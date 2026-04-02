export type { IndustryVertical } from "@/constants/verticals";

export type AgentPersonaType =
  | "customer_service"
  | "order_management"
  | "booking"
  | "payment_support"
  | "technical_support"
  | "hr_assistant";

export type SensitivityLevel = "relaxed" | "balanced" | "strict";

export type TriggerActionType =
  | "RESPOND_IMMEDIATELY"
  | "TRANSFER_AGENT"
  | "GENERATIVE_ANSWER";

export interface ActionConfig {
  action_type: TriggerActionType;
  canned_response: string | null;
  target_agent: string | null;
  generative_prompt: string | null;
}

export interface GuardrailsFormInput {
  industry_vertical: IndustryVertical;
  agent_persona_type: AgentPersonaType;
  sensitivity_level: SensitivityLevel;
  competitor_names: string[];
  custom_blocked_phrases: string[];
  custom_policy_rules: string;
  enable_prompt_injection_guard: boolean;
  default_action: ActionConfig;
}

export interface GuardrailPreviewItem {
  guardrail_type: string;
  display_name: string;
  description: string;
  ces_resource: Record<string, unknown>;
  enabled: boolean;
}

export interface GuardrailsGenerateResponse {
  request_id: string;
  previews: GuardrailPreviewItem[];
  download_url: string;
  zip_filename: string;
  apply_ready: boolean;
  industry_preset_used: string;
  generation_timestamp: string;
}

export interface GuardrailApplyResult {
  guardrail_type: string;
  status: "success" | "failed";
  resource_name: string | null;
  error: string | null;
}

export interface GuardrailsApplyResponse {
  applied_count: number;
  failed_count: number;
  version_id: string | null;
  results: GuardrailApplyResult[];
}
