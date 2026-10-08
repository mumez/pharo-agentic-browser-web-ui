import { For, Show } from "solid-js";
import { useAb } from "../../store";
import type { ConfigOptionData } from "../../types";

interface SelectorDescriptor {
    label: string;
    options: () => ConfigOptionData | null;
    currentName: () => string;
    select: (topicId: string, value: string) => void;
}

export default function ModelModeSelectors() {
    const { state, selectedTopic, setModel, setMode } = useAb();

    const selectors: SelectorDescriptor[] = [
        {
            label: "model",
            options: () => state.modelOptions,
            currentName: () => selectedTopic()?.currentModel || "none",
            select: setModel,
        },
        {
            label: "mode",
            options: () => state.modeOptions,
            currentName: () => selectedTopic()?.currentMode || "auto",
            select: setMode,
        },
    ];

    // Without any selectable options, show the topic's current values as static text instead.
    const hasAnyOptions = () => state.modelOptions !== null || state.modeOptions !== null;

    return (
        <div class="flex flex-col items-start md:items-end shrink-0 text-xs w-full md:w-auto gap-1">
            <For each={selectors}>
                {(selector) => (
                    <Show
                        when={hasAnyOptions()}
                        fallback={
                            <div class="flex items-center gap-1.5">
                                <span class="opacity-40 font-medium">{selector.label}:</span>
                                <span class="opacity-40">{selector.currentName()}</span>
                            </div>
                        }
                    >
                        <Show when={selector.options()}>
                            {(options) => (
                                <div class="flex items-center gap-1.5">
                                    <span class="opacity-40 font-medium">{selector.label}:</span>
                                    <select
                                        class="select select-xs select-bordered text-xs"
                                        value={options().currentValue}
                                        onChange={(e) => {
                                            const topicId = state.selectedTopicId;
                                            if (topicId)
                                                selector.select(topicId, e.currentTarget.value);
                                        }}
                                    >
                                        <For each={options().options}>
                                            {(opt) => <option value={opt.value}>{opt.name}</option>}
                                        </For>
                                    </select>
                                </div>
                            )}
                        </Show>
                    </Show>
                )}
            </For>
        </div>
    );
}
