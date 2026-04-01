export interface AgentContextEntry {
  slug: string;                    // file-safe slug, e.g. "order_support_agent"
  name: string;                    // display name, e.g. "Order Support Agent"
  agentType: "root_agent" | "sub_agent";
  roleSummary: string;             // one-sentence description
  handles: string[];               // capability slugs, e.g. ["returns_refunds"]
  suggestedTools: string[];        // tool name slugs, e.g. ["order_api"]
  instructionApplied: boolean;     // set to true by Acc 2 after PATCH succeeds
  instructionCharCount: number;    // set by Acc 2 after apply
  cesAgentId: string | null;       // set after importApp or manual link
}

export interface ToolContextEntry {
  toolName: string;                // slug, e.g. "order_api"
  displayName: string;             // e.g. "Order Management API"
  baseUrlEnvVar: string;           // e.g. "ORDER_API_BASE_URL"
  authType: "api_key" | "oauth" | "none";
  cesToolId: string | null;
}

export interface ScaffoldContext {
  scaffoldId: string;
  appDisplayName: string;
  businessDomain: string;          // "retail" | "bfsi" | "healthcare" | etc.
  channel: string;                 // "web_chat" | "voice" | "both"
  companyName: string;
  expectedCapabilities: string[];
  decompositionStrategy: string;
  rootAgentStyle: string;
  agents: AgentContextEntry[];
  toolStubs: ToolContextEntry[];
  environmentVars: string[];
  guardrailsApplied: boolean;
  guardrailsIndustry: string | null;
  createdAt: string;
  lastUpdatedAt: string;
  generatedZipFilename: string;
}
