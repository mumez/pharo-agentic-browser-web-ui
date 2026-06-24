import { createContext, useContext, createMemo, onCleanup } from 'solid-js';
import type { JSX } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { AbClient } from './client';
import type { AgentPreset, TopicData, MessageData, ConfigOptionData, CommandData, TopicStatus, TopicSettings } from './types';

interface AbState {
  agents: AgentPreset[];
  topics: TopicData[];
  selectedTopicId: string | null;
  messages: MessageData[];
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  availableCommands: CommandData[];
  modelOptions: ConfigOptionData | null;
  modeOptions: ConfigOptionData | null;
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
  deselectTopic: () => void;
  setAgent: (topicId: string, agentArguments: string[]) => Promise<void>;
  setGoal: (topicId: string, goal: string) => Promise<void>;
  setModel: (topicId: string, optionId: string) => Promise<void>;
  setMode: (topicId: string, optionId: string) => Promise<void>;
  sendPrompt: (text: string) => void;
  cancelPrompt: () => void;
  resolveApproval: (optionId: string) => void;
  getTopicSettings: (topicId: string) => Promise<TopicSettings>;
  setTopicSettings: (topicId: string, settings: Partial<TopicSettings>) => Promise<void>;
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
    modelOptions: null,
    modeOptions: null,
  });

  let client: AbClient | null = null;

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden' && client) {
      client.saveApp().catch(() => {});
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  onCleanup(() => document.removeEventListener('visibilitychange', handleVisibilityChange));

  const selectedTopic = createMemo(() => {
    return state.topics.find((t) => t.topicId === state.selectedTopicId) || null;
  });

  const clearError = () => setState('error', null);

  const connect = (host = 'localhost', port = __RIPPLE_PORT__) => {
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

    client.onEvent('topicRemoved', (topicId: string) => {
      setState('topics', (prev) => prev.filter((t) => t.topicId !== topicId));
      if (state.selectedTopicId === topicId) {
        setState({ selectedTopicId: null, messages: [] });
      }
    });

    client.onEvent('statusChanged', (topicId: string, status: TopicStatus) => {
      setState('topics', (t) => t.topicId === topicId, 'status', status);

      // If this is the currently selected topic and status changed to endTurn, reload messages
      if (state.selectedTopicId === topicId && status === 'endTurn') {
        reloadMessages(topicId);
      }
    });

    client.onEvent('messageAdded', (topicId: string, message: MessageData) => {
      if (state.selectedTopicId === topicId) {
        setState('messages', (prev) => {
          const idx = prev.findIndex((m) => m.id === message.id);
          if (idx !== -1) {
            return [...prev.slice(0, idx), message, ...prev.slice(idx + 1)];
          }
          return [...prev, message];
        });
      }
      setState('topics', (t) => t.topicId === topicId, 'lastUpdated', message.lastUpdated);
    });

    client.onEvent('modelChanged', (topicId: string, options: ConfigOptionData | null) => {
      if (state.selectedTopicId === topicId) {
        setState('modelOptions', reconcile(options));
      }
    });

    client.onEvent('modeChanged', (topicId: string, options: ConfigOptionData | null) => {
      if (state.selectedTopicId === topicId) {
        setState('modeOptions', reconcile(options));
      }
    });

    client.onEvent('commandsChanged', (topicId: string, commands: CommandData[]) => {
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
        modelOptions: null,
        modeOptions: null,
      });
      reloadMessages(topicId);
    } catch (err: any) {
      setState('error', err.message || 'Failed to select topic');
    }
  };

  const deselectTopic = () => {
    setState({ selectedTopicId: null, messages: [], availableCommands: [], modelOptions: null, modeOptions: null });
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
    if (!client) throw new Error('Not connected');
    try {
      await client.setGoal(topicId, goal);
      setState('topics', (t) => t.topicId === topicId, 'goal', goal);
    } catch (err: any) {
      setState('error', err.message || 'Failed to set goal');
      throw err;
    }
  };

  const setModel = async (topicId: string, optionId: string) => {
    if (!client) return;
    try {
      if (state.selectedTopicId === topicId && state.modelOptions) {
        setState('modelOptions', 'currentValue', optionId);
      }
      await client.setModel(topicId, optionId);
    } catch (err: any) {
      setState('error', err.message || 'Failed to set model');
    }
  };

  const setMode = async (topicId: string, optionId: string) => {
    if (!client) return;
    try {
      if (state.selectedTopicId === topicId && state.modeOptions) {
        setState('modeOptions', 'currentValue', optionId);
      }
      await client.setMode(topicId, optionId);
    } catch (err: any) {
      setState('error', err.message || 'Failed to set mode');
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

  const getTopicSettings = async (topicId: string): Promise<TopicSettings> => {
    if (!client) throw new Error('Not connected');
    return client.getSettings(topicId);
  };

  const setTopicSettings = async (topicId: string, settings: Partial<TopicSettings>) => {
    if (!client) throw new Error('Not connected');
    try {
      await client.setSettings(topicId, settings);
    } catch (err: any) {
      setState('error', err.message || 'Failed to update settings');
      throw err;
    }
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
        deselectTopic,
        setAgent,
        setGoal,
        setModel,
        setMode,
        sendPrompt,
        cancelPrompt,
        resolveApproval,
        getTopicSettings,
        setTopicSettings,
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
