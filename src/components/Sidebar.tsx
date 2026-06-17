import { createSignal, createMemo, For, Show } from "solid-js";
import { useAb } from "../store";
import type { TopicData, TopicSettings } from "../types";

export default function Sidebar() {
  const { state, createTopic, deleteTopic, copyTopic, renameTopic, selectTopic, setAgent, getTopicSettings, setTopicSettings, saveApp } = useAb();

  const agentDisplayName = (agentArguments: string[]) => {
    const key = agentArguments.join(' ');
    return state.agents.find((a) => a.command.join(' ') === key)?.name
      ?? (agentArguments.join(' ') || 'no arguments');
  };

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

  const hasAgents = createMemo(() => state.agents.length > 0);

  const [agentModalTopic, setAgentModalTopic] = createSignal<TopicData | null>(null);

  const [longPressTopicId, setLongPressTopicId] = createSignal<string | null>(null);
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let suppressNextClick = false;

  const startLongPress = (topicId: string) => {
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      setLongPressTopicId(topicId);
      suppressNextClick = true;
      longPressTimer = null;
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const [settingsModalTopic, setSettingsModalTopic] = createSignal<TopicData | null>(null);
  const [topicSettings, setTopicSettingsLocal] = createSignal<TopicSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = createSignal(false);

  const openSettingsModal = async (topic: TopicData, e: Event) => {
    e.stopPropagation();
    setSettingsModalTopic(topic);
    setTopicSettingsLocal(null);
    setSettingsLoading(true);
    try {
      const s = await getTopicSettings(topic.topicId);
      setTopicSettingsLocal(s);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    const topic = settingsModalTopic();
    const s = topicSettings();
    if (!topic || !s) return;
    await setTopicSettings(topic.topicId, s);
    setSettingsModalTopic(null);
  };

  const [editingTopicId, setEditingTopicId] = createSignal<string | null>(null);
  const [editingTitle, setEditingTitle] = createSignal("");

  type SortOrder = 'lastUpdated' | 'title';
  const [sortOrder, setSortOrder] = createSignal<SortOrder>('lastUpdated');

  const sortedTopics = createMemo(() => {
    const topics = [...state.topics];
    if (sortOrder() === 'title') {
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

    try {
      const topicId = await createTopic(newTitle().trim(), args);
      setIsCreateOpen(false);
      setNewTitle("");
      setSelectedAgentIndex(0);
      setManualAgentArgs("claude-code");
      // Auto-select the newly created topic
      selectTopic(topicId);
    } catch (err) {
      console.error(err);
    }
  };

  const startRename = (topic: TopicData, e: Event) => {
    e.stopPropagation(); // Prevent select
    setEditingTopicId(topic.topicId);
    setEditingTitle(topic.title);
  };

  const saveRename = async (topicId: string) => {
    if (!editingTitle().trim()) return;
    await renameTopic(topicId, editingTitle().trim());
    setEditingTopicId(null);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "working":
        return "badge-primary animate-pulse font-semibold";
      case "waitingForHuman":
        return "badge-warning text-warning-content font-semibold";
      case "endTurn":
        return "badge-info font-semibold";
      case "goalAchieved":
        return "badge-success text-success-content font-semibold";
      default:
        return "badge-ghost opacity-70";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "working":
        return "Working";
      case "waitingForHuman":
        return "Waiting";
      case "endTurn":
        return "Done";
      case "goalAchieved":
        return "Success";
      default:
        return "Initial";
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
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16" />
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
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  {isSaved() ? "Saved ✓" : "Save"}
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h1 class="font-bold text-lg leading-none">
              Pharo Agentic Browser
            </h1>
            <span class="text-xs opacity-60">Web UI</span>
          </div>
        </div>
        <button
          class="btn btn-sm btn-circle btn-primary"
          onClick={() => setIsCreateOpen(true)}
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
              class={`btn btn-xs rounded-lg ${sortOrder() === 'lastUpdated' ? 'btn-primary' : 'btn-ghost opacity-60'}`}
              onClick={() => setSortOrder('lastUpdated')}
              title="Sort by last updated"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Updated
            </button>
            <button
              class={`btn btn-xs rounded-lg ${sortOrder() === 'title' ? 'btn-primary' : 'btn-ghost opacity-60'}`}
              onClick={() => setSortOrder('title')}
              title="Sort by title"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
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
              <div
                onClick={() => {
                  if (suppressNextClick) {
                    suppressNextClick = false;
                    return;
                  }
                  if (longPressTopicId() !== null) {
                    setLongPressTopicId(null);
                  }
                  if (editingTopicId() !== topic.topicId) {
                    selectTopic(topic.topicId);
                  }
                }}
                onPointerDown={(e) => {
                  if (e.pointerType === 'mouse') return;
                  startLongPress(topic.topicId);
                }}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onContextMenu={(e) => e.preventDefault()}
                class={`group flex flex-col p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                  state.selectedTopicId === topic.topicId
                    ? "bg-primary text-primary-content shadow-lg shadow-primary/20 translate-x-1"
                    : "hover:bg-base-300 text-base-content/90"
                }`}
              >
                {/* Topic Line 1: Title & Status */}
                <div class="flex items-center justify-between w-full min-w-0">
                  <Show
                    when={editingTopicId() === topic.topicId}
                    fallback={
                      <span class="font-medium truncate flex-1 pr-2 text-sm md:text-base">
                        {topic.title}
                      </span>
                    }
                  >
                    <input
                      type="text"
                      class="input input-xs input-bordered text-base-content flex-1 mr-2"
                      value={editingTitle()}
                      onInput={(e) => setEditingTitle(e.currentTarget.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(topic.topicId);
                        if (e.key === "Escape") setEditingTopicId(null);
                      }}
                      autofocus
                    />
                  </Show>
                  <span
                    class={`badge badge-sm ${getStatusBadgeClass(topic.status)}`}
                  >
                    {getStatusText(topic.status)}
                  </span>
                </div>

                {/* Topic Line 2: Details & Actions */}
                <div class="flex items-center justify-between mt-2 pt-1 border-t border-current/10 text-xs opacity-75">
                  <Show
                    when={state.agents.length > 0 && topic.status !== 'working'}
                    fallback={
                      <span class={`truncate max-w-[150px] ${topic.status === 'working' ? 'opacity-50' : ''}`}>
                        {agentDisplayName(topic.agentArguments)}
                      </span>
                    }
                  >
                    <button
                      class="flex items-center gap-1 max-w-[150px] hover:underline underline-offset-2 cursor-pointer transition-opacity"
                      title="Switch agent"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAgentModalTopic(topic);
                      }}
                    >
                      <span class="truncate">{agentDisplayName(topic.agentArguments)}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                      </svg>
                    </button>
                  </Show>

                  {/* Action Buttons */}
                  <div class={`flex items-center gap-1 transition-opacity duration-150 ${longPressTopicId() === topic.topicId ? 'opacity-100' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'}`}>
                    <Show
                      when={editingTopicId() === topic.topicId}
                      fallback={
                        <>
                          <button
                            class="btn btn-ghost btn-xs btn-circle hover:bg-current/10"
                            onClick={(e) => openSettingsModal(topic, e)}
                            title="Settings"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                          <button
                            class="btn btn-ghost btn-xs btn-circle hover:bg-current/10"
                            onClick={(e) => startRename(topic, e)}
                            title="Set title"
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
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>
                          <button
                            class="btn btn-ghost btn-xs btn-circle hover:bg-current/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyTopic(topic.topicId);
                            }}
                            title="Copy"
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
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          </button>
                          <button
                            class={`btn btn-ghost btn-xs btn-circle hover:bg-error hover:text-error-content ${
                              topic.status === "working"
                                ? "btn-disabled opacity-30"
                                : ""
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Delete this topic?")) {
                                deleteTopic(topic.topicId);
                              }
                            }}
                            title="Delete"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </>
                      }
                    >
                      <button
                        class="btn btn-ghost btn-xs btn-circle hover:bg-success hover:text-success-content"
                        onClick={(e) => {
                          e.stopPropagation();
                          saveRename(topic.topicId);
                        }}
                      >
                        ✓
                      </button>
                      <button
                        class="btn btn-ghost btn-xs btn-circle hover:bg-error hover:text-error-content"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTopicId(null);
                        }}
                      >
                        ✕
                      </button>
                    </Show>
                  </div>
                </div>
              </div>
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
      <Show when={settingsModalTopic() !== null}>
        <div class="modal modal-open" onClick={() => setSettingsModalTopic(null)}>
          <div
            class="modal-box max-w-sm rounded-2xl bg-base-100 shadow-2xl p-0 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="p-5 border-b border-base-200">
              <h3 class="font-bold text-lg">Topic Settings</h3>
              <p class="text-xs opacity-60 mt-0.5 truncate">{settingsModalTopic()!.title}</p>
            </div>
            <Show
              when={!settingsLoading()}
              fallback={
                <div class="p-8 flex justify-center">
                  <span class="loading loading-spinner loading-md opacity-50" />
                </div>
              }
            >
              <div class="p-5 space-y-4">
                <div class="form-control">
                  <label class="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-primary checkbox-sm"
                      checked={topicSettings()?.useCommandOnGoalSet ?? false}
                      onChange={(e) =>
                        setTopicSettingsLocal((prev) =>
                          prev ? { ...prev, useCommandOnGoalSet: e.currentTarget.checked } : prev
                        )
                      }
                    />
                    <span class="label-text text-sm">Use command on goal set</span>
                  </label>
                </div>
                <div class="form-control">
                  <label class="label-text text-sm opacity-70 mb-1">Goal set command</label>
                  <input
                    type="text"
                    class="input input-bordered input-sm w-full font-mono"
                    value={topicSettings()?.goalSetCommand ?? ""}
                    onInput={(e) =>
                      setTopicSettingsLocal((prev) =>
                        prev ? { ...prev, goalSetCommand: e.currentTarget.value } : prev
                      )
                    }
                    disabled={!topicSettings()?.useCommandOnGoalSet}
                  />
                </div>
              </div>
            </Show>
            <div class="p-3 border-t border-base-200 flex gap-2 justify-end">
              <button class="btn btn-ghost btn-sm" onClick={() => setSettingsModalTopic(null)}>
                Cancel
              </button>
              <button
                class="btn btn-primary btn-sm"
                onClick={handleSaveSettings}
                disabled={settingsLoading() || topicSettings() === null}
              >
                Save
              </button>
            </div>
          </div>
        </div>
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
              <p class="text-xs opacity-60 mt-0.5 truncate">{agentModalTopic()!.title}</p>
            </div>
            <ul class="p-2 space-y-1">
              <For each={state.agents}>
                {(agent) => {
                  const isActive = agent.command.join(' ') === agentModalTopic()!.agentArguments.join(' ');
                  return (
                    <li>
                      <button
                        class={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-content font-semibold'
                            : 'hover:bg-base-200'
                        }`}
                        onClick={() => {
                          if (!isActive) setAgent(agentModalTopic()!.topicId, agent.command);
                          setAgentModalTopic(null);
                        }}
                      >
                        <span class="flex items-center gap-2">
                          {isActive && (
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
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
              <button class="btn btn-ghost btn-sm w-full" onClick={() => setAgentModalTopic(null)}>
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
                      onInput={(e) => setManualAgentArgs(e.currentTarget.value)}
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
            </div>
            <div class="modal-action">
              <button
                type="button"
                class="btn btn-ghost"
                onClick={() => setIsCreateOpen(false)}
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
