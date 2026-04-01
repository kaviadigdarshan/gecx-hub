import { create } from "zustand"
import { persist } from "zustand/middleware"

interface AuthUser {
  email: string
  name: string
  picture?: string
}

interface AuthStore {
  token: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  isDemoMode: boolean
  setAuth: (token: string, user: AuthUser) => void
  clearAuth: () => void
  setLoading: (v: boolean) => void
  enableDemoMode: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isDemoMode: false,
      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      clearAuth: () => {
        sessionStorage.removeItem("gecx_demo_mode")
        set({ token: null, user: null, isAuthenticated: false, isDemoMode: false })
      },
      setLoading: (v) => set({ isLoading: v }),
      enableDemoMode: () => {
        sessionStorage.setItem("gecx_demo_mode", "true")
        set({
          token: "demo-token",
          user: { email: "demo@gecx-hub.dev", name: "Demo User" },
          isAuthenticated: true,
          isDemoMode: true,
        })
      },
    }),
    {
      name: "gecx-auth",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
