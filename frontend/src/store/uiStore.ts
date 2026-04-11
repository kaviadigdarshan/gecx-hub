import { create } from "zustand";

interface UIStore {
  activeAccelerator: string | null;
  sidebarCollapsed: boolean;
  contextSyncStatus: 'synced' | 'pending' | 'error';
  setActiveAccelerator: (accelerator: string | null) => void;
  toggleSidebar: () => void;
  setContextSyncStatus: (status: 'synced' | 'pending' | 'error') => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeAccelerator: null,
  sidebarCollapsed: false,
  contextSyncStatus: 'synced',
  setActiveAccelerator: (accelerator) =>
    set({ activeAccelerator: accelerator }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setContextSyncStatus: (status) =>
    set({ contextSyncStatus: status }),
}));
