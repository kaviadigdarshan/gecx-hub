export interface ExtractedField {
  field_name: string;
  value: string;
  confidence: 'high' | 'medium' | 'low';
  source_snippet: string;
}

export interface SourceExtractionResult {
  fields: ExtractedField[];
  raw_text_length: number;
  target_accelerator: string;
}
