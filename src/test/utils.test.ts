import { describe, expect, it } from "vitest";
import type { TopicSettings } from "../types";
import { topicSettingsForUpdate } from "../utils";

const baseSettings: TopicSettings = {
    useCommandOnGoalSet: true,
    goalSetCommand: "/goal",
    useDefaultMcpServers: true,
    aiPermissionWaitTimeoutSeconds: 1800,
    aiPermissionTimeoutOption: "reject_once",
    initialPromptSkill: "/smalltalk-dev:st-buddy",
    useStBuddySkillOnInitialPrompt: true,
};

describe("topicSettingsForUpdate", () => {
    it("drops the legacy useStBuddySkillOnInitialPrompt flag", () => {
        const payload = topicSettingsForUpdate(baseSettings);
        expect(payload).not.toHaveProperty("useStBuddySkillOnInitialPrompt");
        expect(payload).toEqual({
            useCommandOnGoalSet: true,
            goalSetCommand: "/goal",
            useDefaultMcpServers: true,
            aiPermissionWaitTimeoutSeconds: 1800,
            aiPermissionTimeoutOption: "reject_once",
            initialPromptSkill: "/smalltalk-dev:st-buddy",
        });
    });

    it("trims initialPromptSkill", () => {
        const payload = topicSettingsForUpdate({
            ...baseSettings,
            initialPromptSkill: "  $st-buddy ",
        });
        expect(payload.initialPromptSkill).toBe("$st-buddy");
    });

    it("keeps an empty initialPromptSkill as no skill", () => {
        const payload = topicSettingsForUpdate({ ...baseSettings, initialPromptSkill: "   " });
        expect(payload.initialPromptSkill).toBe("");
    });
});
