import type { AgentPreset, MessageData, TopicSettings } from "./types";

export function agentDisplayName(agentArguments: string[], agents: AgentPreset[]): string {
    const key = agentArguments.join(" ");
    return agents.find((a) => a.command.join(" ") === key)?.name ?? (key || "no arguments");
}

export const isApprovalMessage = (message: Pick<MessageData, "type">) =>
    message.type === "aiPermission" || message.type === "exportApproval";

export const isPendingApprovalMessage = (message: Pick<MessageData, "type" | "approvalOption">) =>
    isApprovalMessage(message) && message.approvalOption === null;

/**
 * Payload for /topic/setSettings: drops the legacy useStBuddySkillOnInitialPrompt flag
 * (derived from initialPromptSkill on the server) and trims initialPromptSkill.
 */
export function topicSettingsForUpdate(settings: TopicSettings): Partial<TopicSettings> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { useStBuddySkillOnInitialPrompt, ...rest } = settings;
    return rest.initialPromptSkill === undefined
        ? rest
        : { ...rest, initialPromptSkill: rest.initialPromptSkill.trim() };
}
