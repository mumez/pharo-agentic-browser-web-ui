import type { AgentPreset, MessageData } from "./types";

export function agentDisplayName(agentArguments: string[], agents: AgentPreset[]): string {
    const key = agentArguments.join(" ");
    return agents.find((a) => a.command.join(" ") === key)?.name ?? (key || "no arguments");
}

export const isApprovalMessage = (message: Pick<MessageData, "type">) =>
    message.type === "aiPermission" || message.type === "exportApproval";

export const isPendingApprovalMessage = (message: Pick<MessageData, "type" | "approvalOption">) =>
    isApprovalMessage(message) && message.approvalOption === null;
