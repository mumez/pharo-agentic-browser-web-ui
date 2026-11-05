import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CritReviewLauncher, type CritReviewState, type ReviewTab } from "../critReviewLauncher";

function createTab(): ReviewTab & {
    close: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
} {
    const tab = {
        closed: false,
        location: { href: "about:blank" },
        close: vi.fn(() => {
            tab.closed = true;
        }),
        focus: vi.fn(),
    };
    return tab;
}

// A /crit/start request the server accepted.
const accepted = () => vi.fn(() => Promise.resolve(true));

function deferredRequest() {
    let rejectRequest: (err: unknown) => void = () => {};
    const send = vi.fn(
        () =>
            new Promise<boolean>((_resolve, reject) => {
                rejectRequest = reject;
            })
    );
    return { send, reject: (err: unknown) => rejectRequest(err) };
}

const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

function createLauncher(openTab: () => ReviewTab | null, timeoutMs?: number) {
    const states = new Map<string, CritReviewState>();
    const onStateChange = vi.fn((topicId: string, s: CritReviewState | null) => {
        if (s) states.set(topicId, s);
        else states.delete(topicId);
    });
    const openTabSpy = vi.fn(openTab);
    const launcher = new CritReviewLauncher({
        openTab: openTabSpy,
        onStateChange,
        describeError: (err) => (err as { message: string }).message,
        timeoutMs,
    });
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
        const send = accepted();

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
        const send = accepted();

        launcher.start("t1", send);
        expect(launcher.start("t1", send)).toBe(false);
        expect(openTab).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledTimes(1);
    });

    it("exposes the URL as a link when the popup was blocked", () => {
        const { launcher, states } = createLauncher(() => null);

        launcher.start("t1", accepted());
        launcher.handleStarted("t1", "http://host:9080/");

        expect(states.get("t1")).toEqual({ status: "ready", url: "http://host:9080/" });
    });

    it("exposes the URL as a link when the user closed the blank tab", () => {
        const tab = createTab();
        const { launcher, states } = createLauncher(() => tab);

        launcher.start("t1", accepted());
        tab.closed = true;
        launcher.handleStarted("t1", "http://host:9080/");

        expect(tab.location.href).toBe("about:blank");
        expect(states.get("t1")).toEqual({ status: "ready", url: "http://host:9080/" });
    });

    it("rejects a non-http review URL", () => {
        const tab = createTab();
        const { launcher, states } = createLauncher(() => tab);

        launcher.start("t1", accepted());
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

        launcher.start("t1", accepted());
        launcher.handleFailed("t1", "crit not found");

        expect(tab.close).toHaveBeenCalled();
        expect(states.get("t1")).toEqual({ status: "failed", reason: "crit not found" });
    });

    it("fails the review when the server does not respond in time", () => {
        const tab = createTab();
        const { launcher, states } = createLauncher(() => tab, 1000);

        launcher.start("t1", accepted());
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

        launcher.start("t1", accepted());
        launcher.handleStarted("t1", "http://host:9080/");
        vi.advanceTimersByTime(5000);

        expect(states.get("t1")).toEqual({ status: "ready", url: "http://host:9080/" });
    });

    it("fails the review when the request is rejected", async () => {
        const tab = createTab();
        const { launcher, states } = createLauncher(() => tab);
        const request = deferredRequest();

        launcher.start("t1", request.send);
        request.reject({ failureCode: 10011, message: "Crit review not available: x" });
        await flushPromises();

        expect(tab.close).toHaveBeenCalled();
        expect(states.get("t1")).toEqual({
            status: "failed",
            reason: "Crit review not available: x",
        });
        expect(launcher.isPending("t1")).toBe(false);
    });

    it("fails only the topic whose request was rejected", async () => {
        const tab1 = createTab();
        const tab2 = createTab();
        const tabs = [tab1, tab2];
        const { launcher, states } = createLauncher(() => tabs.shift() ?? null);
        const request1 = deferredRequest();

        launcher.start("t1", request1.send);
        launcher.start("t2", accepted());
        request1.reject({ message: "Topic not found: t1" });
        await flushPromises();

        expect(tab1.close).toHaveBeenCalled();
        expect(tab2.close).not.toHaveBeenCalled();
        expect(states.get("t2")).toEqual({ status: "starting" });
    });

    it("ignores a late rejection after the attempt was replaced", async () => {
        const { launcher, states } = createLauncher(createTab);
        const first = deferredRequest();

        launcher.start("t1", first.send);
        launcher.cancel("t1");
        launcher.start("t1", accepted());
        first.reject({ message: "Crit review not available: x" });
        await flushPromises();

        expect(states.get("t1")).toEqual({ status: "starting" });
        expect(launcher.isPending("t1")).toBe(true);
    });

    it("cancels only the given topic", () => {
        const tab1 = createTab();
        const tab2 = createTab();
        const tabs = [tab1, tab2];
        const { launcher, states } = createLauncher(() => tabs.shift() ?? null);

        launcher.start("t1", accepted());
        launcher.start("t2", accepted());
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

        launcher.start("t1", accepted());
        launcher.start("t2", accepted());
        launcher.cancelAll();

        expect(tab1.close).toHaveBeenCalled();
        expect(tab2.close).toHaveBeenCalled();
        expect(states.size).toBe(0);
    });

    it("shows a link when the review starts after the timeout", () => {
        const tab = createTab();
        const { launcher, states } = createLauncher(() => tab, 1000);

        launcher.start("t1", accepted());
        vi.advanceTimersByTime(1000);
        expect(tab.close).toHaveBeenCalled();

        launcher.handleStarted("t1", "http://host:9080/");
        expect(states.get("t1")).toEqual({ status: "ready", url: "http://host:9080/" });
    });

    it("surfaces a failure that arrives after the review started", () => {
        const tab = createTab();
        const { launcher, states } = createLauncher(() => tab);

        launcher.start("t1", accepted());
        launcher.handleStarted("t1", "http://host:9080/");
        launcher.handleFailed("t1", "crit exited");

        expect(tab.location.href).toBe("http://host:9080/");
        expect(states.get("t1")).toEqual({ status: "failed", reason: "crit exited" });
    });

    it("ignores a cancel for a topic without a pending start", () => {
        const { launcher, onStateChange } = createLauncher(createTab);

        launcher.cancel("t1");

        expect(onStateChange).not.toHaveBeenCalled();
    });

    it("keeps a ready link until dismissed or restarted", () => {
        const { launcher, states } = createLauncher(() => null);

        launcher.start("t1", accepted());
        launcher.handleStarted("t1", "http://host:9080/");
        expect(states.get("t1")).toEqual({ status: "ready", url: "http://host:9080/" });

        launcher.dismiss("t1");
        expect(states.has("t1")).toBe(false);

        launcher.start("t1", accepted());
        launcher.handleStarted("t1", "http://host:9080/");
        launcher.start("t1", accepted());
        expect(states.get("t1")).toEqual({ status: "starting" });
    });

    describe("one review tab per topic", () => {
        const url = "http://host:9080/";

        // A topic whose review is already showing in `tab`.
        function createLauncherWithOpenReview(timeoutMs?: number) {
            const tab = createTab();
            const created = createLauncher(() => tab, timeoutMs);
            created.launcher.start("t1", accepted());
            created.launcher.handleStarted("t1", url);
            created.openTab.mockClear();
            tab.location.href = "http://host:9080/#scrolled";
            return { ...created, tab };
        }

        it("focuses and reloads the open tab instead of opening another", () => {
            const { launcher, states, openTab, tab } = createLauncherWithOpenReview();
            const send = accepted();

            expect(launcher.start("t1", send)).toBe(true);
            expect(openTab).not.toHaveBeenCalled();
            expect(tab.focus).toHaveBeenCalledTimes(1);
            expect(send).toHaveBeenCalledTimes(1);
            expect(states.get("t1")).toEqual({ status: "starting" });

            launcher.handleStarted("t1", url);
            expect(tab.location.href).toBe(url);
            expect(states.has("t1")).toBe(false);
        });

        it("keeps reusing the same tab across repeated reviews", () => {
            const { launcher, openTab } = createLauncherWithOpenReview();

            for (let i = 0; i < 3; i++) {
                launcher.start("t1", accepted());
                launcher.handleStarted("t1", url);
            }

            expect(openTab).not.toHaveBeenCalled();
        });

        it("opens a new tab once the user closed the review tab", () => {
            const { launcher, openTab, tab } = createLauncherWithOpenReview();
            tab.closed = true;

            launcher.start("t1", accepted());

            expect(openTab).toHaveBeenCalledTimes(1);
            expect(tab.focus).not.toHaveBeenCalled();
        });

        it("keeps a separate tab for each topic", () => {
            const tab1 = createTab();
            const tab2 = createTab();
            const tabs = [tab1, tab2];
            const { launcher, openTab } = createLauncher(() => tabs.shift() ?? null);

            launcher.start("t1", accepted());
            launcher.handleStarted("t1", url);
            launcher.start("t2", accepted());
            launcher.handleStarted("t2", "http://host:9081/");

            expect(openTab).toHaveBeenCalledTimes(2);
            expect(tab1.location.href).toBe(url);
            expect(tab2.location.href).toBe("http://host:9081/");
        });

        it("keeps the open tab when a restart fails", () => {
            const { launcher, states, tab } = createLauncherWithOpenReview();

            launcher.start("t1", accepted());
            launcher.handleFailed("t1", "crit exited");

            expect(tab.close).not.toHaveBeenCalled();
            expect(states.get("t1")).toEqual({ status: "failed", reason: "crit exited" });
        });

        it("keeps the open tab when a restart times out, and reuses it for a late result", () => {
            const { launcher, states, tab } = createLauncherWithOpenReview(1000);

            launcher.start("t1", accepted());
            vi.advanceTimersByTime(1000);
            expect(tab.close).not.toHaveBeenCalled();
            expect(states.get("t1")?.status).toBe("failed");

            launcher.handleStarted("t1", url);
            expect(tab.location.href).toBe(url);
            expect(states.has("t1")).toBe(false);
        });

        it("keeps the open tab when a restart is cancelled", () => {
            const { launcher, states, tab } = createLauncherWithOpenReview();

            launcher.start("t1", accepted());
            launcher.cancel("t1");

            expect(tab.close).not.toHaveBeenCalled();
            expect(states.has("t1")).toBe(false);
        });

        it("still reuses the tab after pending starts were cancelled by a reconnect", () => {
            const { launcher, openTab, tab } = createLauncherWithOpenReview();

            launcher.start("t1", accepted());
            launcher.cancelAll();
            launcher.start("t1", accepted());

            expect(openTab).not.toHaveBeenCalled();
            expect(tab.closed).toBe(false);
        });

        it("does not remember a blank tab whose start failed", () => {
            const tab = createTab();
            const { launcher, openTab } = createLauncher(() => tab);

            launcher.start("t1", accepted());
            launcher.handleFailed("t1", "crit not found");
            tab.closed = false;
            launcher.start("t1", accepted());

            expect(openTab).toHaveBeenCalledTimes(2);
        });

        it("falls back to a link and forgets the tab when it refuses navigation", () => {
            const { launcher, states, openTab, tab } = createLauncherWithOpenReview();
            Object.defineProperty(tab, "location", {
                value: {
                    set href(_value: string) {
                        throw new DOMException("not allowed to navigate", "SecurityError");
                    },
                },
            });

            launcher.start("t1", accepted());
            launcher.handleStarted("t1", url);
            expect(states.get("t1")).toEqual({ status: "ready", url });

            launcher.dismiss("t1");
            launcher.start("t1", accepted());
            expect(openTab).toHaveBeenCalledTimes(1);
        });

        it("adopts the tab opened from the fallback link", () => {
            const tab = createTab();
            const results: (ReviewTab | null)[] = [null, tab];
            const { launcher, states, openTab } = createLauncher(() => results.shift() ?? null);
            launcher.start("t1", accepted());
            launcher.handleStarted("t1", url);
            expect(states.get("t1")).toEqual({ status: "ready", url });

            expect(launcher.openReady("t1", url)).toBe(true);
            expect(tab.location.href).toBe(url);
            expect(states.has("t1")).toBe(false);

            launcher.start("t1", accepted());
            expect(openTab).toHaveBeenCalledTimes(2);
            expect(tab.focus).toHaveBeenCalledTimes(1);
        });

        it("leaves the fallback link in place when its tab cannot be opened", () => {
            const { launcher, states } = createLauncher(() => null);
            launcher.start("t1", accepted());
            launcher.handleStarted("t1", url);

            expect(launcher.openReady("t1", url)).toBe(false);
            expect(states.get("t1")).toEqual({ status: "ready", url });
        });
    });
});
