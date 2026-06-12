import { createSignal, Show } from 'solid-js';
import { useAb } from '../store';

export default function InputArea() {
  const { state, selectedTopic, sendPrompt, cancelPrompt } = useAb();
  const [inputText, setInputText] = createSignal('');
  let textareaRef: HTMLTextAreaElement | undefined;

  const handleSend = () => {
    const text = inputText().trim();
    if (!text) return;

    sendPrompt(text);
    setInputText('');
    if (textareaRef) {
      textareaRef.style.height = 'auto';
    }
  };

  const isWorking = () => selectedTopic()?.status === 'working';

  return (
    <Show when={state.selectedTopicId}>
      <div class="p-4 border-t border-base-300 bg-base-100 flex flex-col gap-3">
        {/* Goal Banner in input area if set */}
        <Show when={selectedTopic()?.status !== 'initial'}>
          <div class="text-xs opacity-60 flex items-center gap-1 select-none">
            <span class="font-semibold text-primary">Goal:</span>
            <span class="truncate max-w-[500px]">
              {selectedTopic()?.name || 'Collaborating on Pharo tasks'}
            </span>
          </div>
        </Show>

        <div class="flex gap-2 items-end">
          {/* Text Input Area */}
          <div class="flex-1 relative">
            <textarea
              class="textarea textarea-bordered w-full pr-12 rounded-2xl min-h-[44px] max-h-40 resize-none py-2.5 font-sans leading-relaxed text-sm focus:outline-primary"
              placeholder={
                isWorking()
                  ? 'Agent is processing... please wait or cancel'
                  : 'Ask agent to implement code, run tests, or search class...'
              }
              value={inputText()}
              onInput={(e) => setInputText(e.currentTarget.value)}
              disabled={isWorking()}
              rows={1}
              style={{
                height: 'auto',
              }}
              ref={(el) => {
                textareaRef = el;
                el.addEventListener('input', () => {
                  el.style.height = 'auto';
                  el.style.height = `${el.scrollHeight}px`;
                });
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
                class="btn btn-error btn-outline rounded-xl px-4 h-full min-h-0 flex items-center gap-1.5 animate-pulse"
                onClick={cancelPrompt}
              >
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
              </button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
