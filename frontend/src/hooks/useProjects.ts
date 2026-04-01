import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import api from "@/services/api"
import { useAuthStore } from "@/store/authStore"
import type { CESApp } from "@/types/ces"

export interface GCPProject {
  project_id: string
  display_name: string
  state: string
  project_number: string
}

export function useProjects() {
  const { isAuthenticated } = useAuthStore()
  const [projects, setProjects] = useState<GCPProject[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    setIsLoading(true)
    setError(null)
    api
      .get("/projects")
      .then((r) => setProjects(r.data.projects ?? []))
      .catch((e) => {
        const msg = e?.response?.data?.detail ?? "Failed to load projects"
        setError(msg)
      })
      .finally(() => setIsLoading(false))
  }, [isAuthenticated])

  return { projects, isLoading, error }
}

export function useApps(projectId: string | null) {
  return useQuery<{ apps: CESApp[]; warning?: string }>({
    queryKey: ["apps", projectId],
    queryFn: () => api.get(`/projects/${projectId}/apps`).then((r) => r.data),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000,
  })
}
