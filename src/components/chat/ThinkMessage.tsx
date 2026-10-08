import { Show } from "solid-js";
import type { MessageData } from "../../types";
import { getSenderName } from "./messageFormat";

interface ThinkMessageProps {
    message: MessageData;
    isWorking: boolean;
    isExpanded: boolean;
    onToggle: () => void;
}

export default function ThinkMessage(props: ThinkMessageProps) {
    return (
        <div class="bg-base-200/50 rounded-xl border border-base-300/40 my-2 overflow-hidden">
            <button
                class={`w-full text-left text-xs font-semibold py-2 px-4 flex items-center gap-2 opacity-70 select-none transition-opacity hover:opacity-100 ${props.isWorking ? "cursor-default" : "cursor-pointer"}`}
                onClick={() => props.onToggle()}
                disabled={props.isWorking}
            >
                <span>💡</span>
                <span>{getSenderName(props.message.sender)}'s Reasoning</span>
                <Show when={props.isWorking}>
                    <span class="loading loading-dots loading-xs ml-1 text-primary" />
                </Show>
                <Show when={!props.isWorking}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class={`h-3 w-3 ml-auto transition-transform ${props.isExpanded ? "rotate-180" : ""}`}
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
            <Show when={props.isExpanded}>
                <div class="text-xs font-mono whitespace-pre-wrap opacity-80 px-4 pb-3 pt-1 border-t border-base-300/20">
                    {props.message.text}
                </div>
            </Show>
        </div>
    );
}
