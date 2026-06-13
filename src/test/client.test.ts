import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AbClient } from '../client';
import { MockWebSocket } from './mocks';

// Stub the global WebSocket
vi.stubGlobal('WebSocket', MockWebSocket);

describe('AbClient', () => {
  let client: AbClient;
  const sessionId = 'test-session-uuid';

  beforeEach(() => {
    MockWebSocket.clearInstances();
    // Reinitialize client
    client = new AbClient('localhost', 8080, sessionId);
  });

  it('should initialize connection and trigger onOpen', async () => {
    const onOpen = vi.fn();
    client.onOpen(onOpen);

    // Wait for mock connection timeout
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onOpen).toHaveBeenCalled();
    const ws = MockWebSocket.lastInstance();
    expect(ws).toBeDefined();
    expect(ws?.url).toContain('ws://localhost:8080/ws/agentic-browser?token=test-session-uuid');
  });

  it('should handle request-reply for listTopics', async () => {
    // Wait for connection
    await new Promise((resolve) => setTimeout(resolve, 10));
    const ws = MockWebSocket.lastInstance()!;

    // Call API
    const listPromise = client.listTopics();

    // Verify request envelope sent
    const sent = ws.getSentJSON();
    // index 0 is ping from ripple-st-client, index 1 is our request
    const request = sent.find((m) => m.type === 'request' && m.address === '/topics/list');
    expect(request).toBeDefined();
    expect(request.correlationId).toBeDefined();

    // Simulate server reply
    ws.simulateMessageFromServer({
      type: 'reply',
      address: '/topics/list',
      correlationId: request.correlationId,
      body: {
        topics: [
          {
            topicId: 't1',
            title: 'Test Topic',
            name: 'test-topic',
            status: 'initial',
            agentArguments: [],
            currentModel: '',
            currentMode: '',
            lastUpdated: '2026-06-11T10:00:00Z',
          },
        ],
      },
    });

    const topics = await listPromise;
    expect(topics).toHaveLength(1);
    expect(topics[0].topicId).toBe('t1');
    expect(topics[0].title).toBe('Test Topic');
  });

  it('should handle request-reply for listAgents', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    const ws = MockWebSocket.lastInstance()!;

    const agentsPromise = client.listAgents();

    const sent = ws.getSentJSON();
    const request = sent.find((m) => m.type === 'request' && m.address === '/agents/list');
    expect(request).toBeDefined();

    ws.simulateMessageFromServer({
      type: 'reply',
      address: '/agents/list',
      correlationId: request.correlationId,
      body: {
        agents: [
          { name: 'claude-agent-acp', command: ['claude-agent-acp'] },
          { name: 'Gemini CLI', command: ['gemini', '--acp'] },
        ],
      },
    });

    const agents = await agentsPromise;
    expect(agents).toHaveLength(2);
    expect(agents[0].name).toBe('claude-agent-acp');
    expect(agents[1].command).toEqual(['gemini', '--acp']);
  });

  it('should handle selectTopic reply as ok boolean only', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    const ws = MockWebSocket.lastInstance()!;

    const selectPromise = client.selectTopic('t1');

    const sent = ws.getSentJSON();
    const request = sent.find((m) => m.type === 'request' && m.address === '/topic/select');
    expect(request).toBeDefined();
    expect(request.body).toEqual({ topicId: 't1' });

    ws.simulateMessageFromServer({
      type: 'reply',
      address: '/topic/select',
      correlationId: request.correlationId,
      body: { ok: true },
    });

    const ok = await selectPromise;
    expect(ok).toBe(true);
  });

  it('should support sending prompt and canceling', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    const ws = MockWebSocket.lastInstance()!;

    client.sendPrompt('t1', 'hello agent');
    let sent = ws.getSentJSON();
    let promptSend = sent.find((m) => m.type === 'send' && m.address === '/prompt/send');
    expect(promptSend).toBeDefined();
    expect(promptSend.body).toEqual({ topicId: 't1', text: 'hello agent' });

    client.cancelPrompt('t1');
    sent = ws.getSentJSON();
    let promptCancel = sent.find((m) => m.type === 'send' && m.address === '/prompt/cancel');
    expect(promptCancel).toBeDefined();
    expect(promptCancel.body).toEqual({ topicId: 't1' });
  });

  it('should receive messages chunk via getAllMessages', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    const ws = MockWebSocket.lastInstance()!;

    const onChunk = vi.fn();
    client.getAllMessages('t1', onChunk);

    // Verify /messages/getAll send was sent
    const sent = ws.getSentJSON();
    const getAll = sent.find((m) => m.type === 'send' && m.address === '/messages/getAll');
    expect(getAll).toBeDefined();
    expect(getAll.body).toEqual({ topicId: 't1' });

    // Simulate chunks pushed via serverEventPushed address
    ws.simulateMessageFromServer({
      type: 'send',
      address: 'serverEventPushed',
      body: {
        event: 'messages',
        messages: [{ id: 'msg-1', sender: 'human', text: 'hi', type: 'normal', approvalOptions: [], approvalOption: null, lastUpdated: '' }],
        done: false,
      },
    });

    ws.simulateMessageFromServer({
      type: 'send',
      address: 'serverEventPushed',
      body: {
        event: 'messages',
        messages: [{ id: 'msg-2', sender: 'ai', text: 'hello', type: 'normal', approvalOptions: [], approvalOption: null, lastUpdated: '' }],
        done: true,
      },
    });

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk.mock.calls[0][0]).toHaveLength(1);
    expect(onChunk.mock.calls[0][1]).toBe(false); // done = false
    expect(onChunk.mock.calls[1][1]).toBe(true); // done = true
  });

  it('should send register for topicsUpdated on connect', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    const ws = MockWebSocket.lastInstance()!;

    const sent = ws.getSentJSON();
    const registerMsg = sent.find((m) => m.type === 'register' && m.address === 'topicsUpdated');
    expect(registerMsg).toBeDefined();
  });

  it('should fire topicsUpdated event on publish', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    const ws = MockWebSocket.lastInstance()!;

    const onTopicsUpdated = vi.fn();
    client.onEvent('topicsUpdated', onTopicsUpdated);

    ws.simulateMessageFromServer({
      type: 'publish',
      address: 'topicsUpdated',
      body: { event: 'topicsUpdated', requesterId: 'other-session-id' },
    });

    expect(onTopicsUpdated).toHaveBeenCalledWith('other-session-id');
  });

  it('should handle push events for messageAdded and statusChanged', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    const ws = MockWebSocket.lastInstance()!;

    const onMessageAdded = vi.fn();
    const onStatusChanged = vi.fn();

    client.onEvent('messageAdded', onMessageAdded);
    client.onEvent('statusChanged', onStatusChanged);

    // Simulate messageAdded push event via serverEventPushed
    const messageMock = { id: 'msg-uuid-1', sender: 'ai', text: 'thinking...', type: 'think', approvalOptions: [], approvalOption: null, lastUpdated: '' };
    ws.simulateMessageFromServer({
      type: 'send',
      address: 'serverEventPushed',
      body: {
        event: 'messageAdded',
        message: messageMock,
      },
    });

    // Simulate statusChanged push event via serverEventPushed
    ws.simulateMessageFromServer({
      type: 'send',
      address: 'serverEventPushed',
      body: {
        event: 'statusChanged',
        topicId: 't1',
        status: 'working',
      },
    });

    expect(onMessageAdded).toHaveBeenCalledWith(messageMock);
    expect(onStatusChanged).toHaveBeenCalledWith('t1', 'working');
  });
});
