/**
 * End-to-end pipeline test: Scaffolder → Instructions → Guardrails
 *
 * Covers the full GECX-Hub user journey:
 * 1. Complete scaffolder wizard → generate scaffold → ScaffoldContext persisted
 * 2. Navigate to Instructions → agent selector auto-populated → apply instruction
 * 3. Navigate to Guardrails → auto-prefilled from context → apply guardrails
 * 4. Sidebar progress panel reflects all steps complete
 *
 * Uses Zustand store state manipulation to simulate cross-accelerator flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { apiClient } from "@/services/api";

import ScaffolderPage from "@/components/accelerators/scaffolder/ScaffolderPage";
import InstructionsPage from "@/components/accelerators/instructions/InstructionsPage";
import GuardrailsPage from "@/components/accelerators/guardrails/GuardrailsPage";
import Sidebar from "@/components/layout/Sidebar";

import type { ScaffoldContext } from "@/types/scaffoldContext";
import type { AppScaffoldResponse, ArchitectureSuggestion } from "@/types/scaffolder";
import type { GuardrailsGenerateResponse, GuardrailsApplyResponse } from "@/types/accelerators";
import type { InstructionPushResult } from "@/types/instructions";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const mockArchSuggestion: ArchitectureSuggestion = {
  agents: [
    {
      name: "Telco Root Agent",
      slug: "root_agent",
      agent_type: "root_agent",
      role_summary: "Routes queries to billing or technical support agents",
      handles: [],
      suggested_tools: [],
      ai_generated: true,
      callbackHooks: ["beforeAgent"],
    },
    {
      name: "Billing Agent",
      slug: "billing_agent",
      agent_type: "sub_agent",
      role_summary: "Handles bill payments, data plan queries and usage reports",
      handles: ["bill_payment", "data_plan_management"],
      suggested_tools: ["billing_api"],
      ai_generated: true,
      callbackHooks: ["beforeAgent"],
    },
  ],
  rationale: "Telecom use-case is best served by a root router delegating to specialist agents",
  decomposition_strategy: "capability_based",
  root_agent_style: "pure_router",
  estimated_complexity: "moderate",
};

const mockScaffoldApiResponse: AppScaffoldResponse = {
  request_id: "scaffold-telco-001",
  download_url: "https://storage.example.com/telco_agent.zip",
  zip_filename: "telco_agent.zip",
  app_display_name: "Acme Telco CX Agent",
  agent_count: 2,
  tool_stub_count: 1,
  agent_previews: [
    {
      agent_slug: "root_agent",
      display_name: "Telco Root Agent",
      agent_type: "root_agent",
      instruction_scaffold: "# Telco Root Agent\n## Role\nRoute queries appropriately.",
      json_resource: {},
    },
    {
      agent_slug: "billing_agent",
      display_name: "Billing Agent",
      agent_type: "sub_agent",
      instruction_scaffold: "# Billing Agent\n## Role\nHandle billing queries.",
      json_resource: {},
    },
  ],
  tool_previews: [
    { tool_name: "billing_api", display_name: "Billing API", json_resource: {} },
  ],
  environment_vars: ["BILLING_API_BASE_URL"],
  architecture_summary: "root_agent\n  └── billing_agent",
  generation_timestamp: new Date().toISOString(),
};

const expectedScaffoldContext: ScaffoldContext = {
  scaffoldId: "scaffold-telco-001",
  appDisplayName: "Acme Telco CX Agent",
  businessDomain: "telecom",
  channel: "web_chat",
  companyName: "Acme Telco",
  expectedCapabilities: ["bill_payment", "data_plan_management"],
  decompositionStrategy: "capability_based",
  rootAgentStyle: "pure_router",
  agents: [
    {
      slug: "root_agent",
      name: "Telco Root Agent",
      agentType: "root_agent",
      roleSummary: "Routes queries to billing or technical support agents",
      handles: [],
      suggestedTools: [],
      instructionApplied: false,
      instructionCharCount: 0,
      cesAgentId: null,
    },
    {
      slug: "billing_agent",
      name: "Billing Agent",
      agentType: "sub_agent",
      roleSummary: "Handles bill payments, data plan queries and usage reports",
      handles: ["bill_payment", "data_plan_management"],
      suggestedTools: ["billing_api"],
      instructionApplied: false,
      instructionCharCount: 0,
      cesAgentId: null,
    },
  ],
  toolStubs: [
    {
      toolName: "billing_api",
      displayName: "Billing API",
      baseUrlEnvVar: "BILLING_API_BASE_URL",
      authType: "none",
      cesToolId: null,
    },
  ],
  environmentVars: ["BILLING_API_BASE_URL"],
  guardrailsApplied: false,
  guardrailsIndustry: null,
  createdAt: new Date().toISOString(),
  lastUpdatedAt: new Date().toISOString(),
  generatedZipFilename: "telco_agent.zip",
  guardrailNames: [],
  tools: [],
  toolsets: [],
};

const mockGuardrailsResponse: GuardrailsGenerateResponse = {
  request_id: "guardrails-telco-001",
  previews: [
    {
      guardrail_type: "ContentFilter",
      display_name: "Content Blocklist",
      description: "Blocks banned phrases.",
      ces_resource: { displayName: "Content Blocklist" },
      enabled: true,
    },
  ],
  download_url: "https://storage.example.com/guardrails_telecom.zip",
  zip_filename: "guardrails_telecom.zip",
  apply_ready: true,
  industry_preset_used: "telecom",
  generation_timestamp: new Date().toISOString(),
};

const mockGuardrailsApplyResponse: GuardrailsApplyResponse = {
  applied_count: 1,
  failed_count: 0,
  version_id: "v-telco-001",
  results: [
    { guardrail_type: "ContentFilter", status: "success", resource_name: "projects/p/guardrails/cf", error: null },
  ],
};

const mockInstructionPushResult: InstructionPushResult = {
  instruction: "# Billing Agent\n## Role\nHandles billing.",
  char_count: 800,
  agent_resource_name: "projects/p/agents/billing_agent",
};

// ── Mock setup ────────────────────────────────────────────────────────────────

vi.mock("@/services/api", () => ({
  apiClient: { post: vi.fn() },
}));

vi.mock("@/hooks/useScaffoldContext", () => ({
  useScaffoldContext: () => ({
    saveContext: vi.fn().mockResolvedValue(undefined),
    scaffoldContext: useProjectStore.getState().scaffoldContext,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    token: "real-token",
    user: { email: "test@example.com", name: "Test User" },
    isAuthenticated: true,
    isLoading: false,
    isDemoMode: false,
  });
  useProjectStore.setState({
    scaffoldContext: null,
    selectedProject: null,
    selectedApp: null,
    activeInstructionAgent: null,
    isDemoMode: false,
  });
  useUIStore.setState({
    activeAccelerator: null,
    sidebarCollapsed: false,
  });
});

// ── Stage 1: Scaffolder generates context ─────────────────────────────────────

describe("Pipeline Stage 1 — Scaffolder produces ScaffoldContext", () => {
  it("ScaffoldContext is written to store after successful generate", async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: mockArchSuggestion })      // suggest-architecture
      .mockResolvedValueOnce({ data: mockScaffoldApiResponse }); // generate

    render(<ScaffolderPage />);

    // Step 1: fill use case form
    // ScaffolderPage Step1UseCase has no htmlFor on label — query by combobox role
    const domainSelect = screen.getByRole("combobox") as HTMLSelectElement;
    await userEvent.selectOptions(domainSelect, "telecom");

    const useCaseTextarea = screen.getByPlaceholderText(/describe what you want/i);
    await userEvent.type(useCaseTextarea, "Handle billing, data plans and tech support for telecom customers");

    await userEvent.click(screen.getByRole("button", { name: /suggest architecture/i }));

    // Step 2: architecture loads
    await waitFor(() => screen.getByRole("button", { name: /continue/i }), { timeout: 3000 });
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 3: App Settings — continue
    await waitFor(() => screen.getByRole("button", { name: /continue/i }));
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 4: Session Vars — continue
    await waitFor(() => screen.getByRole("button", { name: /continue/i }));
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 5: Tools — continue to preview
    await waitFor(() => screen.getByRole("button", { name: /continue/i }));
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 6: Generate
    await waitFor(() => screen.getByRole("button", { name: /generate scaffold/i }));
    await userEvent.click(screen.getByRole("button", { name: /generate scaffold/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/accelerators/scaffolder/generate",
        expect.objectContaining({
          use_case: expect.objectContaining({ business_domain: "telecom" }),
          architecture: expect.any(Array),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/scaffold generated/i)).toBeInTheDocument();
    });

    const ctx = useProjectStore.getState().scaffoldContext;
    expect(ctx).not.toBeNull();
    expect(ctx?.scaffoldId).toBe("scaffold-telco-001");
    expect(ctx?.agents).toHaveLength(2);
    expect(ctx?.guardrailsApplied).toBe(false);
  });
});

// ── Stage 2: Instructions reads context and applies ───────────────────────────

describe("Pipeline Stage 2 — Instructions uses ScaffoldContext", () => {
  beforeEach(() => {
    useProjectStore.setState({ scaffoldContext: expectedScaffoldContext });
  });

  it("agent selector shows both agents from scaffoldContext", () => {
    render(<InstructionsPage />);
    expect(screen.getByText("Telco Root Agent")).toBeInTheDocument();
    expect(screen.getByText("Billing Agent")).toBeInTheDocument();
  });

  it("applying instruction marks billing_agent as applied in store", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockInstructionPushResult });

    render(<InstructionsPage />);
    await userEvent.click(screen.getByRole("button", { name: /billing agent/i }));

    // Navigate to step 7
    for (let i = 0; i < 6; i++) {
      await waitFor(() => screen.getByRole("button", { name: /next/i }));
      await userEvent.click(screen.getByRole("button", { name: /next/i }));
    }

    await waitFor(() => screen.getByText(/instruction preview/i));

    // Use exact string to uniquely target Step7Preview's button
    // (WizardShell also renders "Apply Instruction →" which would cause multiple matches)
    const applyBtn = screen.getByRole("button", { name: "Apply Instruction" });
    await userEvent.click(applyBtn);

    await waitFor(() => screen.getByText(/instruction applied successfully/i));

    const ctx = useProjectStore.getState().scaffoldContext;
    const billingAgent = ctx?.agents.find((a) => a.slug === "billing_agent");
    expect(billingAgent?.instructionApplied).toBe(true);
    expect(billingAgent?.instructionCharCount).toBeGreaterThan(0);
  });
});

// ── Stage 3: Guardrails auto-fills from context ───────────────────────────────

describe("Pipeline Stage 3 — Guardrails auto-fills from ScaffoldContext", () => {
  beforeEach(() => {
    useProjectStore.setState({ scaffoldContext: expectedScaffoldContext });
  });

  it("industry vertical is pre-filled as 'telecom'", async () => {
    render(<GuardrailsPage />);
    await waitFor(() => {
      // GuardrailsForm label has no htmlFor — query by combobox role; first = industry_vertical
      const selects = screen.getAllByRole("combobox");
      expect((selects[0] as HTMLSelectElement).value).toBe("telecom");
    });
  });

  it("generates and applies guardrails, then marks guardrailsApplied in store", async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: mockGuardrailsResponse })
      .mockResolvedValueOnce({ data: mockGuardrailsApplyResponse });

    render(<GuardrailsPage />);

    await userEvent.click(screen.getByRole("button", { name: /generate guardrails pack/i }));

    // Wait for GuardrailsPreview to mount — ensures items prop is defined before interaction
    await waitFor(() => screen.getByText("Guardrail Preview"), { timeout: 3000 });

    await userEvent.click(screen.getByRole("button", { name: /proceed to apply/i }));
    await waitFor(() => screen.getByRole("button", { name: /apply to app/i }));

    await userEvent.click(screen.getByRole("button", { name: /apply to app/i }));
    await waitFor(() => screen.getByText(/all guardrails applied successfully/i));

    const ctx = useProjectStore.getState().scaffoldContext;
    expect(ctx?.guardrailsApplied).toBe(true);
    expect(ctx?.guardrailsIndustry).toBe("telecom");
  });
});

// ── Stage 4: Sidebar progress reflects complete pipeline ──────────────────────

describe("Pipeline Stage 4 — Sidebar progress panel", () => {
  it("shows all steps complete when all agents + guardrails are done", () => {
    const fullContext: ScaffoldContext = {
      ...expectedScaffoldContext,
      agents: expectedScaffoldContext.agents.map((a) => ({
        ...a,
        instructionApplied: true,
        instructionCharCount: 900,
      })),
      guardrailsApplied: true,
      guardrailsIndustry: "telecom",
    };
    useProjectStore.setState({ scaffoldContext: fullContext });

    render(<Sidebar />);

    expect(screen.queryByTitle(/complete/i)).toBeTruthy();
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it("shows partial progress when only scaffold is done", () => {
    useProjectStore.setState({ scaffoldContext: expectedScaffoldContext });

    render(<Sidebar />);

    expect(screen.getByText(/25%/)).toBeInTheDocument();
    expect(screen.getByText(/1\/4 complete/)).toBeInTheDocument();
  });

  it("shows 'Configure' buttons for agents without instructions (expanded sidebar)", () => {
    useProjectStore.setState({ scaffoldContext: expectedScaffoldContext });
    useUIStore.setState({ sidebarCollapsed: false });

    render(<Sidebar />);

    const configureBtns = screen.getAllByRole("button", { name: /configure/i });
    expect(configureBtns.length).toBeGreaterThanOrEqual(2);
  });

  it("'Configure' button sets activeInstructionAgent in store", async () => {
    useProjectStore.setState({ scaffoldContext: expectedScaffoldContext });
    render(<Sidebar />);

    const configureBtns = screen.getAllByRole("button", { name: /configure/i });
    await userEvent.click(configureBtns[0]);

    const { activeInstructionAgent } = useProjectStore.getState();
    expect(activeInstructionAgent).not.toBeNull();
  });

  it("collapses sidebar on toggle button click", async () => {
    render(<Sidebar />);
    const toggleBtn = screen.getByTitle(/collapse sidebar/i);
    await userEvent.click(toggleBtn);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });

  it("shows accelerator nav items — App Scaffolder is clickable", async () => {
    render(<Sidebar />);
    const scaffolderBtn = screen.getByRole("button", { name: /app scaffolder/i });
    await userEvent.click(scaffolderBtn);
    expect(useUIStore.getState().activeAccelerator).toBe("scaffolder");
  });

  it("marks active accelerator with border-l-2 border-gecx-600 style", async () => {
    useUIStore.setState({ activeAccelerator: "guardrails" });
    render(<Sidebar />);
    const guardrailsBtn = screen.getByRole("button", { name: /guardrails generator/i });
    expect(guardrailsBtn.className).toContain("border-gecx-600");
  });
});

// ── Cross-accelerator: scaffolder 'Next Steps' navigation ────────────────────

describe("Scaffolder Step4Preview — cross-accelerator navigation", () => {
  it("'Craft agent instructions' row calls setActiveAccelerator('instructions')", async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: mockArchSuggestion })
      .mockResolvedValueOnce({ data: mockScaffoldApiResponse });

    render(<ScaffolderPage />);

    useProjectStore.setState({ scaffoldContext: expectedScaffoldContext });

    // Step1UseCase: no htmlFor — query by combobox role
    const domainSelect = screen.getByRole("combobox") as HTMLSelectElement;
    await userEvent.selectOptions(domainSelect, "telecom");
    const textarea = screen.getByPlaceholderText(/describe what you want/i);
    await userEvent.type(textarea, "Telecom billing and technical support handling");
    await userEvent.click(screen.getByRole("button", { name: /suggest architecture/i }));
    await waitFor(() => screen.getByRole("button", { name: /continue/i }), { timeout: 3000 });

    for (let i = 0; i < 4; i++) {
      const continueBtn = await screen.findByRole("button", { name: /continue/i });
      await userEvent.click(continueBtn);
    }

    await waitFor(() => screen.getByRole("button", { name: /generate scaffold/i }));
    await userEvent.click(screen.getByRole("button", { name: /generate scaffold/i }));

    await waitFor(() => screen.getByText(/scaffold generated/i), { timeout: 5000 });

    const instructionsRow = screen.getByRole("button", { name: /craft agent instructions/i });
    await userEvent.click(instructionsRow);

    expect(useUIStore.getState().activeAccelerator).toBe("instructions");
  });

  it("'Configure guardrails' row calls setActiveAccelerator('guardrails')", async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: mockArchSuggestion })
      .mockResolvedValueOnce({ data: mockScaffoldApiResponse });

    render(<ScaffolderPage />);

    // Step1UseCase: no htmlFor — query by combobox role
    const domainSelect = screen.getByRole("combobox") as HTMLSelectElement;
    await userEvent.selectOptions(domainSelect, "telecom");
    const textarea = screen.getByPlaceholderText(/describe what you want/i);
    await userEvent.type(textarea, "Telecom billing and technical support handling");
    await userEvent.click(screen.getByRole("button", { name: /suggest architecture/i }));
    await waitFor(() => screen.getByRole("button", { name: /continue/i }), { timeout: 3000 });

    for (let i = 0; i < 4; i++) {
      const continueBtn = await screen.findByRole("button", { name: /continue/i });
      await userEvent.click(continueBtn);
    }

    await waitFor(() => screen.getByRole("button", { name: /generate scaffold/i }));
    await userEvent.click(screen.getByRole("button", { name: /generate scaffold/i }));
    await waitFor(() => screen.getByText(/scaffold generated/i), { timeout: 5000 });

    const guardrailsRow = screen.getByRole("button", { name: /configure guardrails/i });
    await userEvent.click(guardrailsRow);

    expect(useUIStore.getState().activeAccelerator).toBe("guardrails");
  });
});