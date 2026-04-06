/**
 * Type definitions for the Multi-Agent App Scaffolder (Accelerator 3).
 */

import { INDUSTRY_VERTICALS } from "@/constants/verticals"
import type { CallbackHookType } from "@/types/scaffoldContext";

export const CAPABILITY_OPTIONS: { slug: string; label: string }[] = [
  { slug: "returns_refunds", label: "Returns & Refunds" },
  { slug: "order_management", label: "Order Management" },
  { slug: "account_management", label: "Account Management" },
  { slug: "product_recommendations", label: "Product Recommendations" },
  { slug: "payment_support", label: "Payment Support" },
  { slug: "appointment_booking", label: "Appointment Booking" },
  { slug: "technical_support", label: "Technical Support" },
  { slug: "loyalty_rewards", label: "Loyalty & Rewards" },
  { slug: "escalation_to_human", label: "Escalation to Human" },
  { slug: "faq_knowledge", label: "FAQ / Knowledge Base" },
  { slug: "inventory_lookup", label: "Inventory Lookup" },
  { slug: "shipment_tracking", label: "Shipment Tracking" },
]

export const BUSINESS_DOMAINS = INDUSTRY_VERTICALS.map(({ value, label }) => ({ value, label }));

// ── Form state ────────────────────────────────────────────────────────────────

export interface UseCaseData {
  business_domain: string
  primary_use_case: string
  channel: "web_chat" | "voice" | "both"
  company_name: string
  expected_capabilities: string[]
  customCapabilities: string[]
}

export const defaultUseCaseData: UseCaseData = {
  business_domain: "",
  primary_use_case: "",
  channel: "web_chat",
  company_name: "",
  expected_capabilities: [],
  customCapabilities: [],
}

// ── App Settings (model, runtime config) ─────────────────────────────────────

export interface AppSettingsData {
  model: string
  temperature: number
  toolExecutionMode: "PARALLEL" | "SEQUENTIAL"
  languageCode: string
  timeZone: string
}

export const defaultAppSettings: AppSettingsData = {
  model: "gemini-3.0-flash-001",  // ← was "gemini-2.0-flash-001" which doesn't exist in the list
  temperature: 1.0,
  toolExecutionMode: "PARALLEL",
  languageCode: "en-US",
  timeZone: "UTC",
}

export const GEMINI_MODELS = [
  { value: "gemini-3.0-flash-001",          label: "gemini-3.0-flash-001 (Recommended)" },
  { value: "gemini-2.5-flash-001",          label: "gemini-2.5-flash-001" }
]

export const COMMON_TIMEZONES = [
  "UTC",
  "Australia/Sydney",
  "Australia/Melbourne",
  "US/Eastern",
  "US/Pacific",
  "Asia/Kolkata",
  "Europe/London",
]

export interface GlobalSettingsData {
  app_display_name: string
  default_language: string
  logging_enabled: boolean
  execution_mode: "parallel" | "sequential"
  global_instruction_keywords: string
}

export const defaultGlobalSettings: GlobalSettingsData = {
  app_display_name: "",
  default_language: "en-US",
  logging_enabled: true,
  execution_mode: "sequential",
  global_instruction_keywords: "",
}

export interface ToolStubData {
  tool_name: string
  display_name: string
  description: string
  base_url_env_var: string
  auth_type: "api_key" | "oauth" | "none"
  assigned_to_agents: string[]
}

// ── API response types ────────────────────────────────────────────────────────

export interface AgentDefinition {
  name: string
  slug: string
  agent_type: "root_agent" | "sub_agent"
  role_summary: string
  handles: string[]
  suggested_tools: string[]
  ai_generated: boolean
  persona?: string
  tools?: string[]
  toolsets?: { toolset: string; toolIds: string[] }[]
  callbackHooks?: CallbackHookType[]
}

export interface ArchitectureSuggestion {
  agents: AgentDefinition[]
  rationale: string
  decomposition_strategy: string
  root_agent_style: string
  estimated_complexity: "simple" | "moderate" | "complex"
}

export interface AgentScaffoldPreview {
  agent_slug: string
  display_name: string
  agent_type: string
  instruction_scaffold: string
  json_resource: Record<string, unknown>
}

export interface ToolStubPreview {
  tool_name: string
  display_name: string
  json_resource: Record<string, unknown>
}

export interface AppScaffoldResponse {
  request_id: string
  download_url: string
  zip_filename: string
  app_display_name: string
  agent_count: number
  tool_stub_count: number
  agent_previews: AgentScaffoldPreview[]
  tool_previews: ToolStubPreview[]
  environment_vars: string[]
  architecture_summary: string
  generation_timestamp: string
}
