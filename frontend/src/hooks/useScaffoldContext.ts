import { useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/services/api";
import type { ScaffoldContext } from "@/types/scaffoldContext";

const SESSION_KEY = "gecx_scaffold_context";

/** Fill in defaults for new fields added after initial release. */
function normalizeContext(ctx: ScaffoldContext): ScaffoldContext {
  return {
    ...ctx,
    variableDeclarations: ctx.variableDeclarations ?? [],
    guardrailNames: ctx.guardrailNames ?? [],
    modelSettings: ctx.modelSettings ?? { model: "gemini-2.0-flash-001", temperature: 1.0 },
    toolExecutionMode: ctx.toolExecutionMode ?? "PARALLEL",
    languageCode: ctx.languageCode ?? "en-US",
    timeZone: ctx.timeZone ?? "UTC",
    tools: ctx.tools ?? [],
    toolsets: ctx.toolsets ?? [],
    agents: ctx.agents.map((a) => ({
      ...a,
      tools: a.tools ?? [],
      toolsets: a.toolsets ?? [],
      callbackHooks: a.callbackHooks ?? [],
      instructionPath: a.instructionPath ?? "",
    })),
  };
}

export function useScaffoldContext() {
  const { selectedProject, scaffoldContext, setScaffoldContext } = useProjectStore();
  const { isAuthenticated } = useAuthStore();

  // On project change: try to load context from backend (GCS)
  useEffect(() => {
    if (!selectedProject || !isAuthenticated) return;

    apiClient
      .get(`/context/${selectedProject.projectId}`)
      .then((r) => {
        if (r.data) {
          const normalized = normalizeContext(r.data);
          setScaffoldContext(normalized);
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
        }
      })
      .catch((e: { response?: { status?: number } }) => {
        if (e?.response?.status !== 404) {
          console.warn("Context load error:", e);
        }
        // 404 = no context yet, that is fine
      });
  }, [selectedProject?.projectId, isAuthenticated]);

  // On first app load: restore from sessionStorage if store is empty
  useEffect(() => {
    if (scaffoldContext) return;
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        setScaffoldContext(normalizeContext(JSON.parse(stored)));
      } catch {}
    }
  }, []);

  // Keep sessionStorage in sync with store
  useEffect(() => {
    if (scaffoldContext) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(scaffoldContext));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, [scaffoldContext]);

  // Save to backend (GCS via API)
  const saveContext = async (ctx: ScaffoldContext) => {
    if (!selectedProject) return;
    setScaffoldContext(ctx);
    try {
      await apiClient.put(`/context/${selectedProject.projectId}`, ctx);
    } catch (e) {
      console.warn("Context save failed — changes saved locally only", e);
    }
  };

  return {
    scaffoldContext,
    hasScaffold: !!scaffoldContext,
    saveContext,
  };
}
