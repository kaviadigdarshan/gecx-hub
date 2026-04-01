# Instruction Architect Rules
- Form fields are pre-filled from ScaffoldContext per-agent data
- Instructions are LLM-native: natural language, not intent-based
- Output: instruction string suitable for CX Agent Studio agent config
- Reads ScaffoldContext.agents[] to populate per-agent forms
