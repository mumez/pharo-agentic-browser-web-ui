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
    // Must be called synchronously from the click handler; browsers block window.open
    // once the user gesture is gone, so the tab is opened before the server replies.
    openTab: () => ReviewTab | null;
    onStateChange: (topicId: string, state: CritReviewState | null) => void;
    // Turns a rejected /crit/start request into the reason shown to the user.
    describeError: (err: unknown) => string;
    // Safety net when neither critReviewStarted nor critReviewFailed arrives after the
    // request was accepted: give up instead of spinning forever.
    timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);

interface PendingReview {
    tab: ReviewTab | null;
    timer: ReturnType<typeof setTimeout>;
}

export class CritReviewLauncher {
    private readonly options: CritReviewLauncherOptions;
    private pending = new Map<string, PendingReview>();

    constructor(options: CritReviewLauncherOptions) {
        this.options = options;
    }

    // `send` issues the /crit/start request; a rejection (validation error, disconnect)
    // fails this attempt. The result itself arrives later via handleStarted/handleFailed.
    start(topicId: string, send: () => Promise<unknown>): boolean {
        if (this.pending.has(topicId)) return false;

        const tab = this.options.openTab();
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

    handleStarted(topicId: string, url: string) {
        if (!isHttpUrl(url)) {
            this.handleFailed(topicId, `Invalid review URL: ${url}`);
            return;
        }
        const tab = this.take(topicId);
        if (tab === undefined) return;

        if (tab && !tab.closed) {
            tab.location.href = url;
            this.options.onStateChange(topicId, null);
        } else {
            // Popup blocked or closed by the user: fall back to a link the user can click.
            this.options.onStateChange(topicId, { status: "ready", url });
        }
    }

    handleFailed(topicId: string, reason: string) {
        const tab = this.take(topicId);
        if (tab === undefined) return;
        if (tab && !tab.closed) tab.close();
        this.options.onStateChange(topicId, { status: "failed", reason });
    }

    cancel(topicId: string) {
        const tab = this.take(topicId);
        if (tab === undefined) return;
        if (tab && !tab.closed) tab.close();
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

    // Removes the pending entry; returns undefined when the topic has no pending start.
    private take(topicId: string): ReviewTab | null | undefined {
        const entry = this.pending.get(topicId);
        if (!entry) return undefined;
        clearTimeout(entry.timer);
        this.pending.delete(topicId);
        return entry.tab;
    }
}
