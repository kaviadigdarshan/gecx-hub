# Guardrails Generator Rules
- Five guardrail types: ContentFilter, LlmPromptSecurity, LlmPolicy,
  ModelSafety, CodeCallback
- Industry vertical is pre-filled from ScaffoldContext.vertical
- Sensitivity levels: Relaxed (high-severity only), Balanced (recommended),
  Strict (regulated industries)
- Output format: valid CX Agent Studio guardrail configuration JSON
- Never use Dialogflow CX guardrail types or patterns
