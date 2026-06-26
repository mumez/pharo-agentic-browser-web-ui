export type TopicStatus = "initial" | "working" | "waitingForHuman" | "endTurn" | "goalAchieved";

export interface TopicData {
    topicId: string;
    title: string;
    name: string;
    status: TopicStatus;
    agentArguments: string[];
    goal: string;
    currentModel: string;
    currentMode: string;
    lastUpdated: string;
}

export type MessageSender = "human" | "ai" | "system";

export type MessageType = "normal" | "think" | "aiPermission" | "exportApproval";

export interface ApprovalOption {
    label: string;
    optionId: string;
}

export interface MessageData {
    id: string;
    sender: MessageSender;
    text: string;
    type: MessageType;
    approvalOptions: ApprovalOption[];
    approvalOption: string | null;
    lastUpdated: string;
}

export interface OptionData {
    label: string;
    optionId: string;
    selected: boolean;
}

export interface ConfigOptionItem {
    name: string;
    value: string;
}

export interface ConfigOptionData {
    id: string;
    currentValue: string;
    type: string;
    category: string;
    options: ConfigOptionItem[];
}

export interface TopicSettings {
    useCommandOnGoalSet: boolean;
    goalSetCommand: string;
}

export interface RippleError {
    type: "err";
    failureType: string;
    failureCode: number;
    message: string;
    correlationId?: string;
}

export interface TopicsListResponse {
    topics: TopicData[];
}

export interface TopicCreateResponse {
    topicId: string;
}

export interface AgentPreset {
    name: string;
    command: string[];
}

export interface AgentsListResponse {
    agents: AgentPreset[];
}

export interface TopicSelectResponse {
    ok: boolean;
}

export interface MessagesResponse {
    event: "messages";
    messages: MessageData[];
    done: boolean;
}

export interface MessageAddedEvent {
    event: "messageAdded";
    message: MessageData;
}

export interface StatusChangedEvent {
    event: "statusChanged";
    topicId: string;
    status: TopicStatus;
}

export interface ModelChangedEvent {
    event: "modelChanged";
    topicId: string;
    options: ConfigOptionData | null;
}

export interface ModeChangedEvent {
    event: "modeChanged";
    topicId: string;
    options: ConfigOptionData | null;
}

export interface CommandData {
    name: string;
    description?: string;
    input?: {
        hint: string;
    };
}

export interface CommandsChangedEvent {
    event: "commandsChanged";
    topicId: string;
    commands: CommandData[];
}

export interface TopicAddedEvent {
    event: "topicAdded";
    topic: TopicData;
}

export interface TopicsUpdatedEvent {
    event: "topicsUpdated";
    requesterId: string;
}

export type ServerEvent =
    | MessageAddedEvent
    | StatusChangedEvent
    | ModelChangedEvent
    | ModeChangedEvent
    | CommandsChangedEvent
    | TopicAddedEvent
    | TopicsUpdatedEvent;
