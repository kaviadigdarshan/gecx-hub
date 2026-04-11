import { useState, useEffect } from "react";
import { CheckCircle, ChevronDown, ChevronUp, Zap, Save } from "lucide-react";
import { apiClient } from "@/services/api";
import { useProjectStore } from "@/store/projectStore";
import { useScaffoldContext } from "@/hooks/useScaffoldContext";
import { ScaffoldContextBanner } from "@/components/common/ScaffoldContextBanner";
import type { AgentContextEntry, CallbackHookType } from "@/types/scaffoldContext";

const HOOK_OPTIONS: { value: CallbackHookType; label: string; description: string }[] = [
  { value: "beforeAgent", label: "Before Agent", description: "Runs before the agent processes the turn. Use to inject session variables." },
  { value: "afterModel", label: "After Model", description: "Runs after the LLM responds. Use to enrich or transform the response." },
  { value: "afterTool", label: "After Tool", description: "Runs after a tool call completes. Use to post-process tool output." },
  { value: "beforeModel", label: "Before Model (root only)", description: "Runs before the LLM call. Root agents only — use to set context vars." },
  { value: "afterAgent", label: "After Agent", description: "Runs after the agent finishes. Use to emit structured custom_output." },
];

interface AgentCallbackState {
  agent: AgentContextEntry;
  selectedHooks: CallbackHookType[];
  generatedCode: Record<string, string>; // hookType -> python code
  isGenerating: boolean;
  isExpanded: boolean;
  error: string | null;
}

interface CallbackGenerateResponse {
  callbacks: Record<string, string>;
  demo_mode: boolean;
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-gray-900 text-green-300 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-64">
      {code}
    </pre>
  );
}

export default function CallbacksPage() {
  const { scaffoldContext, markCallbacksGenerated } = useProjectStore();
  const { saveContext } = useScaffoldContext();

  const [agentStates, setAgentStates] = useState<AgentCallbackState[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialise per-agent state from ScaffoldContext
  useEffect(() => {
    if (!scaffoldContext) return;
    setAgentStates(
      scaffoldContext.agents.map((agent) => ({
        agent,
        selectedHooks: (agent.callbackHooks && agent.callbackHooks.length > 0)
          ? agent.callbackHooks
          : ["beforeAgent"],
        generatedCode: {},
        isGenerating: false,
        isExpanded: false,
        error: null,
      }))
    );
  }, [scaffoldContext?.scaffoldId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateAgentState = (slug: string, patch: Partial<AgentCallbackState>) => {
    setAgentStates((prev) =>
      prev.map((s) => (s.agent.slug === slug ? { ...s, ...patch } : s))
    );
  };

  const toggleHook = (slug: string, hook: CallbackHookType) => {
    setAgentStates((prev) =>
      prev.map((s) => {
        if (s.agent.slug !== slug) return s;
        const next = s.selectedHooks.includes(hook)
          ? s.selectedHooks.filter((h) => h !== hook)
          : [...s.selectedHooks, hook];
        // Always keep at least one hook
        return { ...s, selectedHooks: next.length > 0 ? next : s.selectedHooks };
      })
    );
  };

  const generateForAgent = async (state: AgentCallbackState) => {
    updateAgentState(state.agent.slug, { isGenerating: true, error: null });
    try {
      const res = await apiClient.post<CallbackGenerateResponse>(
        "/accelerators/callbacks/generate",
        {
          agentId: state.agent.cesAgentId ?? state.agent.slug,
          agentName: state.agent.name,
          agentDescription: state.agent.roleSummary,
          hookTypes: state.selectedHooks,
          vertical: scaffoldContext?.businessDomain ?? "generic",
          variableDeclarations: scaffoldContext?.variableDeclarations ?? [],
          sessionId: scaffoldContext?.scaffoldId,
        }
      );
      updateAgentState(state.agent.slug, {
        generatedCode: res.data.callbacks,
        isGenerating: false,
        isExpanded: true,
      });
    } catch {
      updateAgentState(state.agent.slug, {
        isGenerating: false,
        error: "Failed to generate callbacks. Try again.",
      });
    }
  };

  const handleSaveAll = async () => {
    if (!scaffoldContext) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const agentCallbacks = agentStates
      .filter((s) => Object.keys(s.generatedCode).length > 0)
      .map((s) => ({
        agentId: s.agent.cesAgentId ?? s.agent.slug,
        agentSlug: s.agent.slug,
        callbacks: s.generatedCode,
      }));

    try {
      await apiClient.post("/accelerators/callbacks/write-to-scaffold", {
        sessionId: scaffoldContext.scaffoldId,
        agentCallbacks,
      });
      markCallbacksGenerated();
      // Persist updated context to GCS
      setTimeout(async () => {
        const updated = useProjectStore.getState().scaffoldContext;
        if (updated) await saveContext(updated);
      }, 0);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError("Failed to save callbacks. Changes stored locally — try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const anyGenerated = agentStates.some((s) => Object.keys(s.generatedCode).length > 0);

  if (!scaffoldContext) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-400">
          Run the App Scaffolder first to generate an agent topology, then come back here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ScaffoldContextBanner />

      {/* Agent cards */}
      <div className="space-y-3">
        {agentStates.map((state) => {
          const isRoot = state.agent.agentType === "root_agent";
          const hasCode = Object.keys(state.generatedCode).length > 0;

          return (
            <div
              key={state.agent.slug}
              className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden"
            >
              {/* Card header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isRoot ? "bg-gecx-100" : "bg-gray-100"
                  }`}
                >
                  <Zap
                    size={14}
                    className={isRoot ? "text-gecx-600" : "text-gray-500"}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">
                      {state.agent.name}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isRoot
                          ? "bg-gecx-100 text-gecx-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {isRoot ? "ROOT" : "SUB"}
                    </span>
                    {hasCode && (
                      <CheckCircle size={13} className="text-green-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {state.agent.roleSummary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateAgentState(state.agent.slug, {
                      isExpanded: !state.isExpanded,
                    })
                  }
                  className="text-gray-400 hover:text-gray-600 transition shrink-0"
                >
                  {state.isExpanded ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>
              </div>

              {/* Expanded body */}
              {state.isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                  {/* Hook selector */}
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">
                      Select callback hooks
                    </p>
                    <div className="space-y-1.5">
                      {HOOK_OPTIONS.filter(
                        (h) => isRoot || h.value !== "beforeModel"
                      ).map((hook) => {
                        const checked = state.selectedHooks.includes(hook.value);
                        return (
                          <label
                            key={hook.value}
                            className="flex items-start gap-2.5 cursor-pointer group"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleHook(state.agent.slug, hook.value)}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-gecx-600 focus:ring-gecx-500"
                            />
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-gray-700">
                                {hook.label}
                              </span>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {hook.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Generate button */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => generateForAgent(state)}
                      disabled={state.isGenerating}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gecx-600 text-white text-sm font-medium hover:bg-gecx-700 disabled:opacity-50 transition"
                    >
                      {state.isGenerating ? (
                        <>
                          <svg
                            className="animate-spin h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
                            />
                          </svg>
                          Generating…
                        </>
                      ) : (
                        <>
                          <Zap size={14} />
                          {hasCode ? "Re-generate" : "Generate Callbacks"}
                        </>
                      )}
                    </button>
                    {state.error && (
                      <span className="text-xs text-red-500">{state.error}</span>
                    )}
                  </div>

                  {/* Generated code preview */}
                  {hasCode && (
                    <div className="space-y-3">
                      {Object.entries(state.generatedCode).map(([hook, code]) => (
                        <div key={hook}>
                          <p className="text-xs font-medium text-gray-500 mb-1">
                            {hook}
                          </p>
                          <CodeBlock code={code} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-3">
          {saveError && (
            <span className="text-sm text-red-600">{saveError}</span>
          )}
          {saveSuccess && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle size={14} /> Callbacks saved to scaffold
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={isSaving || !anyGenerated}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gecx-600 text-white text-sm font-semibold hover:bg-gecx-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
        >
          {isSaving ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
                />
              </svg>
              Saving…
            </>
          ) : (
            <>
              <Save size={15} />
              Accept & Save to Scaffold
            </>
          )}
        </button>
      </div>
    </div>
  );
}
