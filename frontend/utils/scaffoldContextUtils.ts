/**
 * Pure utility functions for ScaffoldContext transformation.
 * Extracted from useScaffoldContext.ts and Step7Preview.tsx.
 */

import type { ScaffoldContext, AgentContextEntry } from "@/types/scaffoldContext";
import type { AppScaffoldResponse, ArchitectureSuggestion } from "@/types/scaffolder";
import type { InstructionFormData } from "@/types/instructions";

// ── Normalization (mirrors useScaffoldContext.normalizeContext) ────────────────

/** Fill in safe defaults for any field added after initial release. */
export function normalizeScaffoldContext(ctx: ScaffoldContext): ScaffoldContext {
  return {
    ...ctx,
    variableDeclarations: ctx.variableDeclarations ?? [],
    guardrailNames: ctx.guardrailNames ?? [],
    modelSettings: ctx.modelSettings ?? { model: "gemini-2.0-flash-001", temperature: 1.0 },
    toolExecutionMode: ctx.toolExecutionMode ?? "PARALLEL",
    languageCode: ctx.languageCode ?? "en-US",
    timeZone: ctx.timeZone ?? "UTC",
    tools: ctx.tools ?? [],
    toolsets: ctx.toolsets ?? [],
    agents: ctx.agents.map((a) => ({
      ...a,
      tools: a.tools ?? [],
      toolsets: a.toolsets ?? [],
      callbackHooks: a.callbackHooks ?? [],
      instructionPath: a.instructionPath ?? "",
    })),
  };
}

// ── Scaffold API response → ScaffoldContext ───────────────────────────────────

/**
 * Converts the raw AppScaffoldResponse from /accelerators/scaffolder/generate
 * into a ScaffoldContext suitable for the projectStore.
 *
 * Called by ScaffolderPage after a successful generate.
 */
export function scaffoldResponseToContext(
  response: AppScaffoldResponse,
  arch: ArchitectureSuggestion,
  overrides: Pick<ScaffoldContext, "businessDomain" | "channel" | "companyName" | "expectedCapabilities">
): ScaffoldContext {
  const now = new Date().toISOString();

  const agents: AgentContextEntry[] = arch.agents.map((a) => ({
    slug: a.slug,
    name: a.name,
    agentType: a.agent_type,
    roleSummary: a.role_summary,
    handles: a.handles,
    suggestedTools: a.suggested_tools,
    persona: a.persona ?? "",
    instructionApplied: false,
    instructionCharCount: 0,
    cesAgentId: null,
    tools: a.tools ?? [],
    toolsets: a.toolsets ?? [],
    callbackHooks: a.callbackHooks ?? [],
    instructionPath: "",
  }));

  return normalizeScaffoldContext({
    scaffoldId: response.request_id,
    appDisplayName: response.app_display_name,
    businessDomain: overrides.businessDomain,
    channel: overrides.channel,
    companyName: overrides.companyName,
    expectedCapabilities: overrides.expectedCapabilities,
    decompositionStrategy: arch.decomposition_strategy,
    rootAgentStyle: arch.root_agent_style,
    agents,
    toolStubs: response.tool_previews.map((tp) => ({
      toolName: tp.tool_name,
      displayName: tp.display_name,
      baseUrlEnvVar: `${tp.tool_name.toUpperCase()}_BASE_URL`,
      authType: "none" as const,
      cesToolId: null,
    })),
    environmentVars: response.environment_vars,
    guardrailsApplied: false,
    guardrailsIndustry: null,
    createdAt: now,
    lastUpdatedAt: now,
    generatedZipFilename: response.zip_filename,
  });
}

// ── Instruction assemble payload builder ─────────────────────────────────────

/**
 * Builds the payload for POST /accelerators/instructions/assemble.
 * Extracted verbatim from Step7Preview.tsx so it can be unit-tested in isolation.
 */
export function buildAssemblePayload(
  formData: InstructionFormData,
  scaffoldContext: ScaffoldContext | null
) {
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

// ── Progress calculation ──────────────────────────────────────────────────────

export interface ScaffoldProgress {
  totalSteps: number;
  completedSteps: number;
  percentComplete: number;
  label: string; // e.g. "3/5 complete"
}

/**
 * Calculates pipeline completion for the Sidebar progress panel.
 * Steps: 1 scaffold + N agents + 1 guardrails = N+2 total steps.
 */
export function calculateScaffoldProgress(ctx: ScaffoldContext | null): ScaffoldProgress {
  if (!ctx) {
    return { totalSteps: 0, completedSteps: 0, percentComplete: 0, label: "0/0 complete" };
  }

  // 1 for scaffold generation itself
  const scaffoldStep = 1;
  // 1 per agent
  const agentSteps = ctx.agents.length;
  // 1 for guardrails
  const guardrailStep = 1;

  const totalSteps = scaffoldStep + agentSteps + guardrailStep;

  const completedSteps =
    scaffoldStep + // scaffold is always done if ctx exists
    ctx.agents.filter((a) => a.instructionApplied).length +
    (ctx.guardrailsApplied ? 1 : 0);

  const percentComplete = Math.round((completedSteps / totalSteps) * 100);

  return {
    totalSteps,
    completedSteps,
    percentComplete,
    label: `${completedSteps}/${totalSteps} complete`,
  };
}

// ── Agent helpers ─────────────────────────────────────────────────────────────

/** Returns agents that still need instructions configured. */
export function getPendingAgents(ctx: ScaffoldContext): AgentContextEntry[] {
  return ctx.agents.filter((a) => !a.instructionApplied);
}

/** Returns true if every agent has an applied instruction. */
export function allAgentsConfigured(ctx: ScaffoldContext): boolean {
  return ctx.agents.every((a) => a.instructionApplied);
}

/** Returns the root agent entry, or null if not found. */
export function getRootAgent(ctx: ScaffoldContext): AgentContextEntry | null {
  return ctx.agents.find((a) => a.agentType === "root_agent") ?? null;
}