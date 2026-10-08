import type { MessageData } from "../../types";

export default function SystemMessage(props: { message: MessageData }) {
    return (
        <div class="flex justify-center my-2">
            <div class="bg-base-200 text-base-content/60 text-xs px-3 py-1 rounded-full font-mono border border-base-300">
                {props.message.text}
            </div>
        </div>
    );
}
