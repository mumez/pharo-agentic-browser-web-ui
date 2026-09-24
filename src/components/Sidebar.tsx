import { createSignal, createMemo, For, Show } from "solid-js";
import { useAb, errMsg } from "../store";
import type { TopicData, WorkingDirectoryInfo } from "../types";
import TopicListItem from "./TopicListItem";
import TopicSettingsModal from "./TopicSettingsModal";

const NEW_WORKING_DIRECTORY_OPTION = "__new__";
const AUTO_WORKING_DIRECTORY_OPTION = "__auto__";

export default function Sidebar() {
    const {
        state,
        createTopic,
        listWorkingDirectories,
        deleteTopic,
        copyTopic,
        renameTopic,
        selectTopic,
        setAgent,
        saveApp,
    } = useAb();

    const [isSaved, setIsSaved] = createSignal(false);

    const handleSave = async () => {
        await saveApp();
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const [isCreateOpen, setIsCreateOpen] = createSignal(false);
    const [newTitle, setNewTitle] = createSignal("");
    const [selectedAgentIndex, setSelectedAgentIndex] = createSignal(0);
    const [manualAgentArgs, setManualAgentArgs] = createSignal("claude-code");
    const [workingDirectories, setWorkingDirectories] = createSignal<WorkingDirectoryInfo[]>([]);
    const [workingDirectorySelection, setWorkingDirectorySelection] = createSignal(
        AUTO_WORKING_DIRECTORY_OPTION
    );
    const [newWorkingDirectoryName, setNewWorkingDirectoryName] = createSignal("");
    const [loadingWorkingDirectories, setLoadingWorkingDirectories] = createSignal(false);
    const [createTopicError, setCreateTopicError] = createSignal<string | null>(null);

    const openCreateModal = async () => {
        setIsCreateOpen(true);
        setWorkingDirectorySelection(AUTO_WORKING_DIRECTORY_OPTION);
        setNewWorkingDirectoryName("");
        setCreateTopicError(null);
        setLoadingWorkingDirectories(true);
        try {
            setWorkingDirectories(await listWorkingDirectories());
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingWorkingDirectories(false);
        }
    };

    const hasAgents = createMemo(() => state.agents.length > 0);

    const [agentModalTopic, setAgentModalTopic] = createSignal<TopicData | null>(null);

    const [settingsModalTopic, setSettingsModalTopic] = createSignal<TopicData | null>(null);
    const [deletingTopicIds, setDeletingTopicIds] = createSignal<Set<string>>(new Set());

    const handleDelete = async (topicId: string) => {
        setDeletingTopicIds((prev) => new Set([...prev, topicId]));
        const timeoutId = setTimeout(() => {
            setDeletingTopicIds((prev) => {
                const s = new Set(prev);
                s.delete(topicId);
                return s;
            });
        }, 5000);

        try {
            await deleteTopic(topicId);
        } finally {
            clearTimeout(timeoutId);
            setDeletingTopicIds((prev) => {
                const s = new Set(prev);
                s.delete(topicId);
                return s;
            });
        }
    };

    type SortOrder = "lastUpdated" | "title";
    const [sortOrder, setSortOrder] = createSignal<SortOrder>("lastUpdated");

    const sortedTopics = createMemo(() => {
        const topics = [...state.topics];
        if (sortOrder() === "title") {
            return topics.sort((a, b) => a.title.localeCompare(b.title));
        }
        return topics.sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
    });

    const handleCreate = async (e: Event) => {
        e.preventDefault();
        if (!newTitle().trim()) return;

        let args: string[];
        if (hasAgents()) {
            args = state.agents[selectedAgentIndex()]?.command ?? [];
        } else {
            args = manualAgentArgs()
                .split(" ")
                .map((s) => s.trim())
                .filter(Boolean);
        }

        const selection = workingDirectorySelection();
        const workingDirectory =
            selection === AUTO_WORKING_DIRECTORY_OPTION
                ? undefined
                : selection === NEW_WORKING_DIRECTORY_OPTION
                  ? newWorkingDirectoryName().trim()
                  : selection;
        const checkExistingDirectory = selection === NEW_WORKING_DIRECTORY_OPTION;
        if (selection === NEW_WORKING_DIRECTORY_OPTION && !workingDirectory) {
            setCreateTopicError("Working directory name cannot be empty");
            return;
        }

        setCreateTopicError(null);
        try {
            const topicId = await createTopic(newTitle().trim(), args, {
                workingDirectory,
                checkExistingDirectory,
            });
            setIsCreateOpen(false);
            setNewTitle("");
            setSelectedAgentIndex(0);
            setManualAgentArgs("claude-code");
            setWorkingDirectorySelection(AUTO_WORKING_DIRECTORY_OPTION);
            setNewWorkingDirectoryName("");
            // Auto-select the newly created topic
            selectTopic(topicId);
        } catch (err) {
            console.error(err);
            setCreateTopicError(errMsg(err, "Failed to create topic"));
        }
    };

    return (
        <div class="w-full bg-base-200 border-r border-base-300 flex flex-col h-full overflow-hidden select-none">
            {/* Sidebar Header */}
            <div class="p-4 border-b border-base-300 flex items-center justify-between bg-base-100/50 backdrop-blur-md">
                <div class="flex items-center gap-2">
                    <div class="dropdown">
                        <button
                            tabindex="0"
                            class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-content shadow-md shadow-primary/20 hover:bg-primary/80 transition-colors"
                            title="Menu"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2.5"
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            </svg>
                        </button>
                        <ul
                            tabindex="0"
                            class="dropdown-content menu bg-base-100 rounded-xl z-50 w-40 p-1 shadow-lg border border-base-300 mt-1"
                        >
                            <li>
                                <button
                                    class="flex items-center gap-2 text-sm"
                                    onClick={handleSave}
                                >
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
                                            d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                                        />
                                    </svg>
                                    {isSaved() ? "Saved ✓" : "Save"}
                                </button>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h1 class="font-bold text-lg leading-none">Pharo Agentic Browser</h1>
                        <span class="text-xs opacity-60">Web UI</span>
                    </div>
                </div>
                <button
                    class="btn btn-sm btn-circle btn-primary"
                    onClick={openCreateModal}
                    title="Create Topic"
                >
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
                            stroke-width="2.5"
                            d="M12 4v16m8-8H4"
                        />
                    </svg>
                </button>
            </div>

            {/* Topics List */}
            <div class="flex-1 overflow-y-auto p-3 space-y-1 bg-gradient-to-b from-base-200/50 to-base-300/30">
                <Show when={state.topics.length > 0}>
                    <div class="flex items-center justify-end gap-1 pb-1">
                        <button
                            class={`btn btn-xs rounded-lg ${sortOrder() === "lastUpdated" ? "btn-primary" : "btn-ghost opacity-60"}`}
                            onClick={() => setSortOrder("lastUpdated")}
                            title="Sort by last updated"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            Updated
                        </button>
                        <button
                            class={`btn btn-xs rounded-lg ${sortOrder() === "title" ? "btn-primary" : "btn-ghost opacity-60"}`}
                            onClick={() => setSortOrder("title")}
                            title="Sort by title"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                                />
                            </svg>
                            Title
                        </button>
                    </div>
                </Show>
                <Show
                    when={state.topics.length > 0}
                    fallback={
                        <div class="text-center py-10 opacity-40 text-sm">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-10 w-10 mx-auto mb-2 opacity-50"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="1.5"
                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                />
                            </svg>
                            No topics created yet
                        </div>
                    }
                >
                    <For each={sortedTopics()}>
                        {(topic) => (
                            <TopicListItem
                                topic={topic}
                                agents={state.agents}
                                isSelected={state.selectedTopicId === topic.topicId}
                                isDeleting={deletingTopicIds().has(topic.topicId)}
                                onSelect={() => selectTopic(topic.topicId)}
                                onOpenSettings={() => setSettingsModalTopic(topic)}
                                onSwitchAgent={() => setAgentModalTopic(topic)}
                                onDelete={() => handleDelete(topic.topicId)}
                                onCopy={() => copyTopic(topic.topicId)}
                                onRename={(title) => renameTopic(topic.topicId, title)}
                            />
                        )}
                    </For>
                </Show>
            </div>

            {/* Connection Indicator Footer */}
            <div class="p-3 bg-base-300/60 border-t border-base-300 text-xs flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                    <span
                        class={`w-2.5 h-2.5 rounded-full ${
                            state.isConnected
                                ? "bg-success shadow shadow-success/40"
                                : "bg-error shadow shadow-error/40 animate-pulse"
                        }`}
                    />
                    <span class="opacity-80">
                        {state.isConnected
                            ? "Connected"
                            : state.isConnecting
                              ? "Connecting..."
                              : "Disconnected"}
                    </span>
                </div>
                <span class="opacity-40">v{__APP_VERSION__}</span>
            </div>

            {/* Topic Settings Modal */}
            <Show when={settingsModalTopic()} keyed>
                {(topic) => (
                    <TopicSettingsModal topic={topic} onClose={() => setSettingsModalTopic(null)} />
                )}
            </Show>

            {/* Agent Select Modal */}
            <Show when={agentModalTopic() !== null}>
                <div class="modal modal-open" onClick={() => setAgentModalTopic(null)}>
                    <div
                        class="modal-box max-w-sm rounded-2xl bg-base-100 shadow-2xl p-0 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div class="p-5 border-b border-base-200">
                            <h3 class="font-bold text-lg">Switch Agent</h3>
                            <p class="text-xs opacity-60 mt-0.5 truncate">
                                {agentModalTopic()!.title}
                            </p>
                        </div>
                        <ul class="p-2 space-y-1">
                            <For each={state.agents}>
                                {(agent) => {
                                    const isActive =
                                        agent.command.join(" ") ===
                                        agentModalTopic()!.agentArguments.join(" ");
                                    return (
                                        <li>
                                            <button
                                                class={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${
                                                    isActive
                                                        ? "bg-primary text-primary-content font-semibold"
                                                        : "hover:bg-base-200"
                                                }`}
                                                onClick={() => {
                                                    if (!isActive)
                                                        setAgent(
                                                            agentModalTopic()!.topicId,
                                                            agent.command
                                                        );
                                                    setAgentModalTopic(null);
                                                }}
                                            >
                                                <span class="flex items-center gap-2">
                                                    {isActive && (
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            class="h-4 w-4 shrink-0"
                                                            viewBox="0 0 20 20"
                                                            fill="currentColor"
                                                        >
                                                            <path
                                                                fill-rule="evenodd"
                                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                                clip-rule="evenodd"
                                                            />
                                                        </svg>
                                                    )}
                                                    {agent.name}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                }}
                            </For>
                        </ul>
                        <div class="p-3 border-t border-base-200">
                            <button
                                class="btn btn-ghost btn-sm w-full"
                                onClick={() => setAgentModalTopic(null)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </Show>

            {/* Create Topic Modal */}
            <Show when={isCreateOpen()}>
                <div class="modal modal-open">
                    <form
                        onSubmit={handleCreate}
                        class="modal-box max-w-sm rounded-2xl bg-base-100 shadow-2xl"
                    >
                        <h3 class="font-bold text-lg mb-4">Create New Topic</h3>
                        <Show when={createTopicError()}>
                            <div class="alert alert-error text-xs mb-4 py-2">
                                <span>{createTopicError()}</span>
                            </div>
                        </Show>
                        <div class="space-y-4">
                            <div class="form-control">
                                <label class="label-text mb-1 opacity-70">Topic Title</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Fix database connection"
                                    class="input input-bordered w-full"
                                    value={newTitle()}
                                    onInput={(e) => setNewTitle(e.currentTarget.value)}
                                    required
                                    autofocus
                                />
                            </div>
                            <div class="form-control">
                                <label class="label-text mb-1 opacity-70">Agent</label>
                                <Show
                                    when={hasAgents()}
                                    fallback={
                                        <input
                                            type="text"
                                            placeholder="e.g., claude-code --model claude-3-5"
                                            class="input input-bordered w-full font-mono text-sm"
                                            value={manualAgentArgs()}
                                            onInput={(e) =>
                                                setManualAgentArgs(e.currentTarget.value)
                                            }
                                        />
                                    }
                                >
                                    <select
                                        class="select select-bordered w-full"
                                        value={selectedAgentIndex()}
                                        onChange={(e) =>
                                            setSelectedAgentIndex(Number(e.currentTarget.value))
                                        }
                                    >
                                        <For each={state.agents}>
                                            {(agent, i) => (
                                                <option value={i()}>{agent.name}</option>
                                            )}
                                        </For>
                                    </select>
                                </Show>
                            </div>
                            <div class="form-control">
                                <label class="label-text mb-1 opacity-70">Working Directory</label>
                                <select
                                    class="select select-bordered w-full"
                                    value={workingDirectorySelection()}
                                    onChange={(e) =>
                                        setWorkingDirectorySelection(e.currentTarget.value)
                                    }
                                    disabled={loadingWorkingDirectories()}
                                >
                                    <option value={AUTO_WORKING_DIRECTORY_OPTION}>
                                        Auto (default)
                                    </option>
                                    <For each={workingDirectories()}>
                                        {(dir) => <option value={dir.name}>{dir.name}</option>}
                                    </For>
                                    <option value={NEW_WORKING_DIRECTORY_OPTION}>
                                        + New working directory...
                                    </option>
                                </select>
                                <Show
                                    when={
                                        workingDirectorySelection() === NEW_WORKING_DIRECTORY_OPTION
                                    }
                                >
                                    <input
                                        type="text"
                                        placeholder="e.g., my-working-directory"
                                        class="input input-bordered w-full mt-2"
                                        value={newWorkingDirectoryName()}
                                        onInput={(e) =>
                                            setNewWorkingDirectoryName(e.currentTarget.value)
                                        }
                                        required
                                    />
                                </Show>
                            </div>
                        </div>
                        <div class="modal-action">
                            <button
                                type="button"
                                class="btn btn-ghost"
                                onClick={() => {
                                    setIsCreateOpen(false);
                                    setCreateTopicError(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                Create
                            </button>
                        </div>
                    </form>
                </div>
            </Show>
        </div>
    );
}
