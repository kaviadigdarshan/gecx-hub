import { useState } from "react";
import { apiClient } from "@/services/api";
import type {
  GuardrailsFormInput,
  GuardrailPreviewItem,
  GuardrailsGenerateResponse,
} from "@/types/accelerators";
import GuardrailsForm from "./GuardrailsForm";
import GuardrailsPreview from "./GuardrailsPreview";
import GuardrailsResult from "./GuardrailsResult";

type Step = "form" | "preview" | "result";

// Step indicator shown at the top
function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "form", label: "1. Configure" },
    { key: "preview", label: "2. Preview" },
    { key: "result", label: "3. Apply" },
  ];
  const current = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <span
            className={[
              "text-xs font-medium px-2.5 py-1 rounded-full transition",
              i === current
                ? "bg-gecx-600 text-white"
                : i < current
                  ? "bg-gecx-100 text-gecx-600"
                  : "bg-gray-100 text-gray-400",
            ].join(" ")}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span className="text-gray-300 text-xs">›</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function GuardrailsPage() {
  const [step, setStep] = useState<Step>("form");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateResponse, setGenerateResponse] =
    useState<GuardrailsGenerateResponse | null>(null);
  const [previewItems, setPreviewItems] = useState<GuardrailPreviewItem[]>([]);

  const handleFormSubmit = async (data: GuardrailsFormInput) => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await apiClient.post<GuardrailsGenerateResponse>(
        "/accelerators/guardrails/generate",
        data
      );
      setGenerateResponse(res.data);
      setPreviewItems(res.data.previews);
      setStep("preview");
    } catch {
      setGenerateError(
        "Failed to generate guardrails. Check your configuration and try again."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setStep("form");
    setGenerateResponse(null);
    setPreviewItems([]);
    setGenerateError(null);
  };

  return (
    <div>
      <StepIndicator step={step} />

      {step === "form" && (
        <>
          {generateError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
              {generateError}
            </div>
          )}
          <GuardrailsForm onSubmit={handleFormSubmit} isLoading={isGenerating} />
        </>
      )}

      {step === "preview" && generateResponse && (
        <GuardrailsPreview
          items={previewItems}
          onChange={setPreviewItems}
          onBack={() => setStep("form")}
          onProceed={() => setStep("result")}
        />
      )}

      {step === "result" && generateResponse && (
        <GuardrailsResult
          generateResponse={generateResponse}
          enabledItems={previewItems.filter((p) => p.enabled)}
          onBack={() => setStep("preview")}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
