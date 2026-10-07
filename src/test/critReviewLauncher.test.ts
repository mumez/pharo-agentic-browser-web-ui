import { describe, expect, it, vi } from "vitest";
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

function createLauncher(tab: ReviewTab | null) {
    const states = new Map<string, CritReviewState>();
    const onStateChange = vi.fn((topicId: string, s: CritReviewState | null) => {
        if (s) states.set(topicId, s);
        else states.delete(topicId);
    });
    const openTab = vi.fn(() => tab);
    const launcher = new CritReviewLauncher({ openTab, onStateChange });
    return { launcher, states, openTab, onStateChange };
}

describe("CritReviewLauncher", () => {
    it("opens a blank tab on start and navigates it when the review starts", () => {
        const tab = createTab();
        const { launcher, states, openTab } = createLauncher(tab);
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
        const { launcher, openTab } = createLauncher(createTab());
        const send = vi.fn();

        launcher.start("t1", send);
        expect(launcher.start("t1", send)).toBe(false);
        expect(openTab).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledTimes(1);
    });

    it("exposes the URL as a link when the popup was blocked", () => {
        const { launcher, states } = createLauncher(null);

        launcher.start("t1", vi.fn());
        launcher.handleStarted("t1", "http://host:9080/");

        expect(states.get("t1")).toEqual({ status: "ready", url: "http://host:9080/" });
    });

    it("exposes the URL as a link when the user closed the blank tab", () => {
        const tab = createTab();
        const { launcher, states } = createLauncher(tab);

        launcher.start("t1", vi.fn());
        tab.closed = true;
        launcher.handleStarted("t1", "http://host:9080/");

        expect(tab.location.href).toBe("about:blank");
        expect(states.get("t1")).toEqual({ status: "ready", url: "http://host:9080/" });
    });

    it("closes the blank tab and clears state when the review fails", () => {
        const tab = createTab();
        const { launcher, states } = createLauncher(tab);

        launcher.start("t1", vi.fn());
        launcher.handleFailed("t1");

        expect(tab.close).toHaveBeenCalled();
        expect(states.has("t1")).toBe(false);
    });

    it("closes the blank tab when sending throws", () => {
        const tab = createTab();
        const { launcher, states } = createLauncher(tab);

        expect(() =>
            launcher.start("t1", () => {
                throw new Error("INVALID_STATE_ERR");
            })
        ).toThrow("INVALID_STATE_ERR");
        expect(tab.close).toHaveBeenCalled();
        expect(states.has("t1")).toBe(false);
    });

    it("cancels every pending review", () => {
        const tab1 = createTab();
        const tab2 = createTab();
        const tabs = [tab1, tab2];
        const states = new Map<string, CritReviewState>();
        const launcher = new CritReviewLauncher({
            openTab: () => tabs.shift() ?? null,
            onStateChange: (topicId: string, s: CritReviewState | null) => {
                if (s) states.set(topicId, s);
                else states.delete(topicId);
            },
        });

        launcher.start("t1", vi.fn());
        launcher.start("t2", vi.fn());
        launcher.cancelAll();

        expect(tab1.close).toHaveBeenCalled();
        expect(tab2.close).toHaveBeenCalled();
        expect(states.size).toBe(0);
    });

    it("ignores results for topics without a pending start", () => {
        const { launcher, onStateChange } = createLauncher(createTab());

        launcher.handleStarted("t1", "http://host:9080/");
        launcher.handleFailed("t1");

        expect(onStateChange).not.toHaveBeenCalled();
    });

    it("clears a ready link on dismiss", () => {
        const { launcher, states } = createLauncher(null);

        launcher.start("t1", vi.fn());
        launcher.handleStarted("t1", "http://host:9080/");
        launcher.dismiss("t1");

        expect(states.has("t1")).toBe(false);
    });
});
