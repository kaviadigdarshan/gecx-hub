import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { PersonaForm } from "@/types/instructions";

const TONE_OPTIONS = [
  { value: "friendly_professional", label: "Friendly & Professional" },
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "empathetic", label: "Empathetic" },
  { value: "direct", label: "Direct & Concise" },
] as const;

const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese (Simplified)" },
] as const;

interface Props {
  data: PersonaForm;
  onChange: (data: PersonaForm) => void;
}

function KeywordInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInput("");
  };

  const remove = (kw: string) => onChange(value.filter((k) => k !== kw));

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
          }}
          placeholder="e.g. warm, concise — press Enter to add"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 transition"
        />
        <button
          type="button"
          onClick={add}
          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gecx-50 hover:border-gecx-300 hover:text-gecx-600 transition"
        >
          <Plus size={16} />
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gecx-100 text-gecx-700 text-xs font-medium"
            >
              {kw}
              <button
                type="button"
                onClick={() => remove(kw)}
                className="text-gecx-400 hover:text-gecx-700"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Step2Persona({ data, onChange }: Props) {
  const set = <K extends keyof PersonaForm>(key: K, val: PersonaForm[K]) =>
    onChange({ ...data, [key]: val });

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">Agent Persona</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Define how this agent presents itself and communicates with users.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Company name
          </label>
          <input
            type="text"
            value={data.company_name}
            onChange={(e) => set("company_name", e.target.value)}
            placeholder="e.g. Acme Corp"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Persona name
            <span className="ml-1 text-gray-400 font-normal text-xs">(optional)</span>
          </label>
          <input
            type="text"
            value={data.persona_name}
            onChange={(e) => set("persona_name", e.target.value)}
            placeholder="e.g. Alex"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 transition"
          />
          <p className="mt-1 text-xs text-gray-400">Name the agent will use when introducing itself.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Tone</label>
          <select
            value={data.tone}
            onChange={(e) => set("tone", e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 bg-white transition"
          >
            {TONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Language</label>
          <select
            value={data.language}
            onChange={(e) => set("language", e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 bg-white transition"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Brand voice keywords
        </label>
        <KeywordInput
          value={data.brand_voice_keywords}
          onChange={(v) => set("brand_voice_keywords", v)}
        />
        <p className="mt-1.5 text-xs text-gray-400">
          Words and phrases that capture the brand personality (e.g. warm, transparent, jargon-free).
        </p>
      </div>
    </div>
  );
}
