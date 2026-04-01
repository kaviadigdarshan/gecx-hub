import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import LoginCard from "@/components/auth/LoginCard"
import { useAuthStore } from "@/store/authStore"
import api from "@/services/api"

// Faint grid pattern as an SVG data URL for the background
const GRID_SVG = `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cpath stroke='%236366f1' stroke-opacity='0.07' d='M0 0h40v40H0z'/%3E%3C/g%3E%3C/svg%3E")`

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [codeError, setCodeError] = useState<string | null>(null)
  const [exchanging, setExchanging] = useState(false)

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code")
    if (!code) return

    setExchanging(true)
    api
      .post<{ token: string; user: { email: string; name: string; picture?: string } }>(
        "/auth/google/callback",
        { code }
      )
      .then(({ data }) => {
        setAuth(data.token, data.user)
        navigate("/", { replace: true })
      })
      .catch(() => {
        setCodeError("Sign-in failed. Please try again.")
        // Remove the code param from the URL so a refresh doesn't re-attempt
        window.history.replaceState({}, "", "/login")
        setExchanging(false)
      })
  }, []) // run once on mount

  if (exchanging) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gecx-50 to-white font-body">
        <p className="text-gray-500 text-sm">Signing you in…</p>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gecx-50 to-white font-body"
      style={{ backgroundImage: GRID_SVG }}
    >
      {codeError && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">
          {codeError}
        </div>
      )}
      <LoginCard />
    </div>
  )
}
