import { useState } from "react";
import {
  Home,
  Layers,
  GitBranch,
  Wrench,
  FileText,
  Shield,
  Users,
  BarChart2,
  Rocket,
  Activity,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle,
  Circle,
  Settings,
  Zap,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useUIStore } from "@/store/uiStore";
import { useProjectStore } from "@/store/projectStore";
import type { ScaffoldContext } from "@/types/scaffoldContext";
import { hasPipelineProgress, getIncompleteAgents } from "@/utils/contextUtils";


interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  built: boolean;
  path?: string;
  comingSoon?: boolean;
}


interface NavGroup {
  group: string;
  items: NavItem[];
}


const NAV_GROUPS: NavGroup[] = [
  {
    group: "Build",
    items: [
      {
        id: "scaffolder",
        label: "App Scaffolder",
        icon: Layers,
        description: "Generate multi-agent app topology",
        built: true,
        path: "/scaffolder",
      },
      {
        id: "topology",
        label: "Topology Designer",
        icon: GitBranch,
        description: "Refine agent topology at scale",
        built: false,
        comingSoon: true,
      },
      {
        id: "tools",
        label: "Tool Schema Builder",
        icon: Wrench,
        description: "Generate OpenAPI tool definitions",
        built: false,
        comingSoon: true,
      },
      {
        id: "instructions",
        label: "Instruction Architect",
        icon: FileText,
        description: "Craft agent instructions",
        built: true,
        path: "/instructions",
      },
      {
        id: "callbacks",
        label: "Callback Accelerator",
        icon: Zap,
        description: "Generate ADK callback code per agent",
        built: true,
        path: "/callbacks",
      },
      {
        id: "tools-configurator",
        label: "Tools Configurator",
        icon: Settings,
        description: "Define data stores and APIs for agents",
        built: true,
        path: "/tools-configurator",
      },
      {
        id: "guardrails",
        label: "Guardrails Generator",
        icon: Shield,
        description: "Configure safety guardrails",
        built: true,
        path: "/guardrails",
      },
    ],
  },
  {
    group: "Test",
    items: [
      {
        id: "personas",
        label: "Personas Builder",
        icon: Users,
        description: "Build user persona profiles",
        built: false,
        comingSoon: true,
      },
      {
        id: "evaluation",
        label: "Evaluation Dashboard",
        icon: BarChart2,
        description: "Run and review evaluations",
        built: false,
        comingSoon: true,
      },
    ],
  },
  {
    group: "Operate",
    items: [
      {
        id: "promotion",
        label: "Environment Promotion",
        icon: Rocket,
        description: "Promote app between environments",
        built: false,
        comingSoon: true,
      },
      {
        id: "auditor",
        label: "Health Auditor",
        icon: Activity,
        description: "Audit agent health across app",
        built: false,
        comingSoon: true,
      },
    ],
  },
];


// ── Status dot helpers ─────────────────────────────────────────────────────────
type DotStatus = "complete" | "partial" | "none";

function getItemStatus(id: string, ctx: ScaffoldContext | null): DotStatus {
  if (!ctx) return "none";
  switch (id) {
    case "scaffolder":
      return "complete"; // ctx existing means scaffold ran
    case "instructions": {
      const total = ctx.agents.length;
      if (total === 0) return "none";
      const applied = ctx.agents.filter((a) => a.instructionApplied).length;
      if (applied === total) return "complete";
      if (applied > 0) return "partial";
      return "none";
    }
    case "guardrails":
      return ctx.guardrailsApplied ? "complete" : "none";
    case "callbacks":
      return ctx.callbacksGenerated ? "complete" : "none";
    default:
      return "none";
  }
}

function StatusDot({ status }: { status: DotStatus }) {
  if (status === "none") return null;
  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${
        status === "complete" ? "bg-green-400" : "bg-amber-400"
      }`}
    />
  );
}


// ── Pipeline steps: exactly 4 to match test expectations ──────────────────────
interface PipelineStep {
  label: string;
  acceleratorId: string;
  complete: (ctx: ScaffoldContext) => boolean;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    label: "App Scaffolder",
    acceleratorId: "scaffolder",
    complete: (ctx) => ctx.agents.length > 0,
  },
  {
    label: "Instruction Architect",
    acceleratorId: "instructions",
    complete: (ctx) => ctx.agents.some((a) => a.instructionApplied),
  },
  {
    label: "Guardrails Generator",
    acceleratorId: "guardrails",
    complete: (ctx) => ctx.guardrailsApplied === true,
  },
  {
    label: "Callback Accelerator",
    acceleratorId: "callbacks",
    complete: (ctx) => ctx.callbacksGenerated === true,
  },
];

const getPipelineProgress = (ctx: ScaffoldContext) => {
  const done = PIPELINE_STEPS.filter((s) => s.complete(ctx)).length;
  return { steps: PIPELINE_STEPS.length, done };
};


export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { scaffoldContext, setActiveInstructionAgent } = useProjectStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [showRoadmap, setShowRoadmap] = useState(false);

  const width = sidebarCollapsed ? "w-16" : "w-[260px]";

  // Collect all roadmap items (built: false) from all groups
  const roadmapItems = NAV_GROUPS.flatMap((g) => g.items.filter((i) => !i.built));

  // Built items per group (for main nav rendering)
  const builtGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.built),
  })).filter((g) => g.items.length > 0);

  // Collapsed progress dot
  const collapsedDot = (() => {
    if (!scaffoldContext || !hasPipelineProgress(scaffoldContext)) return null;
    const { steps, done } = getPipelineProgress(scaffoldContext);
    const allDone = done >= steps;
    return (
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${allDone ? "bg-green-400" : "bg-amber-400"}`}
        title={allDone ? "All steps complete" : `${done}/${steps} steps complete`}
      />
    );
  })();

  return (
    <aside
      className={`${width} shrink-0 h-full bg-white border-r border-gray-100 flex flex-col transition-all duration-200 overflow-hidden`}
    >
      {/* Accelerator nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">

        {/* Home link */}
        <Link
          to="/home"
          title={sidebarCollapsed ? "Home" : undefined}
          className={[
            "flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-sm transition mb-1",
            location.pathname === "/home"
              ? "bg-gecx-50 text-gecx-700 border-l-2 border-gecx-600 pl-[6px]"
              : "text-gray-600 hover:bg-gray-50 border-l-2 border-transparent pl-[6px]",
          ].join(" ")}
        >
          <Home size={16} className="shrink-0" />
          {!sidebarCollapsed && (
            <span className="text-sm font-medium truncate leading-tight">Home</span>
          )}
        </Link>

        {/* Built accelerator items */}
        {builtGroups.map(({ group, items }, groupIdx) => (
          <div key={group}>
            {!sidebarCollapsed && (
              <p
                className={`px-3 py-2 text-xs uppercase tracking-wider text-gray-400 font-semibold ${
                  groupIdx === 0 ? "" : "mt-4"
                }`}
              >
                {group}
              </p>
            )}
            {sidebarCollapsed && groupIdx > 0 && (
              <div className="border-t border-gray-100 my-2 mx-2" />
            )}

            {items.map((item) => {
              const { id, label, icon: Icon, path } = item;
              const isActive = path ? location.pathname === path : false;
              const status = getItemStatus(id, scaffoldContext);

              return (
                <Link
                  key={id}
                  to={path ?? "/"}
                  title={sidebarCollapsed ? label : undefined}
                  className={[
                    "flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-sm transition",
                    isActive
                      ? "bg-gecx-50 text-gecx-700 border-l-2 border-gecx-600 pl-[6px]"
                      : "text-gray-600 hover:bg-gray-50 border-l-2 border-transparent pl-[6px]",
                  ].join(" ")}
                >
                  <Icon size={16} className="shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium truncate leading-tight">{label}</p>
                      </div>
                      <StatusDot status={status} />
                    </>
                  )}
                  {sidebarCollapsed && <StatusDot status={status} />}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Roadmap collapsible — hidden when sidebar is collapsed */}
        {!sidebarCollapsed && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowRoadmap((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-wider text-gray-400 font-semibold w-full hover:text-gray-500 transition"
            >
              {showRoadmap ? (
                <ChevronDown size={12} className="shrink-0" />
              ) : (
                <ChevronRight size={12} className="shrink-0" />
              )}
              Roadmap ({roadmapItems.length})
            </button>

            {showRoadmap &&
              roadmapItems.map((item) => {
                const { id, label, icon: Icon } = item;
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-default opacity-50"
                  >
                    <Icon size={16} className="text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-400 truncate leading-tight">{label}</p>
                    </div>
                    <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full shrink-0">
                      Soon
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </nav>

      {/* Project Progress Panel — expanded only */}
      {scaffoldContext && hasPipelineProgress(scaffoldContext) && !sidebarCollapsed && (() => {
        const { steps, done } = getPipelineProgress(scaffoldContext);
        const pendingAgents = scaffoldContext.agents.filter((a) => !a.instructionApplied);

        return (
          <div
            className="border-t border-gray-100 p-3 mt-auto"
            title={done === steps ? "complete" : undefined}
          >
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Pipeline Progress
            </p>

            {PIPELINE_STEPS.map((pStep, idx) => {
              const isComplete = pStep.complete(scaffoldContext);
              const incomplete =
                pStep.acceleratorId === "instructions"
                  ? getIncompleteAgents(scaffoldContext)
                  : [];
              const stepTitle =
                pStep.acceleratorId === "scaffolder"
                  ? `${scaffoldContext.agents.length} agents scaffolded`
                  : pStep.acceleratorId === "instructions"
                  ? incomplete.length > 0
                    ? `Missing: ${incomplete.join(", ")}`
                    : "All agents have instructions"
                  : pStep.acceleratorId === "guardrails"
                  ? scaffoldContext.guardrailsApplied
                    ? `Applied: ${scaffoldContext.guardrailsIndustry}`
                    : "Not yet applied"
                  : undefined;

              return (
                <div key={pStep.acceleratorId}>
                  <div className="flex items-center gap-1.5 py-0.5 group" title={stepTitle}>
                    {isComplete ? (
                      <CheckCircle size={11} className="text-green-500 flex-shrink-0" />
                    ) : (
                      <Circle size={11} className="text-amber-400 flex-shrink-0" />
                    )}
                    <span className="text-[10px] text-gray-400 shrink-0 w-3">{idx + 1}.</span>
                    <span className="text-xs text-gray-500 truncate flex-1 min-w-0">
                      {pStep.label}
                    </span>
                    {!isComplete && (
                      <button
                        onClick={() => navigate(`/${pStep.acceleratorId}`)}
                        aria-label={`Configure ${pStep.label}`}
                        className="text-[10px] text-gecx-500 hover:text-gecx-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 underline"
                      >
                        Go
                      </button>
                    )}
                  </div>
                  {pStep.acceleratorId === "instructions" &&
                    incomplete.length > 0 && (
                      <p className="text-[10px] text-amber-500 pl-7 pb-0.5">
                        Missing: {incomplete.join(", ")}
                      </p>
                    )}
                </div>
              );
            })}

            {pendingAgents.length > 0 && (
              <div className="mt-2 pt-1.5 border-t border-gray-50">
                <p className="text-[10px] text-gray-400 mb-1">Agents needing instructions:</p>
                {pendingAgents.map((agent) => (
                  <div key={agent.slug} className="flex items-center justify-between py-0.5">
                    <span className="text-xs text-gray-500 truncate flex-1 min-w-0">
                      {agent.name}
                    </span>
                    <button
                      aria-label={`Configure ${agent.name}`}
                      onClick={() => {
                        setActiveInstructionAgent(agent.slug);
                        navigate("/instructions");
                      }}
                      className="text-[10px] text-gecx-500 hover:text-gecx-700 flex-shrink-0 underline ml-1"
                    >
                      Configure
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 pt-1.5 border-t border-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-400">{done}/{steps} complete</span>
                <span className="text-[10px] text-gray-400">
                  {Math.round((done / steps) * 100)}%
                </span>
              </div>
              <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gecx-500 rounded-full transition-all duration-500"
                  style={{ width: `${(done / steps) * 100}%` }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Collapse toggle */}
      <div className="border-t border-gray-100 p-2 flex items-center justify-center gap-2">
        {sidebarCollapsed && collapsedDot}
        <button
          type="button"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gecx-600 hover:bg-gecx-50 transition"
        >
          {sidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
