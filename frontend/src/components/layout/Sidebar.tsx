import {
  Layers,
  GitBranch,
  Wrench,
  FileText,
  MessageSquare,
  Shield,
  FlaskConical,
  Users,
  BarChart2,
  Rocket,
  Activity,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle,
  Circle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { useProjectStore } from "@/store/projectStore";
import type { ScaffoldContext } from "@/types/scaffoldContext";

interface NavItem {
  id: string;
  label: string;
  step: number;
  icon: LucideIcon;
  description: string;
  built: boolean;
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
        step: 1,
        icon: Layers,
        description: "Generate multi-agent app topology",
        built: true,
      },
      {
        id: "topology",
        label: "Topology Designer",
        step: 2,
        icon: GitBranch,
        description: "Refine agent topology at scale",
        built: false,
        comingSoon: true,
      },
      {
        id: "tools",
        label: "Tool Schema Builder",
        step: 3,
        icon: Wrench,
        description: "Generate OpenAPI tool definitions",
        built: false,
        comingSoon: true,
      },
      {
        id: "instructions",
        label: "Instruction Architect",
        step: 4,
        icon: FileText,
        description: "Craft agent instructions",
        built: true,
      },
      {
        id: "examples",
        label: "Few-Shot Examples",
        step: 5,
        icon: MessageSquare,
        description: "Build few-shot example sets",
        built: false,
        comingSoon: true,
      },
      {
        id: "guardrails",
        label: "Guardrails Generator",
        step: 6,
        icon: Shield,
        description: "Configure safety guardrails",
        built: true,
      },
    ],
  },
  {
    group: "Test",
    items: [
      {
        id: "testcases",
        label: "Test Case Factory",
        step: 7,
        icon: FlaskConical,
        description: "Generate golden test cases",
        built: false,
        comingSoon: true,
      },
      {
        id: "personas",
        label: "Personas Builder",
        step: 8,
        icon: Users,
        description: "Build user persona profiles",
        built: false,
        comingSoon: true,
      },
      {
        id: "evaluation",
        label: "Evaluation Dashboard",
        step: 9,
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
        step: 10,
        icon: Rocket,
        description: "Promote app between environments",
        built: false,
        comingSoon: true,
      },
      {
        id: "auditor",
        label: "Health Auditor",
        step: 11,
        icon: Activity,
        description: "Audit agent health across app",
        built: false,
        comingSoon: true,
      },
    ],
  },
];

const getCompletionStats = (ctx: ScaffoldContext) => {
  const totalAgents = ctx.agents.length;
  const appliedAgents = ctx.agents.filter((a) => a.instructionApplied).length;
  const steps = 1 + totalAgents + 1; // scaffold + N instructions + guardrails
  const done = 1 + appliedAgents + (ctx.guardrailsApplied ? 1 : 0);
  return { steps, done, totalAgents, appliedAgents };
};

export default function Sidebar() {
  const { activeAccelerator, sidebarCollapsed, setActiveAccelerator, toggleSidebar } =
    useUIStore();
  const { scaffoldContext, setActiveInstructionAgent } = useProjectStore();

  const width = sidebarCollapsed ? "w-16" : "w-[260px]";

  // Collapsed progress dot
  const collapsedDot = (() => {
    if (!scaffoldContext) return null;
    const { steps, done } = getCompletionStats(scaffoldContext);
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
        {NAV_GROUPS.map(({ group, items }, groupIdx) => (
          <div key={group}>
            {/* Group header — hidden when collapsed */}
            {!sidebarCollapsed && (
              <p
                className={`px-3 py-2 text-xs uppercase tracking-wider text-gray-400 font-semibold ${
                  groupIdx === 0 ? "" : "mt-4"
                }`}
              >
                {group}
              </p>
            )}
            {/* Divider in collapsed mode */}
            {sidebarCollapsed && groupIdx > 0 && (
              <div className="border-t border-gray-100 my-2 mx-2" />
            )}

            {items.map(({ id, label, step, icon: Icon, built, comingSoon }) => {
              const isActive = activeAccelerator === id;

              if (comingSoon || !built) {
                return (
                  <div
                    key={id}
                    title={sidebarCollapsed ? `${label} (coming soon)` : undefined}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-default opacity-60"
                  >
                    {/* Step badge — coming soon style */}
                    <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {step}
                    </span>
                    {!sidebarCollapsed && (
                      <>
                        <Icon size={16} className="text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-400 truncate leading-tight">{label}</p>
                        </div>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">
                          Soon
                        </span>
                      </>
                    )}
                    {sidebarCollapsed && (
                      <Icon size={16} className="text-gray-400 shrink-0" />
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={id}
                  type="button"
                  title={sidebarCollapsed ? label : undefined}
                  onClick={() => setActiveAccelerator(id)}
                  className={[
                    "flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-sm transition",
                    isActive
                      ? "bg-gecx-50 text-gecx-700 border-l-2 border-gecx-600 pl-[6px]"
                      : "text-gray-600 hover:bg-gray-50 border-l-2 border-transparent pl-[6px]",
                  ].join(" ")}
                >
                  {/* Step badge — built style */}
                  <span
                    className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                      isActive ? "bg-gecx-600 text-white" : "bg-gecx-600 text-white"
                    }`}
                  >
                    {step}
                  </span>
                  {!sidebarCollapsed && (
                    <>
                      <Icon size={16} className="shrink-0" />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium truncate leading-tight">{label}</p>
                      </div>
                    </>
                  )}
                  {sidebarCollapsed && (
                    <Icon size={16} className="shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Project Progress Panel — expanded only */}
      {scaffoldContext && !sidebarCollapsed && (() => {
        const stats = getCompletionStats(scaffoldContext);
        return (
          <div className="border-t border-gray-100 p-3 mt-auto">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Project Progress
            </p>

            {/* Scaffold — always complete if context exists */}
            <div className="flex items-center gap-1.5 py-0.5">
              <CheckCircle size={11} className="text-green-500 flex-shrink-0" />
              <span className="text-xs text-gray-500 truncate">Scaffold generated</span>
            </div>

            {/* One row per agent */}
            {scaffoldContext.agents.map((agent) => (
              <div key={agent.slug} className="flex items-center gap-1.5 py-0.5 group">
                {agent.instructionApplied ? (
                  <CheckCircle size={11} className="text-green-500 flex-shrink-0" />
                ) : (
                  <Circle size={11} className="text-amber-400 flex-shrink-0" />
                )}
                <span className="text-xs text-gray-500 truncate flex-1 min-w-0">
                  {agent.name}
                </span>
                {!agent.instructionApplied && (
                  <button
                    onClick={() => {
                      setActiveInstructionAgent(agent.slug);
                      setActiveAccelerator("instructions");
                    }}
                    className="text-[10px] text-gecx-500 hover:text-gecx-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 underline"
                  >
                    Configure
                  </button>
                )}
              </div>
            ))}

            {/* Guardrails row */}
            <div className="flex items-center gap-1.5 py-0.5 group">
              {scaffoldContext.guardrailsApplied ? (
                <CheckCircle size={11} className="text-green-500 flex-shrink-0" />
              ) : (
                <Circle size={11} className="text-amber-400 flex-shrink-0" />
              )}
              <span className="text-xs text-gray-500 truncate flex-1 min-w-0">Guardrails</span>
              {!scaffoldContext.guardrailsApplied && (
                <button
                  onClick={() => setActiveAccelerator("guardrails")}
                  className="text-[10px] text-gecx-500 hover:text-gecx-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 underline"
                >
                  Apply
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-2 pt-1.5 border-t border-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-400">
                  {stats.done}/{stats.steps} complete
                </span>
                <span className="text-[10px] text-gray-400">
                  {Math.round((stats.done / stats.steps) * 100)}%
                </span>
              </div>
              <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gecx-500 rounded-full transition-all duration-500"
                  style={{ width: `${(stats.done / stats.steps) * 100}%` }}
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
