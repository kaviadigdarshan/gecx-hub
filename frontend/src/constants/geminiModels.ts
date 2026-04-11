export const GEMINI_MODELS = [
  { id: "gemini-3.0-flash-001", value: "gemini-3.0-flash-001", label: "gemini-3.0-flash-001 (Recommended)" },
  { id: "gemini-2.5-flash-001", value: "gemini-2.5-flash-001", label: "gemini-2.5-flash-001" },
] as const;

export type GeminiModelId = (typeof GEMINI_MODELS)[number]["id"];