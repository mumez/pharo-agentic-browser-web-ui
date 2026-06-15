import { createSignal, createMemo, For, Show } from "solid-js";
import { useAb } from "../store";
import type { TopicData } from "../types";

export default function Sidebar() {
  const { state, createTopic, deleteTopic, copyTopic, renameTopic, selectTopic, setAgent, saveApp } = useAb();

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

  const [editingTopicId, setEditingTopicId] = createSignal<string | null>(null);
  const [editingTitle, setEditingTitle] = createSignal("");

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
    <div class="w-80 bg-base-200 border-r border-base-300 flex flex-col h-full overflow-hidden select-none">
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
          <For each={state.topics}>
            {(topic) => (
              <div
                onClick={() => {
                  if (editingTopicId() !== topic.topicId) {
                    selectTopic(topic.topicId);
                  }
                }}
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
                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <Show
                      when={editingTopicId() === topic.topicId}
                      fallback={
                        <>
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
