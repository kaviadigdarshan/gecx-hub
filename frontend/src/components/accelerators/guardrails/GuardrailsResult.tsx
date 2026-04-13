import { Download, ArrowLeft, RotateCcw } from "lucide-react";
import { saveAs } from "file-saver";
import JSZip from "jszip";

import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import { hasContext } from "@/utils/contextUtils";
import { apiClient } from "@/services/api";
import type {
  GuardrailPreviewItem,
  GuardrailsGenerateResponse,
} from "@/types/accelerators";
import IndustryPresetBadge from "./IndustryPresetBadge";
import type { IndustryVertical } from "@/types/accelerators";


interface GuardrailsResultProps {
  generateResponse: GuardrailsGenerateResponse;
  enabledItems: GuardrailPreviewItem[];
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
  onBack,
  onReset,
}: GuardrailsResultProps) {
  const token = useAuthStore((s) => s.token);
  const isDemoMode = token === "demo-token";
  const { scaffoldContext } = useProjectStore();

  const handleDownloadMergedZip = async () => {
    if (!hasContext(scaffoldContext)) return;
    try {
      const res = await apiClient.post<{ request_id: string; download_url: string }>(
        "/accelerators/scaffolder/merge-zip",
        {
          original_request_id: scaffoldContext.scaffoldId,
          guardrails_config: {
            guardrails: enabledItems.map((item) => item.ces_resource),
          },
        }
      );
      window.open(res.data.download_url, "_blank");
    } catch {
      // silent — no toast infrastructure yet
    }
  };

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
            Download ZIP
          </button>

          {hasContext(scaffoldContext) && (
            <button
              type="button"
              onClick={handleDownloadMergedZip}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gecx-200 text-sm text-gecx-600 bg-gecx-50 hover:bg-gecx-100 transition"
            >
              ⬇ Download Merged ZIP
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          <ArrowLeft size={14} />
          Back to preview
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          <RotateCcw size={13} />
          Generate another pack
        </button>
      </div>
    </div>
  );
}
