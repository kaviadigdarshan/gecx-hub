export type CallbackHookType = 'beforeAgent' | 'afterModel' | 'afterTool' | 'beforeModel' | 'afterAgent';

export type VariableDeclaration = {
  name: string;                                   // e.g. 'IS_LOGGED_IN'
  type: 'STRING' | 'BOOLEAN' | 'OBJECT' | 'ARRAY';
  defaultValue?: string | boolean | object | unknown[];
  description?: string;
};

export type ToolDefinition = {
  id: string;                                     // tool name, e.g. 'FAQ_BQ_Datastore_v3'
  type: 'DATASTORE' | 'OPENAPI';
  datastoreSource?: { dataStoreName: string };    // for DATASTORE type
  openApiUrl?: string;                            // for OPENAPI type
};

export type ToolsetDefinition = {
  id: string;                                     // toolset name, e.g. 'cancel_order'
  openApiUrl: string;
  toolIds: string[];                              // specific tool IDs within the toolset
};

export interface AgentContextEntry {
  slug: string;                    // file-safe slug, e.g. "order_support_agent"
  name: string;                    // display name, e.g. "Order Support Agent"
  agentType: "root_agent" | "sub_agent";
  roleSummary: string;             // one-sentence description
  handles: string[];               // capability slugs, e.g. ["returns_refunds"]
  suggestedTools: string[];        // tool name slugs, e.g. ["order_api"]
  persona?: string;                 // set by Acc 3 Step 2 persona dropdown
  instructionApplied: boolean;     // set to true by Acc 2 after PATCH succeeds
  instructionCharCount: number;    // set by Acc 2 after apply
  cesAgentId: string | null;       // set after importApp or manual link
  // NEW (optional — all have backend defaults)
  tools?: string[];
  toolsets?: { toolset: string; toolIds: string[] }[];
  callbackHooks?: CallbackHookType[];
  instructionPath?: string;
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
  // NEW (optional — all have backend defaults)
  variableDeclarations?: VariableDeclaration[];
  guardrailNames?: string[];
  modelSettings?: { model: string; temperature: number };
  toolExecutionMode?: 'PARALLEL' | 'SEQUENTIAL';
  languageCode?: string;
  timeZone?: string;
  tools?: ToolDefinition[];
  toolsets?: ToolsetDefinition[];
  callbacksGenerated?: boolean;
}
