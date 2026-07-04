export interface BrowserNotificationInstance {
    onclick: ((this: Notification, ev: Event) => unknown) | null;
}

export interface BrowserNotificationApi {
    permission: NotificationPermission;
    requestPermission?: () => Promise<NotificationPermission>;
    createNotification: (title: string, options?: NotificationOptions) => BrowserNotificationInstance;
}

interface PermissionNotificationBatcherOptions {
    aggregationWindowMs: number;
    isDocumentHidden: () => boolean;
    notificationApi: BrowserNotificationApi | null;
    getTopicTitle: (topicId: string) => string;
    onActivate: () => void;
}

const DEFAULT_AGGREGATION_WINDOW_MS = 3000;

export class PermissionNotificationBatcher {
    private readonly options: PermissionNotificationBatcherOptions;
    private pendingTopicIds = new Set<string>();
    private pendingRequestCount = 0;
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private currentPermission: NotificationPermission;

    constructor(options: PermissionNotificationBatcherOptions) {
        this.options = {
            ...options,
            aggregationWindowMs: options.aggregationWindowMs || DEFAULT_AGGREGATION_WINDOW_MS,
        };
        this.currentPermission = options.notificationApi?.permission ?? "denied";
    }

    queuePermissionRequest(topicId: string) {
        if (!this.options.isDocumentHidden()) return;
        if (!this.options.notificationApi) return;

        this.pendingRequestCount += 1;
        this.pendingTopicIds.add(topicId);

        if (this.flushTimer !== null) return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            void this.flushPendingNotification();
        }, this.options.aggregationWindowMs);
    }

    dispose() {
        if (this.flushTimer !== null) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        this.pendingTopicIds.clear();
        this.pendingRequestCount = 0;
    }

    private async flushPendingNotification() {
        const topicIds = [...this.pendingTopicIds];
        const requestCount = this.pendingRequestCount;
        this.pendingTopicIds.clear();
        this.pendingRequestCount = 0;

        if (topicIds.length === 0 || requestCount === 0) return;
        if (!this.options.isDocumentHidden()) return;

        const permission = await this.ensurePermission();
        if (permission !== "granted") return;

        const topicTitles = topicIds.map((topicId) => this.options.getTopicTitle(topicId));
        const topicCount = topicTitles.length;
        const title =
            requestCount === 1
                ? "Agent permission request"
                : `${requestCount} agent permission requests`;
        const body =
            topicCount === 1
                ? `${topicTitles[0]} needs your approval.`
                : `${topicTitles.join(", ")} need your approval.`;

        const notification = this.options.notificationApi?.createNotification(title, {
            body,
            tag: "agent-permission-request",
        });
        if (!notification) return;

        notification.onclick = () => {
            this.options.onActivate();
        };
    }

    private async ensurePermission(): Promise<NotificationPermission> {
        if (!this.options.notificationApi) return "denied";

        if (this.currentPermission === "granted" || this.currentPermission === "denied") {
            return this.currentPermission;
        }

        if (!this.options.notificationApi.requestPermission) {
            return this.currentPermission;
        }

        try {
            this.currentPermission = await this.options.notificationApi.requestPermission();
            return this.currentPermission;
        } catch {
            return "denied";
        }
    }
}

export function createBrowserNotificationApi(): BrowserNotificationApi | null {
    if (typeof window === "undefined" || !("Notification" in window)) {
        return null;
    }

    return {
        permission: window.Notification.permission,
        requestPermission: () => window.Notification.requestPermission(),
        createNotification: (title, options) => new window.Notification(title, options),
    };
}
