import { create } from "zustand";

interface UIStore {
  activeAccelerator: string | null;
  sidebarCollapsed: boolean;
  setActiveAccelerator: (accelerator: string | null) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeAccelerator: null,
  sidebarCollapsed: false,
  setActiveAccelerator: (accelerator) =>
    set({ activeAccelerator: accelerator }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
