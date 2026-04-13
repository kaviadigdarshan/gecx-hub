import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import api from "@/services/api"

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-10 w-10 text-gecx-500"
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Loading"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
      />
    </svg>
  )
}

export default function AuthCallbackPage() {
  const hasExchanged = useRef(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [callbackError, setCallbackError] = useState<string | null>(null)

  useEffect(() => {
    if (hasExchanged.current) return
    hasExchanged.current = true

    const code = searchParams.get("code")
    if (!code) {
      setCallbackError("Authentication failed — no code received.")
      return
    }

    api
      .post<{ token: string; user: { email: string; name: string; picture?: string } }>(
        "/auth/google/callback",
        { code }
      )
      .then(({ data }) => {
        setAuth(data.token, data.user)
        navigate("/home", { replace: true })
      })
      .catch(() => {
        setCallbackError("Sign-in failed. Please try again.")
      })
  }, []) // run once on mount

  if (callbackError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 font-body">
        <p className="text-red-600 text-sm">{callbackError}</p>
        <a href="/login" className="text-gecx-600 underline text-sm">
          Try again
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 font-body">
      <LoadingSpinner />
      <p className="text-gray-500 text-sm">Completing sign-in…</p>
    </div>
  )
}
