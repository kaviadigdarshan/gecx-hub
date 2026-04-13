import { useState } from "react"
import { Plus, Trash2, Sparkles, Pencil } from "lucide-react"
import { apiClient } from "@/services/api"
import type { VariableDeclaration } from "@/types/scaffoldContext"
import type { AgentDefinition } from "@/types/scaffolder"
import { RetryButton } from "@/components/RetryButton"

interface Props {
  variables: VariableDeclaration[]
  onChange: (vars: VariableDeclaration[]) => void
  vertical: string
  agents: AgentDefinition[]
  onBack: () => void
  onContinue: () => void
}

type SessionVarType = 'text' | 'number' | 'boolean' | 'custom_schema' | 'array_string' | 'array_number';

const SESSION_VAR_TYPES: { value: SessionVarType; label: string }[] = [
  { value: 'text',          label: 'Text' },
  { value: 'number',        label: 'Number' },
  { value: 'boolean',       label: 'Boolean' },
  { value: 'custom_schema', label: 'Custom Schema' },
  { value: 'array_string',  label: 'Array of Strings' },
  { value: 'array_number',  label: 'Array of Numbers' },
];

const DEFAULT_BY_TYPE: Record<SessionVarType, VariableDeclaration["defaultValue"]> = {
  text: "",
  number: 0,
  boolean: false,
  custom_schema: {},
  array_string: [],
  array_number: [],
}

function defaultValueDisplay(v: VariableDeclaration): string {
  if (v.defaultValue === undefined || v.defaultValue === null) return "—"
  if (typeof v.defaultValue === "boolean") return String(v.defaultValue)
  if (typeof v.defaultValue === "string") return v.defaultValue === "" ? '""' : `"${v.defaultValue}"`
  return JSON.stringify(v.defaultValue)
}

function DefaultValueInput({
  type,
  value,
  onChange,
}: {
  type: SessionVarType
  value: VariableDeclaration["defaultValue"]
  onChange: (v: VariableDeclaration["defaultValue"]) => void
}) {
  if (type === "boolean") {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-gray-300 text-gecx-600 focus:ring-gecx-500"
        />
        <span className="text-xs text-gray-500">{value ? "true" : "false"}</span>
      </label>
    )
  }
  if (type === "custom_schema" || type === "array_string" || type === "array_number") {
    const raw = typeof value === "string" ? value : JSON.stringify(value ?? (type === "custom_schema" ? {} : []), null, 2)
    return (
      <textarea
        rows={2}
        value={raw}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value))
          } catch {
            onChange(e.target.value)
          }
        }}
        className="w-full text-xs font-mono border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gecx-400 resize-none"
      />
    )
  }
  return (
    <input
      type="text"
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      placeholder="default value"
      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gecx-400"
    />
  )
}

function AddVariableForm({ onAdd, onCancel }: { onAdd: (v: VariableDeclaration) => void; onCancel: () => void }) {
  const [name, setName] = useState("")
  const [type, setType] = useState<SessionVarType>("text")
  const [defaultValue, setDefaultValue] = useState<VariableDeclaration["defaultValue"]>("")
  const [description, setDescription] = useState("")
  const [nameError, setNameError] = useState("")

  const handleTypeChange = (t: SessionVarType) => {
    setType(t)
    setDefaultValue(DEFAULT_BY_TYPE[t])
  }

  const handleNameChange = (raw: string) => {
    const upper = raw.toUpperCase().replace(/[^A-Z0-9_]/g, "")
    setName(upper)
    setNameError("")
  }

  const handleAdd = () => {
    if (!name.trim()) {
      setNameError("Name is required")
      return
    }
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
      setNameError("Must start with a letter, use UPPER_SNAKE_CASE")
      return
    }
    onAdd({ name, type, defaultValue, description: description || undefined })
  }

  return (
    <div className="rounded-lg border border-gecx-200 bg-gecx-50/40 p-4 space-y-3">
      <p className="text-xs font-semibold text-gecx-700 mb-1">New Variable</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="VARIABLE_NAME"
            className={[
              "w-full text-xs font-mono border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1",
              nameError ? "border-red-300 focus:ring-red-400" : "border-gray-200 focus:ring-gecx-400",
            ].join(" ")}
          />
          {nameError && <p className="text-[10px] text-red-500 mt-0.5">{nameError}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as SessionVarType)}
            className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gecx-400 bg-white"
          >
            {SESSION_VAR_TYPES.map(({ value: v, label }) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Default Value</label>
        <DefaultValueInput type={type} value={defaultValue} onChange={setDefaultValue} />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this variable tracks…"
          className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gecx-400 resize-none"
        />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleAdd}
          className="px-3 py-1.5 text-xs rounded-md bg-gecx-600 text-white hover:bg-gecx-700 transition font-medium"
        >
          Add Variable
        </button>
      </div>
    </div>
  )
}

export default function Step3SessionVars({
  variables,
  onChange,
  vertical,
  agents,
  onBack,
  onContinue,
}: Props) {
  const [showForm, setShowForm] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [editingVarIdx, setEditingVarIdx] = useState<number | null>(null)

  const updateVariable = (idx: number, patch: Partial<VariableDeclaration>) => {
    onChange(variables.map((v, i) => (i === idx ? { ...v, ...patch } : v)))
  }

  const handleAdd = (v: VariableDeclaration) => {
    onChange([...variables, v])
    setShowForm(false)
  }

  const handleDelete = (idx: number) => {
    onChange(variables.filter((_, i) => i !== idx))
  }

  const handleSuggest = async () => {
    setIsSuggesting(true)
    setSuggestError(null)
    try {
      const res = await apiClient.post<{ suggestions: VariableDeclaration[] }>(
        "/accelerators/scaffolder/suggest-variables",
        {
          vertical: vertical || "generic",
          agents: agents.map((a) => ({ name: a.name, slug: a.slug, agent_type: a.agent_type })),
        }
      )
      // Merge: skip names already declared
      const existing = new Set(variables.map((v) => v.name))
      const newVars = res.data.suggestions.filter((s) => !existing.has(s.name))
      onChange([...variables, ...newVars])
      setHasGenerated(true)
    } catch {
      setSuggestError("AI suggestion failed. Add variables manually or try again.")
    } finally {
      setIsSuggesting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800">Session Variables</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Declare typed session variables used across all agents. These map to{" "}
          <code className="font-mono text-gecx-700">{"{varname}"}</code> references in instructions.
        </p>
      </div>

      {/* Suggest button */}
      <div className="flex items-center gap-2">
        {!hasGenerated ? (
          <button
            type="button"
            onClick={handleSuggest}
            disabled={isSuggesting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gecx-300 text-gecx-700 text-xs font-medium hover:bg-gecx-50 disabled:opacity-40 transition"
          >
            {isSuggesting ? (
              <>
                <span className="w-3 h-3 border-2 border-gecx-400/30 border-t-gecx-600 rounded-full animate-spin" />
                Suggesting…
              </>
            ) : (
              <>
                <Sparkles size={13} />
                Suggest Variables with AI
              </>
            )}
          </button>
        ) : (
          <RetryButton
            onRetry={handleSuggest}
            isLoading={isSuggesting}
            label="Retry"
            className="px-3 py-1.5 rounded-lg text-xs"
          />
        )}
        {suggestError && (
          <span className="text-xs text-red-500">{suggestError}</span>
        )}
      </div>

      {/* Variable list */}
      {variables.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Type</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Default</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 hidden sm:table-cell">Description</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {variables.map((v, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2">
                    {editingVarIdx === i ? (
                      <input
                        autoFocus
                        type="text"
                        value={v.name}
                        onChange={(e) => updateVariable(i, { name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })}
                        onBlur={() => setEditingVarIdx(null)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingVarIdx(null)}
                        className="flex-1 px-2 py-1 text-xs font-mono border border-gecx-300 rounded focus:outline-none focus:ring-1 focus:ring-gecx-400"
                      />
                    ) : (
                      <span className="font-mono font-medium text-gray-800">{v.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded bg-gecx-50 text-gecx-700 font-medium text-[10px]">
                      {v.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-500">{defaultValueDisplay(v)}</td>
                  <td className="px-3 py-2 text-gray-500 hidden sm:table-cell max-w-[180px] truncate">
                    {v.description ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingVarIdx(i)}
                        className="text-gecx-400 hover:text-gecx-700 p-1 transition-colors"
                        aria-label="Edit variable name"
                        title="Edit variable name"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(i)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        aria-label="Delete variable"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {variables.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
          <p className="text-xs text-gray-400">No variables declared yet.</p>
          <p className="text-xs text-gray-400 mt-0.5">Use AI suggestions or add manually.</p>
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <AddVariableForm onAdd={handleAdd} onCancel={() => setShowForm(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-xs text-gecx-600 hover:text-gecx-800 font-medium transition"
        >
          <Plus size={13} />
          Add Variable
        </button>
      )}

      {/* Navigation */}
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
          className="px-6 py-2.5 rounded-lg bg-gecx-600 text-white text-sm font-semibold hover:bg-gecx-700 transition shadow-sm shadow-gecx-200"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
