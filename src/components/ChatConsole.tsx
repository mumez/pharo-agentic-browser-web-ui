import {
    createEffect,
    createMemo,
    createSignal,
    For,
    Match,
    Show,
    Switch,
    onCleanup,
} from "solid-js";
import { useAb } from "../store";
import ApprovalMessage from "./chat/ApprovalMessage";
import ChatHeader from "./chat/ChatHeader";
import ChatMessage from "./chat/ChatMessage";
import CritReviewControls from "./chat/CritReviewControls";
import ModelModeSelectors from "./chat/ModelModeSelectors";
import SystemMessage from "./chat/SystemMessage";
import ThinkMessage from "./chat/ThinkMessage";
import TopicInfoModal from "./chat/TopicInfoModal";

export default function ChatConsole(props: { onBack?: () => void }) {
    const { state, selectedTopic, resolveApproval } = useAb();
    let messageLogRef: HTMLDivElement | undefined;

    const isWorking = createMemo(() => selectedTopic()?.status === "working");

    const [isInfoModalOpen, setIsInfoModalOpen] = createSignal(false);

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
                <ChatHeader
                    title={selectedTopic()?.title}
                    topicId={selectedTopic()?.topicId}
                    onBack={props.onBack}
                    onOpenInfo={() => setIsInfoModalOpen(true)}
                    isWorking={isWorking()}
                    hasThinkMessages={hasThinkMessages()}
                    allThinkCollapsed={allThinkCollapsed()}
                    onToggleAllThinks={toggleAllThinks}
                >
                    {/* Crit diff review */}
                    <CritReviewControls />

                    {/* Model / Mode selectors — stacked vertically on both mobile and desktop */}
                    <ModelModeSelectors />
                </ChatHeader>

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
                                <Switch>
                                    <Match when={message.sender === "system"}>
                                        <SystemMessage message={message} />
                                    </Match>
                                    <Match when={message.type === "think"}>
                                        <ThinkMessage
                                            message={message}
                                            isWorking={isWorking()}
                                            isExpanded={isThinkExpanded(message.id)}
                                            onToggle={() => toggleThink(message.id)}
                                        />
                                    </Match>
                                    <Match
                                        when={
                                            message.type === "aiPermission" ||
                                            message.type === "exportApproval"
                                        }
                                    >
                                        <ApprovalMessage
                                            message={message}
                                            isActive={
                                                message.id === latestApprovalId() &&
                                                !submittedApprovals().has(message.id)
                                            }
                                            submittedOptionId={submittedApprovals().get(message.id)}
                                            onResolve={(optionId) =>
                                                handleResolveApproval(message.id, optionId)
                                            }
                                        />
                                    </Match>
                                    <Match when={message.type === "normal"}>
                                        <ChatMessage message={message} />
                                    </Match>
                                </Switch>
                            </div>
                        )}
                    </For>
                </div>

                <Show when={isInfoModalOpen()}>
                    <TopicInfoModal onClose={() => setIsInfoModalOpen(false)} />
                </Show>
            </Show>
        </div>
    );
}
