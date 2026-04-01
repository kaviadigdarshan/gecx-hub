import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { ToolsForm, ToolEntry } from "@/types/instructions";

interface Props {
  data: ToolsForm;
  onChange: (data: ToolsForm) => void;
}

function ToolCard({
  tool,
  index,
  onChange,
  onRemove,
}: {
  tool: ToolEntry;
  index: number;
  onChange: (t: ToolEntry) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const set = <K extends keyof ToolEntry>(key: K, val: ToolEntry[K]) =>
    onChange({ ...tool, [key]: val });

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
            {tool.tool_name || "Unnamed tool"}
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Tool name / slug</label>
            <input
              type="text"
              value={tool.tool_name}
              onChange={(e) => set("tool_name", e.target.value)}
              placeholder="e.g. get_order_status"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input
              type="text"
              value={tool.tool_description}
              onChange={(e) => set("tool_description", e.target.value)}
              placeholder="e.g. Retrieves the current status of an order"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">When to use</label>
            <textarea
              value={tool.when_to_use}
              onChange={(e) => set("when_to_use", e.target.value)}
              rows={2}
              placeholder="e.g. Call this tool when the customer asks about their order status and provides an order ID."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 resize-none transition"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Step4Tools({ data, onChange }: Props) {
  const updateTool = (idx: number, tool: ToolEntry) =>
    onChange({ tools: data.tools.map((t, i) => (i === idx ? tool : t)) });

  const removeTool = (idx: number) =>
    onChange({ tools: data.tools.filter((_, i) => i !== idx) });

  const addTool = () =>
    onChange({
      tools: [
        ...data.tools,
        { tool_name: "", tool_description: "", when_to_use: "" },
      ],
    });

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">Tool Usage</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          List the tools this agent can call. For each tool, define exactly when it should be invoked.
        </p>
      </div>

      {data.tools.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-400">No tools added yet.</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Add tools this agent needs to fulfil its role.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.tools.map((tool, idx) => (
            <ToolCard
              key={idx}
              tool={tool}
              index={idx}
              onChange={(t) => updateTool(idx, t)}
              onRemove={() => removeTool(idx)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addTool}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-dashed border-gecx-300 text-sm text-gecx-600 hover:bg-gecx-50 transition w-full justify-center"
      >
        <Plus size={14} />
        Add tool
      </button>
    </div>
  );
}
