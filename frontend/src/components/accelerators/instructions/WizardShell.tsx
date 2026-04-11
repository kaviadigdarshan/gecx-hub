import { ScaffoldContextBanner } from "@/components/common/ScaffoldContextBanner";
import type { ScaffoldContext } from "@/types/scaffoldContext";
import { useProjectStore } from "@/store/projectStore";

const STEP_LABELS = [
  "Identity",
  "Persona",
  "Scope",
  "Tools",
  "Sub-Agents",
  "Error Handling",
  "Preview",
];

interface WizardShellProps {
  currentStep: number; // 1-indexed
  onNext: () => void;
  onBack: () => void;
  isNextDisabled?: boolean;
  isFinalStep?: boolean;
  isSubmitting?: boolean;
  nextLabel?: string;
  // Pre-fill banner
  showPreFillBanner: boolean;
  onDismissBanner: () => void;
  selectedAgentSlug: string | null;
  scaffoldContext: ScaffoldContext | null;
  onChangeAgent: () => void;
  children: React.ReactNode;
  accelerator: 'scaffolder' | 'instruction' | 'guardrails';
  onTabChange?: (tabIndex: number) => void;
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
    </svg>
  );
}

export default function WizardShell({
  currentStep,
  onNext,
  onBack,
  isNextDisabled = false,
  isFinalStep = false,
  isSubmitting = false,
  nextLabel,
  showPreFillBanner: _showPreFillBanner,
  onDismissBanner,
  selectedAgentSlug,
  scaffoldContext,
  onChangeAgent,
  children,
  accelerator,
  onTabChange,
}: WizardShellProps) {
  const totalSteps = STEP_LABELS.length;
  const { scaffolderTabState, instructionTabState, guardrailsTabState,
          setActiveTab, markTabVisited } = useProjectStore();
  const tabState = accelerator === 'scaffolder' ? scaffolderTabState
                 : accelerator === 'instruction' ? instructionTabState
                 : guardrailsTabState;

  const handleTabClick = (tabIndex: number) => {
    setActiveTab(accelerator, tabIndex);
    onTabChange?.(tabIndex);
  };

  const handleNext = () => {
    const nextTabIndex = tabState.activeTab + 1;
    if (nextTabIndex < totalSteps) {
      markTabVisited(accelerator, nextTabIndex);
      setActiveTab(accelerator, nextTabIndex);
    }
    onNext();
  };

  const handleBack = () => {
    const prevTabIndex = tabState.activeTab - 1;
    if (prevTabIndex >= 0) {
      setActiveTab(accelerator, prevTabIndex);
    }
    onBack();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Step indicator */}
      <div className="flex items-center gap-1 flex-wrap">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = tabState.activeTab === i;
          const isVisited = tabState.visitedTabs.includes(i);
          return (
            <div key={label} className="flex items-center gap-1">
              <button
                type="button"
                onClick={isVisited ? () => handleTabClick(i) : undefined}
                disabled={!isVisited}
                className={[
                  "text-xs font-medium px-2.5 py-1 rounded-full transition whitespace-nowrap",
                  isActive
                    ? "bg-gecx-600 text-white cursor-default"
                    : isVisited
                    ? "bg-gecx-100 text-gecx-600 cursor-pointer hover:bg-gecx-200"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed",
                ].join(" ")}
              >
                {stepNum}. {label}
                {isVisited && !isActive && (
                  <span style={{ color: '#2ecc71', marginLeft: '4px' }}>✓</span>
                )}
              </button>
              {i < totalSteps - 1 && (
                <span className="text-gray-300 text-xs">›</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Scaffold context banner — shown when an agent is pre-filled from scaffold */}
      {selectedAgentSlug && selectedAgentSlug !== "__manual__" && (
        <ScaffoldContextBanner onClear={onDismissBanner} />
      )}

      {/* Step content */}
      <div>{children}</div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        {/* Left: Change agent link (step 1 only, when scaffold + agent selected) */}
        <div>
          {scaffoldContext && selectedAgentSlug && selectedAgentSlug !== "__manual__" && currentStep === 1 ? (
            <button
              onClick={onChangeAgent}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              ← Change agent
            </button>
          ) : (
            <span /> // spacer
          )}
        </div>

        {/* Right: Back + Next/Submit */}
        <div className="flex items-center gap-2">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              ← Back
            </button>
          )}
          {!isFinalStep && (
            <button
              type="button"
              onClick={handleNext}
              disabled={isNextDisabled || isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gecx-600 text-white text-sm font-semibold hover:bg-gecx-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              {nextLabel ?? "Next →"}
            </button>
          )}
          {isFinalStep && (
            <button
              type="button"
              onClick={handleNext}
              disabled={isNextDisabled || isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gecx-600 text-white text-sm font-semibold hover:bg-gecx-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Spinner />
                  Applying…
                </>
              ) : (
                nextLabel ?? "Apply Instruction →"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
