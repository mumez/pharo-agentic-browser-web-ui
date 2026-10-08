import { For, Show } from "solid-js";
import { useAb } from "../../store";

export default function ModelModeSelectors() {
    const { state, selectedTopic, setModel, setMode } = useAb();

    return (
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
                    <span class="opacity-40">{selectedTopic()?.currentModel || "none"}</span>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="opacity-40 font-medium">mode:</span>
                    <span class="opacity-40">{selectedTopic()?.currentMode || "auto"}</span>
                </div>
            </Show>
        </div>
    );
}
