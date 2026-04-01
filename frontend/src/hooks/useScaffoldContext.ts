import { useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/services/api";
import type { ScaffoldContext } from "@/types/scaffoldContext";

const SESSION_KEY = "gecx_scaffold_context";

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
          setScaffoldContext(r.data);
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(r.data));
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
        setScaffoldContext(JSON.parse(stored));
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
