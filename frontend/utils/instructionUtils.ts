/**
 * Instruction Architect utilities.
 * Extracted from Step7Preview.tsx inline functions.
 */

import type { InstructionFormData, IdentityForm, PersonaForm, ScopeForm } from "@/types/instructions";
import type { AgentContextEntry, ScaffoldContext } from "@/types/scaffoldContext";
import { defaultFormData } from "@/types/instructions";

// ── Instruction preview builder ───────────────────────────────────────────────

/**
 * Builds the markdown preview shown in Step7Preview.
 * Extracted so it can be unit-tested without rendering the component.
 */
export function buildInstructionPreview(formData: InstructionFormData): string {
  const { identity, persona, scope, tools, subAgents, errorHandling } = formData;
  const lines: string[] = [];

  lines.push(`# Agent: ${identity.agent_name || "[Agent Name]"}`);
  lines.push("");
  lines.push("## Role");
  lines.push(identity.agent_purpose || "[No purpose defined]");

  if (identity.agent_type === "sub_agent" && identity.parent_agent_context) {
    lines.push("");
    lines.push(`**Parent agent context:** ${identity.parent_agent_context}`);
  }

  if (persona.company_name || persona.persona_name) {
    lines.push("");
    lines.push("## Identity");
    if (persona.company_name) lines.push(`You represent **${persona.company_name}**.`);
    if (persona.persona_name) lines.push(`Your name is **${persona.persona_name}**.`);
    if (persona.tone) lines.push(`Communicate in a ${persona.tone.replace(/_/g, " ")} tone.`);
    if (persona.brand_voice_keywords.length > 0) {
      lines.push(`Brand voice: ${persona.brand_voice_keywords.join(", ")}.`);
    }
  }

  if (scope.primary_goals.length > 0) {
    lines.push("");
    lines.push("## Primary Goals");
    scope.primary_goals.forEach((g) => lines.push(`- ${g}`));
  }

  if (scope.out_of_scope_topics.length > 0) {
    lines.push("");
    lines.push("## Out of Scope");
    scope.out_of_scope_topics.forEach((t) => lines.push(`- ${t}`));
  }

  if (scope.escalation_triggers.length > 0) {
    lines.push("");
    lines.push("## Escalation");
    lines.push(`Escalate to **${scope.escalation_target}** when:`);
    scope.escalation_triggers.forEach((t) => lines.push(`- ${t}`));
  }

  if (tools.tools.length > 0) {
    lines.push("");
    lines.push("## Tools");
    tools.tools.forEach((t) => {
      lines.push(`**${t.tool_name}**: ${t.tool_description}`);
      if (t.when_to_use) lines.push(`  → ${t.when_to_use}`);
    });
  }

  if (identity.agent_type === "root_agent" && subAgents.sub_agents.length > 0) {
    lines.push("");
    lines.push("## Sub-Agent Delegation");
    subAgents.sub_agents.forEach((sa) => {
      lines.push(`**${sa.agent_name}**: ${sa.agent_capability}`);
      if (sa.delegation_condition) lines.push(`  → Delegate when: ${sa.delegation_condition}`);
    });
  }

  if (errorHandling) {
    lines.push("");
    lines.push("## Error Handling");
    if (errorHandling.max_retries > 0) {
      lines.push(
        `Retry up to ${errorHandling.max_retries} time(s). Retry message: "${errorHandling.retry_message}"`
      );
    }
    lines.push(`Fallback: "${errorHandling.fallback_response}"`);
  }

  return lines.join("\n");
}

// ── ScaffoldContext → InstructionFormData pre-fill ───────────────────────────

/**
 * Given an AgentContextEntry and a ScaffoldContext, produces a pre-filled
 * InstructionFormData for the wizard.
 *
 * This is the canonical pre-fill logic used by InstructionsPage when a user
 * clicks an agent in the agent selector screen.
 */
export function prefillFormFromAgent(
  agent: AgentContextEntry,
  ctx: ScaffoldContext
): InstructionFormData {
  const identity: IdentityForm = {
    agent_name: agent.name,
    agent_purpose: agent.roleSummary,
    agent_type: agent.agentType,
    parent_agent_context:
      agent.agentType === "sub_agent"
        ? `This agent is part of the ${ctx.appDisplayName} multi-agent app.`
        : "",
  };

  const persona: PersonaForm = {
    persona_name: agent.persona ?? "",
    tone: "friendly_professional",
    brand_voice_keywords: [],
    language: ctx.languageCode ?? "en-US",
    company_name: ctx.companyName,
  };

  const scope: ScopeForm = {
    primary_goals: agent.handles.length > 0
      ? agent.handles.map((h) => h.replace(/_/g, " "))
      : [],
    out_of_scope_topics: [],
    escalation_triggers: [],
    escalation_target: "human customer service agent",
  };

  // If root_agent: pre-populate sub_agents from context
  const subAgentEntries =
    agent.agentType === "root_agent"
      ? ctx.agents
          .filter((a) => a.agentType === "sub_agent")
          .map((a) => ({
            agent_name: a.name,
            agent_capability: a.roleSummary,
            delegation_condition: a.handles.length > 0
              ? `User query relates to: ${a.handles.join(", ")}`
              : "",
          }))
      : [];

  // Pre-populate tools from suggestedTools cross-referenced with ctx.toolStubs
  const toolEntries = agent.suggestedTools
    .map((slug) => {
      const stub = ctx.toolStubs.find((t) => t.toolName === slug);
      return stub
        ? {
            tool_name: stub.toolName,
            tool_description: `${stub.displayName} — accessed via ${stub.baseUrlEnvVar}`,
            when_to_use: "",
          }
        : null;
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  return {
    ...defaultFormData,
    identity,
    persona,
    scope,
    tools: { tools: toolEntries },
    subAgents: { sub_agents: subAgentEntries },
    errorHandling: null,
  };
}

// ── Instruction character quality thresholds ──────────────────────────────────

export type InstructionQuality = "too_short" | "good" | "excellent";

/**
 * Classifies instruction length quality for the Step7 progress indicator.
 * < 200 chars = too_short, 200–1500 = good, > 1500 = excellent
 */
export function classifyInstructionLength(charCount: number): InstructionQuality {
  if (charCount < 200) return "too_short";
  if (charCount <= 1500) return "good";
  return "excellent";
}

export const INSTRUCTION_QUALITY_LABELS: Record<InstructionQuality, string> = {
  too_short: "Too short — add more detail",
  good: "Good",
  excellent: "Excellent",
};