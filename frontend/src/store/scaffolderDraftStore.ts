import { create } from "zustand"
import type {
  UseCaseData,
  ArchitectureSuggestion,
  AgentDefinition,
  ToolStubData,
  GlobalSettingsData,
  AppScaffoldResponse,
  AppSettingsData,
} from "@/types/scaffolder"
import { defaultUseCaseData, defaultGlobalSettings, defaultAppSettings } from "@/types/scaffolder"
import type { VariableDeclaration } from "@/types/scaffoldContext"

type ScaffolderStep = "use_case" | "architecture" | "app_settings" | "session_vars" | "tools" | "preview"

interface ScaffolderDraftState {
  step: ScaffolderStep
  useCaseData: UseCaseData
  isSuggesting: boolean
  suggestError: string | null
  architectureSuggestion: ArchitectureSuggestion | null
  architectureData: AgentDefinition[]
  appSettings: AppSettingsData
  variableDeclarations: VariableDeclaration[]
  globalSettings: GlobalSettingsData
  toolStubsData: ToolStubData[]
  isGenerating: boolean
  generateError: string | null
  scaffoldResult: AppScaffoldResponse | null
  isRegenerating: boolean
  regenerateSuccess: boolean
  architectureGenerated: boolean

  setStep: (step: ScaffolderStep) => void
  setUseCaseData: (data: UseCaseData) => void
  setIsSuggesting: (v: boolean) => void
  setSuggestError: (e: string | null) => void
  setArchitectureSuggestion: (s: ArchitectureSuggestion | null) => void
  setArchitectureData: (d: AgentDefinition[]) => void
  setAppSettings: (s: AppSettingsData) => void
  setVariableDeclarations: (v: VariableDeclaration[]) => void
  setGlobalSettings: (s: GlobalSettingsData) => void
  setToolStubsData: (t: ToolStubData[]) => void
  setIsGenerating: (v: boolean) => void
  setGenerateError: (e: string | null) => void
  setScaffoldResult: (r: AppScaffoldResponse | null) => void
  setIsRegenerating: (v: boolean) => void
  setRegenerateSuccess: (v: boolean) => void
  setArchitectureGenerated: (v: boolean) => void
  reset: () => void
}

const initialState = {
  step: "use_case" as ScaffolderStep,
  useCaseData: defaultUseCaseData,
  isSuggesting: false,
  suggestError: null,
  architectureSuggestion: null,
  architectureData: [],
  appSettings: defaultAppSettings,
  variableDeclarations: [],
  globalSettings: defaultGlobalSettings,
  toolStubsData: [],
  isGenerating: false,
  generateError: null,
  scaffoldResult: null,
  isRegenerating: false,
  regenerateSuccess: false,
  architectureGenerated: false,
}

export const useScaffolderDraftStore = create<ScaffolderDraftState>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setUseCaseData: (useCaseData) => set({ useCaseData }),
  setIsSuggesting: (isSuggesting) => set({ isSuggesting }),
  setSuggestError: (suggestError) => set({ suggestError }),
  setArchitectureSuggestion: (architectureSuggestion) => set({ architectureSuggestion }),
  setArchitectureData: (architectureData) => set({ architectureData }),
  setAppSettings: (appSettings) => set({ appSettings }),
  setVariableDeclarations: (variableDeclarations) => set({ variableDeclarations }),
  setGlobalSettings: (globalSettings) => set({ globalSettings }),
  setToolStubsData: (toolStubsData) => set({ toolStubsData }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setGenerateError: (generateError) => set({ generateError }),
  setScaffoldResult: (scaffoldResult) => set({ scaffoldResult }),
  setIsRegenerating: (isRegenerating) => set({ isRegenerating }),
  setRegenerateSuccess: (regenerateSuccess) => set({ regenerateSuccess }),
  setArchitectureGenerated: (architectureGenerated) => set({ architectureGenerated }),
  reset: () => set(initialState),
}))
