import { useState } from "react";
import { apiClient } from "@/services/api";

interface GeneratePythonResponse {
  code: string;
}

export default function PythonToolTab() {
  const [toolName, setToolName] = useState("");
  const [description, setDescription] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!toolName.trim() || !description.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await apiClient.post<GeneratePythonResponse>(
        "/accelerators/tools/generate-python",
        {
          toolName: toolName.trim(),
          description: description.trim(),
          prompt:
            "Generate a Python tool function for CX Agent Studio with proper pydantic BaseModel for state, docstring, and context.state access pattern. Return only Python code.",
        }
      );
      setGeneratedCode(res.data.code);
    } catch {
      setError("Failed to generate Python tool. Try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Tool name</label>
        <input
          type="text"
          value={toolName}
          onChange={(e) => setToolName(e.target.value)}
          placeholder="e.g. lookup_order_status"
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Describe what this tool should do (plain English)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Look up order status by order ID from the CRM and return the current status and estimated delivery date."
          rows={4}
          className="resize-y rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating || !toolName.trim() || !description.trim()}
        className="self-start rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isGenerating ? "Generating…" : "Generate with Gemini"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Generated Python code (editable)
        </label>
        <textarea
          value={generatedCode}
          onChange={(e) => setGeneratedCode(e.target.value)}
          placeholder="Generated code will appear here…"
          style={{ fontFamily: "monospace", minHeight: "300px" }}
          className="resize-y rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
