import { createContext, useContext, useMemo, useRef, type PropsWithChildren } from 'react';
import { StoreApi, createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export type SessionRole = 'user' | 'assistant';

export interface SessionMessage {
  id: string;
  role: SessionRole;
  content: string;
  imageUrl?: string | null;
  topicId: string | null;
  difficulty?: string | null;
  createdAt: Date | null;
  stepType: 'hint' | 'check' | 'final' | null;
  pending?: boolean;
  error?: string | null;
}

export interface SessionStep {
  id: string;
  order: number;
  title: string;
  latex?: string;
  hint?: string | null;
  understood?: boolean;
}

export interface SessionState {
  activeSessionId: string | null;
  messages: SessionMessage[];
  steps: SessionStep[];
  setActiveSessionId: (id: string | null) => void;
  addMessage: (message: SessionMessage) => void;
  updateMessage: (id: string, updater: Partial<SessionMessage>) => void;
  setMessages: (messages: SessionMessage[]) => void;
  clearMessages: () => void;
  setSteps: (steps: SessionStep[]) => void;
  upsertStep: (step: SessionStep) => void;
  reset: () => void;
}

const createSessionStore = () =>
  createStore<SessionState>((set, get) => ({
    activeSessionId: null,
    messages: [],
    steps: [],
    setActiveSessionId: (id) => set({ activeSessionId: id }),
    addMessage: (message) => set({ messages: [...get().messages, message] }),
    updateMessage: (id, updater) =>
      set({
        messages: get().messages.map((message) =>
          message.id === id ? { ...message, ...updater } : message,
        ),
      }),
    setMessages: (messages) => set({ messages }),
    clearMessages: () => set({ messages: [] }),
    setSteps: (steps) => set({ steps: [...steps].sort((a, b) => a.order - b.order) }),
    upsertStep: (step) => {
      const currentSteps = get().steps;
      const existingIndex = currentSteps.findIndex((item) => item.id === step.id);

      if (existingIndex >= 0) {
        const updated = [...currentSteps];
        updated[existingIndex] = { ...updated[existingIndex], ...step };
        set({ steps: updated.sort((a, b) => a.order - b.order) });
      } else {
        set({ steps: [...currentSteps, step].sort((a, b) => a.order - b.order) });
      }
    },
    reset: () => set({ activeSessionId: null, messages: [], steps: [] }),
  }));

const SessionStoreContext = createContext<StoreApi<SessionState> | null>(null);

export const SessionProvider = ({ children }: PropsWithChildren) => {
  const storeRef = useRef<StoreApi<SessionState>>();

  if (!storeRef.current) {
    storeRef.current = createSessionStore();
  }

  return (
    <SessionStoreContext.Provider value={storeRef.current}>{children}</SessionStoreContext.Provider>
  );
};

export const useSessionStore = <T,>(selector: (state: SessionState) => T): T => {
  const store = useContext(SessionStoreContext);

  if (!store) {
    throw new Error('useSessionStore must be used within a SessionProvider');
  }

  return useStore(store, selector);
};

export const useSessionStoreApi = () => {
  const store = useContext(SessionStoreContext);

  if (!store) {
    throw new Error('useSessionStoreApi must be used within a SessionProvider');
  }

  return useMemo(() => store, [store]);
};
