/**
 * Guardrails Accelerator — unit/integration tests
 *
 * Stack: Vitest + React Testing Library
 * Covers: GuardrailsPage 3-step flow, form validation, preview toggle,
 *         apply (real vs demo mode), ScaffoldContext auto-prefill.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import GuardrailsPage from "@/components/accelerators/guardrails/GuardrailsPage";
import GuardrailsForm from "@/components/accelerators/guardrails/GuardrailsForm";
import GuardrailsPreview from "@/components/accelerators/guardrails/GuardrailsPreview";
import GuardrailsResult from "@/components/accelerators/guardrails/GuardrailsResult";

import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/services/api";

import type { GuardrailPreviewItem, GuardrailsGenerateResponse, GuardrailsApplyResponse } from "@/types/accelerators";
import type { ScaffoldContext } from "@/types/scaffoldContext";

// ── Shared Fixtures ──────────────────────────────────────────────────────────

const mockPreviews: GuardrailPreviewItem[] = [
  {
    guardrail_type: "ContentFilter",
    display_name: "Content Blocklist",
    description: "Blocks banned phrases in user inputs and agent responses.",
    ces_resource: { displayName: "Content Blocklist", contentFilter: {} },
    enabled: true,
  },
  {
    guardrail_type: "LlmPromptSecurity",
    display_name: "Prompt Injection Guard",
    description: "Protects against prompt injection attacks.",
    ces_resource: { displayName: "Prompt Injection Guard", llmPromptSecurity: {} },
    enabled: true,
  },
  {
    guardrail_type: "LlmPolicy",
    display_name: "Off-Topic Deflection",
    description: "Blocks unrelated conversation topics.",
    ces_resource: { displayName: "Off-Topic Deflection", llmPolicy: {} },
    enabled: false,
  },
];

const mockGenerateResponse: GuardrailsGenerateResponse = {
  request_id: "test-req-001",
  previews: mockPreviews,
  download_url: "https://storage.example.com/guardrails_retail_test.zip",
  zip_filename: "guardrails_retail_test.zip",
  apply_ready: true,
  industry_preset_used: "retail",
  generation_timestamp: new Date().toISOString(),
};

const mockApplyResponse: GuardrailsApplyResponse = {
  applied_count: 2,
  failed_count: 0,
  version_id: "v-20260404-001",
  results: [
    { guardrail_type: "ContentFilter", status: "success", resource_name: "projects/p/guardrails/cf-001", error: null },
    { guardrail_type: "LlmPromptSecurity", status: "success", resource_name: "projects/p/guardrails/lps-001", error: null },
  ],
};

const mockScaffoldContext: ScaffoldContext = {
  scaffoldId: "scaffold-retail-001",
  appDisplayName: "Acme Retail CX Agent",
  businessDomain: "retail",
  channel: "web_chat",
  companyName: "Acme Corp",
  expectedCapabilities: ["order_management", "returns_refunds"],
  decompositionStrategy: "capability_based",
  rootAgentStyle: "pure_router",
  agents: [
    {
      slug: "root_agent",
      name: "Acme Root Agent",
      agentType: "root_agent",
      roleSummary: "Routes customer queries to appropriate sub-agents",
      handles: [],
      suggestedTools: [],
      instructionApplied: false,
      instructionCharCount: 0,
      cesAgentId: null,
    },
    {
      slug: "order_agent",
      name: "Order Management Agent",
      agentType: "sub_agent",
      roleSummary: "Handles order tracking and cancellations",
      handles: ["order_management"],
      suggestedTools: ["order_api"],
      instructionApplied: false,
      instructionCharCount: 0,
      cesAgentId: null,
    },
  ],
  toolStubs: [],
  environmentVars: ["ORDER_API_BASE_URL"],
  guardrailsApplied: false,
  guardrailsIndustry: null,
  createdAt: new Date().toISOString(),
  lastUpdatedAt: new Date().toISOString(),
  generatedZipFilename: "acme_retail.zip",
};

// ── Mock setup ────────────────────────────────────────────────────────────────

vi.mock("@/services/api", () => ({
  apiClient: {
    post: vi.fn(),
  },
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
    selectedProject: null,
    selectedApp: null,
    activeInstructionAgent: null,
    isDemoMode: false,
  });
});

// ── GuardrailsPage — Step Indicator ──────────────────────────────────────────

describe("GuardrailsPage — step indicator", () => {
  it("renders all 3 step labels on initial load", () => {
    render(<GuardrailsPage />);
    expect(screen.getByText("1. Configure")).toBeInTheDocument();
    expect(screen.getByText("2. Preview")).toBeInTheDocument();
    expect(screen.getByText("3. Apply")).toBeInTheDocument();
  });

  it("starts on the form step (Configure is active)", () => {
    render(<GuardrailsPage />);
    const activeStep = screen.getByText("1. Configure");
    expect(activeStep.className).toContain("bg-gecx-600");
    expect(activeStep.className).toContain("text-white");
  });
});

// ── GuardrailsForm — Field Defaults ──────────────────────────────────────────

describe("GuardrailsForm — defaults and validation", () => {
  const mockSubmit = vi.fn();

  it("renders industry vertical select with 'generic' default", () => {
    render(<GuardrailsForm onSubmit={mockSubmit} isLoading={false} />);
    // Label has no htmlFor — query by combobox role; first select = industry_vertical
    const selects = screen.getAllByRole("combobox");
    expect((selects[0] as HTMLSelectElement).value).toBe("generic");
  });

  it("renders all 8 industry vertical options", () => {
    render(<GuardrailsForm onSubmit={mockSubmit} isLoading={false} />);
    const selects = screen.getAllByRole("combobox");
    const options = selects[0].querySelectorAll("option");
    // retail, bfsi, healthcare, telecom, hospitality, ecommerce, utilities, generic
    expect(options).toHaveLength(8);
  });

  it("renders 3 sensitivity level radio cards", () => {
    render(<GuardrailsForm onSubmit={mockSubmit} isLoading={false} />);
    expect(screen.getByText("Relaxed")).toBeInTheDocument();
    expect(screen.getByText("Balanced")).toBeInTheDocument();
    expect(screen.getByText("Strict")).toBeInTheDocument();
  });

  it("'balanced' sensitivity is selected by default", () => {
    render(<GuardrailsForm onSubmit={mockSubmit} isLoading={false} />);
    const balancedCard = screen.getByText("Balanced").closest("label");
    expect(balancedCard?.className).toContain("border-gecx-500");
  });

  it("prompt injection guard checkbox is checked by default", () => {
    render(<GuardrailsForm onSubmit={mockSubmit} isLoading={false} />);
    // Label wraps the checkbox with no htmlFor — query by role
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("custom_policy_rules shows character count", async () => {
    render(<GuardrailsForm onSubmit={mockSubmit} isLoading={false} />);
    const textarea = screen.getByPlaceholderText(/these rules will be appended/i);
    await userEvent.type(textarea, "Hello");
    expect(screen.getByText(/5\/1000/)).toBeInTheDocument();
  });

  it("submit button shows spinner when isLoading=true", () => {
    render(<GuardrailsForm onSubmit={mockSubmit} isLoading={true} />);
    expect(screen.getByText("Generating…")).toBeInTheDocument();
  });

  it("submit button shows 'Generate Guardrails Pack' when not loading", () => {
    render(<GuardrailsForm onSubmit={mockSubmit} isLoading={false} />);
    expect(screen.getByText("Generate Guardrails Pack")).toBeInTheDocument();
  });
});

// ── GuardrailsForm — ScaffoldContext auto-prefill ─────────────────────────────

describe("GuardrailsForm — ScaffoldContext prefill", () => {
  it("auto-fills industry_vertical from scaffoldContext.businessDomain", async () => {
    useProjectStore.setState({ scaffoldContext: mockScaffoldContext });
    render(<GuardrailsForm onSubmit={vi.fn()} isLoading={false} />);
    await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      expect((selects[0] as HTMLSelectElement).value).toBe("retail");
    });
  });

  it("auto-fills agent_persona_type from expectedCapabilities (order_management → order_management)", async () => {
    useProjectStore.setState({ scaffoldContext: mockScaffoldContext });
    render(<GuardrailsForm onSubmit={vi.fn()} isLoading={false} />);
    await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      expect((selects[1] as HTMLSelectElement).value).toBe("order_management");
    });
  });

  it("shows ScaffoldContextBanner when context is present", async () => {
    useProjectStore.setState({ scaffoldContext: mockScaffoldContext });
    render(<GuardrailsForm onSubmit={vi.fn()} isLoading={false} />);
    await waitFor(() => {
      expect(screen.getByText(/acme retail cx agent/i)).toBeInTheDocument();
    });
  });
});

// ── GuardrailsPage — full flow: form → generate → preview ────────────────────

describe("GuardrailsPage — form submit transitions to preview", () => {
  it("calls /accelerators/guardrails/generate and navigates to preview step", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockGenerateResponse });
    render(<GuardrailsPage />);

    const submitBtn = screen.getByRole("button", { name: /generate guardrails pack/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/accelerators/guardrails/generate",
        expect.objectContaining({
          industry_vertical: "generic",
          sensitivity_level: "balanced",
          enable_prompt_injection_guard: true,
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Guardrail Preview")).toBeInTheDocument();
    });
  });

  it("shows error banner on generate failure", async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("Network error"));
    render(<GuardrailsPage />);

    const submitBtn = screen.getByRole("button", { name: /generate guardrails pack/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/failed to generate guardrails/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("Guardrail Preview")).not.toBeInTheDocument();
  });
});

// ── GuardrailsPreview — toggle logic ─────────────────────────────────────────

describe("GuardrailsPreview — toggle behavior", () => {
  const mockOnChange = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnProceed = vi.fn();

  it("shows correct enabled count (2 of 3 enabled)", () => {
    render(
      <GuardrailsPreview
        items={mockPreviews}
        onChange={mockOnChange}
        onBack={mockOnBack}
        onProceed={mockOnProceed}
      />
    );
    expect(screen.getByText(/2 of 3 guardrails enabled/i)).toBeInTheDocument();
    expect(screen.getByText("2 enabled")).toBeInTheDocument();
  });

  it("renders all guardrail display names", () => {
    render(
      <GuardrailsPreview
        items={mockPreviews}
        onChange={mockOnChange}
        onBack={mockOnBack}
        onProceed={mockOnProceed}
      />
    );
    expect(screen.getByText("Content Blocklist")).toBeInTheDocument();
    expect(screen.getByText("Prompt Injection Guard")).toBeInTheDocument();
    expect(screen.getByText("Off-Topic Deflection")).toBeInTheDocument();
  });

  it("calls onChange with toggled item when toggle button is clicked", async () => {
    render(
      <GuardrailsPreview
        items={mockPreviews}
        onChange={mockOnChange}
        onBack={mockOnBack}
        onProceed={mockOnProceed}
      />
    );
    // Toggle buttons have aria-label "Disable" (enabled) or "Enable" (disabled)
    const toggleButtons = screen.getAllByRole("button", { name: /^(Disable|Enable)$/i });
    await userEvent.click(toggleButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ guardrail_type: "ContentFilter", enabled: false }),
      ])
    );
  });

  it("disables 'Proceed to apply' button when 0 items are enabled", () => {
    const allDisabled = mockPreviews.map((p) => ({ ...p, enabled: false }));
    render(
      <GuardrailsPreview
        items={allDisabled}
        onChange={mockOnChange}
        onBack={mockOnBack}
        onProceed={mockOnProceed}
      />
    );
    const proceedBtn = screen.getByRole("button", { name: /proceed to apply/i });
    expect(proceedBtn).toBeDisabled();
  });

  it("enables 'Proceed to apply' when at least 1 item is enabled", () => {
    render(
      <GuardrailsPreview
        items={mockPreviews}
        onChange={mockOnChange}
        onBack={mockOnBack}
        onProceed={mockOnProceed}
      />
    );
    const proceedBtn = screen.getByRole("button", { name: /proceed to apply/i });
    expect(proceedBtn).not.toBeDisabled();
  });

  it("calls onBack when 'Edit configuration' is clicked", async () => {
    render(
      <GuardrailsPreview
        items={mockPreviews}
        onChange={mockOnChange}
        onBack={mockOnBack}
        onProceed={mockOnProceed}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /edit configuration/i }));
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });
});

// ── GuardrailsResult — real mode ─────────────────────────────────────────────

describe("GuardrailsResult — real auth mode", () => {
  const enabledItems = mockPreviews.filter((p) => p.enabled);

  it("shows download button with zip filename", () => {
    render(
      <GuardrailsResult
        generateResponse={mockGenerateResponse}
        enabledItems={enabledItems}
        industryVertical="retail"
        onBack={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText("guardrails_retail_test.zip")).toBeInTheDocument();
  });

  it("shows 'Apply to CES App' section in real mode", () => {
    render(
      <GuardrailsResult
        generateResponse={mockGenerateResponse}
        enabledItems={enabledItems}
        industryVertical="retail"
        onBack={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText(/apply to ces app/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply to app/i })).toBeInTheDocument();
  });

  it("calls /accelerators/guardrails/apply and shows success state", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockApplyResponse });

    render(
      <GuardrailsResult
        generateResponse={mockGenerateResponse}
        enabledItems={enabledItems}
        industryVertical="retail"
        onBack={vi.fn()}
        onReset={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /apply to app/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/accelerators/guardrails/apply",
        expect.objectContaining({
          guardrails: expect.arrayContaining([
            expect.objectContaining({ displayName: "Content Blocklist" }),
          ]),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/all guardrails applied successfully/i)).toBeInTheDocument();
      expect(screen.getByText(/2 guardrails created/i)).toBeInTheDocument();
      expect(screen.getByText(/v-20260404-001/)).toBeInTheDocument();
    });
  });

  it("shows partial failure state when failed_count > 0", async () => {
    const partialResponse: GuardrailsApplyResponse = {
      applied_count: 1,
      failed_count: 1,
      version_id: null,
      results: [
        { guardrail_type: "ContentFilter", status: "success", resource_name: "projects/p/cf", error: null },
        { guardrail_type: "LlmPromptSecurity", status: "failed", resource_name: null, error: "Permission denied" },
      ],
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: partialResponse });

    render(
      <GuardrailsResult
        generateResponse={mockGenerateResponse}
        enabledItems={enabledItems}
        industryVertical="retail"
        onBack={vi.fn()}
        onReset={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /apply to app/i }));

    await waitFor(() => {
      expect(screen.getByText(/partial success/i)).toBeInTheDocument();
      expect(screen.getByText(/1 applied, 1 failed/i)).toBeInTheDocument();
    });
  });

  it("shows apply error when API call fails", async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("Server error"));

    render(
      <GuardrailsResult
        generateResponse={mockGenerateResponse}
        enabledItems={enabledItems}
        industryVertical="retail"
        onBack={vi.fn()}
        onReset={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /apply to app/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to apply guardrails/i)).toBeInTheDocument();
    });
  });
});

// ── GuardrailsResult — demo mode ─────────────────────────────────────────────

describe("GuardrailsResult — demo mode", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: "demo-token", isDemoMode: true });
  });

  it("hides 'Apply to App' button in demo mode", () => {
    const enabledItems = mockPreviews.filter((p) => p.enabled);
    render(
      <GuardrailsResult
        generateResponse={mockGenerateResponse}
        enabledItems={enabledItems}
        industryVertical="retail"
        onBack={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /apply to app/i })).not.toBeInTheDocument();
  });

  it("shows 'requires GCP connection' message in demo mode", () => {
    const enabledItems = mockPreviews.filter((p) => p.enabled);
    render(
      <GuardrailsResult
        generateResponse={mockGenerateResponse}
        enabledItems={enabledItems}
        industryVertical="retail"
        onBack={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText(/requires gcp connection/i)).toBeInTheDocument();
  });
});

// ── GuardrailsPage — markGuardrailsApplied is called ─────────────────────────

describe("GuardrailsPage — projectStore.markGuardrailsApplied integration", () => {
  it("marks guardrails as applied on successful apply", async () => {
    useProjectStore.setState({ scaffoldContext: mockScaffoldContext });
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: mockGenerateResponse }) // generate
      .mockResolvedValueOnce({ data: mockApplyResponse });   // apply

    render(<GuardrailsPage />);

    // Step 1 → Submit form
    await userEvent.click(screen.getByRole("button", { name: /generate guardrails pack/i }));
    await waitFor(() => screen.getByText("Guardrail Preview"));

    // Step 2 → Proceed to result
    await userEvent.click(screen.getByRole("button", { name: /proceed to apply/i }));
    await waitFor(() => screen.getByRole("button", { name: /apply to app/i }));

    // Step 3 → Apply
    await userEvent.click(screen.getByRole("button", { name: /apply to app/i }));
    await waitFor(() => screen.getByText(/all guardrails applied successfully/i));

    const ctx = useProjectStore.getState().scaffoldContext;
    expect(ctx?.guardrailsApplied).toBe(true);
    expect(ctx?.guardrailsIndustry).toBe("retail");
  });
});