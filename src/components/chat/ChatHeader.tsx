import { Show } from "solid-js";
import { useAb } from "../../store";
import CritReviewControls from "./CritReviewControls";
import ModelModeSelectors from "./ModelModeSelectors";

interface ChatHeaderProps {
    onBack?: () => void;
    onOpenInfo: () => void;
    isWorking: boolean;
    hasThinkMessages: boolean;
    allThinkCollapsed: boolean;
    onToggleAllThinks: () => void;
}

export default function ChatHeader(props: ChatHeaderProps) {
    const { selectedTopic } = useAb();

    return (
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
                <h2 class="font-bold text-base md:text-lg leading-tight truncate flex items-center gap-1.5">
                    <span class="truncate">{selectedTopic()?.title}</span>
                    <button
                        class="btn btn-ghost btn-xs btn-circle shrink-0"
                        onClick={() => props.onOpenInfo()}
                        aria-label="Topic info"
                        title="Topic info"
                    >
                        <svg
                            aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4 opacity-60"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </button>
                </h2>
                <div class="hidden md:flex items-center gap-1.5 mt-0.5 text-xs opacity-60">
                    <span class="font-mono bg-base-200 px-1 rounded truncate max-w-[150px]">
                        {selectedTopic()?.topicId}
                    </span>
                </div>
            </div>
            {/* Think visibility toggle */}
            <Show when={props.hasThinkMessages}>
                <button
                    class={`btn btn-xs btn-ghost rounded-lg shrink-0 gap-1 ${props.allThinkCollapsed ? "opacity-50" : "opacity-80"}`}
                    onClick={() => props.onToggleAllThinks()}
                    disabled={props.isWorking}
                    title={props.allThinkCollapsed ? "Expand all thinks" : "Collapse all thinks"}
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
                        {props.allThinkCollapsed ? "Show" : "Hide"} thinks
                    </span>
                </button>
            </Show>

            {/* Crit diff review */}
            <CritReviewControls />

            {/* Model / Mode selectors — stacked vertically on both mobile and desktop */}
            <ModelModeSelectors />
        </div>
    );
}
