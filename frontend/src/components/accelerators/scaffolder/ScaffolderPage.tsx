import { useState, useEffect } from "react"
import { apiClient } from "@/services/api"
import { useProjectStore } from "@/store/projectStore"
import { useScaffoldContext } from "@/hooks/useScaffoldContext"
import type { ScaffoldContext } from "@/types/scaffoldContext"
import type {
  UseCaseData,
  ArchitectureSuggestion,
  AgentDefinition,
  ToolStubData,
  GlobalSettingsData,
  AppScaffoldResponse,
} from "@/types/scaffolder"
import { defaultUseCaseData, defaultGlobalSettings } from "@/types/scaffolder"
import Step1UseCase from "./Step1UseCase"
import Step2Architecture from "./Step2Architecture"
import Step3ToolStubs from "./Step3ToolStubs"
import Step4Preview from "./Step4Preview"

type ScaffolderStep = "use_case" | "architecture" | "tools" | "preview"

const STEPS: { key: ScaffolderStep; label: string }[] = [
  { key: "use_case", label: "1. Use Case" },
  { key: "architecture", label: "2. Architecture" },
  { key: "tools", label: "3. Tools & Settings" },
  { key: "preview", label: "4. Generate" },
]

function StepIndicator({ current }: { current: ScaffolderStep }) {
  const idx = STEPS.findIndex((s) => s.key === current)
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <span
            className={[
              "text-xs font-medium px-2.5 py-1 rounded-full transition",
              i === idx
                ? "bg-gecx-600 text-white"
                : i < idx
                  ? "bg-gecx-100 text-gecx-600"
                  : "bg-gray-100 text-gray-400",
            ].join(" ")}
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <span className="text-gray-300 text-xs">›</span>
          )}
        </div>
      ))}
    </div>
  )
}

export default function ScaffolderPage() {
  useProjectStore() // initialises context sync
  const { saveContext } = useScaffoldContext()

  const [step, setStep] = useState<ScaffolderStep>("use_case")

  // Step 1
  const [useCaseData, setUseCaseData] = useState<UseCaseData>(defaultUseCaseData)

  // Step 2
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [architectureSuggestion, setArchitectureSuggestion] =
    useState<ArchitectureSuggestion | null>(null)
  const [architectureData, setArchitectureData] = useState<AgentDefinition[]>([])

  // Step 3
  const [globalSettings, setGlobalSettings] =
    useState<GlobalSettingsData>(defaultGlobalSettings)
  const [toolStubsData, setToolStubsData] = useState<ToolStubData[]>([])

  // Step 4
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [scaffoldResult, setScaffoldResult] = useState<AppScaffoldResponse | null>(null)

  // Pre-fill app_display_name when transitioning to step 3
  useEffect(() => {
    if (step === "tools" && !globalSettings.app_display_name && useCaseData.company_name) {
      setGlobalSettings((prev) => ({
        ...prev,
        app_display_name: `${useCaseData.company_name} CX Agent`,
      }))
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 1 → Step 2: call /suggest-architecture ──────────────────────────────
  const handleStep1Continue = async () => {
    setIsSuggesting(true)
    setSuggestError(null)
    setStep("architecture")
    try {
      const res = await apiClient.post<ArchitectureSuggestion>(
        "/accelerators/scaffolder/suggest-architecture",
        { use_case: useCaseData }
      )
      setArchitectureSuggestion(res.data)
      setArchitectureData(res.data.agents)
    } catch {
      setSuggestError(
        "Gemini couldn't suggest an architecture. Check your use case description and try again."
      )
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleRetryArchitecture = () => {
    handleStep1Continue()
  }

  // ── Step 4: call /generate ───────────────────────────────────────────────────
  const handleGenerate = async () => {
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const res = await apiClient.post<AppScaffoldResponse>(
        "/accelerators/scaffolder/generate",
        {
          use_case: useCaseData,
          architecture: architectureData,
          tool_stubs: toolStubsData,
          global_settings: globalSettings,
          include_guardrails_placeholder: true,
          include_examples_placeholder: true,
        }
      )
      const response = res.data
      setScaffoldResult(response)

      // Build and save ScaffoldContext
      const context: ScaffoldContext = {
        scaffoldId: response.request_id,
        appDisplayName: globalSettings.app_display_name,
        businessDomain: useCaseData.business_domain,
        channel: useCaseData.channel,
        companyName: useCaseData.company_name ?? "",
        expectedCapabilities: useCaseData.expected_capabilities,
        decompositionStrategy:
          architectureSuggestion?.decomposition_strategy ?? "capability_based",
        rootAgentStyle: architectureSuggestion?.root_agent_style ?? "pure_router",
        agents: response.agent_previews.map((preview) => {
          const archAgent = architectureData.find((a) => a.slug === preview.agent_slug)
          return {
            slug: preview.agent_slug,
            name: preview.display_name,
            agentType: preview.agent_type as "root_agent" | "sub_agent",
            roleSummary: archAgent?.role_summary ?? "",
            handles: archAgent?.handles ?? [],
            suggestedTools: archAgent?.suggested_tools ?? [],
            instructionApplied: false,
            instructionCharCount: 0,
            cesAgentId: null,
          }
        }),
        toolStubs: toolStubsData.map((stub) => ({
          toolName: stub.tool_name,
          displayName: stub.display_name,
          baseUrlEnvVar: stub.base_url_env_var,
          authType: stub.auth_type as "api_key" | "oauth" | "none",
          cesToolId: null,
        })),
        environmentVars: response.environment_vars,
        guardrailsApplied: false,
        guardrailsIndustry: null,
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        generatedZipFilename: response.zip_filename,
      }

      await saveContext(context)
      // saveContext calls setScaffoldContext internally,
      // so the sidebar progress panel updates immediately
    } catch {
      setGenerateError(
        "Failed to generate scaffold. Please check your configuration and try again."
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleReset = () => {
    setStep("use_case")
    setUseCaseData(defaultUseCaseData)
    setArchitectureSuggestion(null)
    setArchitectureData([])
    setGlobalSettings(defaultGlobalSettings)
    setToolStubsData([])
    setScaffoldResult(null)
    setGenerateError(null)
    setSuggestError(null)
  }

  return (
    <div>
      <StepIndicator current={step} />

      {step === "use_case" && (
        <Step1UseCase
          data={useCaseData}
          onChange={setUseCaseData}
          onContinue={handleStep1Continue}
          isLoading={isSuggesting}
        />
      )}

      {step === "architecture" && (
        <Step2Architecture
          isLoading={isSuggesting}
          error={suggestError}
          suggestion={architectureSuggestion}
          agents={architectureData}
          onAgentsChange={setArchitectureData}
          onRetry={handleRetryArchitecture}
          onContinue={() => setStep("tools")}
          onBack={() => {
            setStep("use_case")
            setSuggestError(null)
          }}
        />
      )}

      {step === "tools" && (
        <Step3ToolStubs
          globalSettings={globalSettings}
          onGlobalSettingsChange={setGlobalSettings}
          toolStubs={toolStubsData}
          onToolStubsChange={setToolStubsData}
          agents={architectureData}
          onBack={() => setStep("architecture")}
          onContinue={() => setStep("preview")}
        />
      )}

      {step === "preview" && (
        <Step4Preview
          globalSettings={globalSettings}
          architectureData={architectureData}
          isGenerating={isGenerating}
          generateError={generateError}
          scaffoldResult={scaffoldResult}
          onGenerate={handleGenerate}
          onBack={() => setStep("tools")}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
