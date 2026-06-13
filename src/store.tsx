import { createContext, useContext, createMemo } from 'solid-js';
import type { JSX } from 'solid-js';
import { createStore } from 'solid-js/store';
import { AbClient } from './client';
import type { AgentPreset, TopicData, MessageData, OptionData, TopicStatus } from './types';

interface AbState {
  agents: AgentPreset[];
  topics: TopicData[];
  selectedTopicId: string | null;
  messages: MessageData[];
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  availableCommands: OptionData[];
  modelOptions: OptionData[];
  modeOptions: OptionData[];
}

interface AbContextValue {
  state: AbState;
  selectedTopic: () => TopicData | null;
  connect: (host?: string, port?: number) => void;
  loadTopics: () => Promise<void>;
  createTopic: (title?: string, agentArguments?: string[]) => Promise<string>;
  renameTopic: (topicId: string, title: string) => Promise<void>;
  deleteTopic: (topicId: string) => Promise<void>;
  copyTopic: (topicId: string) => Promise<void>;
  selectTopic: (topicId: string) => Promise<void>;
  setAgent: (topicId: string, agentArguments: string[]) => Promise<void>;
  setGoal: (topicId: string, goal: string) => Promise<void>;
  sendPrompt: (text: string) => void;
  cancelPrompt: () => void;
  resolveApproval: (optionId: string) => void;
  saveApp: () => Promise<void>;
  clearError: () => void;
}

const AbContext = createContext<AbContextValue>();

export function AbProvider(props: { children: JSX.Element }) {
  const [state, setState] = createStore<AbState>({
    agents: [],
    topics: [],
    selectedTopicId: null,
    messages: [],
    isConnecting: false,
    isConnected: false,
    error: null,
    availableCommands: [],
    modelOptions: [],
    modeOptions: [],
  });

  let client: AbClient | null = null;

  const selectedTopic = createMemo(() => {
    return state.topics.find((t) => t.topicId === state.selectedTopicId) || null;
  });

  const clearError = () => setState('error', null);

  const connect = (host = 'localhost', port = 8080) => {
    if (client) {
      client.close();
    }

    setState({ isConnecting: true, isConnected: false, error: null });

    // Generate session token
    const sessionId = 'agentic-browser-' + Math.random().toString(36).substring(2, 11);

    client = new AbClient(host, port, sessionId);

    client.onOpen(() => {
      setState({ isConnecting: false, isConnected: true });
      loadAgents();
      loadTopics();
    });

    client.onClose(() => {
      setState({ isConnecting: false, isConnected: false });
    });

    client.onError((err: any) => {
      console.error('Client connection error:', err);
      setState({
        isConnecting: false,
        error: err.message || 'Connection failed',
      });
    });

    // Register push event hooks
    client.onEvent('topicAdded', (topic: TopicData) => {
      setState('topics', (prev) => {
        if (prev.some((t) => t.topicId === topic.topicId)) return prev;
        return [...prev, topic];
      });
    });

    client.onEvent('topicsUpdated', (requesterId: string) => {
      if (requesterId !== sessionId) {
        loadTopics();
      }
    });

    client.onEvent('statusChanged', (topicId: string, status: TopicStatus) => {
      setState('topics', (t) => t.topicId === topicId, 'status', status);

      // If this is the currently selected topic and status changed to endTurn, reload messages
      if (state.selectedTopicId === topicId && status === 'endTurn') {
        reloadMessages(topicId);
      }
    });

    client.onEvent('messageAdded', (message: MessageData) => {
      setState('messages', (prev) => {
        const idx = prev.findIndex((m) => m.id === message.id);
        if (idx !== -1) {
          return [...prev.slice(0, idx), message, ...prev.slice(idx + 1)];
        }
        return [...prev, message];
      });
    });

    client.onEvent('modelChanged', (topicId: string, options: OptionData[]) => {
      if (state.selectedTopicId === topicId) {
        setState('modelOptions', options);
      }
    });

    client.onEvent('modeChanged', (topicId: string, options: OptionData[]) => {
      if (state.selectedTopicId === topicId) {
        setState('modeOptions', options);
      }
    });

    client.onEvent('commandsChanged', (topicId: string, commands: OptionData[]) => {
      if (state.selectedTopicId === topicId) {
        setState('availableCommands', commands);
      }
    });
  };

  const loadAgents = async () => {
    if (!client) return;
    try {
      const agents = await client.listAgents();
      setState('agents', agents);
    } catch (err: any) {
      console.warn('Failed to load agents:', err.message);
    }
  };

  const loadTopics = async () => {
    if (!client) return;
    try {
      const list = await client.listTopics();
      setState('topics', list);
    } catch (err: any) {
      setState('error', err.message || 'Failed to load topics');
    }
  };

  const createTopic = async (title = 'Untitled', agentArguments: string[] = []): Promise<string> => {
    if (!client) throw new Error('Not connected');
    try {
      const topicId = await client.createTopic(title, agentArguments);
      await loadTopics();
      return topicId;
    } catch (err: any) {
      setState('error', err.message || 'Failed to create topic');
      throw err;
    }
  };

  const renameTopic = async (topicId: string, title: string) => {
    if (!client) return;
    try {
      await client.setTitle(topicId, title);
      setState('topics', (t) => t.topicId === topicId, 'title', title);
    } catch (err: any) {
      setState('error', err.message || 'Failed to rename topic');
    }
  };

  const copyTopic = async (topicId: string) => {
    if (!client) return;
    try {
      const newTopicId = await client.copyTopic(topicId);
      // topicAdded push event will add the topic to the list automatically
      await selectTopic(newTopicId);
    } catch (err: any) {
      setState('error', err.message || 'Failed to copy topic');
    }
  };

  const deleteTopic = async (topicId: string) => {
    if (!client) return;
    try {
      await client.deleteTopic(topicId);
      setState('topics', (prev) => prev.filter((t) => t.topicId !== topicId));
      if (state.selectedTopicId === topicId) {
        setState({ selectedTopicId: null, messages: [] });
      }
    } catch (err: any) {
      setState('error', err.message || 'Failed to delete topic');
    }
  };

  const selectTopic = async (topicId: string) => {
    if (!client) return;
    try {
      await client.selectTopic(topicId);
      // Clear state immediately; commandsChanged/modelChanged/modeChanged push events
      // will arrive shortly after the reply and populate these via the event handlers.
      setState({
        selectedTopicId: topicId,
        messages: [],
        availableCommands: [],
        modelOptions: [],
        modeOptions: [],
      });
      reloadMessages(topicId);
    } catch (err: any) {
      setState('error', err.message || 'Failed to select topic');
    }
  };

  const reloadMessages = (topicId: string) => {
    if (!client) return;
    let accumulatedMessages: MessageData[] = [];
    client.getAllMessages(topicId, (chunk, done) => {
      accumulatedMessages = [...accumulatedMessages, ...chunk];
      if (done) {
        setState('messages', accumulatedMessages);
      }
    });
  };

  const setAgent = async (topicId: string, agentArguments: string[]) => {
    if (!client) return;
    try {
      await client.setAgent(topicId, agentArguments);
      setState('topics', (t) => t.topicId === topicId, 'agentArguments', agentArguments);
    } catch (err: any) {
      setState('error', err.message || 'Failed to set agent');
    }
  };

  const setGoal = async (topicId: string, goal: string) => {
    if (!client) return;
    try {
      await client.setGoal(topicId, goal);
    } catch (err: any) {
      setState('error', err.message || 'Failed to set goal');
    }
  };

  const sendPrompt = (text: string) => {
    if (!client || !state.selectedTopicId) return;
    client.sendPrompt(state.selectedTopicId, text);
  };

  const cancelPrompt = () => {
    if (!client || !state.selectedTopicId) return;
    client.cancelPrompt(state.selectedTopicId);
  };

  const saveApp = async () => {
    if (!client) return;
    try {
      await client.saveApp();
    } catch (err: any) {
      setState('error', err.message || 'Failed to save');
    }
  };

  const resolveApproval = (optionId: string) => {
    if (!client || !state.selectedTopicId) return;
    client.resolveApproval(state.selectedTopicId, optionId);

    // Optimistically resolve locally
    setState(
      'messages',
      (m) =>
        (m.type === 'aiPermission' || m.type === 'exportApproval') &&
        m.approvalOption === null,
      'approvalOption',
      optionId
    );
  };

  return (
    <AbContext.Provider
      value={{
        state,
        selectedTopic,
        connect,
        loadTopics,
        createTopic,
        renameTopic,
        deleteTopic,
        copyTopic,
        selectTopic,
        setAgent,
        setGoal,
        sendPrompt,
        cancelPrompt,
        resolveApproval,
        saveApp,
        clearError,
      }}
    >
      {props.children}
    </AbContext.Provider>
  );
}

export function useAb() {
  const context = useContext(AbContext);
  if (!context) {
    throw new Error('useAb must be used within an AbProvider');
  }
  return context;
}
