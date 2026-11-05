export interface ReviewTab {
    closed: boolean;
    location: { href: string };
    close: () => void;
    focus: () => void;
}

export type CritReviewState =
    | { status: "starting" }
    | { status: "ready"; url: string }
    | { status: "failed"; reason: string };

interface CritReviewLauncherOptions {
    // Must be called synchronously from the click handler; browsers block window.open
    // once the user gesture is gone, so the tab is opened before the server replies.
    openTab: () => ReviewTab | null;
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

interface PendingReview {
    tab: ReviewTab | null;
    // A reused tab may hold a review the user is working on, so unlike a blank tab opened
    // for this attempt it stays open when the attempt ends without a result.
    reused: boolean;
    timer: ReturnType<typeof setTimeout>;
}

export class CritReviewLauncher {
    private readonly options: CritReviewLauncherOptions;
    private pending = new Map<string, PendingReview>();
    // The tab showing each topic's review. Held only in memory, so a page reload forgets it.
    private reviewTabs = new Map<string, ReviewTab>();

    constructor(options: CritReviewLauncherOptions) {
        this.options = options;
    }

    // `send` issues the /crit/start request; a rejection (validation error, disconnect)
    // fails this attempt. The result itself arrives later via handleStarted/handleFailed.
    start(topicId: string, send: () => Promise<unknown>): boolean {
        if (this.pending.has(topicId)) return false;

        const reusableTab = this.liveReviewTab(topicId);
        reusableTab?.focus();
        const tab = reusableTab ?? this.options.openTab();
        const timer = setTimeout(
            () => this.handleFailed(topicId, "Crit review did not respond in time"),
            this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS
        );
        const entry: PendingReview = { tab, reused: reusableTab !== null, timer };
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
        const tab = this.take(topicId)?.tab ?? this.liveReviewTab(topicId);

        if (!tab || tab.closed || !this.showReview(topicId, tab, url)) {
            // Popup blocked, closed by the user, or already given up on: fall back to a link.
            this.options.onStateChange(topicId, { status: "ready", url });
        }
    }

    // Opens the "ready" fallback link's URL in a tab this launcher tracks. Returns false when
    // no tab could be opened, so the caller can let the link navigate on its own.
    // Must be called synchronously from the click handler, like start.
    openReady(topicId: string, url: string): boolean {
        const tab = this.options.openTab();
        return tab !== null && this.showReview(topicId, tab, url);
    }

    handleFailed(topicId: string, reason: string) {
        this.closeBlankTab(this.take(topicId));
        this.options.onStateChange(topicId, { status: "failed", reason });
    }

    cancel(topicId: string) {
        const entry = this.take(topicId);
        if (!entry) return;
        this.closeBlankTab(entry);
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

    // Returns false when the browser refuses the navigation, leaving the state to the caller.
    private showReview(topicId: string, tab: ReviewTab, url: string): boolean {
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

    private closeBlankTab(entry: PendingReview | undefined) {
        if (entry?.tab && !entry.reused && !entry.tab.closed) entry.tab.close();
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
