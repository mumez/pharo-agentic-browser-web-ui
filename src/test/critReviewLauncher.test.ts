import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CritReviewLauncher, type CritReviewState, type ReviewTab } from "../critReviewLauncher";

function createTab(): ReviewTab & { close: ReturnType<typeof vi.fn> } {
    const tab = {
        closed: false,
        location: { href: "about:blank" },
        close: vi.fn(() => {
            tab.closed = true;
        }),
    };
    return tab;
}

function createLauncher(openTab: () => ReviewTab | null, timeoutMs?: number) {
    const states = new Map<string, CritReviewState>();
    const onStateChange = vi.fn((topicId: string, s: CritReviewState | null) => {
        if (s) states.set(topicId, s);
        else states.delete(topicId);
    });
    const openTabSpy = vi.fn(openTab);
    const launcher = new CritReviewLauncher({ openTab: openTabSpy, onStateChange, timeoutMs });
    return { launcher, states, openTab: openTabSpy, onStateChange };
}

describe("CritReviewLauncher", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("opens a blank tab on start and navigates it when the review starts", () => {
        const tab = createTab();
        const { launcher, states, openTab } = createLauncher(() => tab);
        const send = vi.fn();

        expect(launcher.start("t1", send)).toBe(true);
        expect(openTab).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledTimes(1);
        expect(states.get("t1")).toEqual({ status: "starting" });

        launcher.handleStarted("t1", "http://host:9080/");
        expect(tab.location.href).toBe("http://host:9080/");
        expect(states.has("t1")).toBe(false);
    });

    it("ignores a second start while the first is pending", () => {
        const { launcher, openTab } = createLauncher(createTab);
        const send = vi.fn();

        launcher.start("t1", send);
        expect(launcher.start("t1", send)).toBe(false);
        expect(openTab).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledTimes(1);
    });

    it("exposes the URL as a link when the popup was blocked", () => {
        const { launcher, states } = createLauncher(() => null);

        launcher.start("t1", vi.fn());
        launcher.handleStarted("t1", "http://host:9080/");

        expect(states.get("t1")).toEqual({ status: "ready", url: "http://host:9080/" });
    });

    it("exposes the URL as a link when the user closed the blank tab", () => {
        const tab = createTab();
        const { launcher, states } = createLauncher(() => tab);

        launcher.start("t1", vi.fn());
        tab.closed = true;
        launcher.handleStarted("t1", "http://host:9080/");

        expect(tab.location.href).toBe("about:blank");
        expect(states.get("t1")).toEqual({ status: "ready", url: "http://host:9080/" });
    });

    it("rejects a non-http review URL", () => {
        const tab = createTab();
        const { launcher, states } = createLauncher(() => tab);

        launcher.start("t1", vi.fn());
        launcher.handleStarted("t1", "javascript:alert(1)");

        expect(tab.location.href).toBe("about:blank");
        expect(tab.close).toHaveBeenCalled();
        expect(states.get("t1")).toEqual({
            status: "failed",
            reason: "Invalid review URL: javascript:alert(1)",
        });
    });

    it("closes the blank tab and records the reason when the review fails", () => {
        const tab = createTab();
        const { launcher, states } = createLauncher(() => tab);

        launcher.start("t1", vi.fn());
        launcher.handleFailed("t1", "crit not found");

        expect(tab.close).toHaveBeenCalled();
        expect(states.get("t1")).toEqual({ status: "failed", reason: "crit not found" });
    });

    it("fails the review when the server does not respond in time", () => {
        const tab = createTab();
        const { launcher, states } = createLauncher(() => tab, 1000);

        launcher.start("t1", vi.fn());
        vi.advanceTimersByTime(999);
        expect(states.get("t1")).toEqual({ status: "starting" });

        vi.advanceTimersByTime(1);
        expect(tab.close).toHaveBeenCalled();
        expect(states.get("t1")).toEqual({
            status: "failed",
            reason: "Crit review did not respond in time",
        });
        expect(launcher.isPending("t1")).toBe(false);
    });

    it("does not time out after the review has started", () => {
        const { launcher, states } = createLauncher(() => null, 1000);

        launcher.start("t1", vi.fn());
        launcher.handleStarted("t1", "http://host:9080/");
        vi.advanceTimersByTime(5000);

        expect(states.get("t1")).toEqual({ status: "ready", url: "http://host:9080/" });
    });

    it("closes the blank tab when sending throws", () => {
        const tab = createTab();
        const { launcher, states } = createLauncher(() => tab);

        expect(() =>
            launcher.start("t1", () => {
                throw new Error("INVALID_STATE_ERR");
            })
        ).toThrow("INVALID_STATE_ERR");
        expect(tab.close).toHaveBeenCalled();
        expect(states.has("t1")).toBe(false);
        expect(launcher.isPending("t1")).toBe(false);
    });

    it("cancels only the given topic", () => {
        const tab1 = createTab();
        const tab2 = createTab();
        const tabs = [tab1, tab2];
        const { launcher, states } = createLauncher(() => tabs.shift() ?? null);

        launcher.start("t1", vi.fn());
        launcher.start("t2", vi.fn());
        launcher.cancel("t1");

        expect(tab1.close).toHaveBeenCalled();
        expect(tab2.close).not.toHaveBeenCalled();
        expect(states.has("t1")).toBe(false);
        expect(states.get("t2")).toEqual({ status: "starting" });
    });

    it("cancels every pending review", () => {
        const tab1 = createTab();
        const tab2 = createTab();
        const tabs = [tab1, tab2];
        const { launcher, states } = createLauncher(() => tabs.shift() ?? null);

        launcher.start("t1", vi.fn());
        launcher.start("t2", vi.fn());
        launcher.cancelAll();

        expect(tab1.close).toHaveBeenCalled();
        expect(tab2.close).toHaveBeenCalled();
        expect(states.size).toBe(0);
    });

    it("reports the most recently started pending topic", () => {
        const { launcher } = createLauncher(() => null);

        expect(launcher.latestPendingTopicId()).toBeNull();
        launcher.start("t1", vi.fn());
        launcher.start("t2", vi.fn());
        expect(launcher.latestPendingTopicId()).toBe("t2");

        launcher.cancel("t2");
        expect(launcher.latestPendingTopicId()).toBe("t1");
    });

    it("attributes a topic-not-found error to the named pending topic", () => {
        const tab1 = createTab();
        const tab2 = createTab();
        const tabs = [tab1, tab2];
        const { launcher, states } = createLauncher(() => tabs.shift() ?? null);

        launcher.start("t1", vi.fn());
        launcher.start("t2", vi.fn());

        expect(launcher.handleSendError(10001, "Topic not found: t1")).toBe(true);
        expect(tab1.close).toHaveBeenCalled();
        expect(tab2.close).not.toHaveBeenCalled();
        expect(states.get("t1")).toEqual({ status: "failed", reason: "Topic not found: t1" });
        expect(states.get("t2")).toEqual({ status: "starting" });
    });

    it("does not claim a topic-not-found error for a topic without a pending start", () => {
        const { launcher, states } = createLauncher(createTab);

        launcher.start("t1", vi.fn());

        expect(launcher.handleSendError(10001, "Topic not found: other")).toBe(false);
        expect(states.get("t1")).toEqual({ status: "starting" });
    });

    it("attributes crit-specific errors to the most recent pending start", () => {
        const tab1 = createTab();
        const tab2 = createTab();
        const tabs = [tab1, tab2];
        const { launcher, states } = createLauncher(() => tabs.shift() ?? null);

        launcher.start("t1", vi.fn());
        launcher.start("t2", vi.fn());

        const message = "Crit review not available: useCrit is false";
        expect(launcher.handleSendError(10011, message)).toBe(true);
        expect(tab2.close).toHaveBeenCalled();
        expect(tab1.close).not.toHaveBeenCalled();
        expect(states.get("t2")).toEqual({ status: "failed", reason: message });

        expect(launcher.handleSendError(10012, "Invalid crit review host: a b")).toBe(true);
        expect(states.get("t1")).toEqual({
            status: "failed",
            reason: "Invalid crit review host: a b",
        });
    });

    it("leaves unrelated errors to the caller", () => {
        const { launcher, states } = createLauncher(createTab);

        expect(launcher.handleSendError(10011, "Crit review not available: x")).toBe(false);

        launcher.start("t1", vi.fn());
        expect(launcher.handleSendError(10007, "No model config")).toBe(false);
        expect(states.get("t1")).toEqual({ status: "starting" });
    });

    it("ignores results for topics without a pending start", () => {
        const { launcher, onStateChange } = createLauncher(createTab);

        launcher.handleStarted("t1", "http://host:9080/");
        launcher.handleFailed("t1", "crit not found");
        launcher.cancel("t1");

        expect(onStateChange).not.toHaveBeenCalled();
    });

    it("keeps a ready link until dismissed or restarted", () => {
        const { launcher, states } = createLauncher(() => null);

        launcher.start("t1", vi.fn());
        launcher.handleStarted("t1", "http://host:9080/");
        expect(states.get("t1")).toEqual({ status: "ready", url: "http://host:9080/" });

        launcher.dismiss("t1");
        expect(states.has("t1")).toBe(false);

        launcher.start("t1", vi.fn());
        launcher.handleStarted("t1", "http://host:9080/");
        launcher.start("t1", vi.fn());
        expect(states.get("t1")).toEqual({ status: "starting" });
    });
});
