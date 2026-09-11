import { createSignal, Show } from "solid-js";
import type { AgentPreset, TopicData } from "../types";
import { agentDisplayName } from "../utils";

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

interface TopicListItemProps {
    topic: TopicData;
    agents: AgentPreset[];
    isSelected: boolean;
    isDeleting: boolean;
    onSelect: () => void;
    onOpenSettings: () => void;
    onSwitchAgent: () => void;
    onDelete: () => void;
    onCopy: () => void;
    onRename: (newTitle: string) => void;
}

export default function TopicListItem(props: TopicListItemProps) {
    const [isEditing, setIsEditing] = createSignal(false);
    const [editingTitle, setEditingTitle] = createSignal("");
    const [actionMenuOpen, setActionMenuOpen] = createSignal(false);

    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let suppressNextClick = false;

    const startLongPress = () => {
        if (longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
            setActionMenuOpen(true);
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

    const startRename = () => {
        setEditingTitle(props.topic.title);
        setIsEditing(true);
    };

    const saveRename = () => {
        if (!editingTitle().trim()) return;
        props.onRename(editingTitle().trim());
        setIsEditing(false);
    };

    const isDeleteDisabled = () => props.topic.status === "working" || props.isDeleting;

    const menuAction = (action: () => void) => {
        setActionMenuOpen(false);
        action();
    };

    return (
        <div
            onClick={() => {
                if (suppressNextClick) {
                    suppressNextClick = false;
                    return;
                }
                if (!isEditing()) props.onSelect();
            }}
            onPointerDown={(e) => {
                if (e.pointerType === "mouse") return;
                startLongPress();
            }}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onContextMenu={(e) => e.preventDefault()}
            class={`group flex flex-col p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                props.isDeleting
                    ? "opacity-40 pointer-events-none"
                    : props.isSelected
                      ? "bg-primary text-primary-content shadow-lg shadow-primary/20 translate-x-1"
                      : "hover:bg-base-300 text-base-content/90"
            }`}
        >
            {/* Topic Line 1: Title & Status */}
            <div class="flex items-center justify-between w-full min-w-0">
                <Show
                    when={isEditing()}
                    fallback={
                        <span class="font-medium truncate flex-1 pr-2 text-sm md:text-base">
                            {props.topic.title}
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
                            if (e.key === "Enter") saveRename();
                            if (e.key === "Escape") setIsEditing(false);
                        }}
                        autofocus
                    />
                </Show>
                <span class={`badge badge-sm ${getStatusBadgeClass(props.topic.status)}`}>
                    {getStatusText(props.topic.status)}
                </span>
            </div>

            {/* Topic Line 2: Details & Actions */}
            <div class="flex items-center justify-between mt-2 pt-1 border-t border-current/10 text-xs opacity-75">
                <Show
                    when={props.agents.length > 0 && props.topic.status !== "working"}
                    fallback={
                        <span
                            class={`truncate max-w-[150px] ${props.topic.status === "working" ? "opacity-50" : ""}`}
                        >
                            {agentDisplayName(props.topic.agentArguments, props.agents)}
                        </span>
                    }
                >
                    <button
                        class="flex items-center gap-1 max-w-[150px] hover:underline underline-offset-2 cursor-pointer transition-opacity"
                        title="Switch agent"
                        onClick={(e) => {
                            e.stopPropagation();
                            props.onSwitchAgent();
                        }}
                    >
                        <span class="truncate">
                            {agentDisplayName(props.topic.agentArguments, props.agents)}
                        </span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-3 w-3 shrink-0"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                clip-rule="evenodd"
                            />
                        </svg>
                    </button>
                </Show>

                {/* Action Buttons (desktop: hover to reveal) */}
                <div
                    class={`flex items-center gap-1 transition-opacity duration-150 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto`}
                >
                    <Show
                        when={isEditing()}
                        fallback={
                            <>
                                <button
                                    class="btn btn-ghost btn-xs btn-circle text-current! hover:bg-current/10"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        props.onOpenSettings();
                                    }}
                                    title="Settings"
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
                                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                        />
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                        />
                                    </svg>
                                </button>
                                <button
                                    class="btn btn-ghost btn-xs btn-circle text-current! hover:bg-current/10"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        startRename();
                                    }}
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
                                    class="btn btn-ghost btn-xs btn-circle text-current! hover:bg-current/10"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        props.onCopy();
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
                                    class={`btn btn-ghost btn-xs btn-circle text-current! hover:bg-error hover:text-error-content! ${
                                        isDeleteDisabled() ? "btn-disabled opacity-30" : ""
                                    }`}
                                    disabled={isDeleteDisabled()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!confirm("Delete this topic?")) return;
                                        props.onDelete();
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
                            class="btn btn-ghost btn-xs btn-circle text-current! hover:bg-success hover:text-success-content!"
                            onClick={(e) => {
                                e.stopPropagation();
                                saveRename();
                            }}
                        >
                            ✓
                        </button>
                        <button
                            class="btn btn-ghost btn-xs btn-circle text-current! hover:bg-error hover:text-error-content!"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(false);
                            }}
                        >
                            ✕
                        </button>
                    </Show>
                </div>
            </div>

            {/* Mobile Action Menu Modal (opened via long-press) */}
            <Show when={actionMenuOpen()}>
                <div
                    class="modal modal-open"
                    onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuOpen(false);
                    }}
                >
                    <div
                        class="modal-box max-w-xs rounded-2xl bg-base-100 shadow-2xl p-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p class="px-3 pt-2 pb-1 text-xs opacity-60 truncate">{props.topic.title}</p>
                        <ul class="menu w-full">
                            <li>
                                <button onClick={() => menuAction(props.onOpenSettings)}>
                                    Settings
                                </button>
                            </li>
                            <li>
                                <button onClick={() => menuAction(startRename)}>Set title</button>
                            </li>
                            <li>
                                <button onClick={() => menuAction(props.onCopy)}>Copy</button>
                            </li>
                            <li>
                                <button
                                    class={`text-error ${isDeleteDisabled() ? "btn-disabled opacity-30" : ""}`}
                                    disabled={isDeleteDisabled()}
                                    onClick={() => {
                                        if (!confirm("Delete this topic?")) return;
                                        menuAction(props.onDelete);
                                    }}
                                >
                                    Delete
                                </button>
                            </li>
                        </ul>
                        <button
                            class="btn btn-ghost btn-sm w-full mt-1"
                            onClick={() => setActionMenuOpen(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </Show>
        </div>
    );
}
