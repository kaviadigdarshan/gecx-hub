import { useState, useEffect } from "react";
import { CheckCircle, Circle, ChevronRight, User } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { useScaffoldContext } from "@/hooks/useScaffoldContext";
import type { InstructionFormData } from "@/types/instructions";
import { defaultFormData } from "@/types/instructions";
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

  // Sync with store whenever the sidebar fires a "Configure" click on a different agent
  useEffect(() => {
    if (activeInstructionAgent && activeInstructionAgent !== selectedAgentSlug) {
      setSelectedAgentSlug(activeInstructionAgent);
    }
  }, [activeInstructionAgent]);

  // ADDITION 2: Pre-fill wizard formData from ScaffoldContext
  useEffect(() => {
    if (!selectedAgentSlug || selectedAgentSlug === "__manual__" || !scaffoldContext) return;

    const agent = scaffoldContext.agents.find((a) => a.slug === selectedAgentSlug);
    if (!agent) return;

    const rootAgent = scaffoldContext.agents.find((a) => a.agentType === "root_agent");
    const isRoot = agent.agentType === "root_agent";
    const otherAgents = scaffoldContext.agents.filter((a) => a.slug !== selectedAgentSlug);
    const delegatableSubAgents = scaffoldContext.agents.filter(
      (a) => a.agentType === "sub_agent" && a.slug !== selectedAgentSlug
    );

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
          const stub = scaffoldContext.toolStubs.find((t) => t.toolName === toolSlug);
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

    setCurrentStep(1); // always start from step 1 even when pre-filled
  }, [selectedAgentSlug, scaffoldContext?.scaffoldId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChangeAgent = () => {
    setSelectedAgentSlug(null);
    setActiveInstructionAgent(null);
  };

  const handleNext = () => setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const handleBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  // ADDITION 1: Agent selector screen
  if (scaffoldContext && !selectedAgentSlug) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-display font-semibold text-gray-900">
            Select an agent to configure
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Your scaffold has {scaffoldContext.agents.length} agent{scaffoldContext.agents.length !== 1 ? "s" : ""}.
            Configure instructions for each one.
          </p>
        </div>

        <div className="space-y-2">
          {scaffoldContext.agents.map((agent) => (
            <button
              key={agent.slug}
              onClick={() => {
                setSelectedAgentSlug(agent.slug);
                setActiveInstructionAgent(agent.slug);
              }}
              className="w-full flex items-center gap-3 p-4 rounded-xl border text-left hover:border-gecx-300 hover:bg-gecx-50 transition-colors group"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  agent.agentType === "root_agent" ? "bg-gecx-100" : "bg-gray-100"
                }`}
              >
                <User
                  size={14}
                  className={
                    agent.agentType === "root_agent" ? "text-gecx-600" : "text-gray-500"
                  }
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">{agent.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      agent.agentType === "root_agent"
                        ? "bg-gecx-100 text-gecx-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {agent.agentType === "root_agent" ? "ROOT" : "SUB"}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">{agent.roleSummary}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {agent.instructionApplied ? (
                  <CheckCircle size={16} className="text-green-500" />
                ) : (
                  <Circle size={16} className="text-amber-300" />
                )}
                <ChevronRight
                  size={14}
                  className="text-gray-300 group-hover:text-gecx-400 transition-colors"
                />
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400">
          Not using a scaffold?{" "}
          <button
            onClick={() => setSelectedAgentSlug("__manual__")}
            className="text-gecx-500 underline"
          >
            Enter agent details manually
          </button>
        </p>
      </div>
    );
  }

  // Wizard — shown when agent is selected (or manual mode, or no scaffold)
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
            onReturnToSelector={handleChangeAgent}
          />
        );
      default:
        return null;
    }
  };

  return (
    <WizardShell
      currentStep={currentStep}
      onNext={handleNext}
      onBack={handleBack}
      isFinalStep={currentStep === TOTAL_STEPS}
      showPreFillBanner={showPreFillBanner}
      onDismissBanner={() => {
          // Context was cleared by ScaffoldContextBanner; reset form and go to manual mode
          setFormData(defaultFormData);
          setSelectedAgentSlug("__manual__");
          setActiveInstructionAgent(null);
        }}
      selectedAgentSlug={selectedAgentSlug}
      scaffoldContext={scaffoldContext}
      onChangeAgent={handleChangeAgent}
    >
      {renderStep()}
    </WizardShell>
  );
}
