import { createMemo, For } from "solid-js";
import { useAb } from "../../store";
import { agentDisplayName } from "../../utils";

interface TopicInfoModalProps {
    onClose: () => void;
}

export default function TopicInfoModal(props: TopicInfoModalProps) {
    const { state, selectedTopic } = useAb();

    const topicInfoItems = createMemo(() => {
        const topic = selectedTopic();
        if (!topic) return [];
        return [
            { label: "Topic ID", value: topic.topicId },
            { label: "Title", value: topic.title },
            { label: "Agent", value: agentDisplayName(topic.agentArguments, state.agents) },
            { label: "Last Updated", value: topic.lastUpdated },
            { label: "Working Directory Path", value: topic.workingDirectoryPath || "(none)" },
        ];
    });

    return (
        <div class="modal modal-open" onClick={() => props.onClose()}>
            <div
                class="modal-box max-w-sm rounded-2xl bg-base-100 shadow-2xl p-0 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div class="p-5 border-b border-base-200">
                    <h3 class="font-bold text-lg">Topic Info</h3>
                </div>
                <div class="p-5 space-y-3">
                    <For each={topicInfoItems()}>
                        {(item) => (
                            <div>
                                <div class="text-xs opacity-60">{item.label}</div>
                                <div class="text-sm font-mono break-all">{item.value}</div>
                            </div>
                        )}
                    </For>
                </div>
                <div class="p-3 border-t border-base-200 flex justify-end">
                    <button class="btn btn-ghost btn-sm" onClick={() => props.onClose()}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
