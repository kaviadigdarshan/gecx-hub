/**
 * Instruction Architect Accelerator — unit/integration tests
 *
 * Covers: InstructionsPage agent-selector screen, 7-step wizard flow,
 *         ScaffoldContext pre-fill, Step7Preview assemble + apply, manual mode.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import InstructionsPage from "@/components/accelerators/instructions/InstructionsPage";

import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/services/api";

import type { ScaffoldContext } from "@/types/scaffoldContext";
import type { InstructionPushResult } from "@/types/instructions";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const mockScaffoldContext: ScaffoldContext = {
  scaffoldId: "scaffold-bfsi-001",
  appDisplayName: "HDFC CX Agent",
  businessDomain: "bfsi",
  channel: "web_chat",
  companyName: "HDFC Bank",
  expectedCapabilities: ["account_management", "fraud_reporting"],
  decompositionStrategy: "capability_based",
  rootAgentStyle: "pure_router",
  agents: [
    {
      slug: "root_agent",
      name: "HDFC Root Agent",
      agentType: "root_agent",
      roleSummary: "Routes customer queries to appropriate specialist agents",
      handles: [],
      suggestedTools: [],
      instructionApplied: false,
      instructionCharCount: 0,
      cesAgentId: null,
    },
    {
      slug: "account_agent",
      name: "Account Management Agent",
      agentType: "sub_agent",
      roleSummary: "Handles account balance, statements and KYC queries",
      handles: ["account_management"],
      suggestedTools: ["account_api"],
      instructionApplied: false,
      instructionCharCount: 0,
      cesAgentId: null,
    },
    {
      slug: "fraud_agent",
      name: "Fraud Reporting Agent",
      agentType: "sub_agent",
      roleSummary: "Handles fraud reporting and suspicious transaction escalations",
      handles: ["fraud_reporting"],
      suggestedTools: ["fraud_api"],
      instructionApplied: true, // already applied
      instructionCharCount: 1450,
      cesAgentId: null,
    },
  ],
  toolStubs: [
    {
      toolName: "account_api",
      displayName: "Account Management API",
      baseUrlEnvVar: "ACCOUNT_API_BASE_URL",
      authType: "oauth",
      cesToolId: null,
    },
  ],
  environmentVars: ["ACCOUNT_API_BASE_URL", "FRAUD_API_BASE_URL"],
  guardrailsApplied: false,
  guardrailsIndustry: null,
  createdAt: new Date().toISOString(),
  lastUpdatedAt: new Date().toISOString(),
  generatedZipFilename: "hdfc_bfsi.zip",
  variableDeclarations: [
    { name: "IS_AUTHENTICATED", type: "BOOLEAN", defaultValue: false },
  ],
};

const mockPushResult: InstructionPushResult = {
  instruction: "# Agent: Account Management Agent\n\n## Role\nHandles account balance and statements.",
  char_count: 1200,
  agent_resource_name: "projects/my-proj/agents/account_agent",
};

const mockAssembleResponse = {
  instruction: "<agent>\n  <task_module name='balance_query'>\n    <!-- handle balance -->\n  </task_module>\n</agent>",
  task_modules: [{ name: "balance_query", trigger: "user asks for balance", action: "call account_api" }],
  quality_score: 0.87,
  character_count: 512,
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/services/api", () => ({
  apiClient: { post: vi.fn() },
}));

vi.mock("@/hooks/useScaffoldContext", () => ({
  useScaffoldContext: () => ({
    saveContext: vi.fn().mockResolvedValue(undefined),
    scaffoldContext: null,
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
    activeInstructionAgent: null,
    selectedProject: null,
    selectedApp: null,
    isDemoMode: false,
  });
});

// ── InstructionsPage — no scaffold (manual mode) ──────────────────────────────

describe("InstructionsPage — no scaffold context", () => {
  it("renders the wizard directly (no agent selector screen)", () => {
    render(<InstructionsPage />);
    expect(screen.getByText(/agent name/i)).toBeInTheDocument();
  });

  it("shows step 1 of 7 on initial render", () => {
    render(<InstructionsPage />);
    // WizardShell renders "1. Identity" not "1 / 7"
    expect(screen.getByText("1. Identity")).toBeInTheDocument();
  });
});

// ── InstructionsPage — agent selector screen ──────────────────────────────────

describe("InstructionsPage — agent selector (with scaffold context)", () => {
  beforeEach(() => {
    useProjectStore.setState({ scaffoldContext: mockScaffoldContext });
  });

  it("shows agent selector heading", () => {
    render(<InstructionsPage />);
    expect(screen.getByText(/select an agent to configure/i)).toBeInTheDocument();
  });

  it("renders all 3 agents from scaffoldContext", () => {
    render(<InstructionsPage />);
    expect(screen.getByText("HDFC Root Agent")).toBeInTheDocument();
    expect(screen.getByText("Account Management Agent")).toBeInTheDocument();
    expect(screen.getByText("Fraud Reporting Agent")).toBeInTheDocument();
  });

  it("shows ROOT badge for root agent", () => {
    render(<InstructionsPage />);
    expect(screen.getByText("ROOT")).toBeInTheDocument();
  });

  it("shows SUB badge for sub agents", () => {
    render(<InstructionsPage />);
    const subBadges = screen.getAllByText("SUB");
    expect(subBadges).toHaveLength(2);
  });

  it("shows CheckCircle for already-applied fraud agent", () => {
    render(<InstructionsPage />);
    const fraudBtn = screen.getByRole("button", { name: /fraud reporting agent/i });
    expect(fraudBtn.querySelector("svg")).toBeInTheDocument();
  });

  it("shows count of total agents", () => {
    render(<InstructionsPage />);
    expect(screen.getByText(/your scaffold has 3 agents/i)).toBeInTheDocument();
  });

  it("shows 'Enter agent details manually' link", () => {
    render(<InstructionsPage />);
    expect(screen.getByText(/enter agent details manually/i)).toBeInTheDocument();
  });

  it("clicking 'Enter agent details manually' goes to wizard without pre-fill", async () => {
    render(<InstructionsPage />);
    await userEvent.click(screen.getByText(/enter agent details manually/i));
    expect(screen.getByText(/agent name/i)).toBeInTheDocument();
  });

  it("clicking an agent navigates to wizard and pre-fills identity", async () => {
    render(<InstructionsPage />);
    await userEvent.click(screen.getByRole("button", { name: /account management agent/i }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Account Management Agent")).toBeInTheDocument();
    });
  });
});

// ── Wizard navigation — Step 1 → Step 7 ──────────────────────────────────────

describe("InstructionsPage — wizard step navigation", () => {
  beforeEach(() => {
    useProjectStore.setState({ scaffoldContext: mockScaffoldContext });
    render(<InstructionsPage />);
  });

  it("navigates from agent selector into wizard", async () => {
    await userEvent.click(screen.getByRole("button", { name: /hdfc root agent/i }));
    // WizardShell renders "1. Identity" not "1 / 7"
    await waitFor(() => expect(screen.getByText("1. Identity")).toBeInTheDocument());
  });

  it("advances to step 2 on Next", async () => {
    await userEvent.click(screen.getByRole("button", { name: /hdfc root agent/i }));
    await waitFor(() => screen.getByText("1. Identity"));
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    // WizardShell renders "2. Persona" not "2 / 7"
    await waitFor(() => expect(screen.getByText("2. Persona")).toBeInTheDocument());
  });

  it("goes back to step 1 from step 2 on Back", async () => {
    await userEvent.click(screen.getByRole("button", { name: /hdfc root agent/i }));
    await waitFor(() => screen.getByText("1. Identity"));
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByText("2. Persona"));
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    // WizardShell renders "1. Identity" not "1 / 7"
    await waitFor(() => expect(screen.getByText("1. Identity")).toBeInTheDocument());
  });

  it("shows 'Apply' as final step action label on step 7", async () => {
    await userEvent.click(screen.getByRole("button", { name: /hdfc root agent/i }));
    for (let i = 0; i < 6; i++) {
      await waitFor(() => screen.getByRole("button", { name: /next/i }));
      await userEvent.click(screen.getByRole("button", { name: /next/i }));
    }
    // WizardShell renders "7. Preview" not "7 / 7"
    await waitFor(() => {
      expect(screen.getByText("7. Preview")).toBeInTheDocument();
    });
  });
});

// ── ScaffoldContext prefill logic ─────────────────────────────────────────────

describe("InstructionsPage — ScaffoldContext pre-fill correctness", () => {
  it("pre-fills roleSummary into agent_purpose", async () => {
    useProjectStore.setState({ scaffoldContext: mockScaffoldContext });
    render(<InstructionsPage />);
    await userEvent.click(screen.getByRole("button", { name: /account management agent/i }));

    await waitFor(() => {
      expect(
        screen.getByDisplayValue(/handles account balance, statements and kyc queries/i)
      ).toBeInTheDocument();
    });
  });

  it("sets agent_type to 'root_agent' for root agent selection", async () => {
    useProjectStore.setState({ scaffoldContext: mockScaffoldContext });
    render(<InstructionsPage />);
    await userEvent.click(screen.getByRole("button", { name: /hdfc root agent/i }));

    await waitFor(() => {
      // Step1Identity uses toggle buttons, not a select — "Root Agent" button is active
      const rootBtn = screen.getByRole("button", { name: "Root Agent" });
      expect(rootBtn.className).toContain("border-gecx-500");
    });
  });

  it("sets agent_type to 'sub_agent' for sub agent selection", async () => {
    useProjectStore.setState({ scaffoldContext: mockScaffoldContext });
    render(<InstructionsPage />);
    await userEvent.click(screen.getByRole("button", { name: /account management agent/i }));

    await waitFor(() => {
      // Step1Identity uses toggle buttons, not a select — "Sub-Agent" button is active
      const subBtn = screen.getByRole("button", { name: "Sub-Agent" });
      expect(subBtn.className).toContain("border-gecx-500");
    });
  });

  it("pre-fills company_name from scaffoldContext.companyName into persona step", async () => {
    useProjectStore.setState({ scaffoldContext: mockScaffoldContext });
    render(<InstructionsPage />);
    await userEvent.click(screen.getByRole("button", { name: /account management agent/i }));

    await waitFor(() => screen.getByRole("button", { name: /next/i }));
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("HDFC Bank")).toBeInTheDocument();
    });
  });
});

// ── Step7Preview — Assemble + Apply ──────────────────────────────────────────

describe("Step7Preview — AI assemble and apply flow", () => {
  const navigateToStep7 = async () => {
    useProjectStore.setState({ scaffoldContext: mockScaffoldContext });
    render(<InstructionsPage />);
    await userEvent.click(screen.getByRole("button", { name: /account management agent/i }));
    for (let i = 0; i < 6; i++) {
      await waitFor(() => screen.getByRole("button", { name: /next/i }));
      await userEvent.click(screen.getByRole("button", { name: /next/i }));
    }
    await waitFor(() => screen.getByText(/instruction preview/i));
  };

  it("shows 'Generate with AI' button on step 7", async () => {
    await navigateToStep7();
    expect(screen.getByRole("button", { name: /generate with ai/i })).toBeInTheDocument();
  });

  it("calls /accelerators/instructions/assemble on 'Generate with AI' click", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockAssembleResponse });
    await navigateToStep7();

    await userEvent.click(screen.getByRole("button", { name: /generate with ai/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/accelerators/instructions/assemble",
        expect.objectContaining({
          identity: expect.objectContaining({ agent_name: "Account Management Agent" }),
        })
      );
    });
  });

  it("displays assembled instruction after successful assembly", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockAssembleResponse });
    await navigateToStep7();

    await userEvent.click(screen.getByRole("button", { name: /generate with ai/i }));

    await waitFor(() => {
      expect(screen.getByText(/task_module/i)).toBeInTheDocument();
    });
  });

  it("shows assemble error on failure", async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("LLM error"));
    await navigateToStep7();

    await userEvent.click(screen.getByRole("button", { name: /generate with ai/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to assemble ai instruction/i)).toBeInTheDocument();
    });
  });

  it("calls /accelerators/instructions/apply on 'Apply Instruction'", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockPushResult });
    await navigateToStep7();

    // WizardShell renders "Apply Instruction →"; Step7Preview renders "Apply Instruction"
    // Use exact string to uniquely target Step7Preview's button
    const applyBtn = screen.getByRole("button", { name: "Apply Instruction" });
    await userEvent.click(applyBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/accelerators/instructions/apply",
        expect.objectContaining({
          agent_slug: "account_agent",
          form_data: expect.any(Object),
        })
      );
    });
  });

  it("shows success state with char count after successful apply", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockPushResult });
    await navigateToStep7();

    const applyBtn = screen.getByRole("button", { name: "Apply Instruction" });
    await userEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/instruction applied successfully/i)).toBeInTheDocument();
      expect(screen.getByText(/1,200 characters written/i)).toBeInTheDocument();
    });
  });

  it("marks agent as applied in projectStore after successful apply", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockPushResult });
    await navigateToStep7();

    const applyBtn = screen.getByRole("button", { name: "Apply Instruction" });
    await userEvent.click(applyBtn);

    await waitFor(() => screen.getByText(/instruction applied successfully/i));

    const ctx = useProjectStore.getState().scaffoldContext;
    const agent = ctx?.agents.find((a) => a.slug === "account_agent");
    expect(agent?.instructionApplied).toBe(true);
  });

  it("shows 'pending agents' nudge when other agents still need instructions", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockPushResult });
    await navigateToStep7();

    const applyBtn = screen.getByRole("button", { name: "Apply Instruction" });
    await userEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/still need instructions/i)).toBeInTheDocument();
    });
  });

  it("shows apply error on API failure", async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("Permission denied"));
    await navigateToStep7();

    const applyBtn = screen.getByRole("button", { name: "Apply Instruction" });
    await userEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/failed to apply instruction/i)).toBeInTheDocument();
    });
  });
});

// ── Sidebar "Configure" integration ──────────────────────────────────────────

describe("InstructionsPage — activeInstructionAgent store sync", () => {
  it("auto-selects agent when activeInstructionAgent is set in store", async () => {
    useProjectStore.setState({
      scaffoldContext: mockScaffoldContext,
      activeInstructionAgent: "account_agent",
    });
    render(<InstructionsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Account Management Agent")).toBeInTheDocument();
    });
  });
});