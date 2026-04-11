import { useState } from "react"
import type { AppSettingsData } from "@/types/scaffolder"
import { GEMINI_MODELS, COMMON_TIMEZONES } from "@/types/scaffolder"

interface Props {
  settings: AppSettingsData
  onChange: (s: AppSettingsData) => void
  onBack: () => void
  onContinue: () => void
}

export default function Step3AppSettings({ settings, onChange, onBack, onContinue }: Props) {
  const [tzQuery, setTzQuery] = useState("")

  const set = <K extends keyof AppSettingsData>(key: K, value: AppSettingsData[K]) =>
    onChange({ ...settings, [key]: value })

  const filteredTimezones = tzQuery.trim()
    ? COMMON_TIMEZONES.filter((tz) => tz.toLowerCase().includes(tzQuery.toLowerCase()))
    : COMMON_TIMEZONES

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">App Settings</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Configure the runtime model and execution settings for your CX Agent Studio app.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">

        {/* Model selector */}
        <div className="px-4 py-4">
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Gemini Model
          </label>
          <select
            value={settings.model}
            onChange={(e) => set("model", e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gecx-400 bg-white"
          >
            {GEMINI_MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Temperature slider */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-700">Temperature</label>
            <span className="text-sm font-mono font-medium text-gecx-700 tabular-nums w-8 text-right">
              {settings.temperature.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={settings.temperature}
            onChange={(e) => set("temperature", parseFloat(e.target.value))}
            className="w-full accent-gecx-600"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>0.0</span>
            <span>1.0</span>
            <span>2.0</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            1.0 is recommended for conversational agents. Lower for factual/precise agents.
          </p>
        </div>

        {/* Time Zone */}
        <div className="px-4 py-4">
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Time Zone
          </label>
          <input
            type="text"
            value={tzQuery || settings.timeZone}
            onChange={(e) => {
              setTzQuery(e.target.value)
              set("timeZone", e.target.value)
            }}
            onBlur={() => setTzQuery("")}
            placeholder="Search timezones…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gecx-400 mb-1"
          />
          {tzQuery && filteredTimezones.length > 0 && (
            <ul className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100 max-h-40 overflow-y-auto text-sm shadow-sm">
              {filteredTimezones.map((tz) => (
                <li key={tz}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      set("timeZone", tz)
                      setTzQuery("")
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-gecx-50 hover:text-gecx-700 transition-colors"
                  >
                    {tz}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!tzQuery && (
            <div className="flex flex-wrap gap-1 mt-1">
              {COMMON_TIMEZONES.map((tz) => (
                <button
                  key={tz}
                  type="button"
                  onClick={() => set("timeZone", tz)}
                  className={[
                    "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                    settings.timeZone === tz
                      ? "border-gecx-400 bg-gecx-50 text-gecx-700 font-medium"
                      : "border-gray-200 text-gray-500 hover:border-gecx-300",
                  ].join(" ")}
                >
                  {tz}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Navigation */}
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
          onClick={onContinue}
          className="px-6 py-2.5 rounded-lg bg-gecx-600 text-white text-sm font-semibold hover:bg-gecx-700 transition shadow-sm shadow-gecx-200"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
