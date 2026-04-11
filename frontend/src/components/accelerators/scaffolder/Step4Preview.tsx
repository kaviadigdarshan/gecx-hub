import { useState } from "react"
import {
  Download,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Package,
  Layers,
  RefreshCw,
} from "lucide-react"
import { useUIStore } from "@/store/uiStore"
import type { AppScaffoldResponse, GlobalSettingsData, AgentDefinition } from "@/types/scaffolder"

interface Props {
  globalSettings: GlobalSettingsData
  architectureData: AgentDefinition[]
  isGenerating: boolean
  generateError: string | null
  scaffoldResult: AppScaffoldResponse | null
  onGenerate: () => void
  onBack: () => void
  onReset: () => void
  hasGuardrails?: boolean
  isRegenerating?: boolean
  regenerateSuccess?: boolean
  onRegenerate?: () => void
}

function NextStepRow({
  step,
  label,
  description,
  onNavigate,
}: {
  step: number;
  label: string;
  description: string;
  onNavigate: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onNavigate}
      className="w-full flex items-center gap-3 p-2 bg-white rounded-md border border-gray-100 hover:border-gecx-300 hover:bg-gecx-50 transition-colors text-left group"
    >
      <span className="w-5 h-5 rounded-full bg-gecx-100 text-gecx-700 text-xs font-bold flex items-center justify-center shrink-0">
        {step}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 group-hover:text-gecx-700">{label}</p>
        <p className="text-xs text-gray-500 truncate">{description}</p>
      </div>
      <ArrowRight size={14} className="ml-auto text-gray-400 group-hover:text-gecx-600 shrink-0" />
    </button>
  );
}

function AgentPreviewCard({ preview }: { preview: AppScaffoldResponse["agent_previews"][number] }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition"
      >
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
            preview.agent_type === "root_agent"
              ? "bg-gecx-100 text-gecx-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {preview.agent_type === "root_agent" ? "ROOT" : "SUB"}
        </span>
        <span className="flex-1 text-sm font-medium text-gray-800 truncate">
          {preview.display_name}
        </span>
        {expanded ? (
          <ChevronUp size={13} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-3 py-3 bg-gray-50">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Instruction scaffold</p>
          <textarea
            readOnly
            value={preview.instruction_scaffold || "(no scaffold generated)"}
            style={{ resize: "vertical", minHeight: "120px", height: "auto" }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement
              t.style.height = "auto"
              t.style.height = t.scrollHeight + "px"
            }}
            className="w-full text-[11px] text-gray-700 whitespace-pre-wrap leading-relaxed font-mono bg-gray-50 border-0 outline-none focus:ring-0 p-0"
          />
        </div>
      )}
    </div>
  )
}

export default function Step4Preview({
  globalSettings,
  architectureData,
  isGenerating,
  generateError,
  scaffoldResult,
  onGenerate,
  onBack,
  onReset,
  hasGuardrails = false,
  isRegenerating = false,
  regenerateSuccess = false,
  onRegenerate,
}: Props) {
  const { setActiveAccelerator } = useUIStore()

  // ── Pre-generate state ───────────────────────────────────────────────────────
  if (!isGenerating && !scaffoldResult && !generateError) {
    return (
      <div className="space-y-6">
        {/* Summary card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Ready to Generate</h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">App Name</span>
              <span className="font-medium text-gray-800">
                {globalSettings.app_display_name || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Agents</span>
              <div className="flex gap-1">
                {architectureData.map((a) => (
                  <span
                    key={a.slug}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      a.agent_type === "root_agent"
                        ? "bg-gecx-100 text-gecx-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {a.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Execution Mode</span>
              <span className="font-medium text-gray-800 capitalize">
                {globalSettings.execution_mode}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Logging</span>
              <span className="font-medium text-gray-800">
                {globalSettings.logging_enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Gemini will generate instruction scaffolds for each agent. This may take 20–40 seconds.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={onGenerate}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gecx-600 text-white text-sm font-semibold hover:bg-gecx-700 transition shadow-sm shadow-gecx-200"
          >
            <Package size={15} />
            Generate Scaffold
          </button>
        </div>
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-10 h-10 border-2 border-gecx-200 border-t-gecx-600 rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">Generating your App Scaffold…</p>
          <p className="text-xs text-gray-400 mt-1">
            Writing instruction scaffolds, assembling ZIP, uploading to GCS
          </p>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (generateError) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">Generation failed</p>
            <p className="text-xs text-red-600 mt-0.5">{generateError}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={onGenerate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gecx-600 text-white text-sm font-medium hover:bg-gecx-700 transition"
          >
            <RefreshCw size={13} />
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── Result ───────────────────────────────────────────────────────────────────
  if (!scaffoldResult) return null

  return (
    <div className="space-y-5">
      {/* Success banner */}
      <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
        <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-green-800">
            Scaffold generated — {scaffoldResult.zip_filename}
          </p>
          <p className="text-xs text-green-700 mt-0.5">
            {scaffoldResult.agent_count} agent{scaffoldResult.agent_count !== 1 ? "s" : ""},{" "}
            {scaffoldResult.tool_stub_count} tool stub{scaffoldResult.tool_stub_count !== 1 ? "s" : ""},
            {" "}{scaffoldResult.environment_vars.length} env var{scaffoldResult.environment_vars.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Architecture diagram */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
          <Layers size={13} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-600">Agent Topology</span>
        </div>
        <pre className="px-4 py-3 text-xs text-gray-700 font-mono leading-relaxed overflow-x-auto">
          {scaffoldResult.architecture_summary}
        </pre>
      </div>

      {/* Agent previews */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">
          Instruction Scaffolds
        </p>
        <div className="space-y-2">
          {scaffoldResult.agent_previews.map((preview) => (
            <AgentPreviewCard key={preview.agent_slug} preview={preview} />
          ))}
        </div>
      </div>

      {/* Environment variables */}
      {scaffoldResult.environment_vars.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">
            Environment Variables to configure in environment.json
          </p>
          <div className="flex flex-wrap gap-1.5">
            {scaffoldResult.environment_vars.map((v) => (
              <code
                key={v}
                className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-mono"
              >
                {v}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            ← Back
          </button>
          <a
            href={scaffoldResult.download_url}
            download={scaffoldResult.zip_filename}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gecx-600 text-white text-sm font-medium hover:bg-gecx-700 transition"
          >
            <Download size={14} />
            Download ZIP
          </a>
        </div>

        {/* Regenerate ZIP with guardrails */}
        {hasGuardrails && onRegenerate && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-amber-300 text-amber-700 text-sm font-medium hover:bg-amber-50 disabled:opacity-40 transition"
            >
              {isRegenerating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-600 rounded-full animate-spin" />
                  Regenerating…
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  Regenerate ZIP with guardrails
                </>
              )}
            </button>
            {regenerateSuccess && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700">
                <CheckCircle2 size={12} className="flex-shrink-0" />
                <span>ZIP updated with guardrails</span>
              </div>
            )}
          </div>
        )}

        {/* Next Steps — always shown after successful generation */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Next Steps
          </p>
          <div className="space-y-2">
            <NextStepRow
              step={4}
              label="Craft agent instructions"
              description="Instructions pre-filled for each agent in this scaffold"
              onNavigate={() => setActiveAccelerator("instructions")}
            />
            <NextStepRow
              step={6}
              label="Configure guardrails"
              description="Industry vertical auto-selected from scaffold"
              onNavigate={() => setActiveAccelerator("guardrails")}
            />
          </div>
        </div>
      </div>

      {/* Reset */}
      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-gray-400 hover:text-gecx-600 underline transition"
        >
          Start a new scaffold
        </button>
      </div>
    </div>
  )
}
