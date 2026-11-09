export interface ReviewTab {
    closed: boolean;
    location: { href: string };
    close: () => void;
}

export type CritReviewState =
    | { status: "starting" }
    | { status: "ready"; url: string }
    | { status: "failed"; reason: string };

interface CritReviewLauncherOptions {
    // Opens `url`, or a blank placeholder when it is empty, in the tab named `target`; the
    // browser reuses a tab of that name when one is still open. Must be called synchronously
    // from the click handler: browsers block window.open once the user gesture is gone, so
    // the tab is opened before the server replies.
    openTab: (url: string, target: string) => ReviewTab | null;
    onStateChange: (topicId: string, state: CritReviewState | null) => void;
    // Turns a rejected /crit/start request into the reason shown to the user.
    describeError: (err: unknown) => string;
    // Safety net when neither critReviewStarted nor critReviewFailed arrives: give up
    // instead of spinning forever. The server bounds crit startup to about 10 seconds, and
    // a result that still arrives later is shown anyway (see handleStarted/handleFailed).
    timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);

// The window name of a topic's review tab, so every review of the topic lands in one tab.
export const reviewTabTarget = (topicId: string) => `crit-review-${topicId}`;

interface PendingReview {
    tab: ReviewTab | null;
    timer: ReturnType<typeof setTimeout>;
}

export class CritReviewLauncher {
    private readonly options: CritReviewLauncherOptions;
    private pending = new Map<string, PendingReview>();
    // The URL of each topic's started review. The server never stops crit, so later reviews
    // reopen this URL instead of asking /crit/start again. Held only in memory, so a page
    // reload forgets it and the next review starts crit through the server once more.
    private reviewUrls = new Map<string, string>();
    // The tab showing each topic's review, also forgotten on a page reload.
    private reviewTabs = new Map<string, ReviewTab>();

    constructor(options: CritReviewLauncherOptions) {
        this.options = options;
    }

    // `send` issues the /crit/start request; a rejection (validation error, disconnect)
    // fails this attempt. The result itself arrives later via handleStarted/handleFailed.
    // A topic whose review already started just reopens its review tab without `send`.
    start(topicId: string, send: () => Promise<unknown>): boolean {
        if (this.pending.has(topicId)) return false;

        const url = this.reviewUrls.get(topicId);
        if (url !== undefined) {
            this.reopenReview(topicId, url);
            return true;
        }

        const tab = this.options.openTab("", reviewTabTarget(topicId));
        const timer = setTimeout(
            () => this.handleFailed(topicId, "Crit review did not respond in time"),
            this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS
        );
        const entry: PendingReview = { tab, timer };
        this.pending.set(topicId, entry);
        this.options.onStateChange(topicId, { status: "starting" });
        send().catch((err: unknown) => {
            // Ignore a late rejection once this attempt has ended or been replaced.
            if (this.pending.get(topicId) !== entry) return;
            this.handleFailed(topicId, this.options.describeError(err));
        });
        return true;
    }

    isPending(topicId: string): boolean {
        return this.pending.has(topicId);
    }

    // Results also count when no start is pending (e.g. after the timeout): they are only
    // pushed to the requesting connection, so they always belong to this client's attempt.
    handleStarted(topicId: string, url: string) {
        if (!isHttpUrl(url)) {
            this.handleFailed(topicId, `Invalid review URL: ${url}`);
            return;
        }
        this.reviewUrls.set(topicId, url);
        const tab = this.take(topicId)?.tab ?? this.liveReviewTab(topicId);

        if (!tab || tab.closed || !this.tryNavigate(topicId, tab, url)) {
            // Popup blocked, closed by the user, or already given up on: fall back to a link.
            this.options.onStateChange(topicId, { status: "ready", url });
        }
    }

    // Opens the "ready" fallback link's URL in the topic's review tab. Returns false when
    // no tab could be opened, so the caller can let the link navigate on its own.
    // Must be called synchronously from the click handler, like start.
    openReady(topicId: string, url: string): boolean {
        if (!isHttpUrl(url)) return false;
        this.reviewUrls.set(topicId, url);
        return this.reopenReview(topicId, url);
    }

    handleFailed(topicId: string, reason: string) {
        const tab = this.take(topicId)?.tab;
        if (tab && !tab.closed) tab.close();
        this.reviewUrls.delete(topicId);
        this.options.onStateChange(topicId, { status: "failed", reason });
    }

    cancel(topicId: string) {
        const entry = this.take(topicId);
        if (!entry) return;
        if (entry.tab && !entry.tab.closed) entry.tab.close();
        this.options.onStateChange(topicId, null);
    }

    cancelAll() {
        for (const topicId of [...this.pending.keys()]) {
            this.cancel(topicId);
        }
    }

    dismiss(topicId: string) {
        if (this.pending.has(topicId)) return;
        this.options.onStateChange(topicId, null);
    }

    // Shows the review in a fresh tab of the topic's name, closing the old one first: the
    // reload brings the review up to date, and unlike focus() on an existing tab, which
    // browsers ignore, a newly opened tab comes to the front.
    private reopenReview(topicId: string, url: string): boolean {
        this.liveReviewTab(topicId)?.close();
        this.reviewTabs.delete(topicId);
        const tab = this.options.openTab(url, reviewTabTarget(topicId));
        if (!tab) {
            this.options.onStateChange(topicId, { status: "ready", url });
            return false;
        }
        this.reviewTabs.set(topicId, tab);
        this.options.onStateChange(topicId, null);
        return true;
    }

    // Returns false when the browser refuses the navigation, leaving the state to the caller.
    private tryNavigate(topicId: string, tab: ReviewTab, url: string): boolean {
        try {
            tab.location.href = url;
        } catch {
            this.reviewTabs.delete(topicId);
            return false;
        }
        this.reviewTabs.set(topicId, tab);
        this.options.onStateChange(topicId, null);
        return true;
    }

    private liveReviewTab(topicId: string): ReviewTab | null {
        const tab = this.reviewTabs.get(topicId);
        if (!tab) return null;
        if (tab.closed) {
            this.reviewTabs.delete(topicId);
            return null;
        }
        return tab;
    }

    // Removes the pending entry; returns undefined when the topic has no pending start.
    private take(topicId: string): PendingReview | undefined {
        const entry = this.pending.get(topicId);
        if (!entry) return undefined;
        clearTimeout(entry.timer);
        this.pending.delete(topicId);
        return entry;
    }
}
