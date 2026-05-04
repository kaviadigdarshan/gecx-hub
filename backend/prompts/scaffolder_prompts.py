"""Prompt templates for the App Scaffolder accelerator."""


def build_global_instruction(company: str, keywords: str) -> str:
    """Build a placeholder globalInstruction string for a CES app.

    Intentionally simple — the real globalInstruction is refined via
    Accelerator 2 (Instruction Architect).
    """
    return (
        f"You are a customer service AI agent representing {company}. "
        f"Always maintain a {keywords} tone in all interactions. "
        "Never claim to be human. Identify yourself as an AI assistant when asked. "
        "[CONFIGURE: Add company-wide behavioral rules, compliance requirements, and "
        "brand guidelines here. Use Accelerator 2 (Instruction Architect) to generate "
        "refined instructions.]"
    )
