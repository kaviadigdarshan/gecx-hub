import { ArrowLeft, ArrowRight, Shield, Brain, Lock, Sliders } from "lucide-react";
import type { GuardrailPreviewItem } from "@/types/accelerators";

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; border: string }> = {
  ContentFilter: {
    icon: <Shield size={14} />,
    color: "text-orange-600 bg-orange-50",
    border: "border-orange-100",
  },
  LlmPromptSecurity: {
    icon: <Lock size={14} />,
    color: "text-red-600 bg-red-50",
    border: "border-red-100",
  },
  LlmPolicy: {
    icon: <Brain size={14} />,
    color: "text-blue-600 bg-blue-50",
    border: "border-blue-100",
  },
  ModelSafety: {
    icon: <Sliders size={14} />,
    color: "text-purple-600 bg-purple-50",
    border: "border-purple-100",
  },
};

interface GuardrailsPreviewProps {
  items?: GuardrailPreviewItem[];
  onChange: (items: GuardrailPreviewItem[]) => void;
  onBack: () => void;
  onProceed: () => void;
}

export default function GuardrailsPreview({
  items = [],
  onChange,
  onBack,
  onProceed,
}: GuardrailsPreviewProps) {
  const enabledCount = items.filter((i) => i.enabled).length;

  const toggleItem = (idx: number) => {
    onChange(
      items.map((item, i) =>
        i === idx ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            Guardrail Preview
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {enabledCount} of {items.length} guardrails enabled — toggle to
            customise before applying.
          </p>
        </div>
        <span className="text-xs font-medium text-gecx-600 bg-gecx-50 border border-gecx-200 px-2.5 py-1 rounded-full">
          {enabledCount} enabled
        </span>
      </div>

      <div className="space-y-3 mb-6">
        {items.map((item, idx) => {
          const meta = TYPE_META[item.guardrail_type] ?? {
            icon: <Shield size={14} />,
            color: "text-gray-600 bg-gray-50",
            border: "border-gray-100",
          };

          return (
            <div
              key={idx}
              className={[
                "flex items-start gap-3 p-4 rounded-xl border transition",
                meta.border,
                item.enabled ? "bg-white" : "bg-gray-50 opacity-60",
              ].join(" ")}
            >
              {/* Type badge */}
              <span
                className={[
                  "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5",
                  meta.color,
                ].join(" ")}
              >
                {meta.icon}
                <span>{item.guardrail_type}</span>
              </span>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {item.display_name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
              </div>

              {/* Toggle */}
              <button
                type="button"
                onClick={() => toggleItem(idx)}
                className={[
                  "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                  item.enabled ? "bg-gecx-500" : "bg-gray-200",
                ].join(" ")}
                aria-label={item.enabled ? "Disable" : "Enable"}
              >
                <span
                  className={[
                    "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200",
                    item.enabled ? "translate-x-4" : "translate-x-0",
                  ].join(" ")}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          <ArrowLeft size={14} />
          Edit configuration
        </button>
        <button
          type="button"
          onClick={onProceed}
          disabled={enabledCount === 0}
          className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gecx-600 text-white text-sm font-semibold hover:bg-gecx-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
        >
          Proceed to apply
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
