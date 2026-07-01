import { createEffect, createMemo, createSignal, For, Show, onCleanup } from "solid-js";
import { useAb } from "../store";

export default function ChatConsole(props: { onBack?: () => void }) {
    const { state, selectedTopic, resolveApproval, setModel, setMode } = useAb();
    let messageLogRef: HTMLDivElement | undefined;

    const isWorking = createMemo(() => selectedTopic()?.status === "working");

    const [collapsedThinkIds, setCollapsedThinkIds] = createSignal<Set<string>>(new Set());

    const [submittedApprovals, setSubmittedApprovals] = createSignal<Map<string, string>>(
        new Map()
    );

    const latestApprovalId = createMemo(() => {
        for (let i = state.messages.length - 1; i >= 0; i--) {
            const m = state.messages[i];
            if (
                (m.type === "aiPermission" || m.type === "exportApproval") &&
                m.approvalOption === null
            ) {
                return m.id;
            }
        }
        return null;
    });

    const handleResolveApproval = (messageId: string, optionId: string) => {
        setSubmittedApprovals((prev) => new Map([...prev, [messageId, optionId]]));
        resolveApproval(optionId);
    };

    const thinkMessages = createMemo(() => state.messages.filter((m) => m.type === "think"));
    const hasThinkMessages = createMemo(() => thinkMessages().length > 0);
    const allThinkCollapsed = createMemo(
        () =>
            thinkMessages().length > 0 &&
            thinkMessages().every((m) => collapsedThinkIds().has(m.id))
    );

    const isThinkExpanded = (id: string) => isWorking() || !collapsedThinkIds().has(id);

    const toggleThink = (id: string) => {
        if (isWorking()) return;
        setCollapsedThinkIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAllThinks = () => {
        if (allThinkCollapsed()) {
            setCollapsedThinkIds(new Set<string>());
        } else {
            setCollapsedThinkIds(new Set<string>(thinkMessages().map((m) => m.id)));
        }
    };

    // Scrolling forces a synchronous layout reflow (scrollHeight read + scrollTop write).
    // During heavy AI streaming, messages can arrive faster than one per frame; coalescing
    // via rAF keeps that reflow to at most once per frame instead of once per message, so
    // the main thread isn't monopolized and stays responsive to input (e.g. sidebar clicks).
    let scrollRafId: number | null = null;
    createEffect(() => {
        if (state.messages.length && messageLogRef && scrollRafId === null) {
            scrollRafId = requestAnimationFrame(() => {
                scrollRafId = null;
                if (messageLogRef) {
                    messageLogRef.scrollTop = messageLogRef.scrollHeight;
                }
            });
        }
    });
    onCleanup(() => {
        if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);
    });

    const getSenderName = (sender: string) => {
        switch (sender) {
            case "human":
                return "You";
            case "ai":
                return "Agent";
            default:
                return "System";
        }
    };

    const getSenderAvatar = (sender: string) => {
        switch (sender) {
            case "human":
                return "👤";
            case "ai":
                return "🤖";
            default:
                return "⚙️";
        }
    };

    const formatTime = (isoString: string) => {
        if (!isoString) return "";
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } catch {
            return "";
        }
    };

    return (
        <div class="flex-1 flex flex-col bg-base-100 h-full overflow-hidden">
            <Show
                when={state.selectedTopicId}
                fallback={
                    <div class="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-40 select-none">
                        <div class="w-20 h-20 rounded-3xl bg-base-200 flex items-center justify-center text-4xl mb-4 shadow-inner">
                            💬
                        </div>
                        <h2 class="text-xl font-bold">No Topic Selected</h2>
                        <p class="text-sm max-w-sm mt-1">
                            Select an existing topic from the sidebar or create a new one to start
                            collaborating with the Pharo agent.
                        </p>
                    </div>
                }
            >
                {/* Chat Header */}
                <div class="sticky top-0 z-10 px-3 py-2.5 md:p-4 border-b border-base-300 bg-base-100/90 backdrop-blur-md flex flex-wrap items-center gap-x-2 gap-y-2">
                    {/* Back button — mobile only */}
                    <Show when={props.onBack}>
                        <button
                            class="btn btn-ghost btn-sm btn-circle md:hidden shrink-0"
                            onClick={() => props.onBack?.()}
                            aria-label="Back to topics"
                            title="Back to topics"
                        >
                            <svg
                                aria-hidden="true"
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2.5"
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                        </button>
                    </Show>
                    <div class="min-w-0 flex-1">
                        <h2 class="font-bold text-base md:text-lg leading-tight truncate">
                            {selectedTopic()?.title}
                        </h2>
                        <div class="hidden md:flex items-center gap-1.5 mt-0.5 text-xs opacity-60">
                            <span class="font-mono bg-base-200 px-1 rounded truncate max-w-[150px]">
                                {selectedTopic()?.topicId}
                            </span>
                        </div>
                    </div>
                    {/* Think visibility toggle */}
                    <Show when={hasThinkMessages()}>
                        <button
                            class={`btn btn-xs btn-ghost rounded-lg shrink-0 gap-1 ${allThinkCollapsed() ? "opacity-50" : "opacity-80"}`}
                            onClick={toggleAllThinks}
                            disabled={isWorking()}
                            title={
                                allThinkCollapsed() ? "Expand all thinks" : "Collapse all thinks"
                            }
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                />
                            </svg>
                            <span class="hidden sm:inline">
                                {allThinkCollapsed() ? "Show" : "Hide"} thinks
                            </span>
                        </button>
                    </Show>

                    {/* Model / Mode selectors — stacked vertically on both mobile and desktop */}
                    <div class="flex flex-col items-start md:items-end shrink-0 text-xs w-full md:w-auto gap-1">
                        <Show when={state.modelOptions !== null}>
                            <div class="flex items-center gap-1.5">
                                <span class="opacity-40 font-medium">model:</span>
                                <select
                                    class="select select-xs select-bordered text-xs"
                                    value={state.modelOptions!.currentValue}
                                    onChange={(e) => {
                                        const topicId = state.selectedTopicId;
                                        if (topicId) setModel(topicId, e.currentTarget.value);
                                    }}
                                >
                                    <For each={state.modelOptions!.options}>
                                        {(opt) => <option value={opt.value}>{opt.name}</option>}
                                    </For>
                                </select>
                            </div>
                        </Show>
                        <Show when={state.modeOptions !== null}>
                            <div class="flex items-center gap-1.5">
                                <span class="opacity-40 font-medium">mode:</span>
                                <select
                                    class="select select-xs select-bordered text-xs"
                                    value={state.modeOptions!.currentValue}
                                    onChange={(e) => {
                                        const topicId = state.selectedTopicId;
                                        if (topicId) setMode(topicId, e.currentTarget.value);
                                    }}
                                >
                                    <For each={state.modeOptions!.options}>
                                        {(opt) => <option value={opt.value}>{opt.name}</option>}
                                    </For>
                                </select>
                            </div>
                        </Show>
                        <Show when={state.modeOptions === null && state.modelOptions === null}>
                            <div class="flex items-center gap-1.5">
                                <span class="opacity-40 font-medium">model:</span>
                                <span class="opacity-40">
                                    {selectedTopic()?.currentModel || "none"}
                                </span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <span class="opacity-40 font-medium">mode:</span>
                                <span class="opacity-40">
                                    {selectedTopic()?.currentMode || "auto"}
                                </span>
                            </div>
                        </Show>
                    </div>
                </div>

                {/* Message Log */}
                <div ref={messageLogRef} class="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Goal Display */}
                    <Show when={selectedTopic()?.status === "initial"}>
                        <div class="alert alert-info rounded-2xl shadow-sm text-sm">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                class="stroke-current shrink-0 w-6 h-6"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <div>
                                <h3 class="font-bold">Welcome to this topic!</h3>
                                <div class="text-xs">
                                    Type your goal or first prompt below to activate the agent.
                                </div>
                            </div>
                        </div>
                    </Show>

                    <For each={state.messages}>
                        {(message) => (
                            <div class="space-y-2">
                                {/* 1. System / Normal Message Router */}
                                <Show
                                    when={message.sender !== "system"}
                                    fallback={
                                        <div class="flex justify-center my-2">
                                            <div class="bg-base-200 text-base-content/60 text-xs px-3 py-1 rounded-full font-mono border border-base-300">
                                                {message.text}
                                            </div>
                                        </div>
                                    }
                                >
                                    {/* 2. Think Block Render */}
                                    <Show when={message.type === "think"}>
                                        <div class="bg-base-200/50 rounded-xl border border-base-300/40 my-2 overflow-hidden">
                                            <button
                                                class={`w-full text-left text-xs font-semibold py-2 px-4 flex items-center gap-2 opacity-70 select-none transition-opacity hover:opacity-100 ${isWorking() ? "cursor-default" : "cursor-pointer"}`}
                                                onClick={() => toggleThink(message.id)}
                                                disabled={isWorking()}
                                            >
                                                <span>💡</span>
                                                <span>
                                                    {getSenderName(message.sender)}'s Reasoning
                                                </span>
                                                <Show when={isWorking()}>
                                                    <span class="loading loading-dots loading-xs ml-1 text-primary" />
                                                </Show>
                                                <Show when={!isWorking()}>
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        class={`h-3 w-3 ml-auto transition-transform ${isThinkExpanded(message.id) ? "rotate-180" : ""}`}
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                            stroke-width="2"
                                                            d="M19 9l-7 7-7-7"
                                                        />
                                                    </svg>
                                                </Show>
                                            </button>
                                            <Show when={isThinkExpanded(message.id)}>
                                                <div class="text-xs font-mono whitespace-pre-wrap opacity-80 px-4 pb-3 pt-1 border-t border-base-300/20">
                                                    {message.text}
                                                </div>
                                            </Show>
                                        </div>
                                    </Show>

                                    {/* 3. Approval Block Render */}
                                    <Show
                                        when={
                                            message.type === "aiPermission" ||
                                            message.type === "exportApproval"
                                        }
                                    >
                                        <div class="card bg-warning/10 border border-warning/30 p-4 rounded-2xl my-3 flex flex-col gap-3">
                                            <div class="flex items-center gap-2 text-warning font-semibold text-sm">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    class="h-5 w-5"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                                    />
                                                </svg>
                                                <span>
                                                    {message.type === "exportApproval"
                                                        ? "Package Export Approval Requested"
                                                        : "Agent Permission Requested"}
                                                </span>
                                            </div>
                                            <p class="text-sm font-mono bg-base-100/50 p-2.5 rounded-lg border border-base-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                                                {message.text}
                                            </p>

                                            <div class="flex flex-wrap gap-2 mt-1">
                                                <For each={message.approvalOptions}>
                                                    {(opt) => {
                                                        const isSelected = () =>
                                                            message.approvalOption ===
                                                                opt.optionId ||
                                                            submittedApprovals().get(message.id) ===
                                                                opt.optionId;
                                                        const isResolved =
                                                            message.approvalOption !== null;
                                                        const isActive = () =>
                                                            message.id === latestApprovalId() &&
                                                            !isResolved &&
                                                            !submittedApprovals().has(message.id);
                                                        return (
                                                            <button
                                                                class={`btn btn-sm rounded-lg transition-all ${
                                                                    isSelected()
                                                                        ? "btn-success text-success-content hover:btn-success"
                                                                        : isActive()
                                                                          ? "btn-warning hover:bg-warning/80"
                                                                          : "btn-ghost btn-disabled opacity-40"
                                                                }`}
                                                                disabled={!isActive()}
                                                                onClick={() =>
                                                                    handleResolveApproval(
                                                                        message.id,
                                                                        opt.optionId
                                                                    )
                                                                }
                                                            >
                                                                {opt.label}
                                                                {isSelected() && " ✓"}
                                                            </button>
                                                        );
                                                    }}
                                                </For>
                                            </div>
                                        </div>
                                    </Show>

                                    {/* 4. Normal Chat Message Render */}
                                    <Show when={message.type === "normal"}>
                                        <div
                                            class={`chat ${
                                                message.sender === "human"
                                                    ? "chat-end"
                                                    : "chat-start"
                                            }`}
                                        >
                                            <div class="chat-image avatar">
                                                <div class="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-sm shadow-sm select-none">
                                                    {getSenderAvatar(message.sender)}
                                                </div>
                                            </div>
                                            <div class="chat-header opacity-50 text-xs ml-1 mr-1">
                                                {getSenderName(message.sender)}
                                            </div>
                                            <div
                                                class={`chat-bubble rounded-2xl shadow-sm text-sm whitespace-pre-wrap ${
                                                    message.sender === "human"
                                                        ? "chat-bubble-primary text-primary-content"
                                                        : "chat-bubble-neutral text-neutral-content"
                                                }`}
                                            >
                                                {message.text}
                                            </div>
                                            <div class="chat-footer opacity-40 text-[10px] mt-1 select-none">
                                                {formatTime(message.lastUpdated)}
                                            </div>
                                        </div>
                                    </Show>
                                </Show>
                            </div>
                        )}
                    </For>
                </div>
            </Show>
        </div>
    );
}
