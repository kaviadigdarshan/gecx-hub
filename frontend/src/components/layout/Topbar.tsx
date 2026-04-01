import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import { useAuth } from "@/hooks/useAuth";

function GecxLogoMark() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M24 2L46 24L24 46L2 24Z" fill="#4f46e5" opacity="0.15" />
      <path d="M24 10L38 24L24 38L10 24Z" fill="#4f46e5" opacity="0.35" />
      <rect x="18" y="18" width="12" height="12" rx="2" transform="rotate(45 24 24)" fill="#4f46e5" />
    </svg>
  );
}

function UserAvatar({ name, picture }: { name: string; picture: string | null }) {
  if (picture) {
    return (
      <img
        src={picture}
        alt={name}
        className="h-8 w-8 rounded-full object-cover ring-2 ring-gecx-100"
      />
    );
  }
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="h-8 w-8 rounded-full bg-gecx-100 flex items-center justify-center text-gecx-700 text-xs font-semibold ring-2 ring-gecx-100">
      {initials}
    </div>
  );
}

export default function Topbar() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { logout } = useAuth();
  const { isDemoMode, clearProject } = useProjectStore();
  const navigate = useNavigate();

  const displayName = user?.name
    ? user.name.length > 20
      ? user.name.slice(0, 20) + "…"
      : user.name
    : "";

  const handleExitDemo = () => {
    sessionStorage.removeItem("gecx_demo_mode");
    clearProject();
    clearAuth();
    navigate("/login", { replace: true });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-gray-100 shadow-sm flex items-center px-4 gap-4">
      {/* Left: brand */}
      <div className="flex items-center gap-2 shrink-0">
        <GecxLogoMark />
        <span className="font-display font-semibold text-gecx-900 text-lg leading-none">
          GECX Hub
        </span>
      </div>

      {/* Center: demo pill */}
      <div className="flex-1 flex justify-center">
        {isDemoMode && (
          <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1 text-xs font-medium">
            🔍 Demo Mode — no GCP connected
          </span>
        )}
      </div>

      {/* Right: user info */}
      {user && (
        <div className="flex items-center gap-2 shrink-0">
          {isDemoMode ? (
            <>
              <span className="text-sm text-gray-500 hidden sm:block">Demo User</span>
              <button
                onClick={handleExitDemo}
                className="ml-1 text-xs text-gecx-500 hover:text-gecx-700 hover:underline transition"
              >
                Exit Demo
              </button>
            </>
          ) : (
            <>
              <UserAvatar name={user.name} picture={user.picture ?? null} />
              <span className="text-sm text-gray-700 font-medium hidden sm:block">{displayName}</span>
              <button
                onClick={logout}
                title="Sign out"
                aria-label="Sign out"
                className="ml-1 p-1.5 rounded-lg text-gray-400 hover:text-gecx-600 hover:bg-gecx-50 transition"
              >
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}
