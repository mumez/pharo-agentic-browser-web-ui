import { For } from "solid-js";
import type { MessageData } from "../../types";

interface ApprovalMessageProps {
    message: MessageData;
    /** True when this is the latest unresolved approval and nothing has been submitted yet. */
    isActive: boolean;
    /** Option submitted locally, before the server confirms the resolution. */
    submittedOptionId: string | undefined;
    onResolve: (optionId: string) => void;
}

export default function ApprovalMessage(props: ApprovalMessageProps) {
    return (
        <div class="card bg-warning/10 border border-warning/30 p-4 rounded-2xl my-3 flex flex-col gap-3">
            <div class="flex items-center gap-2 text-warning font-semibold text-sm">
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
                        stroke-width="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>
                <span>
                    {props.message.type === "exportApproval"
                        ? "Package Export Approval Requested"
                        : "Agent Permission Requested"}
                </span>
            </div>
            <p class="text-sm font-mono bg-base-100/50 p-2.5 rounded-lg border border-base-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                {props.message.text}
            </p>

            <div class="flex flex-wrap gap-2 mt-1">
                <For each={props.message.approvalOptions}>
                    {(opt) => {
                        const isSelected = () =>
                            props.message.approvalOption === opt.optionId ||
                            props.submittedOptionId === opt.optionId;
                        return (
                            <button
                                class={`btn btn-sm rounded-lg transition-all ${
                                    isSelected()
                                        ? "btn-success text-success-content hover:btn-success"
                                        : props.isActive
                                          ? "btn-warning hover:bg-warning/80"
                                          : "btn-ghost btn-disabled opacity-40"
                                }`}
                                disabled={!props.isActive}
                                onClick={() => props.onResolve(opt.optionId)}
                            >
                                {opt.label}
                                {isSelected() && " ✓"}
                            </button>
                        );
                    }}
                </For>
            </div>
        </div>
    );
}
