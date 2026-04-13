import { useState, useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useScaffoldContext } from "@/hooks/useScaffoldContext";
import { hasContext } from "@/utils/contextUtils";
import { apiClient } from "@/services/api";
import type { InstructionFormData } from "@/types/instructions";
import { defaultFormData } from "@/types/instructions";
import type { ExtractedField } from "@/types/sourceContext";
import { ScaffoldContextBanner } from "@/components/common/ScaffoldContextBanner";
import { ImportContextButton } from "@/components/common/ImportContextButton";
import WizardShell from "./WizardShell";
import Step1Identity from "./Step1Identity";
import Step2Persona from "./Step2Persona";
import Step3Scope from "./Step3Scope";
import Step4Tools from "./Step4Tools";
import Step5SubAgents from "./Step5SubAgents";
import Step6ErrorHandling from "./Step6ErrorHandling";
import Step7Preview from "./Step7Preview";

const TOTAL_STEPS = 7;

export default function InstructionsPage() {
  const {
    scaffoldContext,
    isDemoMode,
    activeInstructionAgent,
    setActiveInstructionAgent,
  } = useProjectStore();
  useScaffoldContext(); // keeps scaffold context synced in session

  const [selectedAgentSlug, setSelectedAgentSlug] = useState<string | null>(
    activeInstructionAgent // set by sidebar "Configure" buttons
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<InstructionFormData>(defaultFormData);
  const [showPreFillBanner] = useState(false); // kept for WizardShell prop compat

  // Manual entry state — used when no scaffold context (demo mode or fresh session)
  const [showManualEntry, setShowManualEntry] = useState(!scaffoldContext || isDemoMode);
  const [manualName, setManualName] = useState("");
  const [manualType, setManualType] = useState<"root_agent" | "sub_agent">("root_agent");

  // Build agent list from ScaffoldContext when present
  const allAgents = scaffoldContext?.agents
    ? scaffoldContext.agents.map((a) => ({
        id: a.slug,
        name: a.name,
        type: a.agentType,
        instructionApplied: a.instructionApplied,
      }))
    : [];

  // Sync with store whenever the sidebar fires a "Configure" click on a different agent
  useEffect(() => {
    if (activeInstructionAgent && activeInstructionAgent !== selectedAgentSlug) {
      setSelectedAgentSlug(activeInstructionAgent);
    }
  }, [activeInstructionAgent]);

  // Pre-fill wizard formData from ScaffoldContext when an agent is selected
  useEffect(() => {
    if (!selectedAgentSlug || selectedAgentSlug === "__manual__" || !scaffoldContext) return;

    const agent = scaffoldContext?.agents?.find((a) => a.slug === selectedAgentSlug);
    if (!agent) return;

    const rootAgent = scaffoldContext?.agents?.find((a) => a.agentType === "root_agent");
    const isRoot = agent.agentType === "root_agent";
    const otherAgents = scaffoldContext?.agents?.filter((a) => a.slug !== selectedAgentSlug) ?? [];
    const delegatableSubAgents = scaffoldContext?.agents?.filter(
      (a) => a.agentType === "sub_agent" && a.slug !== selectedAgentSlug
    ) ?? [];

    setFormData({
      identity: {
        agent_name: agent.name,
        agent_purpose: agent.roleSummary,
        agent_type: agent.agentType,
        parent_agent_context: isRoot
          ? ""
          : `${rootAgent?.name ?? "Root agent"} handles overall conversation routing and delegates specialized tasks to sub-agents`,
      },
      persona: {
        persona_name: "",
        tone: "friendly_professional",
        brand_voice_keywords: [],
        language: "en-US",
        company_name: scaffoldContext.companyName,
      },
      scope: {
        primary_goals: agent.handles.map(
          (h) => `Handle ${h.replace(/_/g, " ")} related customer queries`
        ),
        out_of_scope_topics: otherAgents
          .map((a) =>
            `${a.handles
              .slice(0, 2)
              .map((h) => h.replace(/_/g, " "))
              .join(", ")} (handled by ${a.name})`
          )
          .filter(Boolean)
          .slice(0, 5),
        escalation_triggers: [
          "Customer expresses significant frustration after two failed resolution attempts",
          "[CONFIGURE: add project-specific escalation triggers]",
        ],
        escalation_target: "human customer service agent",
      },
      tools: {
        tools: agent.suggestedTools.map((toolSlug) => {
          const stub = scaffoldContext?.toolStubs?.find((t) => t.toolName === toolSlug);
          return {
            tool_name: toolSlug,
            tool_description: stub?.displayName ?? `${toolSlug} integration`,
            when_to_use: `[CONFIGURE: Describe exactly when to call the ${toolSlug} tool]`,
          };
        }),
      },
      subAgents: {
        sub_agents: isRoot
          ? delegatableSubAgents.map((sa) => ({
              agent_name: sa.name,
              agent_capability: sa.roleSummary,
              delegation_condition: `[CONFIGURE: Describe the exact condition that triggers delegation to ${sa.name}]`,
            }))
          : [],
      },
      errorHandling: null,
    });

    setCurrentStep(1);
  }, [selectedAgentSlug, scaffoldContext?.scaffoldId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownloadMergedZip = async () => {
    if (!hasContext(scaffoldContext)) return;
    try {
      const res = await apiClient.post<{ request_id: string; download_url: string }>(
        "/accelerators/scaffolder/merge-zip",
        {
          original_request_id: scaffoldContext.scaffoldId,
          agent_instructions: scaffoldContext.agents ?? [],
        }
      );
      window.open(res.data.download_url, "_blank");
    } catch {
      // silent — no toast infrastructure yet
    }
  };

  const handleChangeAgent = () => {
    setSelectedAgentSlug(null);
    setActiveInstructionAgent(null);
  };

  const handleFieldsExtracted = (fields: ExtractedField[]) => {
    if (!fields?.length) return; // graceful no-op: demo mode or empty response
    const purpose = fields.find((f) => f.field_name === "agent_purpose");
    if (purpose) {
      setFormData((f) => ({
        ...f,
        identity: { ...f.identity, agent_purpose: purpose.value },
      }));
    }
  };

  const handleNext = () => setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const handleBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1Identity
            data={formData.identity}
            onChange={(identity) => setFormData((f) => ({ ...f, identity }))}
          />
        );
      case 2:
        return (
          <Step2Persona
            data={formData.persona}
            onChange={(persona) => setFormData((f) => ({ ...f, persona }))}
          />
        );
      case 3:
        return (
          <Step3Scope
            data={formData.scope}
            onChange={(scope) => setFormData((f) => ({ ...f, scope }))}
          />
        );
      case 4:
        return (
          <Step4Tools
            data={formData.tools}
            onChange={(tools) => setFormData((f) => ({ ...f, tools }))}
          />
        );
      case 5:
        return (
          <Step5SubAgents
            data={formData.subAgents}
            agentType={formData.identity.agent_type}
            onChange={(subAgents) => setFormData((f) => ({ ...f, subAgents }))}
          />
        );
      case 6:
        return (
          <Step6ErrorHandling
            data={formData.errorHandling}
            onChange={(errorHandling) => setFormData((f) => ({ ...f, errorHandling }))}
          />
        );
      case 7:
        return (
          <Step7Preview
            formData={formData}
            selectedAgentSlug={selectedAgentSlug}
            scaffoldContext={scaffoldContext}
          />
        );
      default:
        return null;
    }
  };

  // ── Inline manual entry form ──────────────────────────────────────────────────
  const ManualEntryForm = (
    <div className="space-y-3 p-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Configure an agent manually
      </p>
      <p className="text-sm text-gray-600">{manualName}</p>
      <input
        type="text"
        value={manualName}
        onChange={(e) => setManualName(e.target.value)}
        placeholder="Agent name"
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 transition"
      />
      <select
        value={manualType}
        onChange={(e) => setManualType(e.target.value as "root_agent" | "sub_agent")}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 transition"
      >
        <option value="root_agent">Root Agent</option>
        <option value="sub_agent">Sub Agent</option>
      </select>
      <button
        onClick={() => {
          if (!manualName.trim()) return;
          setSelectedAgentSlug("__manual__");
          setFormData({
            ...defaultFormData,
            identity: {
              ...defaultFormData.identity,
              agent_name: manualName,
              agent_type: manualType,
            },
          });
          setShowManualEntry(false);
        }}
        disabled={!manualName.trim()}
        className="w-full px-3 py-2 text-sm font-medium text-white bg-gecx-600 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        Configure
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <ScaffoldContextBanner />

      <div className="grid grid-cols-[220px_1fr] gap-4">
        {/* Left: agent list */}
        <div className="border-r border-gray-100 pr-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2.5 mb-2">
            Agents
          </p>

          {showManualEntry && allAgents.length === 0 ? (
            ManualEntryForm
          ) : (
            <>
              {allAgents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgentSlug(agent.id);
                    setActiveInstructionAgent(agent.id);
                  }}
                  className={`block w-full text-left px-2.5 py-2 mb-1 rounded-lg text-sm transition ${
                    agent.id === selectedAgentSlug
                      ? "bg-gecx-600 text-white"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {agent.type === "root_agent" ? "⬡" : "○"} {agent.name}
                  {agent.instructionApplied && (
                    <span className="ml-1 text-xs text-green-400">✓</span>
                  )}
                </button>
              ))}

              {/* Manual entry button — always visible */}
              <button
                onClick={() => setShowManualEntry(true)}
                className="block w-full text-left px-2.5 py-2 mt-2 rounded-lg text-xs text-gecx-600 border border-dashed border-gecx-200 hover:bg-gecx-50 transition"
              >
                + Add agent manually
              </button>
            </>
          )}
        </div>

        {/* Right: wizard for selected agent */}
        <div>
          {selectedAgentSlug ? (
            <div key={selectedAgentSlug}>
              <div className="mb-3 flex justify-end">
                <ImportContextButton
                  targetAccelerator="instructions"
                  onFieldsExtracted={handleFieldsExtracted}
                />
              </div>
              <WizardShell
                currentStep={currentStep}
                onNext={handleNext}
                onBack={handleBack}
                isFinalStep={currentStep === TOTAL_STEPS}
                showPreFillBanner={showPreFillBanner}
                onDismissBanner={() => {
                  setFormData(defaultFormData);
                  setSelectedAgentSlug("__manual__");
                  setActiveInstructionAgent(null);
                }}
                selectedAgentSlug={selectedAgentSlug}
                scaffoldContext={scaffoldContext}
                onChangeAgent={handleChangeAgent}
                accelerator="instruction"
                onTabChange={(tabIndex) => setCurrentStep(tabIndex + 1)}
              >
                {renderStep()}
              </WizardShell>

              {hasContext(scaffoldContext) && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleDownloadMergedZip}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gecx-200 text-sm text-gecx-600 bg-gecx-50 hover:bg-gecx-100 transition"
                  >
                    ⬇ Download Merged ZIP
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              Select an agent from the list or add one manually.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
