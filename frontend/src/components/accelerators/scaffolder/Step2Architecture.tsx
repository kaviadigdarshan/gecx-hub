import { useState, useEffect } from "react"
import {
  Sparkles,
  AlertCircle,
  RefreshCw,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Wrench,
} from "lucide-react"
import type { ArchitectureSuggestion, AgentDefinition } from "@/types/scaffolder"
import type { ToolDefinition, ToolsetDefinition } from "@/types/scaffoldContext"
import { PERSONAS_BY_VERTICAL } from "@/constants/personasByVertical"
import { RetryButton } from "@/components/RetryButton"

interface Props {
  isLoading: boolean
  error: string | null
  suggestion: ArchitectureSuggestion | null
  agents: AgentDefinition[]
  onAgentsChange: (agents: AgentDefinition[]) => void
  onRetry: () => void
  onContinue: () => void
  onBack: () => void
  vertical: string
  contextTools: ToolDefinition[]
  contextToolsets: ToolsetDefinition[]
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
  personaOptions,
  contextTools,
  contextToolsets,
}: {
  agent: AgentDefinition
  onUpdate: (updated: AgentDefinition) => void
  onDelete: () => void
  canDelete: boolean
  personaOptions: string[]
  contextTools: ToolDefinition[]
  contextToolsets: ToolsetDefinition[]
}) {
  const [expanded, setExpanded] = useState(false)
  const [toolsExpanded, setToolsExpanded] = useState(false)

  const agentTools = agent.tools ?? []
  const agentToolsets = agent.toolsets ?? []

  const isToolsetEnabled = (id: string) => agentToolsets.some((ts) => ts.toolset === id)
  const getToolsetToolIds = (id: string) =>
    agentToolsets.find((ts) => ts.toolset === id)?.toolIds ?? []

  const toggleTool = (toolId: string) => {
    const next = agentTools.includes(toolId)
      ? agentTools.filter((t) => t !== toolId)
      : [...agentTools, toolId]
    onUpdate({ ...agent, tools: next })
  }

  const toggleToolset = (toolsetId: string, allToolIds: string[]) => {
    if (isToolsetEnabled(toolsetId)) {
      onUpdate({ ...agent, toolsets: agentToolsets.filter((ts) => ts.toolset !== toolsetId) })
    } else {
      onUpdate({
        ...agent,
        toolsets: [...agentToolsets, { toolset: toolsetId, toolIds: allToolIds }],
      })
    }
  }

  const toggleToolsetTool = (toolsetId: string, toolId: string) => {
    const existing = agentToolsets.find((ts) => ts.toolset === toolsetId)
    if (!existing) return
    const nextToolIds = existing.toolIds.includes(toolId)
      ? existing.toolIds.filter((t) => t !== toolId)
      : [...existing.toolIds, toolId]
    onUpdate({
      ...agent,
      toolsets: agentToolsets.map((ts) =>
        ts.toolset === toolsetId ? { ...ts, toolIds: nextToolIds } : ts
      ),
    })
  }

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

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={agent.name}
            onChange={(e) => onUpdate({ ...agent, name: e.target.value })}
            className={`w-full px-3 py-2 text-sm font-medium text-gray-900 rounded-lg focus:outline-none transition-colors ${
              agent.name.trim() === '' ? 'border-2 border-red-400' : 'border border-gray-200'
            }`}
            placeholder="Agent display name"
          />
          {agent.name.trim() === '' && (
            <p className="text-xs text-red-500 mt-1">Agent name is required</p>
          )}
        </div>

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

      {/* Role summary (always visible, editable) */}
      <div className="px-4 pb-3">
        <input
          type="text"
          value={agent.role_summary}
          onChange={(e) => onUpdate({ ...agent, role_summary: e.target.value })}
          placeholder="Agent description"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gecx-300"
        />
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Persona Type</label>
            <select
              value={agent.persona ?? personaOptions[0]}
              onChange={(e) => onUpdate({ ...agent, persona: e.target.value })}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-gecx-300"
            >
              {personaOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          {agent.handles.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Handles</label>
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

          {/* ── Tools & Toolsets accordion ─────────────────────────────────── */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setToolsExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Wrench size={12} className="text-gray-400" />
                Tools &amp; Toolsets
                {(agentTools.length > 0 || agentToolsets.length > 0) && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gecx-100 text-gecx-600">
                    {agentTools.length + agentToolsets.length} assigned
                  </span>
                )}
              </div>
              {toolsExpanded ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
            </button>

            {toolsExpanded && (
              <div className="border-t border-gray-100 px-3 py-3 space-y-4">

                {/* Tools multi-select */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Tools</label>
                  {contextTools.length === 0 ? (
                    <input
                      type="text"
                      disabled
                      placeholder="No tools yet — define them in the Tools Configurator (Step 5)"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-400 cursor-not-allowed"
                    />
                  ) : (
                    <div className="space-y-1">
                      {contextTools.map((tool) => (
                        <label
                          key={tool.id}
                          className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-gecx-700"
                        >
                          <input
                            type="checkbox"
                            checked={agentTools.includes(tool.id)}
                            onChange={() => toggleTool(tool.id)}
                            className="accent-gecx-600"
                          />
                          {tool.id} ({tool.type})
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Toolsets */}
                {contextToolsets.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Toolsets</label>
                    <div className="space-y-2">
                      {contextToolsets.map((ts) => {
                        const enabled = isToolsetEnabled(ts.id)
                        const selectedToolIds = getToolsetToolIds(ts.id)
                        return (
                          <div key={ts.id} className="rounded border border-gray-200 p-2">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={() => toggleToolset(ts.id, ts.toolIds)}
                                className="accent-gecx-600"
                              />
                              {ts.id}
                            </label>
                            {enabled && ts.toolIds.length > 0 && (
                              <div className="mt-2 ml-4 space-y-1">
                                {ts.toolIds.map((toolId) => (
                                  <label
                                    key={toolId}
                                    className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:text-gecx-700"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedToolIds.includes(toolId)}
                                      onChange={() => toggleToolsetTool(ts.id, toolId)}
                                      className="accent-gecx-600"
                                    />
                                    {toolId}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
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
  vertical,
  contextTools,
  contextToolsets,
}: Props) {
  const personaOptions = PERSONAS_BY_VERTICAL[vertical] ?? PERSONAS_BY_VERTICAL.generic

  // When vertical changes, keep persona if still valid; otherwise reset to first option
  useEffect(() => {
    if (agents.length === 0) return
    const updated = agents.map((a) => ({
      ...a,
      persona: personaOptions.includes(a.persona ?? "") ? a.persona : personaOptions[0],
    }))
    onAgentsChange(updated)
  }, [vertical]) // eslint-disable-line react-hooks/exhaustive-deps

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
      tools: [],
      toolsets: [],
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
              personaOptions={personaOptions}
              contextTools={contextTools}
              contextToolsets={contextToolsets}
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
        <div className="flex items-center gap-2">
          <RetryButton
            onRetry={onRetry}
            isLoading={isLoading}
            label="Retry"
            className="px-4 py-2 rounded-lg text-sm"
          />
          <button
            type="button"
            onClick={onContinue}
            disabled={
              agents.length === 0 ||
              agents.some((agent) => agent.name.trim() === '')
            }
            className="px-5 py-2 rounded-lg bg-gecx-600 text-white text-sm font-medium hover:bg-gecx-700 disabled:opacity-40 transition"
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  )
}
