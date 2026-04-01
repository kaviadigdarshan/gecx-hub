import { BUSINESS_DOMAINS, CAPABILITY_OPTIONS } from "@/types/scaffolder"
import type { UseCaseData } from "@/types/scaffolder"

interface Props {
  data: UseCaseData
  onChange: (data: UseCaseData) => void
  onContinue: () => void
  isLoading: boolean
}

const MAX_CHARS = 500

export default function Step1UseCase({ data, onChange, onContinue, isLoading }: Props) {
  const update = <K extends keyof UseCaseData>(key: K, value: UseCaseData[K]) =>
    onChange({ ...data, [key]: value })

  const toggleCapability = (slug: string) => {
    const caps = data.expected_capabilities.includes(slug)
      ? data.expected_capabilities.filter((c) => c !== slug)
      : [...data.expected_capabilities, slug]
    update("expected_capabilities", caps)
  }

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
            onChange={(e) => update("business_domain", e.target.value)}
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
          placeholder="Describe what you want the AI app to do. e.g. Handle customer service for an online retailer — including order tracking, returns, product questions, and loyalty rewards."
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
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Expected Capabilities{" "}
          <span className="text-gray-400 font-normal">(select all that apply)</span>
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Gemini uses these to suggest the right agent decomposition.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {CAPABILITY_OPTIONS.map(({ slug, label }) => {
            const checked = data.expected_capabilities.includes(slug)
            return (
              <label
                key={slug}
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
                  onChange={() => toggleCapability(slug)}
                  className="accent-gecx-600 w-3 h-3 flex-shrink-0"
                />
                <span className="leading-tight">{label}</span>
              </label>
            )
          })}
        </div>
      </div>

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
