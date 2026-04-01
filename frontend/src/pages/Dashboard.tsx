import { useUIStore } from "@/store/uiStore";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/accelerators/EmptyState";
import AcceleratorWrapper from "@/components/accelerators/AcceleratorWrapper";
import GuardrailsPage from "@/components/accelerators/guardrails/GuardrailsPage";
import InstructionsPage from "@/components/accelerators/instructions/InstructionsPage";
import ScaffolderPage from "@/components/accelerators/scaffolder/ScaffolderPage";

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
      default:
        return <EmptyState />;
    }
  };

  return <AppShell>{renderAccelerator()}</AppShell>;
}
