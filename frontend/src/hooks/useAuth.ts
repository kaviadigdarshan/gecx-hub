import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import api from "@/services/api"

export function useAuth() {
  const navigate = useNavigate()
  const { setAuth, clearAuth, isAuthenticated } = useAuthStore()

  const initiateLogin = async () => {
    try {
      const { data } = await api.get<{ url: string }>("/auth/google/url")
      window.location.href = data.url
    } catch (err) {
      console.error("Failed to get Google auth URL:", err)
    }
  }

  const handleCallback = async (code: string) => {
    try {
      const { data } = await api.post<{
        token: string
        user: { email: string; name: string; picture?: string }
      }>("/auth/google/callback", { code })
      setAuth(data.token, data.user)
      navigate("/", { replace: true })
    } catch (err) {
      console.error("Auth callback failed:", err)
      navigate("/login?error=auth_failed", { replace: true })
    }
  }

  const logout = async () => {
    clearAuth()
    navigate("/login", { replace: true })
  }

  const checkSession = async (): Promise<boolean> => {
    const token = useAuthStore.getState().token
    if (!token) return false
    try {
      await api.get("/auth/me")
      return true
    } catch {
      clearAuth()
      return false
    }
  }

  return { initiateLogin, handleCallback, logout, checkSession, isAuthenticated }
}
