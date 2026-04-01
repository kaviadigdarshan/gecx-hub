import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";

// Geometric diamond "G" mark in gecx-600
function GecxLogoMark() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer diamond */}
      <path d="M24 2L46 24L24 46L2 24Z" fill="#4f46e5" opacity="0.15" />
      {/* Inner diamond */}
      <path d="M24 10L38 24L24 38L10 24Z" fill="#4f46e5" opacity="0.35" />
      {/* Center square rotated */}
      <rect x="18" y="18" width="12" height="12" rx="2" transform="rotate(45 24 24)" fill="#4f46e5" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M19.6 10.23c0-.68-.06-1.36-.17-2H10v3.79h5.4a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 3-4.33 3-7.31z"
        fill="#4285F4"
      />
      <path
        d="M10 20c2.7 0 4.97-.9 6.63-2.43l-3.24-2.51c-.9.6-2.04.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H1.07v2.6A10 10 0 0 0 10 20z"
        fill="#34A853"
      />
      <path
        d="M4.4 11.9A6.02 6.02 0 0 1 4.08 10c0-.66.11-1.3.31-1.9V5.5H1.07A10 10 0 0 0 0 10c0 1.61.39 3.14 1.07 4.5L4.4 11.9z"
        fill="#FBBC05"
      />
      <path
        d="M10 3.96c1.47 0 2.78.5 3.82 1.5l2.86-2.86C14.96.9 12.7 0 10 0A10 10 0 0 0 1.07 5.5L4.4 8.1C5.19 5.72 7.4 3.96 10 3.96z"
        fill="#EA4335"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-gecx-500"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
      />
    </svg>
  );
}

export default function LoginCard() {
  const [loading, setLoading] = useState(false);
  const { initiateLogin } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const error = searchParams.get("error");

  const enableDemoModeAuth = useAuthStore((s) => s.enableDemoMode);
  const enableDemoModeProject = useProjectStore((s) => s.enableDemoMode);

  const handleSignIn = async () => {
    setLoading(true);
    await initiateLogin();
    // page navigates away; loading stays true until redirect
  };

  const handleDemoMode = () => {
    enableDemoModeAuth();
    enableDemoModeProject();
    navigate("/dashboard");
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl px-8 py-10 w-full max-w-md">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mb-6">
        <GecxLogoMark />
        <div className="text-center">
          <h1 className="font-display font-semibold text-2xl text-gecx-900 tracking-tight">
            GECX Accelerator Hub
          </h1>
          <p className="text-sm text-gray-500 mt-1">Powered by Google CX Agent Studio</p>
        </div>
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-400">Sign in to continue</span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">
          {error === "auth_failed"
            ? "Authentication failed. Please try again."
            : error === "no_code"
              ? "No authorization code received from Google."
              : "An error occurred. Please try again."}
        </div>
      )}

      {/* Google sign-in button */}
      <button
        onClick={handleSignIn}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 h-12 rounded-xl border border-gray-200 bg-white px-4 font-medium text-gray-700 transition hover:border-gecx-300 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? <Spinner /> : <GoogleIcon />}
        <span>{loading ? "Redirecting…" : "Continue with Google"}</span>
      </button>

      {/* Separator */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-100" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-300">or</span>
        </div>
      </div>

      {/* Demo mode button */}
      <button
        onClick={handleDemoMode}
        className="flex w-full flex-col items-center justify-center gap-0.5 h-12 rounded-xl border border-gray-200 bg-white px-4 transition hover:border-amber-300 hover:bg-amber-50"
      >
        <span className="text-sm font-medium text-gray-600">Explore without Google account</span>
      </button>
      <p className="text-center text-xs text-gray-400 mt-1.5">
        No GCP account needed — forms and UI only
      </p>

      {/* Footer */}
      <p className="mt-8 text-center text-xs text-gray-400">
        Internal tool — Niveus Solutions
      </p>
    </div>
  );
}
