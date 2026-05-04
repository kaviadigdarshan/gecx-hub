"""Prompt templates for the Guardrails Generator accelerator."""

GUARDRAIL_NAMES_SYSTEM_INSTRUCTION = (
    "You are a CX Agent Studio expert. "
    "Return only valid JSON with exactly the 5 specified cluster keys."
)


def get_guardrail_names_prompt(vertical: str) -> str:
    """Build the Gemini prompt for generating 22 vertical-specific guardrail names."""
    return (
        f"For a {vertical} CX Agent Studio app, generate 22 guardrail names in 5 clusters: "
        "Safety (4), Compliance (5), Brand/Business (4), Content (5), Experience (4). "
        'Return JSON: { "Safety": [...], "Compliance": [...], "Brand/Business": [...], '
        '"Content": [...], "Experience": [...] }'
    )
