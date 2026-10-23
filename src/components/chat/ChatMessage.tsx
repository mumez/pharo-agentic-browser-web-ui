import type { MessageData } from "../../types";
import { formatTime, getSenderAvatar, getSenderName } from "./messageFormat";

export default function ChatMessage(props: { message: MessageData }) {
    return (
        <div class={`chat ${props.message.sender === "human" ? "chat-end" : "chat-start"}`}>
            <div class="chat-image avatar">
                <div class="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-sm shadow-sm select-none">
                    {getSenderAvatar(props.message.sender)}
                </div>
            </div>
            <div class="chat-header opacity-50 text-xs ml-1 mr-1">
                {getSenderName(props.message.sender)}
            </div>
            <div
                class={`chat-bubble rounded-2xl shadow-sm text-sm whitespace-pre-wrap ${
                    props.message.sender === "human"
                        ? "chat-bubble-primary text-primary-content"
                        : "chat-bubble-neutral text-neutral-content"
                }`}
            >
                {props.message.text}
            </div>
            <div class="chat-footer opacity-40 text-[10px] mt-1 select-none">
                {formatTime(props.message.lastUpdated)}
            </div>
        </div>
    );
}
