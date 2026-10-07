export interface ReviewTab {
    closed: boolean;
    location: { href: string };
    close: () => void;
}

export type CritReviewState = { status: "starting" } | { status: "ready"; url: string };

interface CritReviewLauncherOptions {
    // Must be called synchronously from the click handler; browsers block window.open
    // once the user gesture is gone, so the tab is opened before the server replies.
    openTab: () => ReviewTab | null;
    onStateChange: (topicId: string, state: CritReviewState | null) => void;
}

export class CritReviewLauncher {
    private readonly options: CritReviewLauncherOptions;
    private pendingTabs = new Map<string, ReviewTab | null>();

    constructor(options: CritReviewLauncherOptions) {
        this.options = options;
    }

    start(topicId: string, send: () => void): boolean {
        if (this.pendingTabs.has(topicId)) return false;

        const tab = this.options.openTab();
        this.pendingTabs.set(topicId, tab);
        this.options.onStateChange(topicId, { status: "starting" });
        try {
            send();
        } catch (err) {
            this.handleFailed(topicId);
            throw err;
        }
        return true;
    }

    handleStarted(topicId: string, url: string) {
        if (!this.pendingTabs.has(topicId)) return;
        const tab = this.pendingTabs.get(topicId) ?? null;
        this.pendingTabs.delete(topicId);

        if (tab && !tab.closed) {
            tab.location.href = url;
            this.options.onStateChange(topicId, null);
        } else {
            // Popup blocked or closed by the user: fall back to a link the user can click.
            this.options.onStateChange(topicId, { status: "ready", url });
        }
    }

    handleFailed(topicId: string) {
        if (!this.pendingTabs.has(topicId)) return;
        const tab = this.pendingTabs.get(topicId) ?? null;
        this.pendingTabs.delete(topicId);
        if (tab && !tab.closed) tab.close();
        this.options.onStateChange(topicId, null);
    }

    cancelAll() {
        for (const topicId of [...this.pendingTabs.keys()]) {
            this.handleFailed(topicId);
        }
    }

    dismiss(topicId: string) {
        if (this.pendingTabs.has(topicId)) return;
        this.options.onStateChange(topicId, null);
    }
}
