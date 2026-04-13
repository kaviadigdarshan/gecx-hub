import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { apiClient } from "@/services/api";
import type { ScaffoldContext } from "@/types/scaffoldContext";

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
  const [isLoading, setIsLoading] = useState(false);
  const [gcsLoaded, setGcsLoaded] = useState(false);

  // Reset the GCS-loaded guard whenever the selected project changes so that
  // switching projects always triggers a fresh fetch.
  useEffect(() => {
    setGcsLoaded(false);
    useUIStore.getState().setContextLoadStatus('idle');
  }, [selectedProject?.projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // GCS load: only fires when:
  //   1. A project is selected and the user is authenticated
  //   2. No context is present (Zustand persist has nothing for this project)
  //   3. We haven't already loaded from GCS this session (gcsLoaded guard)
  // If context is already present (from Zustand persist), mark it as 'local'
  // and skip the network call entirely.
  useEffect(() => {
    if (!selectedProject || !isAuthenticated) return;

    if (scaffoldContext !== null) {
      // Context came from Zustand persist — mark as local cache, skip GCS.
      if (!gcsLoaded) {
        useUIStore.getState().setContextLoadStatus('local');
        setGcsLoaded(true);
      }
      return;
    }

    if (gcsLoaded) return;

    setIsLoading(true);
    useUIStore.getState().setContextLoadStatus('loading');

    apiClient
      .get(`/context/${selectedProject.projectId}`)
      .then((r) => {
        if (r.data) {
          setScaffoldContext(normalizeContext(r.data));
          useUIStore.getState().setContextLoadStatus('gcs');
        } else {
          useUIStore.getState().setContextLoadStatus('idle');
        }
      })
      .catch((e: { response?: { status?: number } }) => {
        if (e?.response?.status !== 404) {
          console.warn("Context load error:", e);
        }
        useUIStore.getState().setContextLoadStatus('idle');
      })
      .finally(() => {
        setIsLoading(false);
        setGcsLoaded(true);
      });
  // scaffoldContext is intentionally included so we catch the persist-restored case.
  }, [selectedProject?.projectId, isAuthenticated, scaffoldContext, gcsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Force-reload from GCS: clears context and resets guard so the load effect re-fires.
  const loadSource = () => {
    setScaffoldContext(null);
    setGcsLoaded(false);
  };

  // Save to backend (GCS via API).
  const saveContext = async (ctx: ScaffoldContext) => {
    if (!selectedProject) return;
    setScaffoldContext(ctx);
    const { setContextSyncStatus } = useUIStore.getState();
    setContextSyncStatus('pending');
    try {
      await apiClient.put(`/context/${selectedProject.projectId}`, ctx);
      setContextSyncStatus('synced');
    } catch (e) {
      setContextSyncStatus('error');
      console.warn("Context save failed — changes saved locally only", e);
    }
  };

  return {
    scaffoldContext,
    hasScaffold: !!scaffoldContext,
    isLoading,
    loadSource,
    saveContext,
  };
}
