import { useState, useRef } from "react"
import { BUSINESS_DOMAINS } from "@/types/scaffolder"
import type { UseCaseData } from "@/types/scaffolder"
import { CAPABILITIES_BY_VERTICAL } from "@/constants/capabilitiesByVertical"

interface Props {
  data: UseCaseData
  onChange: (data: UseCaseData) => void
  onContinue: () => void
  isLoading: boolean
}

const MAX_CHARS = 2000

export default function Step1UseCase({ data, onChange, onContinue, isLoading }: Props) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customInputValue, setCustomInputValue] = useState("")
  const customInputRef = useRef<HTMLInputElement>(null)

  const update = <K extends keyof UseCaseData>(key: K, value: UseCaseData[K]) =>
    onChange({ ...data, [key]: value })

  const handleDomainChange = (domain: string) => {
  onChange({
    ...data,
    business_domain: domain,
    expected_capabilities: [],
  })
}

  const toggleCapability = (label: string) => {
    const caps = data.expected_capabilities.includes(label)
      ? data.expected_capabilities.filter((c) => c !== label)
      : [...data.expected_capabilities, label]
    update("expected_capabilities", caps)
  }

  const confirmCustomCapability = () => {
    const trimmed = customInputValue.trim()
    if (!trimmed) return
    const already =
      data.expected_capabilities.includes(trimmed) ||
      (data.customCapabilities ?? []).includes(trimmed)
    if (!already) {
      onChange({
        ...data,
        customCapabilities: [...(data.customCapabilities ?? []), trimmed],
      })
    }
    setCustomInputValue("")
    setShowCustomInput(false)
  }

  const removeCustomCapability = (label: string) => {
    onChange({
      ...data,
      customCapabilities: (data.customCapabilities ?? []).filter((c) => c !== label),
    })
  }

  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      confirmCustomCapability()
    } else if (e.key === "Escape") {
      setShowCustomInput(false)
      setCustomInputValue("")
    }
  }

  const presetCapabilities = CAPABILITIES_BY_VERTICAL[data.business_domain] ?? null
  const isGeneric = data.business_domain === "generic"
  const showGrid = presetCapabilities !== null && !isGeneric

  const canContinue =
    data.business_domain.length > 0 && data.primary_use_case.trim().length >= 20

  return (
    <div className="space-y-6">
      {/* Domain + Company */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Business Domain <span className="text-red-400">*</span>
          </label>
          <select
            value={data.business_domain}
            onChange={(e) => handleDomainChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gecx-300 focus:border-gecx-400"
          >
            <option value="">Select domain…</option>
            {BUSINESS_DOMAINS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Company Name <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={data.company_name}
            onChange={(e) => update("company_name", e.target.value)}
            placeholder="e.g. Acme Corp"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gecx-300 focus:border-gecx-400"
          />
        </div>
      </div>

      {/* Use case description */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Primary Use Case <span className="text-red-400">*</span>
          </label>
          <span
            className={`text-xs ${
              data.primary_use_case.length > MAX_CHARS - 50
                ? "text-amber-500"
                : "text-gray-400"
            }`}
          >
            {data.primary_use_case.length}/{MAX_CHARS}
          </span>
        </div>
        <textarea
          value={data.primary_use_case}
          onChange={(e) =>
            update("primary_use_case", e.target.value.slice(0, MAX_CHARS))
          }
          placeholder="Describe what you want the AI app to do. Include the key user journeys, business constraints, and any integration points. e.g. Handle customer service for a grocery retailer — including order tracking, cancellations, product search, store locator, and escalation to human agents."
          rows={4}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gecx-300 focus:border-gecx-400"
        />
        {data.primary_use_case.trim().length > 0 &&
          data.primary_use_case.trim().length < 20 && (
            <p className="mt-1 text-xs text-amber-600">
              Please provide at least 20 characters for a useful architecture suggestion.
            </p>
          )}
      </div>

      {/* Channel */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Deployment Channel
        </label>
        <div className="flex gap-2">
          {(
            [
              { value: "web_chat", label: "Web Chat" },
              { value: "voice", label: "Voice" },
              { value: "both", label: "Both" },
            ] as { value: UseCaseData["channel"]; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => update("channel", value)}
              className={[
                "px-4 py-1.5 rounded-full text-sm font-medium border transition",
                data.channel === value
                  ? "bg-gecx-600 text-white border-gecx-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gecx-300 hover:text-gecx-700",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        {data.channel === "voice" && (
          <p className="mt-1.5 text-xs text-gray-500">
            Voice channel uses a simpler topology (2–4 agents) for better latency.
          </p>
        )}
      </div>

      {/* Capabilities */}
      {data.business_domain && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expected Capabilities{" "}
            <span className="text-gray-400 font-normal">(select all that apply)</span>
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Selected capabilities map directly to suggested sub-agents. Add custom ones for
            domain-specific requirements.
          </p>

          {/* Preset grid */}
          {showGrid && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(CAPABILITIES_BY_VERTICAL[data.business_domain] ?? []).map((label) => {
                const checked = data.expected_capabilities.includes(label)
                return (
                  <label
                    key={label}
                    className={[
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition",
                      checked
                        ? "border-gecx-400 bg-gecx-50 text-gecx-700"
                        : "border-gray-200 text-gray-600 hover:border-gecx-200 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCapability(label)}
                      className="accent-gecx-600 w-3 h-3 flex-shrink-0"
                    />
                    <span className="leading-tight">{label}</span>
                  </label>
                )
              })}
            </div>
          )}

          {/* Generic vertical empty state */}
          {isGeneric && (
            <p className="text-xs text-gray-400 italic mb-3">
              No preset capabilities for Generic. Add your own below.
            </p>
          )}

          {/* Custom capabilities chips */}
          {(data.customCapabilities ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {(data.customCapabilities ?? []).map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gecx-400 bg-gecx-50 text-gecx-700 text-xs"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => removeCustomCapability(label)}
                    className="text-gecx-400 hover:text-gecx-700 leading-none"
                    aria-label={`Remove ${label}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Add capability input */}
          {showCustomInput ? (
            <div className="flex items-center gap-2">
              <input
                ref={customInputRef}
                type="text"
                value={customInputValue}
                onChange={(e) => setCustomInputValue(e.target.value)}
                onKeyDown={handleCustomKeyDown}
                placeholder="e.g. Gift Card Management"
                autoFocus
                className="flex-1 rounded-lg border border-gecx-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gecx-300"
              />
              <button
                type="button"
                onClick={confirmCustomCapability}
                className="px-3 py-1.5 rounded-lg bg-gecx-600 text-white text-xs font-medium hover:bg-gecx-700 transition"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCustomInput(false)
                  setCustomInputValue("")
                }}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              className="text-xs text-gecx-600 hover:text-gecx-700 font-medium transition"
            >
              + Add capability
            </button>
          )}
        </div>
      )}

      {/* Continue */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue || isLoading}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gecx-600 text-white text-sm font-medium hover:bg-gecx-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Getting suggestion…
            </>
          ) : (
            "Suggest Architecture →"
          )}
        </button>
      </div>
    </div>
  )
}
