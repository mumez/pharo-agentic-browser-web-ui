import { onMount, Show, createSignal, createEffect } from "solid-js";
import { AbProvider, useAb } from "./store";
import Sidebar from "./components/Sidebar";
import ChatConsole from "./components/ChatConsole";
import InputArea from "./components/InputArea";

function AppContent() {
    const { connect, state, clearError, deselectTopic } = useAb();
    const [mobileView, setMobileView] = createSignal<"sidebar" | "chat">("sidebar");

    onMount(() => {
        // Dynamically connect to the origin host so mobile LAN browsers work.
        // Port is set at build time via PHARO_RIPPLE_PORT env var (default: 8080).
        const host = window.location.hostname || "localhost";
        connect(host, __RIPPLE_PORT__);
    });

    // Auto-switch to chat when a topic is selected, to sidebar when deselected
    createEffect(() => {
        if (state.selectedTopicId) {
            setMobileView("chat");
        } else if (mobileView() === "chat") {
            setMobileView("sidebar");
        }
    });

    return (
        <div class="h-[100dvh] w-screen flex bg-base-100 overflow-hidden text-base-content font-sans">
            {/* Error Toast — outside mobile view containers so it shows on both sidebar and chat views */}
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

            {/* Sidebar (Topics list) — full-screen on mobile when active */}
            <div
                class={`${mobileView() === "sidebar" ? "flex" : "hidden"} md:flex w-full md:w-80 md:shrink-0 flex-col h-full overflow-hidden`}
            >
                <Sidebar />
            </div>

            {/* Main Area — full-screen on mobile when active */}
            <div
                class={`${mobileView() === "chat" ? "flex" : "hidden"} md:flex flex-1 flex-col h-full overflow-hidden relative bg-base-100`}
            >
                {/* Conversation Logs */}
                <ChatConsole
                    onBack={() => {
                        deselectTopic();
                        setMobileView("sidebar");
                    }}
                />

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
