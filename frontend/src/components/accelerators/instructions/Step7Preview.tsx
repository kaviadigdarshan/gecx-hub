import { useState } from "react";
import { Copy, Check, Sparkles } from "lucide-react";
import { apiClient } from "@/services/api";
import type { InstructionFormData } from "@/types/instructions";
import type { ScaffoldContext } from "@/types/scaffoldContext";
import TaskModuleEditor from "./TaskModuleEditor";

interface AssembleResponse {
  instruction: string;
  task_modules: Array<{ name: string; trigger: string; action: string }>;
  quality_score: number;
  character_count: number;
}

interface Props {
  formData: InstructionFormData;
  selectedAgentSlug: string | null;
  scaffoldContext: ScaffoldContext | null;
}

function buildAssemblePayload(formData: InstructionFormData, scaffoldContext: ScaffoldContext | null) {
  return {
    identity: {
      agent_name: formData.identity.agent_name,
      agent_purpose: formData.identity.agent_purpose,
      agent_type: formData.identity.agent_type,
      parent_agent_context: formData.identity.parent_agent_context,
    },
    persona: {
      persona_name: formData.persona.persona_name,
      tone: formData.persona.tone,
      brand_voice_keywords: formData.persona.brand_voice_keywords,
      language: formData.persona.language,
      company_name: formData.persona.company_name,
    },
    scope: {
      primary_goals: formData.scope.primary_goals,
      out_of_scope_topics: formData.scope.out_of_scope_topics,
      escalation_triggers: formData.scope.escalation_triggers,
      escalation_target: formData.scope.escalation_target,
    },
    tools: {
      tools: formData.tools.tools.map((t) => ({
        tool_name: t.tool_name,
        tool_description: t.tool_description,
        when_to_use: t.when_to_use,
      })),
    },
    sub_agents: {
      sub_agents: formData.subAgents.sub_agents.map((sa) => ({
        agent_name: sa.agent_name,
        agent_capability: sa.agent_capability,
        delegation_condition: sa.delegation_condition,
      })),
    },
    error_handling: formData.errorHandling
      ? {
          no_answer_response: formData.errorHandling.fallback_response,
          tool_failure_response: "",
          max_clarification_attempts: formData.errorHandling.max_retries,
          fallback_behavior: "apologize_and_escalate",
        }
      : {
          no_answer_response: "",
          tool_failure_response: "",
          max_clarification_attempts: 2,
          fallback_behavior: "apologize_and_escalate",
        },
    variable_declarations: (scaffoldContext?.variableDeclarations ?? []).map((v) => ({
      name: v.name,
      type: v.type,
    })),
    custom_sections: {},
    task_modules: [],
    root_agent_slug: "",
  };
}

function InstructionSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gecx-600 uppercase tracking-wider mb-1.5">{title}</h4>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

function buildInstructionPreview(formData: InstructionFormData): string {
  const { identity, persona, scope, tools, subAgents, errorHandling } = formData;
  const lines: string[] = [];

  lines.push(`# Agent: ${identity.agent_name || "[Agent Name]"}`);
  lines.push("");
  lines.push(`## Role`);
  lines.push(identity.agent_purpose || "[No purpose defined]");

  if (identity.agent_type === "sub_agent" && identity.parent_agent_context) {
    lines.push("");
    lines.push(`**Parent agent context:** ${identity.parent_agent_context}`);
  }

  if (persona.company_name || persona.persona_name) {
    lines.push("");
    lines.push(`## Identity`);
    if (persona.company_name) lines.push(`You represent **${persona.company_name}**.`);
    if (persona.persona_name) lines.push(`Your name is **${persona.persona_name}**.`);
    if (persona.tone) lines.push(`Communicate in a ${persona.tone.replace(/_/g, " ")} tone.`);
    if (persona.brand_voice_keywords.length > 0) {
      lines.push(`Brand voice: ${persona.brand_voice_keywords.join(", ")}.`);
    }
  }

  if (scope.primary_goals.length > 0) {
    lines.push("");
    lines.push(`## Primary Goals`);
    scope.primary_goals.forEach((g) => lines.push(`- ${g}`));
  }

  if (scope.out_of_scope_topics.length > 0) {
    lines.push("");
    lines.push(`## Out of Scope`);
    scope.out_of_scope_topics.forEach((t) => lines.push(`- ${t}`));
  }

  if (scope.escalation_triggers.length > 0) {
    lines.push("");
    lines.push(`## Escalation`);
    lines.push(`Escalate to **${scope.escalation_target}** when:`);
    scope.escalation_triggers.forEach((t) => lines.push(`- ${t}`));
  }

  if (tools.tools.length > 0) {
    lines.push("");
    lines.push(`## Tools`);
    tools.tools.forEach((t) => {
      lines.push(`**${t.tool_name}**: ${t.tool_description}`);
      if (t.when_to_use) lines.push(`  → ${t.when_to_use}`);
    });
  }

  if (identity.agent_type === "root_agent" && subAgents.sub_agents.length > 0) {
    lines.push("");
    lines.push(`## Sub-Agent Delegation`);
    subAgents.sub_agents.forEach((sa) => {
      lines.push(`**${sa.agent_name}**: ${sa.agent_capability}`);
      if (sa.delegation_condition) lines.push(`  → Delegate when: ${sa.delegation_condition}`);
    });
  }

  if (errorHandling) {
    lines.push("");
    lines.push(`## Error Handling`);
    if (errorHandling.max_retries > 0) {
      lines.push(`Retry up to ${errorHandling.max_retries} time(s). Retry message: "${errorHandling.retry_message}"`);
    }
    lines.push(`Fallback: "${errorHandling.fallback_response}"`);
  }

  return lines.join("\n");
}

export default function Step7Preview({
  formData,
  selectedAgentSlug,
  scaffoldContext,
}: Props) {
  const [copied, setCopied] = useState(false);

  // AI-assembled instruction with <task_module> blocks
  const [assembledInstruction, setAssembledInstruction] = useState<string | null>(null);
  const [isAssembling, setIsAssembling] = useState(false);
  const [assembleError, setAssembleError] = useState<string | null>(null);

  const handleAssemble = async () => {
    setIsAssembling(true);
    setAssembleError(null);
    try {
      const res = await apiClient.post<AssembleResponse>(
        "/accelerators/instructions/assemble",
        buildAssemblePayload(formData, scaffoldContext)
      );
      setAssembledInstruction(res.data.instruction);
    } catch {
      setAssembleError("Failed to assemble AI instruction. Check your connection and try again.");
    } finally {
      setIsAssembling(false);
    }
  };

  const previewText = buildInstructionPreview(formData);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(previewText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Preview card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Instruction Preview</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {previewText.length} characters · review before applying
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-white hover:text-gecx-600 transition"
          >
            {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="p-5 max-h-80 overflow-y-auto font-mono text-xs text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50/40">
          {previewText}
        </div>
      </div>

      {/* Summary sections */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Summary</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InstructionSection title="Identity">
            <p><span className="text-gray-400">Name:</span> {formData.identity.agent_name || "—"}</p>
            <p><span className="text-gray-400">Type:</span> {formData.identity.agent_type === "root_agent" ? "Root Agent" : "Sub-Agent"}</p>
          </InstructionSection>

          <InstructionSection title="Persona">
            <p><span className="text-gray-400">Company:</span> {formData.persona.company_name || "—"}</p>
            <p><span className="text-gray-400">Tone:</span> {formData.persona.tone.replace(/_/g, " ")}</p>
          </InstructionSection>

          <InstructionSection title="Scope">
            <p>{formData.scope.primary_goals.length} goal{formData.scope.primary_goals.length !== 1 ? "s" : ""}</p>
            <p>{formData.scope.out_of_scope_topics.length} out-of-scope topic{formData.scope.out_of_scope_topics.length !== 1 ? "s" : ""}</p>
            <p>{formData.scope.escalation_triggers.length} escalation trigger{formData.scope.escalation_triggers.length !== 1 ? "s" : ""}</p>
          </InstructionSection>

          <InstructionSection title="Tools & Sub-agents">
            <p>{formData.tools.tools.length} tool{formData.tools.tools.length !== 1 ? "s" : ""} configured</p>
            {formData.identity.agent_type === "root_agent" && (
              <p>{formData.subAgents.sub_agents.length} sub-agent{formData.subAgents.sub_agents.length !== 1 ? "s" : ""} configured</p>
            )}
            <p>Error handling: {formData.errorHandling ? "enabled" : "disabled"}</p>
          </InstructionSection>
        </div>
      </div>

      {/* AI Instruction Assembly + Task Module Editor */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">AI-Assembled Instruction</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {assembledInstruction
                ? `${assembledInstruction.length} characters · edit task modules below`
                : "Generate the full XML instruction with task modules using Gemini"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAssemble}
            disabled={isAssembling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gecx-200 text-xs text-gecx-600 bg-gecx-50 hover:bg-gecx-100 disabled:opacity-50 transition"
          >
            <Sparkles size={12} className={isAssembling ? "animate-pulse" : ""} />
            {isAssembling ? "Generating…" : assembledInstruction ? "Regenerate" : "Generate with AI"}
          </button>
        </div>

        {assembleError && (
          <div className="px-5 py-3 text-xs text-red-600 bg-red-50 border-b border-red-100">
            {assembleError}
          </div>
        )}

        {assembledInstruction && (
          <div className="p-5 max-h-52 overflow-y-auto font-mono text-xs text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50/40 border-b border-gray-100">
            {assembledInstruction}
          </div>
        )}
      </div>

      {/* Task Module Editor — only shown when assembled instruction has <task_module> blocks */}
      {assembledInstruction && (
        <TaskModuleEditor
          instruction={assembledInstruction}
          onChange={setAssembledInstruction}
          agentId={selectedAgentSlug ?? ""}
          agentName={formData.identity.agent_name}
          vertical={scaffoldContext?.businessDomain ?? "general"}
          scaffoldContext={scaffoldContext}
        />
      )}

    </div>
  );
}
