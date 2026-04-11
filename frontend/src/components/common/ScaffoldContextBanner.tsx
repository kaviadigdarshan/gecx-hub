import { useState } from "react";
import { Info, X, ChevronDown, ChevronUp } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { useUIStore } from "@/store/uiStore";
import { useScaffoldContext } from "@/hooks/useScaffoldContext";

interface ScaffoldContextBannerProps {
  onClear?: () => void; // called after context is cleared (use to reset the local form)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function ScaffoldContextBanner({ onClear }: ScaffoldContextBannerProps) {
  const { scaffoldContext, setScaffoldContext } = useProjectStore();
  const contextSyncStatus = useUIStore((s) => s.contextSyncStatus);
  const { saveContext } = useScaffoldContext();
  const [expanded, setExpanded] = useState(false);

  if (!scaffoldContext) return null;

  const handleClear = () => {
    setScaffoldContext(null);
    onClear?.();
  };

  const agentCount = scaffoldContext.agents.length;

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-3 mb-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Info className="text-blue-500 mt-0.5 shrink-0" size={16} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-800">
              Pre-filled from scaffold:{" "}
              <span className="font-semibold">{scaffoldContext.appDisplayName}</span>
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              {scaffoldContext.businessDomain} · {agentCount} agent{agentCount !== 1 ? "s" : ""} ·
              scaffolded {timeAgo(scaffoldContext.createdAt)}
            </p>

            {expanded && agentCount > 0 && (
              <ul className="mt-2 space-y-0.5">
                {scaffoldContext.agents.map((a) => (
                  <li key={a.slug} className="text-xs text-blue-700">
                    •{" "}
                    <span className="font-medium">{a.name}</span> — {a.roleSummary}
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? "Hide agents" : `View ${agentCount} agent${agentCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {contextSyncStatus === 'pending' && (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#e65100' }}>
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: '#e65100' }}
              />
              Saving context…
            </span>
          )}
          {contextSyncStatus === 'error' && scaffoldContext && (
            <button
              type="button"
              onClick={() => saveContext(scaffoldContext)}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
            >
              <span className="inline-block w-2 h-2 rounded-full bg-red-600" />
              Context save failed — retry?
            </button>
          )}
          <button
            type="button"
            onClick={handleClear}
            className="text-blue-400 hover:text-blue-600 p-1"
            title="Clear context and use standalone mode"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
