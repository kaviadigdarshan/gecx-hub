import { useFormContext } from "react-hook-form";
import type { GuardrailsFormInput, TriggerActionType } from "@/types/accelerators";

const ACTION_OPTIONS: { value: TriggerActionType; label: string; description: string }[] = [
  {
    value: "RESPOND_IMMEDIATELY",
    label: "Canned Response",
    description: "Reply with a fixed message when a guardrail triggers.",
  },
  {
    value: "TRANSFER_AGENT",
    label: "Transfer to Agent",
    description: "Route the conversation to a specific agent.",
  },
  {
    value: "GENERATIVE_ANSWER",
    label: "Generative Answer",
    description: "Let the model generate a response guided by a prompt.",
  },
];

export default function ActionConfigPanel() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<GuardrailsFormInput>();

  const actionType = watch("default_action.action_type");

  return (
    <div className="space-y-3">
      {/* Action type radio group */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {ACTION_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={[
              "relative flex flex-col gap-1 p-3 rounded-lg border cursor-pointer transition",
              actionType === opt.value
                ? "border-gecx-400 bg-gecx-50"
                : "border-gray-200 bg-white hover:border-gecx-200",
            ].join(" ")}
          >
            <input
              type="radio"
              value={opt.value}
              {...register("default_action.action_type")}
              onChange={() => {
                setValue("default_action.action_type", opt.value);
                setValue("default_action.canned_response", null);
                setValue("default_action.target_agent", null);
                setValue("default_action.generative_prompt", null);
              }}
              className="absolute inset-0 opacity-0 w-0 h-0"
            />
            <span className="flex items-center gap-2">
              <span
                className={[
                  "w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition",
                  actionType === opt.value
                    ? "border-gecx-500 bg-gecx-500"
                    : "border-gray-300",
                ].join(" ")}
              />
              <span className="text-sm font-medium text-gray-700">{opt.label}</span>
            </span>
            <span className="text-xs text-gray-400 ml-5">{opt.description}</span>
          </label>
        ))}
      </div>

      {/* Conditional fields */}
      {actionType === "RESPOND_IMMEDIATELY" && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Canned response text <span className="text-red-500">*</span>
          </label>
          <textarea
            {...register("default_action.canned_response")}
            rows={3}
            placeholder="e.g. I'm sorry, I can't help with that. Please contact our support team."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 resize-none transition"
          />
          {errors.default_action?.canned_response && (
            <p className="mt-1 text-xs text-red-500">
              {errors.default_action.canned_response.message}
            </p>
          )}
        </div>
      )}

      {actionType === "TRANSFER_AGENT" && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Target agent name
          </label>
          <input
            {...register("default_action.target_agent")}
            type="text"
            placeholder="e.g. live-agent-handoff"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 transition"
          />
        </div>
      )}

      {actionType === "GENERATIVE_ANSWER" && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Generative prompt
          </label>
          <textarea
            {...register("default_action.generative_prompt")}
            rows={3}
            placeholder="e.g. Politely decline the request and explain that this topic is outside the scope of this assistant."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 resize-none transition"
          />
        </div>
      )}
    </div>
  );
}
