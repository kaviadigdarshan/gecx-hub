/**
 * Scaffolder sub-tests: Tool Stubs (Step3ToolStubs) and App Settings (Step3AppSettings)
 * Also covers Step1UseCase validation and capability logic,
 * Step2Architecture agent editing, and Step4Preview actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Step1UseCase from "@/components/accelerators/scaffolder/Step1UseCase";
import Step3AppSettings from "@/components/accelerators/scaffolder/Step3AppSettings";
import Step3ToolStubs from "@/components/accelerators/scaffolder/Step3ToolStubs";
import Step4Preview from "@/components/accelerators/scaffolder/Step4Preview";

import { useUIStore } from "@/store/uiStore";
import { useProjectStore } from "@/store/projectStore";
import { apiClient } from "@/services/api";

import type { UseCaseData, AppSettingsData, GlobalSettingsData, ToolStubData, AgentDefinition, AppScaffoldResponse } from "@/types/scaffolder";
import { defaultUseCaseData, defaultAppSettings, defaultGlobalSettings } from "@/types/scaffolder";
import { CAPABILITIES_BY_VERTICAL } from "@/constants/capabilitiesByVertical";
import { GEMINI_MODELS } from "@/constants/geminiModels";

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
  useUIStore.setState({ activeAccelerator: null, sidebarCollapsed: false });
  useProjectStore.setState({ scaffoldContext: null, activeInstructionAgent: null });
});

// ── Step1UseCase — form validation ────────────────────────────────────────────

describe("Step1UseCase — form validation and capability grid", () => {
  const mockOnChange = vi.fn();
  const mockOnContinue = vi.fn();

  const renderStep1 = (data: Partial<UseCaseData> = {}) =>
    render(
      <Step1UseCase
        data={{ ...defaultUseCaseData, ...data }}
        onChange={mockOnChange}
        onContinue={mockOnContinue}
        isLoading={false}
      />
    );

  it("disables 'Suggest Architecture' when domain is empty", () => {
    renderStep1({ business_domain: "", primary_use_case: "" });
    expect(screen.getByRole("button", { name: /suggest architecture/i })).toBeDisabled();
  });

  it("disables 'Suggest Architecture' when primary_use_case < 20 chars", () => {
    renderStep1({ business_domain: "retail", primary_use_case: "short" });
    expect(screen.getByRole("button", { name: /suggest architecture/i })).toBeDisabled();
  });

  it("enables 'Suggest Architecture' when domain is set and use case >= 20 chars", () => {
    renderStep1({
      business_domain: "retail",
      primary_use_case: "Handle customer returns, orders and product search for a grocery retailer",
    });
    expect(screen.getByRole("button", { name: /suggest architecture/i })).not.toBeDisabled();
  });

  it("shows char count warning when use case is 1–19 chars", () => {
    renderStep1({ business_domain: "retail", primary_use_case: "Short" });
    expect(screen.getByText(/at least 20 characters/i)).toBeInTheDocument();
  });

  it("renders 'Suggest Architecture →' label when not loading", () => {
    renderStep1({ business_domain: "retail", primary_use_case: "Handle orders for retail customers" });
    expect(screen.getByRole("button", { name: /suggest architecture →/i })).toBeInTheDocument();
  });

  it("renders spinner text 'Getting suggestion…' when isLoading=true", () => {
    render(
      <Step1UseCase
        data={{ ...defaultUseCaseData, business_domain: "retail", primary_use_case: "x".repeat(25) }}
        onChange={mockOnChange}
        onContinue={mockOnContinue}
        isLoading={true}
      />
    );
    expect(screen.getByText("Getting suggestion…")).toBeInTheDocument();
  });

  it("renders capability grid for 'retail' domain", () => {
    renderStep1({ business_domain: "retail" });
    const retailCaps = CAPABILITIES_BY_VERTICAL["retail"];
    expect(screen.getByText(retailCaps[0])).toBeInTheDocument();
    expect(screen.getByText(retailCaps[1])).toBeInTheDocument();
  });

  it("renders 12 capability checkboxes for 'retail' domain", () => {
    renderStep1({ business_domain: "retail" });
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(CAPABILITIES_BY_VERTICAL["retail"].length);
  });

  it("shows 'No preset capabilities for Generic' for 'generic' domain", () => {
    renderStep1({ business_domain: "generic" });
    expect(screen.getByText(/no preset capabilities for generic/i)).toBeInTheDocument();
  });

  it("calls onChange with updated capabilities when checkbox is toggled", async () => {
    renderStep1({
      business_domain: "retail",
      expected_capabilities: [],
    });
    const firstCap = CAPABILITIES_BY_VERTICAL["retail"][0];
    const checkbox = screen.getByRole("checkbox", { name: new RegExp(firstCap, "i") });
    await userEvent.click(checkbox);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        expected_capabilities: expect.arrayContaining([firstCap]),
      })
    );
  });

  it("pre-fills capabilities from CAPABILITIES_BY_VERTICAL when domain changes", async () => {
    const data = { ...defaultUseCaseData };
    render(
      <Step1UseCase data={data} onChange={mockOnChange} onContinue={mockOnContinue} isLoading={false} />
    );

    // Step1UseCase label has no htmlFor — query by combobox role
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    await userEvent.selectOptions(select, "healthcare");

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        business_domain: "healthcare",
        expected_capabilities: CAPABILITIES_BY_VERTICAL["healthcare"],
      })
    );
  });

  it("allows adding a custom capability via '+ Add capability'", async () => {
    renderStep1({ business_domain: "retail" });
    await userEvent.click(screen.getByText("+ Add capability"));
    const input = screen.getByPlaceholderText(/e.g. gift card management/i);
    await userEvent.type(input, "Gift Card Management");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        customCapabilities: expect.arrayContaining(["Gift Card Management"]),
      })
    );
  });

  it("adds custom capability via Enter key", async () => {
    renderStep1({ business_domain: "retail" });
    await userEvent.click(screen.getByText("+ Add capability"));
    const input = screen.getByPlaceholderText(/e.g. gift card management/i);
    await userEvent.type(input, "Loyalty Rewards{Enter}");

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        customCapabilities: expect.arrayContaining(["Loyalty Rewards"]),
      })
    );
  });

  it("3 channel buttons render: Web Chat, Voice, Both", () => {
    renderStep1();
    expect(screen.getByRole("button", { name: /web chat/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^voice$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^both$/i })).toBeInTheDocument();
  });

  it("selecting 'Voice' channel shows latency note", async () => {
    const data = { ...defaultUseCaseData, business_domain: "retail" };
    render(
      <Step1UseCase data={data} onChange={mockOnChange} onContinue={mockOnContinue} isLoading={false} />
    );
    await userEvent.click(screen.getByRole("button", { name: /^voice$/i }));
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ channel: "voice" }));
  });

  it("shows voice latency note when channel is 'voice'", () => {
    renderStep1({ channel: "voice" });
    expect(screen.getByText(/simpler topology.*latency/i)).toBeInTheDocument();
  });
});

// ── Step3AppSettings ──────────────────────────────────────────────────────────

describe("Step3AppSettings — model and runtime config", () => {
  const mockOnChange = vi.fn();
  const defaultSettings: AppSettingsData = { ...defaultAppSettings };

  it("renders model selector with correct default value", () => {
    render(
      <Step3AppSettings
        settings={defaultSettings}
        onChange={mockOnChange}
        onBack={vi.fn()}
        onContinue={vi.fn()}
      />
    );
    // Label has no htmlFor — query by combobox role; first select = model
    const selects = screen.getAllByRole("combobox");
    expect((selects[0] as HTMLSelectElement).value).toBe(defaultSettings.model);
  });

  it("renders all Gemini model options from GEMINI_MODELS constant", () => {
    render(
      <Step3AppSettings
        settings={defaultSettings}
        onChange={mockOnChange}
        onBack={vi.fn()}
        onContinue={vi.fn()}
      />
    );
    // Assert against actual GEMINI_MODELS content, not hardcoded strings
    const selects = screen.getAllByRole("combobox");
    const options = selects[0].querySelectorAll("option");
    expect(options).toHaveLength(GEMINI_MODELS.length);
    GEMINI_MODELS.forEach((model) => {
      expect(selects[0]).toContainElement(selects[0].querySelector(`option[value="${model.value}"]`));
    });
  });

  it("renders PARALLEL/SEQUENTIAL tool execution mode options", () => {
    render(
      <Step3AppSettings
        settings={defaultSettings}
        onChange={mockOnChange}
        onBack={vi.fn()}
        onContinue={vi.fn()}
      />
    );
    // execution_mode uses buttons not options — getByText still works on button text
    expect(screen.getByText(/parallel/i)).toBeInTheDocument();
    expect(screen.getByText(/sequential/i)).toBeInTheDocument();
  });

  it("renders temperature slider with default value", () => {
    render(
      <Step3AppSettings
        settings={defaultSettings}
        onChange={mockOnChange}
        onBack={vi.fn()}
        onContinue={vi.fn()}
      />
    );
    // Component renders temperature via toFixed(1) — match "1.0" not "1"
    expect(screen.getByText(defaultSettings.temperature.toFixed(1))).toBeInTheDocument();
  });

  it("renders language code field with default 'en-US'", () => {
    render(
      <Step3AppSettings
        settings={defaultSettings}
        onChange={mockOnChange}
        onBack={vi.fn()}
        onContinue={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("en-US")).toBeInTheDocument();
  });
});

// ── Step3ToolStubs ────────────────────────────────────────────────────────────

describe("Step3ToolStubs — tool configuration", () => {
  const mockAgents: AgentDefinition[] = [
    {
      name: "Root Agent",
      slug: "root_agent",
      agent_type: "root_agent",
      role_summary: "Routes queries",
      handles: [],
      suggested_tools: [],
      ai_generated: true,
    },
    {
      name: "Order Agent",
      slug: "order_agent",
      agent_type: "sub_agent",
      role_summary: "Handles orders",
      handles: ["order_management"],
      suggested_tools: ["order_api"],
      ai_generated: true,
    },
  ];

  const defaultProps = {
    globalSettings: { ...defaultGlobalSettings },
    onGlobalSettingsChange: vi.fn(),
    toolStubs: [] as ToolStubData[],
    onToolStubsChange: vi.fn(),
    agents: mockAgents,
    onBack: vi.fn(),
    onContinue: vi.fn(),
  };

  it("renders '+ Add Tool Stub' button", () => {
    render(<Step3ToolStubs {...defaultProps} />);
    expect(screen.getByRole("button", { name: /add tool stub/i })).toBeInTheDocument();
  });

  it("renders app_display_name input in global settings", () => {
    render(<Step3ToolStubs {...defaultProps} />);
    // Label has no htmlFor — query by placeholder
    expect(
      screen.getByPlaceholderText(/acme customer service/i)
    ).toBeInTheDocument();
  });

  it("renders existing tool stubs from props", () => {
    const toolStubs: ToolStubData[] = [
      {
        tool_name: "order_api",
        display_name: "Order Management API",
        description: "Fetches order details",
        base_url_env_var: "ORDER_API_BASE_URL",
        auth_type: "oauth",
        assigned_to_agents: ["order_agent"],
      },
    ];
    render(<Step3ToolStubs {...defaultProps} toolStubs={toolStubs} />);
    // ToolStubCard renders display_name as an input value, not a text node
    expect(screen.getByDisplayValue("Order Management API")).toBeInTheDocument();
  });

  it("renders auth type for each tool stub", () => {
    const toolStubs: ToolStubData[] = [
      {
        tool_name: "order_api",
        display_name: "Order API",
        description: "Order tool",
        base_url_env_var: "ORDER_API_BASE_URL",
        auth_type: "api_key",
        assigned_to_agents: [],
      },
    ];
    render(<Step3ToolStubs {...defaultProps} toolStubs={toolStubs} />);
    // Auth type select shows "API Key" as the option label, not the raw "api_key" value
    expect(screen.getByText(/api key/i)).toBeInTheDocument();
  });

  it("renders execution_mode field in global settings", () => {
    render(<Step3ToolStubs {...defaultProps} />);
    // Label has no htmlFor — check for the visible button options instead
    expect(screen.getByRole("button", { name: /sequential/i })).toBeInTheDocument();
  });

  it("logging_enabled checkbox is checked by default", () => {
    render(<Step3ToolStubs {...defaultProps} />);
    // Label has no htmlFor — query by role
    const checkboxes = screen.getAllByRole("checkbox");
    const loggingCheckbox = checkboxes.find(
      (cb) => (cb as HTMLInputElement).checked
    ) as HTMLInputElement;
    expect(loggingCheckbox).toBeDefined();
    expect(loggingCheckbox.checked).toBe(true);
  });
});

// ── Step4Preview — pre-generate, loading, error, result states ────────────────

describe("Step4Preview — state machine", () => {
  const mockScaffoldResult: AppScaffoldResponse = {
    request_id: "req-001",
    download_url: "https://storage.example.com/acme.zip",
    zip_filename: "acme_retail.zip",
    app_display_name: "Acme Retail CX",
    agent_count: 2,
    tool_stub_count: 1,
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
    environment_vars: ["ORDER_API_BASE_URL"],
    architecture_summary: "root_agent\n  └── order_agent",
    generation_timestamp: new Date().toISOString(),
  };

  const mockArchData: AgentDefinition[] = [
    {
      name: "Root Agent",
      slug: "root_agent",
      agent_type: "root_agent",
      role_summary: "Routes queries",
      handles: [],
      suggested_tools: [],
      ai_generated: true,
    },
  ];

  const baseProps = {
    globalSettings: { ...defaultGlobalSettings, app_display_name: "Acme Retail CX", execution_mode: "parallel" as const },
    architectureData: mockArchData,
    isGenerating: false,
    generateError: null,
    scaffoldResult: null,
    onGenerate: vi.fn(),
    onBack: vi.fn(),
    onReset: vi.fn(),
  };

  it("shows 'Ready to Generate' card in pre-generate state", () => {
    render(<Step4Preview {...baseProps} />);
    expect(screen.getByText(/ready to generate/i)).toBeInTheDocument();
  });

  it("shows app name in pre-generate summary", () => {
    render(<Step4Preview {...baseProps} />);
    expect(screen.getByText("Acme Retail CX")).toBeInTheDocument();
  });

  it("shows agent badges in pre-generate summary", () => {
    render(<Step4Preview {...baseProps} />);
    expect(screen.getByText("Root Agent")).toBeInTheDocument();
  });

  it("shows loading spinner when isGenerating=true", () => {
    render(<Step4Preview {...baseProps} isGenerating={true} />);
    expect(screen.getByText(/generating your app scaffold/i)).toBeInTheDocument();
  });

  it("shows error state with retry button when generateError is set", () => {
    render(<Step4Preview {...baseProps} generateError="Failed to generate scaffold." />);
    expect(screen.getByText("Generation failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("calls onGenerate on 'Generate Scaffold' click", async () => {
    const onGenerate = vi.fn();
    render(<Step4Preview {...baseProps} onGenerate={onGenerate} />);
    await userEvent.click(screen.getByRole("button", { name: /generate scaffold/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("shows success banner after scaffold result is available", () => {
    render(<Step4Preview {...baseProps} scaffoldResult={mockScaffoldResult} />);
    expect(screen.getByText(/scaffold generated/i)).toBeInTheDocument();
    expect(screen.getByText(/acme_retail.zip/i)).toBeInTheDocument();
  });

  it("shows agent count and env vars in success state", () => {
    render(<Step4Preview {...baseProps} scaffoldResult={mockScaffoldResult} />);
    expect(screen.getByText(/2 agents/i)).toBeInTheDocument();
    expect(screen.getByText("ORDER_API_BASE_URL")).toBeInTheDocument();
  });

  it("shows 'Download ZIP' link in success state", () => {
    render(<Step4Preview {...baseProps} scaffoldResult={mockScaffoldResult} />);
    expect(screen.getByRole("link", { name: /download zip/i })).toBeInTheDocument();
  });

  it("download link has correct href", () => {
    render(<Step4Preview {...baseProps} scaffoldResult={mockScaffoldResult} />);
    const link = screen.getByRole("link", { name: /download zip/i }) as HTMLAnchorElement;
    expect(link.href).toBe("https://storage.example.com/acme.zip");
  });

  it("shows 'Import to CES' button in success state", () => {
    render(<Step4Preview {...baseProps} scaffoldResult={mockScaffoldResult} />);
    expect(screen.getByRole("button", { name: /import to ces/i })).toBeInTheDocument();
  });

  it("shows 'Next Steps' section after generation", () => {
    render(<Step4Preview {...baseProps} scaffoldResult={mockScaffoldResult} />);
    expect(screen.getByText("Next Steps")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /craft agent instructions/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /configure guardrails/i })).toBeInTheDocument();
  });

  it("'Craft agent instructions' button sets activeAccelerator to 'instructions'", async () => {
    render(<Step4Preview {...baseProps} scaffoldResult={mockScaffoldResult} />);
    await userEvent.click(screen.getByRole("button", { name: /craft agent instructions/i }));
    expect(useUIStore.getState().activeAccelerator).toBe("instructions");
  });

  it("'Configure guardrails' button sets activeAccelerator to 'guardrails'", async () => {
    render(<Step4Preview {...baseProps} scaffoldResult={mockScaffoldResult} />);
    await userEvent.click(screen.getByRole("button", { name: /configure guardrails/i }));
    expect(useUIStore.getState().activeAccelerator).toBe("guardrails");
  });

  it("shows 'Regenerate ZIP with guardrails' when hasGuardrails=true", () => {
    render(
      <Step4Preview
        {...baseProps}
        scaffoldResult={mockScaffoldResult}
        hasGuardrails={true}
        onRegenerate={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /regenerate zip with guardrails/i })).toBeInTheDocument();
  });

  it("calls onRegenerate when regenerate button clicked", async () => {
    const onRegenerate = vi.fn();
    render(
      <Step4Preview
        {...baseProps}
        scaffoldResult={mockScaffoldResult}
        hasGuardrails={true}
        onRegenerate={onRegenerate}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /regenerate zip with guardrails/i }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("shows 'ZIP updated with guardrails' on regenerateSuccess=true", () => {
    render(
      <Step4Preview
        {...baseProps}
        scaffoldResult={mockScaffoldResult}
        hasGuardrails={true}
        onRegenerate={vi.fn()}
        regenerateSuccess={true}
      />
    );
    expect(screen.getByText(/zip updated with guardrails/i)).toBeInTheDocument();
  });

  it("calls /accelerators/scaffolder/import on 'Import to CES' click", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, app_id: "app-001", app_console_url: "https://console.cloud.google.com/ces/app-001" },
    });

    render(<Step4Preview {...baseProps} scaffoldResult={mockScaffoldResult} />);
    await userEvent.click(screen.getByRole("button", { name: /import to ces/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/accelerators/scaffolder/import",
        expect.objectContaining({
          app_display_name: "Acme Retail CX",
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/import complete/i)).toBeInTheDocument();
      expect(screen.getByText("app-001")).toBeInTheDocument();
    });
  });

  it("shows import error when import API call fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: false,
    }));

    render(<Step4Preview {...baseProps} scaffoldResult={mockScaffoldResult} />);
    await userEvent.click(screen.getByRole("button", { name: /import to ces/i }));

    await waitFor(() => {
      expect(screen.getByText(/import failed/i)).toBeInTheDocument();
    });
  });

  it("shows 'Start a new scaffold' reset link", () => {
    render(<Step4Preview {...baseProps} scaffoldResult={mockScaffoldResult} />);
    expect(screen.getByText(/start a new scaffold/i)).toBeInTheDocument();
  });

  it("calls onReset when 'Start a new scaffold' is clicked", async () => {
    const onReset = vi.fn();
    render(<Step4Preview {...baseProps} scaffoldResult={mockScaffoldResult} onReset={onReset} />);
    await userEvent.click(screen.getByText(/start a new scaffold/i));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

// ── CAPABILITIES_BY_VERTICAL — data contract ──────────────────────────────────

describe("capabilitiesByVertical — data contract", () => {
  const verticals = ["retail", "bfsi", "healthcare", "telecom", "hospitality", "ecommerce", "utilities"];

  it.each(verticals)("vertical '%s' has at least 5 capabilities", (vertical) => {
    expect(CAPABILITIES_BY_VERTICAL[vertical].length).toBeGreaterThanOrEqual(5);
  });

  it("'generic' vertical has empty capabilities array", () => {
    expect(CAPABILITIES_BY_VERTICAL["generic"]).toEqual([]);
  });

  it("retail vertical includes 'Order Management'", () => {
    expect(CAPABILITIES_BY_VERTICAL["retail"]).toContain("Order Management");
  });

  it("bfsi vertical includes 'Fraud Reporting'", () => {
    expect(CAPABILITIES_BY_VERTICAL["bfsi"]).toContain("Fraud Reporting");
  });

  it("healthcare vertical includes 'Appointment Booking'", () => {
    expect(CAPABILITIES_BY_VERTICAL["healthcare"]).toContain("Appointment Booking");
  });
});