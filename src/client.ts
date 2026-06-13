import { Ripple } from 'ripple-st-client';
import type {
  AgentPreset,
  TopicData,
  MessageData,
} from './types';

export class AbClient {
  private ripple: Ripple;
  private eventHandlers: Map<string, Function[]> = new Map();
  private openHandler: ((client: AbClient) => void) | null = null;

  constructor(host: string, port: number, sessionId: string) {
    const url = `ws://${host}:${port}/ws/agentic-browser?token=${sessionId}`;
    this.ripple = new Ripple(url);
    this.ripple.onOpen(() => {
      this.ripple.registerHandler('serverEventPushed', (body: any, err: any) => {
        if (err) {
          console.error('Push error:', err);
          return;
        }
        this.handlePushEvent(body);
      });
      this.ripple.registerHandler('topicsUpdated', (body: any, err: any) => {
        if (err) {
          console.error('topicsUpdated error:', err);
          return;
        }
        this.handleTopicsUpdated(body);
      });
      if (this.openHandler) this.openHandler(this);
    });
  }

  onOpen(handler: (client: AbClient) => void) {
    this.openHandler = handler;
  }

  onClose(handler: () => void) {
    this.ripple.onClose(handler);
  }

  onError(handler: (err: any) => void) {
    this.ripple.onError(handler);
  }

  close() {
    this.ripple.close();
  }

  private handlePushEvent(body: any) {
    if (!body || typeof body.event !== 'string') return;
    const eventName = body.event;
    const handlers = this.eventHandlers.get(eventName) || [];
    
    if (eventName === 'messages') {
      handlers.forEach((fn) => fn(body.messages, body.done));
    } else if (eventName === 'messageAdded') {
      handlers.forEach((fn) => fn(body.message));
    } else if (eventName === 'statusChanged') {
      handlers.forEach((fn) => fn(body.topicId, body.status));
    } else if (eventName === 'modelChanged' || eventName === 'modeChanged') {
      handlers.forEach((fn) => fn(body.topicId, body.options));
    } else if (eventName === 'commandsChanged') {
      handlers.forEach((fn) => fn(body.topicId, body.commands));
    } else if (eventName === 'topicAdded') {
      handlers.forEach((fn) => fn(body.topic));
    } else {
      handlers.forEach((fn) => fn(body));
    }
  }

  private handleTopicsUpdated(body: any) {
    const handlers = this.eventHandlers.get('topicsUpdated') || [];
    handlers.forEach((fn) => fn(body.requesterId));
  }

  onEvent(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  offEvent(event: string, handler: Function) {
    const handlers = this.eventHandlers.get(event) || [];
    this.eventHandlers.set(event, handlers.filter((fn) => fn !== handler));
  }

  listAgents(): Promise<AgentPreset[]> {
    return new Promise((resolve, reject) => {
      this.ripple.request('/agents/list', {}, (body: any, err: any) => {
        if (err) return reject(err);
        resolve(body.agents);
      });
    });
  }

  listTopics(): Promise<TopicData[]> {
    return new Promise((resolve, reject) => {
      this.ripple.request('/topics/list', {}, (body: any, err: any) => {
        if (err) return reject(err);
        resolve(body.topics);
      });
    });
  }

  createTopic(title: string = 'Untitled', agentArguments: string[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
      this.ripple.request('/topics/create', { title, agentArguments }, (body: any, err: any) => {
        if (err) return reject(err);
        resolve(body.topicId);
      });
    });
  }

  setTitle(topicId: string, title: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.ripple.request('/topics/setTitle', { topicId, title }, (body: any, err: any) => {
        if (err) return reject(err);
        resolve(body.ok);
      });
    });
  }

  deleteTopic(topicId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.ripple.request('/topics/delete', { topicId }, (body: any, err: any) => {
        if (err) return reject(err);
        resolve(body.ok);
      });
    });
  }

  setAgent(topicId: string, agentArguments: string[]): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.ripple.request('/topics/setAgent', { topicId, agentArguments }, (body: any, err: any) => {
        if (err) return reject(err);
        resolve(body.ok);
      });
    });
  }

  setGoal(topicId: string, goal: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.ripple.request('/topics/setGoal', { topicId, goal }, (body: any, err: any) => {
        if (err) return reject(err);
        resolve(body.ok);
      });
    });
  }

  selectTopic(topicId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.ripple.request('/topics/select', { topicId }, (body: any, err: any) => {
        if (err) return reject(err);
        resolve(body.ok);
      });
    });
  }

  getAllMessages(topicId: string, onChunk?: (messages: MessageData[], done: boolean) => void) {
    if (onChunk) {
      const handleMessages = (messages: MessageData[], done: boolean) => {
        onChunk(messages, done);
        if (done) {
          this.offEvent('messages', handleMessages);
        }
      };
      this.onEvent('messages', handleMessages);
    }
    this.ripple.send('/messages/getAll', { topicId });
  }

  sendPrompt(topicId: string, text: string) {
    this.ripple.send('/prompt/send', { topicId, text });
  }

  cancelPrompt(topicId: string) {
    this.ripple.send('/prompt/cancel', { topicId });
  }

  resolveApproval(topicId: string, optionId: string) {
    this.ripple.send('/approval/resolve', { topicId, optionId });
  }

  saveApp(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.ripple.request('/app/save', {}, (body: any, err: any) => {
        if (err) return reject(err);
        resolve(body.ok);
      });
    });
  }
}
