import { useState } from "react"
import {
  Sparkles,
  AlertCircle,
  RefreshCw,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { ArchitectureSuggestion, AgentDefinition } from "@/types/scaffolder"

interface Props {
  isLoading: boolean
  error: string | null
  suggestion: ArchitectureSuggestion | null
  agents: AgentDefinition[]
  onAgentsChange: (agents: AgentDefinition[]) => void
  onRetry: () => void
  onContinue: () => void
  onBack: () => void
}

const COMPLEXITY_STYLES: Record<string, string> = {
  simple: "bg-green-100 text-green-700",
  moderate: "bg-amber-100 text-amber-700",
  complex: "bg-red-100 text-red-700",
}

function AgentCard({
  agent,
  onUpdate,
  onDelete,
  canDelete,
}: {
  agent: AgentDefinition
  onUpdate: (updated: AgentDefinition) => void
  onDelete: () => void
  canDelete: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
            agent.agent_type === "root_agent"
              ? "bg-gecx-100 text-gecx-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {agent.agent_type === "root_agent" ? "ROOT" : "SUB"}
        </span>

        <input
          type="text"
          value={agent.name}
          onChange={(e) => onUpdate({ ...agent, name: e.target.value })}
          className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-gecx-400 focus:outline-none py-0.5 transition-colors"
          placeholder="Agent display name"
        />

        <div className="flex items-center gap-1 flex-shrink-0">
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
              title="Remove agent"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gecx-600 hover:bg-gecx-50 transition"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Role summary (always visible) */}
      <div className="px-4 pb-3">
        <p className="text-xs text-gray-500 leading-relaxed">{agent.role_summary}</p>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Role Summary</label>
            <textarea
              value={agent.role_summary}
              onChange={(e) => onUpdate({ ...agent, role_summary: e.target.value })}
              rows={2}
              className="w-full text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-gecx-300 bg-white"
            />
          </div>

          {agent.handles.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Handles
              </label>
              <div className="flex flex-wrap gap-1">
                {agent.handles.map((h) => (
                  <span
                    key={h}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-gecx-50 text-gecx-600 border border-gecx-100"
                  >
                    {h.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {agent.suggested_tools.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Suggested Tools
              </label>
              <div className="flex flex-wrap gap-1">
                {agent.suggested_tools.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Step2Architecture({
  isLoading,
  error,
  suggestion,
  agents,
  onAgentsChange,
  onRetry,
  onContinue,
  onBack,
}: Props) {
  const updateAgent = (index: number, updated: AgentDefinition) => {
    const next = [...agents]
    next[index] = updated
    onAgentsChange(next)
  }

  const deleteAgent = (index: number) => {
    onAgentsChange(agents.filter((_, i) => i !== index))
  }

  const addSubAgent = () => {
    const newAgent: AgentDefinition = {
      name: "New Sub-Agent",
      slug: `sub_agent_${agents.length}`,
      agent_type: "sub_agent",
      role_summary: "Handles specialized customer requests.",
      handles: [],
      suggested_tools: [],
      ai_generated: false,
    }
    onAgentsChange([...agents, newAgent])
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-10 h-10 border-2 border-gecx-200 border-t-gecx-600 rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            Gemini is designing your architecture…
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Analysing use case, decomposing capabilities, assigning tools
          </p>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">Architecture suggestion failed</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
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
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gecx-600 text-white text-sm font-medium hover:bg-gecx-700 transition"
          >
            <RefreshCw size={13} />
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── No suggestion yet ────────────────────────────────────────────────────────
  if (!suggestion) return null

  return (
    <div className="space-y-5">
      {/* Rationale banner */}
      <div className="rounded-xl bg-gecx-50 border border-gecx-100 p-4 flex items-start gap-3">
        <Sparkles size={16} className="text-gecx-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gecx-800 leading-relaxed">{suggestion.rationale}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-gecx-200 text-gecx-600 font-medium">
              {suggestion.decomposition_strategy.replace(/_/g, " ")}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-gecx-200 text-gecx-600 font-medium">
              {suggestion.root_agent_style.replace(/_/g, " ")}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                COMPLEXITY_STYLES[suggestion.estimated_complexity] ?? ""
              }`}
            >
              {suggestion.estimated_complexity} complexity
            </span>
          </div>
        </div>
      </div>

      {/* Agent list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} — review and edit as needed
          </p>
        </div>

        <div className="space-y-2">
          {agents.map((agent, i) => (
            <AgentCard
              key={`${agent.slug}-${i}`}
              agent={agent}
              onUpdate={(updated) => updateAgent(i, updated)}
              onDelete={() => deleteAgent(i)}
              canDelete={agent.agent_type !== "root_agent" || agents.filter(a => a.agent_type === "root_agent").length > 1}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addSubAgent}
          className="mt-2 flex items-center gap-1.5 text-xs text-gecx-600 hover:text-gecx-800 transition"
        >
          <Plus size={13} />
          Add sub-agent
        </button>
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
          disabled={agents.length === 0}
          className="px-5 py-2 rounded-lg bg-gecx-600 text-white text-sm font-medium hover:bg-gecx-700 disabled:opacity-40 transition"
        >
          Configure Tools →
        </button>
      </div>
    </div>
  )
}
