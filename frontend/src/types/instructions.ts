export interface IdentityForm {
  agent_name: string;
  agent_purpose: string;
  agent_type: "root_agent" | "sub_agent";
  parent_agent_context: string;
}

export interface PersonaForm {
  persona_name: string;
  tone: string;
  brand_voice_keywords: string[];
  language: string;
  company_name: string;
}

export interface ScopeForm {
  primary_goals: string[];
  out_of_scope_topics: string[];
  escalation_triggers: string[];
  escalation_target: string;
}

export interface ToolEntry {
  tool_name: string;
  tool_description: string;
  when_to_use: string;
}

export interface ToolsForm {
  tools: ToolEntry[];
}

export interface SubAgentEntry {
  agent_name: string;
  agent_capability: string;
  delegation_condition: string;
}

export interface SubAgentsForm {
  sub_agents: SubAgentEntry[];
}

export interface ErrorHandlingForm {
  fallback_response: string;
  max_retries: number;
  retry_message: string;
}

export interface InstructionFormData {
  identity: IdentityForm;
  persona: PersonaForm;
  scope: ScopeForm;
  tools: ToolsForm;
  subAgents: SubAgentsForm;
  errorHandling: ErrorHandlingForm | null;
}

export interface InstructionPushResult {
  instruction: string;
  char_count: number;
  agent_resource_name?: string;
}

export const defaultFormData: InstructionFormData = {
  identity: {
    agent_name: "",
    agent_purpose: "",
    agent_type: "sub_agent",
    parent_agent_context: "",
  },
  persona: {
    persona_name: "",
    tone: "friendly_professional",
    brand_voice_keywords: [],
    language: "en-US",
    company_name: "",
  },
  scope: {
    primary_goals: [],
    out_of_scope_topics: [],
    escalation_triggers: [],
    escalation_target: "human customer service agent",
  },
  tools: {
    tools: [],
  },
  subAgents: {
    sub_agents: [],
  },
  errorHandling: null,
};
