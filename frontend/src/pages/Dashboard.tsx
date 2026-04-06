import { useUIStore } from "@/store/uiStore";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/accelerators/EmptyState";
import AcceleratorWrapper from "@/components/accelerators/AcceleratorWrapper";
import GuardrailsPage from "@/components/accelerators/guardrails/GuardrailsPage";
import InstructionsPage from "@/components/accelerators/instructions/InstructionsPage";
import ScaffolderPage from "@/components/accelerators/scaffolder/ScaffolderPage";
import ToolsPage from "@/components/accelerators/Acc6Tools/ToolsPage";
import CallbacksPage from "@/components/accelerators/callbacks/CallbacksPage";

export default function Dashboard() {
  const { activeAccelerator } = useUIStore();

  const renderAccelerator = () => {
    switch (activeAccelerator) {
      case "guardrails":
        return (
          <AcceleratorWrapper
            title="Guardrails Generator"
            description="Generate a production-ready CX Agent Studio guardrail configuration pack for your project in minutes."
            docsUrl="https://docs.cloud.google.com/customer-engagement-ai/conversational-agents/ps/guardrail"
          >
            <GuardrailsPage />
          </AcceleratorWrapper>
        );
      case "instructions":
        return (
          <AcceleratorWrapper
            title="Instruction Architect"
            description="Build structured, production-ready agent instructions for every agent in your CES topology."
          >
            <InstructionsPage />
          </AcceleratorWrapper>
        );
      case "scaffolder":
        return (
          <AcceleratorWrapper
            title="Multi-Agent App Scaffolder"
            description="Design your agent topology, generate instruction scaffolds, and export an importable AppSnapshot ZIP."
          >
            <ScaffolderPage />
          </AcceleratorWrapper>
        );
      case "tools-configurator":
        return (
          <AcceleratorWrapper
            title="Tools & Environment Configurator"
            description="Define data stores and APIs available to agents, then sync them into your ScaffoldContext."
          >
            <ToolsPage />
          </AcceleratorWrapper>
        );
      case "callbacks":
        return (
          <AcceleratorWrapper
            title="Callback Accelerator"
            description="Generate ADK callback code for each agent hook type, pre-populated from your scaffold topology."
          >
            <CallbacksPage />
          </AcceleratorWrapper>
        );
      default:
        return <EmptyState />;
    }
  };

  return <AppShell>{renderAccelerator()}</AppShell>;
}
