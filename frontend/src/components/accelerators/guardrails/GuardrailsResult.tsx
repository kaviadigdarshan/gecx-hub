import { useState } from "react";
import { Download, CheckCircle, XCircle, ArrowLeft, RotateCcw, Upload } from "lucide-react";
import { saveAs } from "file-saver";
import JSZip from "jszip";

import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import { useScaffoldContext } from "@/hooks/useScaffoldContext";
import { apiClient } from "@/services/api";
import type {
  GuardrailPreviewItem,
  GuardrailsGenerateResponse,
  GuardrailsApplyResponse,
  GuardrailApplyResult,
} from "@/types/accelerators";
import IndustryPresetBadge from "./IndustryPresetBadge";
import type { IndustryVertical } from "@/types/accelerators";


function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
    </svg>
  );
}

interface GuardrailsResultProps {
  generateResponse: GuardrailsGenerateResponse;
  enabledItems: GuardrailPreviewItem[];
  industryVertical: string;
  onBack: () => void;
  onReset: () => void;
}

async function downloadDemoZip(
  enabledItems: GuardrailPreviewItem[],
  zipFilename: string
): Promise<void> {
  const zip = new JSZip();

  for (const item of enabledItems) {
    const filename = item.guardrail_type.toLowerCase().replace(/\s+/g, "_") + ".json";
    zip.file(filename, JSON.stringify(item.ces_resource, null, 2));
  }

  zip.file(
    "README.md",
    `# Guardrails Pack (Demo)\n\nGenerated in Demo Mode — not connected to GCP.\n\n` +
      `Contains ${enabledItems.length} guardrail resource(s).\n\n` +
      `To apply these guardrails to a real CX Agent Studio app, sign in with your Google account.\n`
  );

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, zipFilename);
}

export default function GuardrailsResult({
  generateResponse,
  enabledItems,
  industryVertical,
  onBack,
  onReset,
}: GuardrailsResultProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [applyResponse, setApplyResponse] = useState<GuardrailsApplyResponse | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const token = useAuthStore((s) => s.token);
  const isDemoMode = token === "demo-token";

  const { scaffoldContext, markGuardrailsApplied } = useProjectStore();
  const { saveContext } = useScaffoldContext();

  const handleDownload = () => {
    if (isDemoMode) {
      downloadDemoZip(enabledItems, generateResponse.zip_filename).catch(console.error);
      return;
    }
    // Download ZIP from the signed URL via fetch → blob → saveAs
    fetch(generateResponse.download_url)
      .then((r) => r.blob())
      .then((blob) => saveAs(blob, generateResponse.zip_filename))
      .catch(() => {
        // Fall back to opening in a new tab
        window.open(generateResponse.download_url, "_blank");
      });
  };

  const handleApply = async () => {
    setIsApplying(true);
    setApplyError(null);

    try {
      const res = await apiClient.post<GuardrailsApplyResponse>(
        "/accelerators/guardrails/apply",
        {
          project_id: "",
          location: "",
          app_id: "",
          guardrails: enabledItems.map((p) => p.ces_resource),
        }
      );
      setApplyResponse(res.data);

      // Write back to ScaffoldContext
      if (scaffoldContext) {
        markGuardrailsApplied(industryVertical);
        setTimeout(async () => {
          const updated = useProjectStore.getState().scaffoldContext;
          if (updated) {
            await saveContext(updated);
          }
        }, 0);
      }
    } catch (err) {
      setApplyError("Failed to apply guardrails. Check your permissions and try again.");
    } finally {
      setIsApplying(false);
    }
  };

  const isApplied = !!applyResponse;

  return (
    <div>
      {/* Summary card */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Guardrails Pack Ready
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Generated{" "}
              {new Date(generateResponse.generation_timestamp).toLocaleString()} ·{" "}
              {enabledItems.length} guardrail{enabledItems.length !== 1 ? "s" : ""} enabled
            </p>
          </div>
          <IndustryPresetBadge
            industry={generateResponse.industry_preset_used as IndustryVertical}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            <Download size={14} />
            {generateResponse.zip_filename}
          </button>
        </div>
      </div>

      {/* Apply section */}
      {isDemoMode ? (
        /* Demo mode: disabled apply card */
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-1">
            Apply to CES App — requires GCP connection
          </h3>
          <p className="text-xs text-gray-400">
            Connect your GCP account to apply guardrails directly to your CX Agent Studio app.
          </p>
        </div>
      ) : !isApplied ? (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Apply to CES App
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            A version snapshot will be created before writing. This action creates{" "}
            {enabledItems.length} guardrail resource
            {enabledItems.length !== 1 ? "s" : ""} on your CES app.
          </p>

          {applyError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 text-sm text-red-600">
              <XCircle size={15} className="flex-shrink-0" />
              {applyError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gecx-600 text-white text-sm font-semibold hover:bg-gecx-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              {isApplying ? (
                <>
                  <Spinner />
                  Applying…
                </>
              ) : (
                <>
                  <Upload size={15} />
                  Apply to App
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onBack}
              disabled={isApplying}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              <ArrowLeft size={14} />
              Back to preview
            </button>
          </div>
        </div>
      ) : (
        /* Apply result */
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            {applyResponse.failed_count === 0 ? (
              <>
                <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    All guardrails applied successfully
                  </p>
                  <p className="text-xs text-gray-400">
                    {applyResponse.applied_count} guardrail
                    {applyResponse.applied_count !== 1 ? "s" : ""} created
                    {applyResponse.version_id && ` · Snapshot: ${applyResponse.version_id}`}
                  </p>
                </div>
              </>
            ) : (
              <>
                <XCircle size={18} className="text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    Partial success — {applyResponse.applied_count} applied,{" "}
                    {applyResponse.failed_count} failed
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Per-item results */}
          <div className="space-y-1.5 mb-4">
            {applyResponse.results.map((result: GuardrailApplyResult, idx: number) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs text-gray-500"
              >
                {result.status === "success" ? (
                  <CheckCircle size={11} className="text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle size={11} className="text-red-400 flex-shrink-0" />
                )}
                <span className="font-medium">{result.guardrail_type}</span>
                {result.status === "failed" && result.error && (
                  <span className="text-red-400 truncate">— {result.error}</span>
                )}
                {result.status === "success" && result.resource_name && (
                  <span className="text-gray-400 truncate">— {result.resource_name}</span>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            <RotateCcw size={13} />
            Generate another pack
          </button>
        </div>
      )}
    </div>
  );
}
