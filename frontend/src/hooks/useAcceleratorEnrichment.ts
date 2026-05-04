import { useState } from 'react';
import { apiClient } from '@/services/api';
import type { ExtractedField, SourceExtractionResult } from '@/types/sourceContext';

interface UseAcceleratorEnrichmentReturn {
  isExtracting: boolean;
  extractedFields: ExtractedField[];
  error: string | null;
  extractFromText: (text: string) => Promise<ExtractedField[]>;
  dismissField: (name: string) => void;
}

export function useAcceleratorEnrichment(
  targetAccelerator: string
): UseAcceleratorEnrichmentReturn {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);
  const [error, setError] = useState<string | null>(null);

  const extractFromText = async (text: string): Promise<ExtractedField[]> => {
    setIsExtracting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('source_text', text);
      formData.append('target_accelerator', targetAccelerator);

      const { data } = await apiClient.post<SourceExtractionResult>(
        '/source-extraction/extract',
        formData
      );
      // Guard against demo-mode or malformed responses that omit .fields
      if (!data?.fields) {
        setError('Extraction not available — check backend connection.');
        return [];
      }
      setExtractedFields(data.fields);
      return data.fields;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Extraction failed. Please try again.';
      setError(message);
      return [];
    } finally {
      setIsExtracting(false);
    }
  };

  const dismissField = (name: string): void => {
    setExtractedFields((prev) => prev.filter((f) => f.field_name !== name));
  };

  return { isExtracting, extractedFields, error, extractFromText, dismissField };
}
