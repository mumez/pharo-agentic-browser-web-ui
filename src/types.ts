export type TopicStatus = 'initial' | 'working' | 'waitingForHuman' | 'endTurn' | 'goalAchieved';

export interface TopicData {
  topicId: string;
  title: string;
  name: string;
  status: TopicStatus;
  agentArguments: string[];
  currentModel: string;
  currentMode: string;
  lastUpdated: string;
}

export type MessageSender = 'human' | 'ai' | 'system';

export type MessageType = 'normal' | 'think' | 'aiPermission' | 'exportApproval';

export interface ApprovalOption {
  label: string;
  optionId: string;
}

export interface MessageData {
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

export interface RippleError {
  type: 'err';
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
  event: 'messages';
  messages: MessageData[];
  done: boolean;
}

export interface MessageAddedEvent {
  event: 'messageAdded';
  message: MessageData;
}

export interface StatusChangedEvent {
  event: 'statusChanged';
  topicId: string;
  status: TopicStatus;
}

export interface ModelChangedEvent {
  event: 'modelChanged';
  topicId: string;
  options: OptionData[];
}

export interface ModeChangedEvent {
  event: 'modeChanged';
  topicId: string;
  options: OptionData[];
}

export interface CommandsChangedEvent {
  event: 'commandsChanged';
  topicId: string;
  commands: OptionData[];
}

export interface TopicAddedEvent {
  event: 'topicAdded';
  topic: TopicData;
}

export interface TopicsUpdatedEvent {
  event: 'topicsUpdated';
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
