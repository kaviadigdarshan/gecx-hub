import type { ScaffoldContext } from '@/types/scaffoldContext'

export function hasContext(ctx: ScaffoldContext | null | undefined): ctx is ScaffoldContext {
  return ctx != null && typeof ctx.scaffoldId === 'string' && ctx.scaffoldId.length > 0
}

export function getAgents(ctx: ScaffoldContext | null | undefined) {
  return ctx?.agents ?? []
}

export function hasPipelineProgress(ctx: ScaffoldContext | null | undefined): boolean {
  if (!hasContext(ctx)) return false
  return ctx.agents.some((a) => a.instructionApplied) || ctx.guardrailsApplied
}

export function getIncompleteAgents(ctx: ScaffoldContext | null | undefined): string[] {
  if (!hasContext(ctx)) return []
  return ctx.agents.filter((a) => !a.instructionApplied).map((a) => a.name)
}
