import { useProjectStore } from "@/store/projectStore";
import type { IdentityForm } from "@/types/instructions";
import { VariablePickerTextarea } from "@/components/common/VariablePickerTextarea";

interface Props {
  data: IdentityForm;
  onChange: (data: IdentityForm) => void;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default function Step1Identity({ data, onChange }: Props) {
  const set = <K extends keyof IdentityForm>(key: K, val: IdentityForm[K]) =>
    onChange({ ...data, [key]: val });

  const { scaffoldContext } = useProjectStore();
  const variableDeclarations = scaffoldContext?.variableDeclarations ?? [];

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">Agent Identity</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Define who this agent is and what its core role is.
        </p>
      </div>

      <Field label="Agent name" hint="The internal identifier for this agent (e.g. Order Support Agent).">
        <input
          type="text"
          value={data.agent_name}
          onChange={(e) => set("agent_name", e.target.value)}
          placeholder="e.g. Order Support Agent"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 transition"
        />
      </Field>

      <Field label="Agent purpose" hint="A concise description of what this agent is responsible for.">
        <VariablePickerTextarea
          value={data.agent_purpose}
          onChange={(val) => set("agent_purpose", val)}
          variableDeclarations={variableDeclarations}
          rows={3}
          placeholder="e.g. Handles customer order queries including status checks, modifications, cancellations, and returns."
        />
      </Field>

      <Field label="Agent type">
        <div className="flex gap-3">
          {(["root_agent", "sub_agent"] as const).map((type) => {
            const isActive = data.agent_type === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => set("agent_type", type)}
                className={[
                  "flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition",
                  isActive
                    ? "border-gecx-500 bg-gecx-50 text-gecx-700"
                    : "border-gray-200 text-gray-500 hover:border-gecx-200 hover:bg-gray-50",
                ].join(" ")}
              >
                {type === "root_agent" ? "Root Agent" : "Sub-Agent"}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-gray-400">
          {data.agent_type === "root_agent"
            ? "Root agents handle conversation routing and delegate to sub-agents."
            : "Sub-agents handle specialised tasks and are delegated to by the root agent."}
        </p>
      </Field>

      {data.agent_type === "sub_agent" && (
        <Field
          label="Parent agent context"
          hint="Briefly describe the root agent that delegates to this sub-agent."
        >
          <VariablePickerTextarea
            value={data.parent_agent_context}
            onChange={(val) => set("parent_agent_context", val)}
            variableDeclarations={variableDeclarations}
            rows={2}
            placeholder="e.g. The root agent handles overall conversation routing and delegates specialised tasks to sub-agents."
          />
        </Field>
      )}
    </div>
  );
}
