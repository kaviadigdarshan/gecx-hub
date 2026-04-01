import { create } from "zustand";
import type { GCPProject, CESApp } from "@/types/ces";
import type { ScaffoldContext, AgentContextEntry } from "@/types/scaffoldContext";

interface ProjectStore {
  selectedProject: GCPProject | null;
  selectedApp: CESApp | null;
  scaffoldContext: ScaffoldContext | null;
  activeInstructionAgent: string | null; // agent slug, set by Acc 3's "Configure" buttons
  isDemoMode: boolean;

  setProject: (project: GCPProject | null) => void;
  setApp: (app: CESApp | null) => void;
  setScaffoldContext: (ctx: ScaffoldContext | null) => void;
  updateAgentInContext: (slug: string, updates: Partial<AgentContextEntry>) => void;
  markAgentInstructionApplied: (slug: string, charCount: number) => void;
  markGuardrailsApplied: (industry: string) => void;
  setActiveInstructionAgent: (slug: string | null) => void;
  clearProject: () => void;
  enableDemoMode: () => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  selectedProject: null,
  selectedApp: null,
  scaffoldContext: null,
  activeInstructionAgent: null,
  isDemoMode: false,

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

  setActiveInstructionAgent: (slug) => set({ activeInstructionAgent: slug }),

  clearProject: () =>
    set({
      selectedProject: null,
      selectedApp: null,
      scaffoldContext: null,
      activeInstructionAgent: null,
      isDemoMode: false,
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
}));
