import type { GlobalSettingsData } from "@/types/scaffolder"

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

interface Props {
  globalSettings: GlobalSettingsData
  onGlobalSettingsChange: (settings: GlobalSettingsData) => void
  onBack: () => void
  onContinue: () => void
}

export default function Step3ToolStubs({
  globalSettings,
  onGlobalSettingsChange,
  onBack,
  onContinue,
}: Props) {
  const update = <K extends keyof GlobalSettingsData>(
    key: K,
    value: GlobalSettingsData[K]
  ) => onGlobalSettingsChange({ ...globalSettings, [key]: value })

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
