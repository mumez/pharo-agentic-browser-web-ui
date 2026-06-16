import { createSignal, createMemo, createEffect, Show, For } from 'solid-js';
import { useAb } from '../store';
import type { CommandData } from '../types';

export default function InputArea() {
  const { state, selectedTopic, sendPrompt, cancelPrompt, setGoal } = useAb();
  const [inputText, setInputText] = createSignal('');
  let textareaRef: HTMLTextAreaElement | undefined;

  const [isCancelling, setIsCancelling] = createSignal(false);

  const [isGoalModalOpen, setIsGoalModalOpen] = createSignal(false);
  const [goalText, setGoalText] = createSignal('');
  const [isSavingGoal, setIsSavingGoal] = createSignal(false);

  // Slash command autocomplete
  const [slashQuery, setSlashQuery] = createSignal<string | null>(null);
  const [selectedCmdIndex, setSelectedCmdIndex] = createSignal(0);

  const filteredCommands = createMemo(() => {
    const q = slashQuery();
    if (q === null) return [];
    const cmds = state.availableCommands as CommandData[];
    if (!q) return cmds;
    const lower = q.toLowerCase();
    return cmds.filter((c) => c.name.toLowerCase().includes(lower));
  });

  // Returns slash info if cursor is inside a slash command token, otherwise null.
  // A slash token starts at position 0 or after whitespace/newline.
  const detectSlashQuery = (value: string, cursorPos: number) => {
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastSlashIdx = textBeforeCursor.lastIndexOf('/');
    if (lastSlashIdx === -1) return null;
    if (lastSlashIdx > 0) {
      const charBefore = textBeforeCursor[lastSlashIdx - 1];
      if (charBefore !== ' ' && charBefore !== '\n') return null;
    }
    const slashText = textBeforeCursor.slice(lastSlashIdx + 1);
    if (slashText.includes(' ') || slashText.includes('\n')) return null;
    return { startIdx: lastSlashIdx, query: slashText };
  };

  const updateSlashState = (value: string, cursorPos: number) => {
    const info = detectSlashQuery(value, cursorPos);
    if (info && state.availableCommands.length > 0) {
      setSlashQuery(info.query);
      setSelectedCmdIndex(0);
    } else {
      setSlashQuery(null);
    }
  };

  const applyCommand = (cmd: CommandData) => {
    if (!textareaRef) return;
    const cursorPos = textareaRef.selectionStart;
    const text = inputText();
    const info = detectSlashQuery(text, cursorPos);
    if (!info) return;
    const before = text.slice(0, info.startIdx);
    const after = text.slice(cursorPos);
    // Ensure the slash is preserved; server may omit it from cmd.name
    const name = cmd.name.startsWith('/') ? cmd.name : `/${cmd.name}`;
    // Leave a trailing space when the command takes input so user can type arguments
    const insertion = cmd.input ? `${name} ` : name;
    const newText = before + insertion + after;
    setInputText(newText);
    setSlashQuery(null);
    const newPos = info.startIdx + insertion.length;
    requestAnimationFrame(() => {
      if (!textareaRef) return;
      textareaRef.focus();
      textareaRef.setSelectionRange(newPos, newPos);
      textareaRef.style.height = 'auto';
      textareaRef.style.height = `${textareaRef.scrollHeight}px`;
    });
  };

  const openGoalModal = () => {
    setGoalText(selectedTopic()?.goal ?? '');
    setIsGoalModalOpen(true);
  };

  const handleGoalSave = async () => {
    const topicId = state.selectedTopicId;
    if (!topicId) return;
    setIsSavingGoal(true);
    try {
      await setGoal(topicId, goalText().trim());
      setIsGoalModalOpen(false);
    } finally {
      setIsSavingGoal(false);
    }
  };

  const handleSend = () => {
    const text = inputText().trim();
    if (!text) return;
    sendPrompt(text);
    setInputText('');
    setSlashQuery(null);
    if (textareaRef) {
      textareaRef.style.height = 'auto';
    }
  };

  const isWorking = () => selectedTopic()?.status === 'working';

  // Reset cancelling state when the server confirms the agent stopped
  createEffect(() => {
    if (!isWorking()) setIsCancelling(false);
  });

  return (
    <Show when={state.selectedTopicId}>
      <div class="p-4 border-t border-base-300 bg-base-100 flex flex-col gap-3">
        {/* Goal Banner */}
        <div class="flex items-center gap-1.5 select-none">
          <span class="text-xs font-semibold text-primary shrink-0">Goal:</span>
          <span class="text-xs opacity-60 truncate flex-1">
            {selectedTopic()?.goal || 'Not set'}
          </span>
          <button
            class="btn btn-ghost btn-xs btn-circle shrink-0 opacity-50 hover:opacity-100"
            onClick={openGoalModal}
            title="Set goal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>

        <div class="flex gap-2 items-end">
          {/* Text Input Area */}
          <div class="flex-1 relative">
            {/* Slash Command Popup */}
            <Show when={slashQuery() !== null && filteredCommands().length > 0}>
              <div class="absolute bottom-full left-0 right-0 mb-1 bg-base-100 border border-base-300 rounded-xl shadow-lg overflow-hidden z-50 max-h-48 overflow-y-auto">
                <For each={filteredCommands()}>
                  {(cmd, i) => (
                    <button
                      class={`w-full text-left px-3 py-2 flex items-start gap-2 transition-colors ${
                        i() === selectedCmdIndex() ? 'bg-base-200' : 'hover:bg-base-200/60'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault(); // keep textarea focused
                        applyCommand(cmd);
                      }}
                    >
                      <span class="font-mono text-xs font-semibold text-primary shrink-0 mt-0.5 min-w-[80px]">
                        {cmd.name}
                      </span>
                      <span class="text-xs opacity-60 leading-relaxed">
                        {cmd.description}
                        <Show when={cmd.input}>
                          <span class="ml-1 opacity-50 italic">&lt;{cmd.input!.hint}&gt;</span>
                        </Show>
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <textarea
              class="textarea textarea-bordered w-full pr-12 rounded-2xl min-h-[44px] max-h-40 resize-none py-2.5 font-sans leading-relaxed text-sm focus:outline-primary"
              placeholder={
                isWorking()
                  ? 'Agent is processing... please wait or cancel'
                  : 'Ask agent to implement code, run tests, or search class...'
              }
              value={inputText()}
              disabled={isWorking()}
              rows={1}
              style={{ height: 'auto' }}
              ref={(el) => { textareaRef = el; }}
              onInput={(e) => {
                const el = e.currentTarget;
                setInputText(el.value);
                el.style.height = 'auto';
                el.style.height = `${el.scrollHeight}px`;
                updateSlashState(el.value, el.selectionStart);
              }}
              onKeyDown={(e) => {
                const q = slashQuery();
                if (q === null) return;
                const cmds = filteredCommands();
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedCmdIndex((i) => Math.min(i + 1, cmds.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedCmdIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const cmd = cmds[selectedCmdIndex()];
                  if (cmd) applyCommand(cmd);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setSlashQuery(null);
                }
              }}
              onKeyUp={(e) => {
                // Re-evaluate after cursor movement keys
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                  updateSlashState(e.currentTarget.value, e.currentTarget.selectionStart);
                }
              }}
              onClick={(e) => {
                updateSlashState(e.currentTarget.value, e.currentTarget.selectionStart);
              }}
            />
          </div>

          {/* Action Buttons */}
          <div class="flex items-center gap-1.5 h-[44px]">
            <Show
              when={isWorking()}
              fallback={
                <button
                  class="btn btn-primary rounded-xl px-4 h-full min-h-0 flex items-center gap-1.5"
                  onClick={handleSend}
                  disabled={!inputText().trim()}
                >
                  <span class="hidden sm:inline">Send</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              }
            >
              <button
                class={`btn btn-error btn-outline rounded-xl px-4 h-full min-h-0 flex items-center gap-1.5 ${isCancelling() ? 'opacity-60 cursor-not-allowed' : 'animate-pulse'}`}
                disabled={isCancelling()}
                onClick={() => {
                  if (isCancelling()) return;
                  setIsCancelling(true);
                  cancelPrompt();
                }}
              >
                <Show
                  when={isCancelling()}
                  fallback={
                    <>
                      <span class="hidden sm:inline">Cancel</span>
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
                          stroke-width="2"
                          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </>
                  }
                >
                  <span class="hidden sm:inline">Cancelling</span>
                  <span class="loading loading-spinner loading-xs" />
                </Show>
              </button>
            </Show>
          </div>
        </div>
      </div>

      {/* Goal Edit Modal */}
      <Show when={isGoalModalOpen()}>
        <div class="modal modal-open" onClick={() => setIsGoalModalOpen(false)}>
          <div
            class="modal-box max-w-lg rounded-2xl bg-base-100 shadow-2xl p-0 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="p-5 border-b border-base-200">
              <h3 class="font-bold text-lg">Set Goal</h3>
              <p class="text-xs opacity-60 mt-0.5">
                Describe the goal for this topic. It will be injected as context when sending prompts.
              </p>
            </div>
            <div class="p-5">
              <textarea
                class="textarea textarea-bordered w-full rounded-xl text-sm font-sans leading-relaxed resize-none focus:outline-primary"
                rows={6}
                placeholder="e.g., Implement the user authentication module with JWT support and add unit tests."
                value={goalText()}
                onInput={(e) => setGoalText(e.currentTarget.value)}
                autofocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleGoalSave();
                  }
                  if (e.key === 'Escape') {
                    setIsGoalModalOpen(false);
                  }
                }}
              />
              <p class="text-xs opacity-40 mt-1.5">Cmd/Ctrl+Enter to save</p>
            </div>
            <div class="modal-action px-5 pb-5 pt-0">
              <button class="btn btn-ghost btn-sm" onClick={() => setIsGoalModalOpen(false)}>
                Cancel
              </button>
              <button
                class="btn btn-primary btn-sm"
                onClick={handleGoalSave}
                disabled={isSavingGoal()}
              >
                {isSavingGoal() ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </Show>
  );
}
