import { useState } from "react";
import { apiClient } from "@/services/api";

type AuthType = "service_agent_id_token" | "api_key" | "oauth2" | "none";

interface GenerateOpenAPIResponse {
  spec: string;
}

export default function OpenAPIToolTab() {
  const [authType, setAuthType] = useState<AuthType>("service_agent_id_token");
  const [description, setDescription] = useState("");
  const [generatedSpec, setGeneratedSpec] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await apiClient.post<GenerateOpenAPIResponse>(
        "/accelerators/tools/generate-openapi",
        {
          authType,
          description: description.trim(),
        }
      );
      setGeneratedSpec(res.data.spec);
    } catch {
      setError("Failed to generate OpenAPI spec. Try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Authentication Type
        </label>
        <select
          value={authType}
          onChange={(e) => setAuthType(e.target.value as AuthType)}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="service_agent_id_token">Service Agent ID Token</option>
          <option value="api_key">API Key</option>
          <option value="oauth2">OAuth 2.0</option>
          <option value="none">None</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Describe the API (plain English)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. A REST API for retrieving customer account details by email address. Returns account ID, tier, and active subscriptions."
          rows={4}
          className="resize-y rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating || !description.trim()}
        className="self-start rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isGenerating ? "Generating…" : "Generate OpenAPI Spec with Gemini"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Generated OpenAPI spec (editable)
        </label>
        <textarea
          value={generatedSpec}
          onChange={(e) => setGeneratedSpec(e.target.value)}
          placeholder="Generated YAML spec will appear here…"
          style={{ fontFamily: "monospace", minHeight: "300px" }}
          className="resize-y rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
