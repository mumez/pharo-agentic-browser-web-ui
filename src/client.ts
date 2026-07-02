import { Ripple } from "ripple-st-client";
import type { RippleError } from "ripple-st-client";
import type {
    AgentPreset,
    TopicData,
    MessageData,
    TopicSettings,
    ConfigOptionData,
    CommandData,
    TopicStatus,
} from "./types";

interface EventHandlerMap {
    messages: (messages: MessageData[], done: boolean) => void;
    messageAdded: (topicId: string, message: MessageData) => void;
    statusChanged: (topicId: string, status: TopicStatus) => void;
    modelChanged: (topicId: string, options: ConfigOptionData | null) => void;
    modeChanged: (topicId: string, options: ConfigOptionData | null) => void;
    commandsChanged: (topicId: string, commands: CommandData[]) => void;
    topicAdded: (topic: TopicData) => void;
    topicRemoved: (topicId: string) => void;
    topicsUpdated: (requesterId: string) => void;
}

type EventName = keyof EventHandlerMap;

interface PushEventBody {
    event: string;
    topicId?: string;
    message?: MessageData;
    messages?: MessageData[];
    done?: boolean;
    status?: TopicStatus;
    options?: ConfigOptionData | null;
    commands?: CommandData[];
    topic?: TopicData;
}

type OkResponse = { ok: boolean };

export class AbClient {
    private ripple: Ripple;
    private eventHandlers = new Map<string, EventHandlerMap[EventName][]>();
    private openHandler: ((client: AbClient) => void) | null = null;

    constructor(host: string, port: number, sessionId: string) {
        const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
        const url = `${wsScheme}://${host}:${port}/ws/agentic-browser?token=${sessionId}`;
        this.ripple = new Ripple(url);
        this.ripple.onOpen(() => {
            this.ripple.registerHandler(
                "serverEventPushed",
                (body: unknown, err: RippleError | null) => {
                    if (err) {
                        console.error("Push error:", err);
                        return;
                    }
                    this.handlePushEvent(body);
                }
            );
            this.ripple.registerHandler(
                "topicsUpdated",
                (body: unknown, err: RippleError | null) => {
                    if (err) {
                        console.error("topicsUpdated error:", err);
                        return;
                    }
                    this.handleTopicsUpdated(body as { requesterId: string });
                }
            );
            if (this.openHandler) this.openHandler(this);
        });
    }

    onOpen(handler: (client: AbClient) => void) {
        this.openHandler = handler;
    }

    onClose(handler: () => void) {
        this.ripple.onClose(handler);
    }

    onError(handler: (err: RippleError) => void) {
        this.ripple.onError(handler);
    }

    close() {
        this.ripple.close();
    }

    private handlePushEvent(body: unknown) {
        if (!body || typeof body !== "object" || !("event" in body)) return;
        const pb = body as PushEventBody;
        const eventName = pb.event;

        if (eventName === "messages") {
            const handlers = (this.eventHandlers.get("messages") ??
                []) as EventHandlerMap["messages"][];
            handlers.forEach((fn) => fn(pb.messages ?? [], pb.done ?? false));
        } else if (eventName === "messageAdded") {
            const handlers = (this.eventHandlers.get("messageAdded") ??
                []) as EventHandlerMap["messageAdded"][];
            handlers.forEach((fn) => fn(pb.topicId!, pb.message!));
        } else if (eventName === "statusChanged") {
            const handlers = (this.eventHandlers.get("statusChanged") ??
                []) as EventHandlerMap["statusChanged"][];
            handlers.forEach((fn) => fn(pb.topicId!, pb.status!));
        } else if (eventName === "modelChanged") {
            const handlers = (this.eventHandlers.get("modelChanged") ??
                []) as EventHandlerMap["modelChanged"][];
            handlers.forEach((fn) => fn(pb.topicId!, pb.options ?? null));
        } else if (eventName === "modeChanged") {
            const handlers = (this.eventHandlers.get("modeChanged") ??
                []) as EventHandlerMap["modeChanged"][];
            handlers.forEach((fn) => fn(pb.topicId!, pb.options ?? null));
        } else if (eventName === "commandsChanged") {
            const handlers = (this.eventHandlers.get("commandsChanged") ??
                []) as EventHandlerMap["commandsChanged"][];
            handlers.forEach((fn) => fn(pb.topicId!, pb.commands ?? []));
        } else if (eventName === "topicAdded") {
            const handlers = (this.eventHandlers.get("topicAdded") ??
                []) as EventHandlerMap["topicAdded"][];
            handlers.forEach((fn) => fn(pb.topic!));
        } else if (eventName === "topicRemoved") {
            const handlers = (this.eventHandlers.get("topicRemoved") ??
                []) as EventHandlerMap["topicRemoved"][];
            handlers.forEach((fn) => fn(pb.topicId!));
        }
    }

    private handleTopicsUpdated(body: { requesterId: string }) {
        const handlers = (this.eventHandlers.get("topicsUpdated") ??
            []) as EventHandlerMap["topicsUpdated"][];
        handlers.forEach((fn) => fn(body.requesterId));
    }

    onEvent<K extends EventName>(event: K, handler: EventHandlerMap[K]) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(handler as EventHandlerMap[EventName]);
    }

    offEvent<K extends EventName>(event: K, handler: EventHandlerMap[K]) {
        const handlers = this.eventHandlers.get(event) ?? [];
        this.eventHandlers.set(
            event,
            handlers.filter((fn) => fn !== (handler as EventHandlerMap[EventName]))
        );
    }

    listAgents(): Promise<AgentPreset[]> {
        return new Promise((resolve, reject) => {
            this.ripple.request("/agents/list", {}, (body: unknown, err: RippleError | null) => {
                if (err) return reject(err);
                resolve((body as { agents: AgentPreset[] }).agents);
            });
        });
    }

    listTopics(): Promise<TopicData[]> {
        return new Promise((resolve, reject) => {
            this.ripple.request("/topics/list", {}, (body: unknown, err: RippleError | null) => {
                if (err) return reject(err);
                resolve((body as { topics: TopicData[] }).topics);
            });
        });
    }

    createTopic(title: string = "Untitled", agentArguments: string[] = []): Promise<string> {
        return new Promise((resolve, reject) => {
            this.ripple.request(
                "/topics/create",
                { title, agentArguments },
                (body: unknown, err: RippleError | null) => {
                    if (err) return reject(err);
                    resolve((body as { topicId: string }).topicId);
                }
            );
        });
    }

    setTitle(topicId: string, title: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.ripple.request(
                "/topic/setTitle",
                { topicId, title },
                (body: unknown, err: RippleError | null) => {
                    if (err) return reject(err);
                    resolve((body as OkResponse).ok);
                }
            );
        });
    }

    deleteTopic(topicId: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.ripple.request(
                "/topic/delete",
                { topicId },
                (body: unknown, err: RippleError | null) => {
                    if (err) return reject(err);
                    resolve((body as OkResponse).ok);
                }
            );
        });
    }

    setAgent(topicId: string, agentArguments: string[]): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.ripple.request(
                "/topic/setAgent",
                { topicId, agentArguments },
                (body: unknown, err: RippleError | null) => {
                    if (err) return reject(err);
                    resolve((body as OkResponse).ok);
                }
            );
        });
    }

    setGoal(topicId: string, goal: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.ripple.request(
                "/topic/setGoal",
                { topicId, goal },
                (body: unknown, err: RippleError | null) => {
                    if (err) return reject(err);
                    resolve((body as OkResponse).ok);
                }
            );
        });
    }

    setModel(topicId: string, optionId: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.ripple.request(
                "/topic/setModel",
                { topicId, optionId },
                (body: unknown, err: RippleError | null) => {
                    if (err) return reject(err);
                    resolve((body as OkResponse).ok);
                }
            );
        });
    }

    setMode(topicId: string, optionId: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.ripple.request(
                "/topic/setMode",
                { topicId, optionId },
                (body: unknown, err: RippleError | null) => {
                    if (err) return reject(err);
                    resolve((body as OkResponse).ok);
                }
            );
        });
    }

    selectTopic(topicId: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.ripple.request(
                "/topic/select",
                { topicId },
                (body: unknown, err: RippleError | null) => {
                    if (err) return reject(err);
                    resolve((body as OkResponse).ok);
                }
            );
        });
    }

    getAllMessages(topicId: string, onChunk?: (messages: MessageData[], done: boolean) => void) {
        if (onChunk) {
            const handleMessages = (messages: MessageData[], done: boolean) => {
                onChunk(messages, done);
                if (done) {
                    this.offEvent("messages", handleMessages);
                }
            };
            this.onEvent("messages", handleMessages);
        }
        this.ripple.send("/messages/getAll", { topicId });
    }

    sendPrompt(topicId: string, text: string) {
        this.ripple.send("/prompt/send", { topicId, text });
    }

    cancelPrompt(topicId: string) {
        this.ripple.send("/prompt/cancel", { topicId });
    }

    resolveApproval(topicId: string, optionId: string) {
        this.ripple.send("/approval/resolve", { topicId, optionId });
    }

    copyTopic(topicId: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.ripple.request(
                "/topic/copy",
                { topicId },
                (body: unknown, err: RippleError | null) => {
                    if (err) return reject(err);
                    resolve((body as { topicId: string }).topicId);
                }
            );
        });
    }

    getSettings(topicId: string): Promise<TopicSettings> {
        return new Promise((resolve, reject) => {
            this.ripple.request(
                "/topic/getSettings",
                { topicId },
                (body: unknown, err: RippleError | null) => {
                    if (err) return reject(err);
                    resolve((body as { settings: TopicSettings }).settings);
                }
            );
        });
    }

    setSettings(topicId: string, settings: Partial<TopicSettings>): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.ripple.request(
                "/topic/setSettings",
                { topicId, settings },
                (body: unknown, err: RippleError | null) => {
                    if (err) return reject(err);
                    resolve((body as OkResponse).ok);
                }
            );
        });
    }

    saveApp(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.ripple.request("/app/save", {}, (body: unknown, err: RippleError | null) => {
                if (err) return reject(err);
                resolve((body as OkResponse).ok);
            });
        });
    }
}
