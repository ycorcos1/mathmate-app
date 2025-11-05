import { createContext, useContext, useMemo, useRef, type PropsWithChildren } from 'react';
import { StoreApi, createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export type ThemeMode = 'system' | 'light';
export type WorkspaceTab = 'sessions' | 'frontier' | 'review';

export interface UIState {
  isWorkspaceCollapsed: boolean;
  isUploading: boolean;
  activeHintId: string | null;
  theme: ThemeMode;
  workspaceTab: WorkspaceTab;
  setWorkspaceCollapsed: (collapsed: boolean) => void;
  toggleWorkspace: () => void;
  setUploading: (uploading: boolean) => void;
  setActiveHintId: (hintId: string | null) => void;
  setTheme: (mode: ThemeMode) => void;
  setWorkspaceTab: (tab: WorkspaceTab) => void;
}

const createUIStore = () =>
  createStore<UIState>((set, get) => ({
    isWorkspaceCollapsed: false,
    isUploading: false,
    activeHintId: null,
    theme: 'system',
    workspaceTab: 'sessions',
    setWorkspaceCollapsed: (collapsed) => set({ isWorkspaceCollapsed: collapsed }),
    toggleWorkspace: () => set({ isWorkspaceCollapsed: !get().isWorkspaceCollapsed }),
    setUploading: (uploading) => set({ isUploading: uploading }),
    setActiveHintId: (hintId) => set({ activeHintId: hintId }),
    setTheme: (mode) => set({ theme: mode }),
    setWorkspaceTab: (tab) => set({ workspaceTab: tab }),
  }));

const UIStoreContext = createContext<StoreApi<UIState> | null>(null);

export const UIProvider = ({ children }: PropsWithChildren) => {
  const storeRef = useRef<StoreApi<UIState>>();

  if (!storeRef.current) {
    storeRef.current = createUIStore();
  }

  return <UIStoreContext.Provider value={storeRef.current}>{children}</UIStoreContext.Provider>;
};

export const useUIStore = <T,>(selector: (state: UIState) => T): T => {
  const store = useContext(UIStoreContext);

  if (!store) {
    throw new Error('useUIStore must be used within a UIProvider');
  }

  return useStore(store, selector);
};

export const useUIStoreApi = () => {
  const store = useContext(UIStoreContext);

  if (!store) {
    throw new Error('useUIStoreApi must be used within a UIProvider');
  }

  return useMemo(() => store, [store]);
};
