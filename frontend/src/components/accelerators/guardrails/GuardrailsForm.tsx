import { useEffect } from "react";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck } from "lucide-react";

import { useProjectStore } from "@/store/projectStore";
import { ScaffoldContextBanner } from "@/components/common/ScaffoldContextBanner";
import TagInput from "./TagInput";
import ActionConfigPanel from "./ActionConfigPanel";
import type { GuardrailsFormInput } from "@/types/accelerators";
import { INDUSTRY_VERTICALS } from "@/constants/verticals";

// ── Zod schema ────────────────────────────────────────────────────────────────

const actionSchema = z.object({
  action_type: z.enum(["RESPOND_IMMEDIATELY", "TRANSFER_AGENT", "GENERATIVE_ANSWER"]),
  canned_response: z.string().nullable(),
  target_agent: z.string().nullable(),
  generative_prompt: z.string().nullable(),
});

const schema = z.object({
  industry_vertical: z.enum(
    INDUSTRY_VERTICALS.map(v => v.value) as [string, ...string[]]
  ),
  agent_persona_type: z.enum([
    "customer_service", "order_management", "booking",
    "payment_support", "technical_support", "hr_assistant",
  ]),
  sensitivity_level: z.enum(["relaxed", "balanced", "strict"]),
  competitor_names: z.array(z.string()),
  custom_blocked_phrases: z.array(z.string()),
  custom_policy_rules: z.string().max(1000),
  enable_prompt_injection_guard: z.boolean(),
  default_action: actionSchema,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const INDUSTRIES = INDUSTRY_VERTICALS.map(({ value, emoji, label }) => ({
  value,
  label: `${emoji} ${label}`,
}));

const PERSONAS = [
  { value: "customer_service",  label: "Customer Service" },
  { value: "order_management",  label: "Order Management" },
  { value: "booking",           label: "Booking & Reservations" },
  { value: "payment_support",   label: "Payment Support" },
  { value: "technical_support", label: "Technical Support" },
  { value: "hr_assistant",      label: "HR Assistant" },
] as const;

const SENSITIVITY_OPTIONS = [
  {
    value: "relaxed" as const,
    label: "Relaxed",
    description: "Block only high-severity content. Best for internal tools.",
    color: "border-green-200 bg-green-50",
    active: "border-green-500 bg-green-50",
  },
  {
    value: "balanced" as const,
    label: "Balanced",
    description: "Block medium and above. Recommended for most deployments.",
    color: "border-gray-200 bg-white",
    active: "border-gecx-500 bg-gecx-50",
  },
  {
    value: "strict" as const,
    label: "Strict",
    description: "Block low and above. Use for regulated industries.",
    color: "border-red-100 bg-red-50",
    active: "border-red-500 bg-red-50",
  },
];

// ── Section card wrapper ──────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ── GuardrailsForm ────────────────────────────────────────────────────────────

interface GuardrailsFormProps {
  onSubmit: (data: GuardrailsFormInput) => void;
  isLoading: boolean;
}

export default function GuardrailsForm({ onSubmit, isLoading }: GuardrailsFormProps) {
  const { scaffoldContext } = useProjectStore();

  const methods = useForm<GuardrailsFormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      industry_vertical: "generic",
      agent_persona_type: "customer_service",
      sensitivity_level: "balanced",
      competitor_names: [],
      custom_blocked_phrases: [],
      custom_policy_rules: "",
      enable_prompt_injection_guard: true,
      default_action: {
        action_type: "RESPOND_IMMEDIATELY",
        canned_response:
          "I'm sorry, I can't help with that. Please contact our support team.",
        target_agent: null,
        generative_prompt: null,
      },
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    reset,
    formState: { errors },
  } = methods;

  // ADDITION 1: pre-fill from ScaffoldContext
  useEffect(() => {
    if (!scaffoldContext) return;

    setValue("industry_vertical", scaffoldContext.businessDomain as GuardrailsFormInput["industry_vertical"]);

    const capToPersona: Record<string, GuardrailsFormInput["agent_persona_type"]> = {
      order_management: "order_management",
      appointment_booking: "booking",
      payment_support: "payment_support",
      technical_support: "technical_support",
      returns_refunds: "customer_service",
      account_management: "customer_service",
      faq_knowledge: "customer_service",
      loyalty_rewards: "customer_service",
    };
    const matched = scaffoldContext.expectedCapabilities
      .map((c) => capToPersona[c])
      .find(Boolean);
    if (matched) setValue("agent_persona_type", matched);
  }, [scaffoldContext?.scaffoldId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensitivityLevel = watch("sensitivity_level");
  const customRules = watch("custom_policy_rules");

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>

        {/* Scaffold context banner — auto-shows when context is available */}
        <ScaffoldContextBanner onClear={() => reset()} />

        {/* Section 1: Target */}
        <Section title="Target">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Industry vertical
              </label>
              <select
                {...register("industry_vertical")}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 bg-white transition"
              >
                {INDUSTRIES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Agent persona type
              </label>
              <select
                {...register("agent_persona_type")}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 bg-white transition"
              >
                {PERSONAS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        {/* Section 2: Sensitivity */}
        <Section title="Sensitivity Level">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SENSITIVITY_OPTIONS.map((opt) => {
              const isActive = sensitivityLevel === opt.value;
              return (
                <label
                  key={opt.value}
                  className={[
                    "relative flex flex-col gap-1 p-3 rounded-lg border cursor-pointer transition",
                    isActive ? opt.active : opt.color,
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    value={opt.value}
                    {...register("sensitivity_level")}
                    className="absolute opacity-0 w-0 h-0"
                  />
                  <span className="flex items-center gap-2">
                    <span
                      className={[
                        "w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition",
                        isActive ? "border-gecx-500 bg-gecx-500" : "border-gray-300",
                      ].join(" ")}
                    />
                    <span className="text-sm font-semibold text-gray-700">
                      {opt.label}
                    </span>
                  </span>
                  <p className="ml-5 text-xs text-gray-500">{opt.description}</p>
                </label>
              );
            })}
          </div>
        </Section>

        {/* Section 3: Content Filtering */}
        <Section title="Content Filtering">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Competitor names to block
              </label>
              <Controller
                name="competitor_names"
                control={control}
                render={({ field }) => (
                  <TagInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="e.g. CompetitorCo, RivalBrand — press Enter to add"
                    maxItems={20}
                  />
                )}
              />
              <p className="mt-1 text-xs text-gray-400">
                These terms will be blocked in both user inputs and agent responses.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Custom blocked phrases
              </label>
              <Controller
                name="custom_blocked_phrases"
                control={control}
                render={({ field }) => (
                  <TagInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="e.g. guaranteed returns — press Enter to add"
                    maxItems={50}
                  />
                )}
              />
            </div>
          </div>
        </Section>

        {/* Section 4: Custom LLM Policy Rules */}
        <Section title="Custom Policy Rules">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Additional policy instructions
            <span className="ml-2 text-xs text-gray-400 font-normal">
              ({customRules.length}/1000)
            </span>
          </label>
          <textarea
            {...register("custom_policy_rules")}
            rows={3}
            placeholder="These rules will be appended to the first LLM policy prompt. e.g. 'The agent must always respond in the user's language.'"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 resize-none transition"
          />
          {errors.custom_policy_rules && (
            <p className="mt-1 text-xs text-red-500">
              {errors.custom_policy_rules.message}
            </p>
          )}
        </Section>

        {/* Section 5: Default Trigger Action */}
        <Section title="Default Trigger Action">
          <p className="text-xs text-gray-400 mb-3">
            Action the agent takes when any guardrail is triggered.
          </p>
          <ActionConfigPanel />
        </Section>

        {/* Section 6: Options */}
        <Section title="Options">
          <label className="flex items-start gap-3 cursor-pointer">
            <span className="flex-1">
              <span className="block text-sm font-medium text-gray-700">
                Enable prompt injection guard
              </span>
              <span className="block text-xs text-gray-400 mt-0.5">
                Protects against attempts to override agent instructions.
                Recommended for all production deployments.
              </span>
            </span>
            <input
              type="checkbox"
              {...register("enable_prompt_injection_guard")}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gecx-600 focus:ring-gecx-500 transition"
            />
          </label>
        </Section>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gecx-600 text-white text-sm font-semibold hover:bg-gecx-700 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-sm"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                Generate Guardrails Pack
              </>
            )}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
