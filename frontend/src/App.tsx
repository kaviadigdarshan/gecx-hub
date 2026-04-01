import { useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { useProjectStore } from "@/store/projectStore"
import { useScaffoldContext } from "@/hooks/useScaffoldContext"
import api from "@/services/api"
import LoginPage from "@/pages/LoginPage"
import AuthCallbackPage from "@/pages/AuthCallbackPage"
import Dashboard from "@/pages/Dashboard"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, clearAuth } = useAuthStore()

  useEffect(() => {
    const token = useAuthStore.getState().token
    if (!token) return
    api.get("/auth/me").catch((err: { response?: { status?: number } }) => {
      if (err?.response?.status === 401) {
        clearAuth()
      }
    })
  }, []) // validate token once on mount

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

// Runs scaffold context side-effects (load from GCS, sync sessionStorage)
// at the top level so they fire on mount and on project/auth changes.
function ScaffoldContextLoader() {
  useScaffoldContext()
  return null
}

// Restores demo mode across page refreshes using sessionStorage.
function DemoModeRestorer() {
  const enableDemoModeAuth = useAuthStore((s) => s.enableDemoMode)
  const enableDemoModeProject = useProjectStore((s) => s.enableDemoMode)
  const isDemoMode = useAuthStore((s) => s.isDemoMode)

  useEffect(() => {
    if (!isDemoMode && sessionStorage.getItem("gecx_demo_mode") === "true") {
      enableDemoModeAuth()
      enableDemoModeProject()
    }
  }, []) // run once on mount

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <DemoModeRestorer />
      <ScaffoldContextLoader />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
