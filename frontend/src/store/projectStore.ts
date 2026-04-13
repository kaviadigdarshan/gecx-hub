import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GCPProject, CESApp } from "@/types/ces";
import type { ScaffoldContext, AgentContextEntry, AgentInstruction } from "@/types/scaffoldContext";

export interface TabState {
  visitedTabs: number[];
  activeTab: number;
  tabFormData: Record<number, unknown>;
}

type AcceleratorKey = 'scaffolder' | 'instruction' | 'guardrails';

const defaultTabState = (): TabState => ({ visitedTabs: [0], activeTab: 0, tabFormData: {} });

interface ProjectStore {
  selectedProject: GCPProject | null;
  selectedApp: CESApp | null;
  scaffoldContext: ScaffoldContext | null;
  activeInstructionAgent: string | null; // agent slug, set by Acc 3's "Configure" buttons
  isDemoMode: boolean;
  scaffolderTabState: TabState;
  instructionTabState: TabState;
  guardrailsTabState: TabState;

  setProject: (project: GCPProject | null) => void;
  setApp: (app: CESApp | null) => void;
  setScaffoldContext: (ctx: ScaffoldContext | null) => void;
  updateAgentInContext: (slug: string, updates: Partial<AgentContextEntry>) => void;
  markAgentInstructionApplied: (slug: string, charCount: number) => void;
  markGuardrailsApplied: (industry: string) => void;
  markCallbacksGenerated: () => void;
  setArchitectureGenerated: (value: boolean) => void;
  setActiveInstructionAgent: (slug: string | null) => void;
  clearProject: () => void;
  enableDemoMode: () => void;
  setActiveTab: (accelerator: AcceleratorKey, tabIndex: number) => void;
  markTabVisited: (accelerator: AcceleratorKey, tabIndex: number) => void;
  saveTabFormData: (accelerator: AcceleratorKey, tabIndex: number, data: unknown) => void;
  upsertAgentInstruction: (instruction: AgentInstruction) => void;
  clearAgentInstructions: () => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
  selectedProject: null,
  selectedApp: null,
  scaffoldContext: null,
  activeInstructionAgent: null,
  isDemoMode: false,
  scaffolderTabState: defaultTabState(),
  instructionTabState: defaultTabState(),
  guardrailsTabState: defaultTabState(),

  setProject: (project) =>
    set({
      selectedProject: project,
      selectedApp: null,
      scaffoldContext: null, // clear context when project changes
      activeInstructionAgent: null,
    }),

  setApp: (app) => set({ selectedApp: app }),

  setScaffoldContext: (ctx) => set({ scaffoldContext: ctx }),

  updateAgentInContext: (slug, updates) =>
    set((state) => {
      if (!state.scaffoldContext) return {};
      return {
        scaffoldContext: {
          ...state.scaffoldContext,
          lastUpdatedAt: new Date().toISOString(),
          agents: state.scaffoldContext.agents.map((a) =>
            a.slug === slug ? { ...a, ...updates } : a
          ),
        },
      };
    }),

  markAgentInstructionApplied: (slug, charCount) =>
    set((state) => {
      if (!state.scaffoldContext) return {};
      return {
        scaffoldContext: {
          ...state.scaffoldContext,
          lastUpdatedAt: new Date().toISOString(),
          agents: state.scaffoldContext.agents.map((a) =>
            a.slug === slug
              ? { ...a, instructionApplied: true, instructionCharCount: charCount }
              : a
          ),
        },
      };
    }),

  markGuardrailsApplied: (industry) =>
    set((state) => {
      if (!state.scaffoldContext) return {};
      return {
        scaffoldContext: {
          ...state.scaffoldContext,
          guardrailsApplied: true,
          guardrailsIndustry: industry,
          lastUpdatedAt: new Date().toISOString(),
        },
      };
    }),

  markCallbacksGenerated: () =>
    set((state) => {
      if (!state.scaffoldContext) return {};
      return {
        scaffoldContext: {
          ...state.scaffoldContext,
          callbacksGenerated: true,
          lastUpdatedAt: new Date().toISOString(),
        },
      };
    }),

  setArchitectureGenerated: (value) =>
    set((state) => {
      if (!state.scaffoldContext) return {};
      return {
        scaffoldContext: {
          ...state.scaffoldContext,
          architectureGenerated: value,
          lastUpdatedAt: new Date().toISOString(),
        },
      };
    }),

  setActiveInstructionAgent: (slug) => set({ activeInstructionAgent: slug }),

  clearProject: () =>
    set({
      selectedProject: null,
      selectedApp: null,
      scaffoldContext: null,
      activeInstructionAgent: null,
      isDemoMode: false,
    }),

  setActiveTab: (accelerator, tabIndex) =>
    set((state) => ({
      [`${accelerator}TabState`]: {
        ...state[`${accelerator}TabState` as keyof ProjectStore] as TabState,
        activeTab: tabIndex,
      },
    })),

  markTabVisited: (accelerator, tabIndex) =>
    set((state) => {
      const key = `${accelerator}TabState` as keyof ProjectStore;
      const current = state[key] as TabState;
      if (current.visitedTabs.includes(tabIndex)) return {};
      return {
        [key]: { ...current, visitedTabs: [...current.visitedTabs, tabIndex] },
      };
    }),

  saveTabFormData: (accelerator, tabIndex, data) =>
    set((state) => {
      const key = `${accelerator}TabState` as keyof ProjectStore;
      const current = state[key] as TabState;
      return {
        [key]: { ...current, tabFormData: { ...current.tabFormData, [tabIndex]: data } },
      };
    }),

  enableDemoMode: () =>
    set({
      selectedProject: {
        projectId: "demo-project",
        displayName: "Demo Project (No GCP)",
        projectNumber: "000000000000",
      },
      selectedApp: {
        name: "demo-app",
        displayName: "Demo CX App",
        state: "ACTIVE",
      },
      isDemoMode: true,
    }),

  upsertAgentInstruction: (instruction) =>
    set((state) => {
      if (!state.scaffoldContext) return {};
      const existing = state.scaffoldContext.agentInstructions ?? [];
      const idx = existing.findIndex((i) => i.agentId === instruction.agentId);
      const updated =
        idx >= 0
          ? existing.map((i, j) => (j === idx ? instruction : i))
          : [...existing, instruction];
      return {
        scaffoldContext: {
          ...state.scaffoldContext,
          agentInstructions: updated,
          lastUpdatedAt: new Date().toISOString(),
        },
      };
    }),

  clearAgentInstructions: () =>
    set((state) => {
      if (!state.scaffoldContext) return {};
      return {
        scaffoldContext: { ...state.scaffoldContext, agentInstructions: [] },
      };
    }),
    }),
    {
      name: 'gecx-project-store',
      partialize: (state) => ({
        scaffoldContext: state.scaffoldContext,
        selectedProject: state.selectedProject,
        selectedApp: state.selectedApp,
      }),
    }
  )
);
