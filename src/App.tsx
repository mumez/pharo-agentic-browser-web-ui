import { onMount, Show } from 'solid-js';
import { AbProvider, useAb } from './store';
import Sidebar from './components/Sidebar';
import ChatConsole from './components/ChatConsole';
import InputArea from './components/InputArea';

function AppContent() {
  const { connect, state, clearError } = useAb();

  onMount(() => {
    // Dynamically connect to the origin host so mobile LAN browsers work.
    // Port is set at build time via PHARO_RIPPLE_PORT env var (default: 8080).
    const host = window.location.hostname || 'localhost';
    connect(host, __RIPPLE_PORT__);
  });

  return (
    <div class="h-screen w-screen flex bg-base-100 overflow-hidden text-base-content font-sans">
      {/* Sidebar (Topics list) */}
      <Sidebar />

      {/* Main Area */}
      <div class="flex-1 flex flex-col h-full overflow-hidden relative bg-base-100">
        {/* Error Toast */}
        <Show when={state.error}>
          <div class="toast toast-top toast-end z-50">
            <div class="alert alert-error shadow-lg rounded-2xl flex items-center justify-between gap-4">
              <span class="text-xs font-semibold">{state.error}</span>
              <button class="btn btn-xs btn-circle btn-ghost" onClick={clearError}>
                ✕
              </button>
            </div>
          </div>
        </Show>

        {/* Conversation Logs */}
        <ChatConsole />

        {/* Input Area */}
        <InputArea />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AbProvider>
      <AppContent />
    </AbProvider>
  );
}
