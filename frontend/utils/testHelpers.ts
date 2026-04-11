/**
 * Test factory helpers for gecx-hub frontend tests.
 *
 * Usage:
 *   import { makeScaffoldContext, makeAgentEntry, makeGuardrailPreview } from "@/utils/testHelpers";
 *
 * All factories accept a Partial<T> so tests only set what they care about.
 * ONLY import this file from *.spec.ts files — never from production code.
 */

import type { ScaffoldContext, AgentContextEntry, ToolContextEntry } from "@/types/scaffoldContext";
import type { AgentDefinition, AppScaffoldResponse } from "@/types/scaffolder";
import type { GuardrailPreviewItem, GuardrailsGenerateResponse, GuardrailsApplyResponse } from "@/types/accelerators";
import type { InstructionPushResult } from "@/types/instructions";

// ── AgentContextEntry factory ─────────────────────────────────────────────────

export function makeAgentEntry(overrides: Partial<AgentContextEntry> = {}): AgentContextEntry {
  return {
    slug: "test_agent",
    name: "Test Agent",
    agentType: "sub_agent",
    roleSummary: "Handles test queries",
    handles: [],
    suggestedTools: [],
    persona: "",
    instructionApplied: false,
    instructionCharCount: 0,
    cesAgentId: null,
    tools: [],
    toolsets: [],
    callbackHooks: [],
    instructionPath: "",
    ...overrides,
  };
}

export function makeRootAgent(overrides: Partial<AgentContextEntry> = {}): AgentContextEntry {
  return makeAgentEntry({
    slug: "root_agent",
    name: "Root Agent",
    agentType: "root_agent",
    roleSummary: "Routes queries to appropriate specialist agents",
    handles: [],
    ...overrides,
  });
}

// ── ToolContextEntry factory ──────────────────────────────────────────────────

export function makeToolEntry(overrides: Partial<ToolContextEntry> = {}): ToolContextEntry {
  return {
    toolName: "test_api",
    displayName: "Test API",
    baseUrlEnvVar: "TEST_API_BASE_URL",
    authType: "none",
    cesToolId: null,
    ...overrides,
  };
}

// ── ScaffoldContext factory ───────────────────────────────────────────────────

export function makeScaffoldContext(overrides: Partial<ScaffoldContext> = {}): ScaffoldContext {
  const now = new Date().toISOString();
  return {
    scaffoldId: "scaffold-test-001",
    appDisplayName: "Test CX Agent",
    businessDomain: "retail",
    channel: "web_chat",
    companyName: "Test Corp",
    expectedCapabilities: ["order_management"],
    decompositionStrategy: "capability_based",
    rootAgentStyle: "pure_router",
    agents: [makeRootAgent(), makeAgentEntry({ slug: "order_agent", name: "Order Agent", handles: ["order_management"] })],
    toolStubs: [],
    environmentVars: [],
    guardrailsApplied: false,
    guardrailsIndustry: null,
    createdAt: now,
    lastUpdatedAt: now,
    generatedZipFilename: "test_retail.zip",
    variableDeclarations: [],
    guardrailNames: [],
    modelSettings: { model: "gemini-2.0-flash-001", temperature: 1.0 },
    toolExecutionMode: "PARALLEL",
    languageCode: "en-US",
    timeZone: "UTC",
    tools: [],
    toolsets: [],
    ...overrides,
  };
}

/** Returns a ScaffoldContext where all agents are fully configured. */
export function makeFullyConfiguredContext(overrides: Partial<ScaffoldContext> = {}): ScaffoldContext {
  const base = makeScaffoldContext(overrides);
  return {
    ...base,
    agents: base.agents.map((a) => ({
      ...a,
      instructionApplied: true,
      instructionCharCount: 900,
    })),
    guardrailsApplied: true,
    guardrailsIndustry: base.businessDomain,
  };
}

// ── Guardrail factories ───────────────────────────────────────────────────────

export function makeGuardrailPreview(overrides: Partial<GuardrailPreviewItem> = {}): GuardrailPreviewItem {
  return {
    guardrail_type: "ContentFilter",
    display_name: "Content Blocklist",
    description: "Blocks banned phrases.",
    ces_resource: { displayName: "Content Blocklist", contentFilter: {} },
    enabled: true,
    ...overrides,
  };
}

export function makeGuardrailsGenerateResponse(
  overrides: Partial<GuardrailsGenerateResponse> = {}
): GuardrailsGenerateResponse {
  return {
    request_id: "guardrails-test-001",
    previews: [
      makeGuardrailPreview(),
      makeGuardrailPreview({
        guardrail_type: "LlmPromptSecurity",
        display_name: "Prompt Injection Guard",
        description: "Protects against prompt injection.",
        ces_resource: { displayName: "Prompt Injection Guard", llmPromptSecurity: {} },
      }),
    ],
    download_url: "https://storage.example.com/guardrails_test.zip",
    zip_filename: "guardrails_test.zip",
    apply_ready: true,
    industry_preset_used: "retail",
    generation_timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function makeGuardrailsApplyResponse(
  overrides: Partial<GuardrailsApplyResponse> = {}
): GuardrailsApplyResponse {
  return {
    applied_count: 2,
    failed_count: 0,
    version_id: "v-test-001",
    results: [
      { guardrail_type: "ContentFilter", status: "success", resource_name: "projects/p/cf", error: null },
      { guardrail_type: "LlmPromptSecurity", status: "success", resource_name: "projects/p/lps", error: null },
    ],
    ...overrides,
  };
}

// ── AgentDefinition factory (scaffolder arch suggestion) ──────────────────────

export function makeAgentDefinition(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    name: "Test Agent",
    slug: "test_agent",
    agent_type: "sub_agent",
    role_summary: "Handles test queries",
    handles: [],
    suggested_tools: [],
    ai_generated: true,
    callbackHooks: [],
    ...overrides,
  };
}

// ── AppScaffoldResponse factory ───────────────────────────────────────────────

export function makeScaffoldApiResponse(
  overrides: Partial<AppScaffoldResponse> = {}
): AppScaffoldResponse {
  return {
    request_id: "scaffold-test-001",
    download_url: "https://storage.example.com/test.zip",
    zip_filename: "test_retail.zip",
    app_display_name: "Test CX Agent",
    agent_count: 2,
    tool_stub_count: 0,
    agent_previews: [
      {
        agent_slug: "root_agent",
        display_name: "Root Agent",
        agent_type: "root_agent",
        instruction_scaffold: "# Root Agent\n## Role\nRoute queries.",
        json_resource: {},
      },
    ],
    tool_previews: [],
    environment_vars: [],
    architecture_summary: "root_agent\n  └── test_agent",
    generation_timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ── InstructionPushResult factory ─────────────────────────────────────────────

export function makeInstructionPushResult(
  overrides: Partial<InstructionPushResult> = {}
): InstructionPushResult {
  return {
    instruction: "# Test Agent\n\n## Role\nHandles test queries.",
    char_count: 500,
    agent_resource_name: "projects/test-proj/agents/test_agent",
    ...overrides,
  };
}