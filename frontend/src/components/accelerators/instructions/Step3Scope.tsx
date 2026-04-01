import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ScopeForm } from "@/types/instructions";

interface Props {
  data: ScopeForm;
  onChange: (data: ScopeForm) => void;
}

function EditableList({
  label,
  hint,
  items,
  placeholder,
  onChange,
}: {
  label: string;
  hint?: string;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setInput("");
  };

  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const update = (idx: number, val: string) =>
    onChange(items.map((item, i) => (i === idx ? val : item)));

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="space-y-1.5 mb-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <span className="mt-2.5 text-xs text-gray-400 w-4 shrink-0 text-right">{idx + 1}.</span>
            <input
              type="text"
              value={item}
              onChange={(e) => update(idx, e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 transition"
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="mt-1 p-1.5 text-gray-300 hover:text-red-400 transition"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 transition"
        />
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gecx-50 hover:border-gecx-300 hover:text-gecx-600 transition"
        >
          <Plus size={14} />
          Add
        </button>
      </div>
      {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default function Step3Scope({ data, onChange }: Props) {
  const set = <K extends keyof ScopeForm>(key: K, val: ScopeForm[K]) =>
    onChange({ ...data, [key]: val });

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">Scope & Escalation</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Define what this agent should and should not handle, and when to escalate.
        </p>
      </div>

      <EditableList
        label="Primary goals"
        hint="What this agent must accomplish in every successful interaction."
        items={data.primary_goals}
        placeholder="e.g. Resolve order status queries without human intervention"
        onChange={(v) => set("primary_goals", v)}
      />

      <EditableList
        label="Out-of-scope topics"
        hint="Topics this agent should decline and optionally redirect."
        items={data.out_of_scope_topics}
        placeholder="e.g. Billing disputes (handled by Billing Agent)"
        onChange={(v) => set("out_of_scope_topics", v)}
      />

      <EditableList
        label="Escalation triggers"
        hint="Conditions that should cause the agent to escalate to a human or another agent."
        items={data.escalation_triggers}
        placeholder="e.g. Customer expresses frustration after two failed resolution attempts"
        onChange={(v) => set("escalation_triggers", v)}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Escalation target
        </label>
        <input
          type="text"
          value={data.escalation_target}
          onChange={(e) => set("escalation_target", e.target.value)}
          placeholder="e.g. human customer service agent"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 transition"
        />
        <p className="mt-1 text-xs text-gray-400">
          Who or what the agent hands off to when escalation is triggered.
        </p>
      </div>
    </div>
  );
}
