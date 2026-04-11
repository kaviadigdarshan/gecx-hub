export type SourceInputType = 'file_upload' | 'clipboard_text';

export interface ExtractedSubAgent {
  name: string;
  purpose: string;
  tools_needed: string[];
}

export interface ExtractedSessionVariable {
  name: string;
  description: string;
}

export interface ExtractedTool {
  name: string;
  description: string;
  api_type: string;
}

export interface SourceExtractionSuccess {
  primary_use_case: string;
  industry_vertical: string;
  root_agent_name: string;
  root_agent_purpose: string;
  sub_agents: ExtractedSubAgent[];
  persona_tone?: string;
  in_scope: string[];
  out_of_scope: string[];
  session_variables: ExtractedSessionVariable[];
  tools_required: ExtractedTool[];
  guardrail_topics: string[];
  blocked_phrases: string[];
  assumptions: string[];
  extraction_confidence: string;
}

export interface SourceExtractionError {
  error: true;
  missing_required: string[];
  message: string;
}

export interface SourceExtractionRequest {
  input_type: SourceInputType;
  text_content?: string;
  file_content_base64?: string;
  filename?: string;
}

export interface SourceExtractionResponse {
  success: boolean;
  data?: SourceExtractionSuccess;
  error?: SourceExtractionError;
}
