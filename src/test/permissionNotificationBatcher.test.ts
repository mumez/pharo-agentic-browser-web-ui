import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    PermissionNotificationBatcher,
    type BrowserNotificationApi,
} from "../permissionNotificationBatcher";

class MockNotification {
    public onclick: ((this: Notification, ev: Event) => unknown) | null = null;
    static created: Array<{ title: string; options?: NotificationOptions }> = [];
    static instances: MockNotification[] = [];

    constructor(title: string, options?: NotificationOptions) {
        MockNotification.created.push({ title, options });
        MockNotification.instances.push(this);
    }
}

function createNotificationApi(
    permission: NotificationPermission = "granted",
    requestPermissionResult: NotificationPermission = "granted"
) {
    return {
        permission,
        createNotification: (title: string, options?: NotificationOptions) =>
            new MockNotification(title, options),
        requestPermission: vi.fn(async () => requestPermissionResult),
    } satisfies BrowserNotificationApi;
}

describe("PermissionNotificationBatcher", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        MockNotification.created = [];
        MockNotification.instances = [];
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("batches multiple permission requests into one notification", async () => {
        const onActivate = vi.fn();
        const batcher = new PermissionNotificationBatcher({
            aggregationWindowMs: 3000,
            isDocumentHidden: () => true,
            notificationApi: createNotificationApi("granted"),
            getTopicTitle: (topicId) => ({ t1: "Topic One", t2: "Topic Two" })[topicId] ?? topicId,
            onActivate,
        });

        batcher.queuePermissionRequest("t1");
        batcher.queuePermissionRequest("t2");
        await vi.runAllTimersAsync();

        expect(MockNotification.created).toHaveLength(1);
        expect(MockNotification.created[0].title).toContain("2");
        expect(MockNotification.created[0].options?.body).toContain("Topic One");
        expect(MockNotification.created[0].options?.body).toContain("Topic Two");
        expect(onActivate).not.toHaveBeenCalled();
    });

    it("does not notify when document is visible", async () => {
        const batcher = new PermissionNotificationBatcher({
            aggregationWindowMs: 3000,
            isDocumentHidden: () => false,
            notificationApi: createNotificationApi("granted"),
            getTopicTitle: (topicId) => topicId,
            onActivate: vi.fn(),
        });

        batcher.queuePermissionRequest("t1");
        await vi.runAllTimersAsync();

        expect(MockNotification.created).toHaveLength(0);
    });

    it("does not notify when tab returns to foreground before flush", async () => {
        let hidden = true;
        const batcher = new PermissionNotificationBatcher({
            aggregationWindowMs: 3000,
            isDocumentHidden: () => hidden,
            notificationApi: createNotificationApi("granted"),
            getTopicTitle: (topicId) => topicId,
            onActivate: vi.fn(),
        });

        batcher.queuePermissionRequest("t1");
        hidden = false;
        await vi.runAllTimersAsync();

        expect(MockNotification.created).toHaveLength(0);
    });

    it("requests permission when needed before showing notification", async () => {
        const notificationApi = createNotificationApi("default", "granted");
        const batcher = new PermissionNotificationBatcher({
            aggregationWindowMs: 3000,
            isDocumentHidden: () => true,
            notificationApi,
            getTopicTitle: (topicId) => topicId,
            onActivate: vi.fn(),
        });

        batcher.queuePermissionRequest("t1");
        await vi.runAllTimersAsync();

        expect(notificationApi.requestPermission).toHaveBeenCalledTimes(1);
        expect(MockNotification.created).toHaveLength(1);
    });

    it("clicking notification triggers window activation callback", async () => {
        const onActivate = vi.fn();
        const batcher = new PermissionNotificationBatcher({
            aggregationWindowMs: 3000,
            isDocumentHidden: () => true,
            notificationApi: createNotificationApi("granted"),
            getTopicTitle: (topicId) => topicId,
            onActivate,
        });

        batcher.queuePermissionRequest("t1");
        await vi.runAllTimersAsync();

        const instance = MockNotification.instances[0];
        expect(instance).toBeDefined();
        instance.onclick?.call(instance as unknown as Notification, new Event("click"));
        expect(onActivate).toHaveBeenCalledTimes(1);
    });
});
