import { createSignal, onMount, Show } from "solid-js";
import { useAb } from "../store";
import type { AiPermissionTimeoutOption, TopicData, TopicSettings } from "../types";

const isValidTimeoutSeconds = (n: number) => Number.isInteger(n) && n > 0;

interface TopicSettingsModalProps {
    topic: TopicData;
    onClose: () => void;
}

export default function TopicSettingsModal(props: TopicSettingsModalProps) {
    const { getTopicSettings, setTopicSettings } = useAb();

    const [settings, setSettings] = createSignal<TopicSettings | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);

    onMount(async () => {
        try {
            setSettings(await getTopicSettings(props.topic.topicId));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load settings");
        } finally {
            setLoading(false);
        }
    });

    const patchSettings = (patch: Partial<TopicSettings>) =>
        setSettings((prev) => (prev ? { ...prev, ...patch } : prev));

    const handleSave = async () => {
        const s = settings();
        if (!s || !isValidTimeoutSeconds(s.aiPermissionWaitTimeoutSeconds)) return;
        try {
            await setTopicSettings(props.topic.topicId, s);
            props.onClose();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div class="modal modal-open" onClick={() => props.onClose()}>
            <div
                class="modal-box max-w-sm rounded-2xl bg-base-100 shadow-2xl p-0 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div class="p-5 border-b border-base-200">
                    <h3 class="font-bold text-lg">Topic Settings</h3>
                    <p class="text-xs opacity-60 mt-0.5 truncate">{props.topic.title}</p>
                </div>
                <Show
                    when={!loading()}
                    fallback={
                        <div class="p-8 flex justify-center">
                            <span class="loading loading-spinner loading-md opacity-50" />
                        </div>
                    }
                >
                    <Show when={error() !== null}>
                        <div class="mx-5 mt-4 alert alert-error text-sm py-2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-4 w-4 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                                />
                            </svg>
                            <span>{error()}</span>
                        </div>
                    </Show>
                    <div class="p-5 space-y-4">
                        <div class="form-control">
                            <label class="label cursor-pointer justify-start gap-3">
                                <input
                                    type="checkbox"
                                    class="checkbox checkbox-primary checkbox-sm"
                                    checked={settings()?.useCommandOnGoalSet ?? false}
                                    onChange={(e) =>
                                        patchSettings({
                                            useCommandOnGoalSet: e.currentTarget.checked,
                                        })
                                    }
                                />
                                <span class="label-text text-sm">Use command on goal set</span>
                            </label>
                        </div>
                        <div class="form-control">
                            <label class="label-text text-sm opacity-70 mb-1">
                                Goal set command
                            </label>
                            <input
                                type="text"
                                class="input input-bordered input-sm w-full font-mono"
                                value={settings()?.goalSetCommand ?? ""}
                                onInput={(e) =>
                                    patchSettings({ goalSetCommand: e.currentTarget.value })
                                }
                                disabled={!settings()?.useCommandOnGoalSet}
                            />
                        </div>
                        <div class="form-control">
                            <label class="label cursor-pointer justify-start gap-3">
                                <input
                                    type="checkbox"
                                    class="checkbox checkbox-primary checkbox-sm"
                                    checked={settings()?.useStBuddySkillOnInitialPrompt ?? false}
                                    onChange={(e) =>
                                        patchSettings({
                                            useStBuddySkillOnInitialPrompt: e.currentTarget.checked,
                                        })
                                    }
                                />
                                <span class="label-text text-sm">
                                    Use st-buddy skill on initial prompt
                                </span>
                            </label>
                        </div>
                        <div class="form-control">
                            <label class="label cursor-pointer justify-start gap-3">
                                <input
                                    type="checkbox"
                                    class="checkbox checkbox-primary checkbox-sm"
                                    checked={settings()?.useDefaultMcpServers ?? false}
                                    onChange={(e) =>
                                        patchSettings({
                                            useDefaultMcpServers: e.currentTarget.checked,
                                        })
                                    }
                                />
                                <span class="label-text text-sm">Use default MCP servers</span>
                            </label>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div class="form-control">
                                <label class="label-text text-sm opacity-70 mb-1">
                                    AI permission timeout (sec)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    class="input input-bordered input-sm w-full font-mono"
                                    classList={{
                                        "input-error": !isValidTimeoutSeconds(
                                            settings()?.aiPermissionWaitTimeoutSeconds ?? 0
                                        ),
                                    }}
                                    value={settings()?.aiPermissionWaitTimeoutSeconds ?? ""}
                                    onInput={(e) =>
                                        patchSettings({
                                            aiPermissionWaitTimeoutSeconds:
                                                e.currentTarget.valueAsNumber,
                                        })
                                    }
                                />
                            </div>
                            <div class="form-control">
                                <label class="label-text text-sm opacity-70 mb-1">On timeout</label>
                                <select
                                    class="select select-bordered select-sm w-full"
                                    value={settings()?.aiPermissionTimeoutOption ?? "reject_once"}
                                    onChange={(e) =>
                                        patchSettings({
                                            aiPermissionTimeoutOption: e.currentTarget
                                                .value as AiPermissionTimeoutOption,
                                        })
                                    }
                                >
                                    <option value="allow_once">Allow</option>
                                    <option value="reject_once">Deny</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </Show>
                <div class="p-3 border-t border-base-200 flex gap-2 justify-end">
                    <button class="btn btn-ghost btn-sm" onClick={() => props.onClose()}>
                        Cancel
                    </button>
                    <button
                        class="btn btn-primary btn-sm"
                        onClick={handleSave}
                        disabled={
                            loading() ||
                            settings() === null ||
                            !isValidTimeoutSeconds(settings()!.aiPermissionWaitTimeoutSeconds)
                        }
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
