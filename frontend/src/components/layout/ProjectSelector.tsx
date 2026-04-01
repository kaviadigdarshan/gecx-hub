import { useRef, useState, useEffect } from "react"
import { ChevronDown, Check } from "lucide-react"
import { useProjects, useApps } from "@/hooks/useProjects"
import type { GCPProject as APIProject } from "@/hooks/useProjects"
import { useProjectStore } from "@/store/projectStore"
import type { CESApp } from "@/types/ces"

// ── Tiny spinner ─────────────────────────────────────────────────────────────
function MiniSpinner() {
  return (
    <svg
      className="animate-spin h-3.5 w-3.5 text-gecx-500 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
    </svg>
  )
}

// ── Generic dropdown ──────────────────────────────────────────────────────────
interface DropdownItem {
  key: string
  label: string
  disabled?: boolean
  dimmed?: boolean
}

interface DropdownProps {
  placeholder: string
  selectedKey: string | null
  items: DropdownItem[]
  loading?: boolean
  disabled?: boolean
  onSelect: (key: string) => void
}

function Dropdown({ placeholder, selectedKey, items, loading, disabled, onSelect }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const selectedItem = items.find((i) => i.key === selectedKey)
  const triggerLabel = selectedItem?.label ?? placeholder

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={[
          "flex items-center gap-1.5 h-8 px-3 rounded-lg border text-sm font-medium transition",
          "max-w-[220px] min-w-[140px]",
          disabled
            ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
            : "border-gray-200 bg-white text-gray-700 hover:border-gecx-300 hover:shadow-sm",
        ].join(" ")}
      >
        {loading ? (
          <MiniSpinner />
        ) : (
          <span className="truncate flex-1 text-left">{triggerLabel}</span>
        )}
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-64 max-h-72 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg py-1">
          {items.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400 italic">No items</div>
          )}
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled) {
                  onSelect(item.key)
                  setOpen(false)
                }
              }}
              className={[
                "flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition",
                item.disabled || item.dimmed
                  ? "text-gray-400 cursor-default"
                  : "text-gray-700 hover:bg-gecx-50 hover:text-gecx-700",
                selectedKey === item.key ? "bg-gecx-50" : "",
              ].join(" ")}
            >
              <span className="flex-1 truncate">{item.label}</span>
              {selectedKey === item.key && (
                <Check size={13} className="shrink-0 text-gecx-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ProjectSelector ───────────────────────────────────────────────────────────
export default function ProjectSelector() {
  const { selectedProject, selectedApp, setProject, setApp } = useProjectStore()

  // useProjects now returns { projects, isLoading, error } with snake_case API shape
  const { projects, isLoading: projectsLoading } = useProjects()
  const { data: appData, isLoading: appsLoading } = useApps(
    selectedProject?.projectId ?? null
  )

  const projectItems: DropdownItem[] = projects.map((p: APIProject) => ({
    key: p.project_id,
    label: p.display_name,
  }))

  const appItems: DropdownItem[] =
    appData?.warning && (appData.apps ?? []).length === 0
      ? [{ key: "__no_apps__", label: "No CES apps in this project", disabled: true, dimmed: true }]
      : (appData?.apps ?? []).map((a: CESApp) => ({
          key: a.name,
          label: a.displayName,
        }))

  const handleProjectSelect = (projectId: string) => {
    const p = projects.find((p: APIProject) => p.project_id === projectId)
    if (p) {
      // Map snake_case API response → camelCase store type
      setProject({
        projectId: p.project_id,
        displayName: p.display_name,
        projectNumber: p.project_number,
      })
      setApp(null)
    }
  }

  const handleAppSelect = (appName: string) => {
    const app = appData?.apps.find((a: CESApp) => a.name === appName)
    if (app) setApp(app)
  }

  return (
    <div className="flex items-center gap-2">
      <Dropdown
        placeholder="Select project"
        selectedKey={selectedProject?.projectId ?? null}
        items={projectItems}
        loading={projectsLoading}
        onSelect={handleProjectSelect}
      />
      <Dropdown
        placeholder="Select app"
        selectedKey={selectedApp?.name ?? null}
        items={appItems}
        loading={appsLoading}
        disabled={!selectedProject}
        onSelect={handleAppSelect}
      />
    </div>
  )
}
