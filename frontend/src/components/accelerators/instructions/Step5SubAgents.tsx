import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Info } from "lucide-react";
import type { SubAgentsForm, SubAgentEntry } from "@/types/instructions";

interface Props {
  data: SubAgentsForm;
  agentType: "root_agent" | "sub_agent";
  onChange: (data: SubAgentsForm) => void;
}

function SubAgentCard({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: SubAgentEntry;
  index: number;
  onChange: (e: SubAgentEntry) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const set = <K extends keyof SubAgentEntry>(key: K, val: SubAgentEntry[K]) =>
    onChange({ ...entry, [key]: val });

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-gecx-600 bg-gecx-100 px-1.5 py-0.5 rounded shrink-0">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-gray-700 truncate">
            {entry.agent_name || "Unnamed sub-agent"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1 text-gray-300 hover:text-red-400 transition"
          >
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sub-agent name</label>
            <input
              type="text"
              value={entry.agent_name}
              onChange={(e) => set("agent_name", e.target.value)}
              placeholder="e.g. Order Support Agent"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Capability summary</label>
            <input
              type="text"
              value={entry.agent_capability}
              onChange={(e) => set("agent_capability", e.target.value)}
              placeholder="e.g. Handles order tracking, modifications, and returns"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Delegation condition</label>
            <textarea
              value={entry.delegation_condition}
              onChange={(e) => set("delegation_condition", e.target.value)}
              rows={2}
              placeholder="e.g. Delegate when the user's intent relates to an order — they mention an order number, ask about shipping status, or want to cancel/modify an order."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 resize-none transition"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Step5SubAgents({ data, agentType, onChange }: Props) {
  if (agentType === "sub_agent") {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-start gap-3 text-gray-500">
          <Info size={16} className="mt-0.5 shrink-0 text-gecx-400" />
          <div>
            <p className="text-sm font-medium text-gray-700">Not applicable for sub-agents</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Sub-agents are delegated to by the root agent — they do not themselves delegate to
              other agents. You can skip this step.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const updateEntry = (idx: number, entry: SubAgentEntry) =>
    onChange({ sub_agents: data.sub_agents.map((e, i) => (i === idx ? entry : e)) });

  const removeEntry = (idx: number) =>
    onChange({ sub_agents: data.sub_agents.filter((_, i) => i !== idx) });

  const addEntry = () =>
    onChange({
      sub_agents: [
        ...data.sub_agents,
        { agent_name: "", agent_capability: "", delegation_condition: "" },
      ],
    });

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">Sub-Agent Delegation</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Configure which sub-agents this root agent can delegate to and under what conditions.
        </p>
      </div>

      {data.sub_agents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-400">No sub-agents configured.</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Add each sub-agent this root agent can hand off to.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.sub_agents.map((entry, idx) => (
            <SubAgentCard
              key={idx}
              entry={entry}
              index={idx}
              onChange={(e) => updateEntry(idx, e)}
              onRemove={() => removeEntry(idx)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addEntry}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-dashed border-gecx-300 text-sm text-gecx-600 hover:bg-gecx-50 transition w-full justify-center"
      >
        <Plus size={14} />
        Add sub-agent
      </button>
    </div>
  );
}
