import { useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronUp, Wrench } from "lucide-react"
import type { ToolStubData, GlobalSettingsData, AgentDefinition } from "@/types/scaffolder"

interface Props {
  globalSettings: GlobalSettingsData
  onGlobalSettingsChange: (settings: GlobalSettingsData) => void
  toolStubs: ToolStubData[]
  onToolStubsChange: (stubs: ToolStubData[]) => void
  agents: AgentDefinition[]
  onBack: () => void
  onContinue: () => void
}

const LANGUAGES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es-ES", label: "Spanish (ES)" },
  { value: "fr-FR", label: "French (FR)" },
  { value: "de-DE", label: "German (DE)" },
  { value: "pt-BR", label: "Portuguese (BR)" },
  { value: "ja-JP", label: "Japanese (JP)" },
  { value: "ko-KR", label: "Korean (KR)" },
]

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
}

function ToolStubCard({
  stub,
  onUpdate,
  onDelete,
  agentOptions,
}: {
  stub: ToolStubData
  onUpdate: (updated: ToolStubData) => void
  onDelete: () => void
  agentOptions: { slug: string; name: string }[]
}) {
  const [expanded, setExpanded] = useState(true)

  const handleDisplayNameBlur = () => {
    if (!stub.tool_name || stub.tool_name === slugify(stub.display_name)) {
      onUpdate({
        ...stub,
        tool_name: slugify(stub.display_name),
        base_url_env_var: slugify(stub.display_name).toUpperCase() + "_BASE_URL",
      })
    }
  }

  const toggleAgent = (slug: string) => {
    const next = stub.assigned_to_agents.includes(slug)
      ? stub.assigned_to_agents.filter((s) => s !== slug)
      : [...stub.assigned_to_agents, slug]
    onUpdate({ ...stub, assigned_to_agents: next })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Wrench size={14} className="text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={stub.display_name}
          onChange={(e) => onUpdate({ ...stub, display_name: e.target.value })}
          onBlur={handleDisplayNameBlur}
          placeholder="Tool display name"
          className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-gecx-400 focus:outline-none py-0.5 transition-colors"
        />
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
            title="Remove tool"
          >
            <Trash2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gecx-600 hover:bg-gecx-50 transition"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Tool Slug
              </label>
              <input
                type="text"
                value={stub.tool_name}
                onChange={(e) =>
                  onUpdate({ ...stub, tool_name: slugify(e.target.value) })
                }
                placeholder="e.g. order_api"
                className="w-full text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gecx-300 bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Auth Type
              </label>
              <select
                value={stub.auth_type}
                onChange={(e) =>
                  onUpdate({
                    ...stub,
                    auth_type: e.target.value as ToolStubData["auth_type"],
                  })
                }
                className="w-full text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gecx-300 bg-white"
              >
                <option value="api_key">API Key</option>
                <option value="oauth">OAuth 2.0</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Description
            </label>
            <input
              type="text"
              value={stub.description}
              onChange={(e) => onUpdate({ ...stub, description: e.target.value })}
              placeholder="What does this tool do?"
              className="w-full text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gecx-300 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Base URL Env Var
            </label>
            <input
              type="text"
              value={stub.base_url_env_var}
              onChange={(e) =>
                onUpdate({ ...stub, base_url_env_var: e.target.value.toUpperCase() })
              }
              placeholder="e.g. ORDER_API_BASE_URL"
              className="w-full text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gecx-300 bg-white font-mono"
            />
          </div>

          {agentOptions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Assign to Agents
              </label>
              <div className="flex flex-wrap gap-1.5">
                {agentOptions.map((a) => {
                  const selected = stub.assigned_to_agents.includes(a.slug)
                  return (
                    <button
                      key={a.slug}
                      type="button"
                      onClick={() => toggleAgent(a.slug)}
                      className={[
                        "text-[10px] px-2 py-0.5 rounded-full border transition",
                        selected
                          ? "bg-gecx-100 border-gecx-300 text-gecx-700"
                          : "bg-white border-gray-200 text-gray-500 hover:border-gecx-200",
                      ].join(" ")}
                    >
                      {a.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Step3ToolStubs({
  globalSettings,
  onGlobalSettingsChange,
  toolStubs,
  onToolStubsChange,
  agents,
  onBack,
  onContinue,
}: Props) {
  const update = <K extends keyof GlobalSettingsData>(
    key: K,
    value: GlobalSettingsData[K]
  ) => onGlobalSettingsChange({ ...globalSettings, [key]: value })

  const addTool = () => {
    onToolStubsChange([
      ...toolStubs,
      {
        tool_name: "",
        display_name: "",
        description: "",
        base_url_env_var: "",
        auth_type: "api_key",
        assigned_to_agents: [],
      },
    ])
  }

  const agentOptions = agents.map((a) => ({ slug: a.slug, name: a.name }))
  const canContinue = !!globalSettings.app_display_name.trim()

  return (
    <div className="space-y-6">
      {/* ── Global Settings ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">App Settings</h3>
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              App Display Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={globalSettings.app_display_name}
              onChange={(e) => update("app_display_name", e.target.value)}
              placeholder="e.g. Acme Customer Service"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gecx-300 focus:border-gecx-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Default Language
              </label>
              <select
                value={globalSettings.default_language}
                onChange={(e) => update("default_language", e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gecx-300"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Execution Mode
              </label>
              <div className="flex gap-2 mt-0.5">
                {(["sequential", "parallel"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => update("execution_mode", mode)}
                    className={[
                      "flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition",
                      globalSettings.execution_mode === mode
                        ? "bg-gecx-600 text-white border-gecx-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gecx-300",
                    ].join(" ")}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Brand Voice Keywords{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={globalSettings.global_instruction_keywords}
                onChange={(e) => update("global_instruction_keywords", e.target.value)}
                placeholder="e.g. warm, professional, concise"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gecx-300"
              />
            </div>

            <div className="flex items-center gap-3 pt-5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={globalSettings.logging_enabled}
                  onChange={(e) => update("logging_enabled", e.target.checked)}
                  className="w-4 h-4 accent-gecx-600 rounded"
                />
                <span className="text-sm text-gray-600">Enable Stackdriver Logging</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tool Stubs ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Tool Stubs</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Optional — creates OpenAPI placeholder stubs for each API your agents need.
            </p>
          </div>
          <button
            type="button"
            onClick={addTool}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gecx-50 text-gecx-600 hover:bg-gecx-100 border border-gecx-200 transition"
          >
            <Plus size={12} />
            Add Tool Stub
          </button>
        </div>

        {toolStubs.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 flex flex-col items-center gap-2 text-center">
            <Wrench size={20} className="text-gray-300" />
            <p className="text-sm text-gray-400">No tool stubs added</p>
            <p className="text-xs text-gray-400 max-w-xs">
              You can add tool stubs now, or connect your agents to tools after import using
              Accelerator 6 (Tool Builder).
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {toolStubs.map((stub, i) => (
              <ToolStubCard
                key={i}
                stub={stub}
                onUpdate={(updated) => {
                  const next = [...toolStubs]
                  next[i] = updated
                  onToolStubsChange(next)
                }}
                onDelete={() => onToolStubsChange(toolStubs.filter((_, idx) => idx !== i))}
                agentOptions={agentOptions}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="px-5 py-2 rounded-lg bg-gecx-600 text-white text-sm font-medium hover:bg-gecx-700 disabled:opacity-40 transition"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
