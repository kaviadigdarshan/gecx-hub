import { create } from "zustand";

interface UIStore {
  sidebarCollapsed: boolean;
  contextSyncStatus: 'synced' | 'pending' | 'error';
  contextLoadStatus: 'idle' | 'loading' | 'local' | 'gcs';
  toggleSidebar: () => void;
  setContextSyncStatus: (status: 'synced' | 'pending' | 'error') => void;
  setContextLoadStatus: (status: 'idle' | 'loading' | 'local' | 'gcs') => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  contextSyncStatus: 'synced',
  contextLoadStatus: 'idle',
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setContextSyncStatus: (status) =>
    set({ contextSyncStatus: status }),
  setContextLoadStatus: (status) =>
    set({ contextLoadStatus: status }),
}));
