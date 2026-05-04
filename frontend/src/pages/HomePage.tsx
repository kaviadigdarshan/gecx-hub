import { Link } from "react-router-dom"
import AppShell from "@/components/layout/AppShell"
import { useProjectStore } from "@/store/projectStore"
import type { ScaffoldContext } from "@/types/scaffoldContext"

function RocketIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-8 h-8 text-gecx-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.63 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
      />
    </svg>
  )
}

function WrenchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-8 h-8 text-gecx-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.654-4.655m5.908-6.61a9 9 0 0 1 8.355 8.354 5.25 5.25 0 0 1-10.233 2.33c-.568.17-1.16.266-1.783.266a5.25 5.25 0 0 1 0-10.5c.623 0 1.215.096 1.783.266a9.013 9.013 0 0 1 0 0Z"
      />
    </svg>
  )
}

function nextIncompleteStep(ctx: ScaffoldContext): string {
  const allInstructionsApplied = ctx.agents.every((a) => a.instructionApplied)
  if (!allInstructionsApplied) return "/instructions"
  if (!ctx.guardrailsApplied) return "/guardrails"
  return "/guardrails"
}

const ACCELERATOR_TOOLS = [
  { label: "App Scaffolder", href: "/scaffolder", description: "Generate AppSnapshot ZIP" },
  { label: "Instruction Architect", href: "/instructions", description: "Author per-agent instructions" },
  { label: "Guardrails Generator", href: "/guardrails", description: "Configure safety policies" },
] as const

export default function HomePage() {
  const scaffoldContext = useProjectStore((s) => s.scaffoldContext)
  const isDemoMode = useProjectStore((s) => s.isDemoMode)
  const selectedApp = useProjectStore((s) => s.selectedApp)
  const hasContext = scaffoldContext !== null

  // Canonical display name: prefer the GCP app name so the banner always
  // shows what the project selector shows, not the potentially-stale
  // appDisplayName baked into the scaffold context.
  const appDisplayName =
    selectedApp?.displayName ?? scaffoldContext?.appDisplayName ?? "My App"

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Welcome header */}
        <div>
          <h1 className="font-display font-semibold text-3xl text-gecx-900 tracking-tight">
            GECX Accelerator Hub
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Build, instruct, and safeguard CX agents on Google Agent Studio.
          </p>
        </div>

        {/* Current project banner */}
        {hasContext && (
          <div className="flex items-center justify-between rounded-xl border border-gecx-200 bg-gecx-50 px-5 py-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-gecx-500">
                  Current project
                </p>
                {isDemoMode && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                    Demo
                  </span>
                )}
              </div>
              <p className="font-semibold text-gecx-900">{appDisplayName}</p>
              <p className="text-sm text-gray-500">
                {scaffoldContext.agents.length}{" "}
                {scaffoldContext.agents.length === 1 ? "agent" : "agents"} configured
              </p>
            </div>
            <Link
              to={nextIncompleteStep(scaffoldContext)}
              className="flex items-center gap-1 rounded-lg bg-gecx-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-gecx-700"
            >
              Continue
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}

        {/* Two-card grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Card 1: Start a New Project */}
          <Link
            to="/scaffolder"
            className="group flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-gecx-300 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gecx-50 group-hover:bg-gecx-100 transition">
              <RocketIcon />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-gray-900">Start a New Project</h2>
              <p className="mt-1 text-sm text-gray-500">
                Scaffold a multi-agent CX app from scratch. Generate the AppSnapshot ZIP
                ready for Google Agent Studio.
              </p>
              {isDemoMode && (
                <p className="mt-2 text-xs text-amber-600">
                  Demo mode — generated output will not be saved to GCP.
                </p>
              )}
            </div>
          </Link>

          {/* Card 2: Use a Tool */}
          <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gecx-50">
              <WrenchIcon />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-gray-900">Use a Tool</h2>
              <p className="mt-1 text-sm text-gray-500">
                Jump directly into an accelerator tool.
              </p>
            </div>
            <div className="mt-auto grid grid-cols-1 gap-2">
              {ACCELERATOR_TOOLS.map((tool) => (
                <Link
                  key={tool.href}
                  to={tool.href}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm transition hover:border-gecx-200 hover:bg-gecx-50"
                >
                  <div>
                    <p className="font-medium text-gray-800">{tool.label}</p>
                    <p className="text-xs text-gray-400">{tool.description}</p>
                  </div>
                  <span className="text-gecx-400 text-xs">→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
