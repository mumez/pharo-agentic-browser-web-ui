import type { AgentPreset } from "./types";

export function agentDisplayName(agentArguments: string[], agents: AgentPreset[]): string {
    const key = agentArguments.join(" ");
    return agents.find((a) => a.command.join(" ") === key)?.name ?? (key || "no arguments");
}
