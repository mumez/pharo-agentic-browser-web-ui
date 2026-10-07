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
    // Safety net for failures the client cannot attribute to a topic (e.g. an unexpected
    // error code on the one-way send): give up instead of spinning forever.
    timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;

// Validation errors of the one-way /crit/start send. Ripple delivers them without a
// correlationId, address, or topicId, so the topic has to be inferred.
export const CRIT_START_ERROR_CODES = {
    topicNotFound: 10001, // "Topic not found: <topicId>" — shared with other endpoints
    notAvailable: 10011, // "Crit review not available: <reason>"
    invalidHost: 10012, // "Invalid crit review host: <host>"
} as const;

const TOPIC_NOT_FOUND_PATTERN = /^Topic not found: (.+)$/;

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);

interface PendingReview {
    tab: ReviewTab | null;
    timer: ReturnType<typeof setTimeout>;
}

export class CritReviewLauncher {
    private readonly options: CritReviewLauncherOptions;
    // Insertion order is start order, which latestPendingTopicId relies on.
    private pending = new Map<string, PendingReview>();

    constructor(options: CritReviewLauncherOptions) {
        this.options = options;
    }

    start(topicId: string, send: () => void): boolean {
        if (this.pending.has(topicId)) return false;

        const tab = this.options.openTab();
        const timer = setTimeout(
            () => this.handleFailed(topicId, "Crit review did not respond in time"),
            this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS
        );
        this.pending.set(topicId, { tab, timer });
        this.options.onStateChange(topicId, { status: "starting" });
        try {
            send();
        } catch (err) {
            this.cancel(topicId);
            throw err;
        }
        return true;
    }

    isPending(topicId: string): boolean {
        return this.pending.has(topicId);
    }

    latestPendingTopicId(): string | null {
        let latest: string | null = null;
        for (const topicId of this.pending.keys()) latest = topicId;
        return latest;
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

    // Fails the pending review an error belongs to. Returns false when the error cannot be
    // attributed to a pending review; unexpected codes fall through to the timeout.
    handleSendError(failureCode: number, message: string): boolean {
        let topicId: string | null = null;
        if (failureCode === CRIT_START_ERROR_CODES.topicNotFound) {
            const id = TOPIC_NOT_FOUND_PATTERN.exec(message)?.[1];
            if (id !== undefined && this.pending.has(id)) topicId = id;
        } else if (
            failureCode === CRIT_START_ERROR_CODES.notAvailable ||
            failureCode === CRIT_START_ERROR_CODES.invalidHost
        ) {
            // The server validates sends in order, so the newest start is the likeliest source.
            topicId = this.latestPendingTopicId();
        }
        if (topicId === null) return false;
        this.handleFailed(topicId, message);
        return true;
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
