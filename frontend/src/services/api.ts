import axios from "axios";
import type { InternalAxiosRequestConfig, AxiosResponse } from "axios";
import { API_BASE_URL } from "@/config/constants";
import { useAuthStore } from "@/store/authStore";
import type { SourceExtractionRequest, SourceExtractionResponse } from "@/types/source_extraction";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// ── Demo mode mock responses ──────────────────────────────────────────────────

const DEMO_GUARDRAILS_RESPONSE = {
  request_id: "demo-request-001",
  previews: [
    {
      guardrail_type: "ContentFilter",
      display_name: "Content Blocklist",
      description: "Blocks specific words and phrases in user inputs and agent responses.",
      ces_resource: {
        displayName: "Content Blocklist",
        contentFilter: {
          bannedContents: ["competitor_brand", "price match guarantee"],
          bannedContentsInUserInput: [],
          bannedContentsInAgentResponse: ["internal pricing"],
          matchType: "CONTAINS",
          disregardDiacritics: true,
        },
        action: { respondImmediately: { responses: [{ text: "I cannot help with that." }] } },
        enabled: true,
      },
      enabled: true,
    },
    {
      guardrail_type: "LlmPromptSecurity",
      display_name: "Prompt Injection Guard",
      description: "Protects against prompt injection attacks.",
      ces_resource: {
        displayName: "Prompt Injection Guard",
        llmPromptSecurity: { defaultSettings: {}, failOpen: false },
        action: { respondImmediately: { responses: [{ text: "I cannot help with that." }] } },
        enabled: true,
      },
      enabled: true,
    },
    {
      guardrail_type: "LlmPolicy",
      display_name: "Off-Topic Deflection",
      description: "Uses an LLM to classify whether conversation content violates policy.",
      ces_resource: {
        displayName: "Off-Topic Deflection",
        llmPolicy: {
          prompt: "Is the user asking about topics completely unrelated to retail shopping? Return VIOLATING if yes.",
          policyScope: "USER_INPUT",
          maxConversationMessages: 10,
          allowShortUtterance: true,
        },
        action: { respondImmediately: { responses: [{ text: "I cannot help with that." }] } },
        enabled: true,
      },
      enabled: true,
    },
    {
      guardrail_type: "LlmPolicy",
      display_name: "Price Commitment Check",
      description: "Checks agent responses for unauthorized price commitments.",
      ces_resource: {
        displayName: "Price Commitment Check",
        llmPolicy: {
          prompt: "Is the agent making a specific price-match commitment? Return VIOLATING if yes.",
          policyScope: "AGENT_RESPONSE",
          maxConversationMessages: 10,
          allowShortUtterance: true,
        },
        action: { respondImmediately: { responses: [{ text: "I cannot help with that." }] } },
        enabled: true,
      },
      enabled: true,
    },
    {
      guardrail_type: "ModelSafety",
      display_name: "Model Safety (Balanced)",
      description: "Applies Gemini built-in content safety filters.",
      ces_resource: {
        displayName: "Model Safety (Balanced)",
        modelSafety: {
          safetySettings: [
            { harmCategory: "HARM_CATEGORY_HARASSMENT", harmBlockThreshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { harmCategory: "HARM_CATEGORY_HATE_SPEECH", harmBlockThreshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { harmCategory: "HARM_CATEGORY_SEXUALLY_EXPLICIT", harmBlockThreshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { harmCategory: "HARM_CATEGORY_DANGEROUS_CONTENT", harmBlockThreshold: "BLOCK_MEDIUM_AND_ABOVE" },
          ],
        },
        action: { respondImmediately: { responses: [{ text: "I cannot help with that." }] } },
        enabled: true,
      },
      enabled: true,
    },
  ],
  download_url: "demo://guardrails",
  zip_filename: "guardrails_retail_demo.zip",
  apply_ready: false,
  industry_preset_used: "retail",
  generation_timestamp: new Date().toISOString(),
};

function getMockResponse(url: string | undefined, method: string | undefined): unknown {
  const path = url ?? "";
  const verb = (method ?? "get").toLowerCase();

  if (verb === "get" && path.includes("/auth/me")) {
    return { id: "demo-user", email: "demo@gecx-hub.dev", name: "Demo User", picture: null };
  }
  if (verb === "post" && path.includes("/auth/logout")) {
    return { success: true };
  }
  if (verb === "get" && /\/projects\/[^/]+\/apps/.test(path)) {
    return { apps: [] };
  }
  if (verb === "get" && path.includes("/projects")) {
    return { projects: [] };
  }
  if (verb === "post" && path.includes("/accelerators/guardrails/generate")) {
    return { ...DEMO_GUARDRAILS_RESPONSE, generation_timestamp: new Date().toISOString() };
  }
  if (verb === "get" && path.includes("/accelerators/tools/templates")) {
    return {
      templates: [
        {
          vertical: "retail",
          tools: [
            { id: "FAQ_BQ_Datastore_v3", type: "DATASTORE", datastoreSource: { dataStoreName: "projects/demo/locations/global/collections/default_collection/dataStores/faq_store" } },
            { id: "order_management_api", type: "OPENAPI", openApiUrl: "https://api.example.com/retail/orders/openapi.json" },
          ],
          toolsets: [
            { id: "cancel_order", openApiUrl: "https://api.example.com/retail/orders/openapi.json", toolIds: ["order_management_api"] },
          ],
        },
        {
          vertical: "bfsi",
          tools: [
            { id: "account_lookup_api", type: "OPENAPI", openApiUrl: "https://api.example.com/bfsi/accounts/openapi.json" },
            { id: "KYC_Docs_Datastore", type: "DATASTORE", datastoreSource: { dataStoreName: "projects/demo/locations/global/collections/default_collection/dataStores/kyc_store" } },
          ],
          toolsets: [],
        },
      ],
    };
  }
  if (verb === "post" && path.includes("/accelerators/tools/save")) {
    return { saved: true };
  }
  if (verb === "post" && path.includes("/accelerators/callbacks/generate")) {
    return {
      callbacks: {
        beforeAgent:
          "from google.adk.agents.callback_context import CallbackContext\n" +
          "from typing import Optional\n" +
          "from google.genai import types\n\n" +
          "def before_agent_callback(callback_context: CallbackContext) -> Optional[types.Content]:\n" +
          "    callback_context.state['session_id'] = callback_context.session_id\n" +
          "    return None  # demo stub\n",
      },
      demo_mode: true,
    };
  }
  if (verb === "post" && path.includes("/accelerators/callbacks/write-to-scaffold")) {
    return { stored: true, session_id: "demo", agent_count: 0 };
  }
  if (verb === "put" && path.includes("/context/")) {
    return { saved: true };
  }
  if (verb === "get" && path.includes("/context/")) {
    // Simulate a 404 — no context in demo
    const err = Object.assign(new Error("Not found"), {
      response: { status: 404, data: { detail: "No context in demo mode" } },
    });
    throw err;
  }
  // Fallback for any other POST
  return { error: "Demo mode — not connected to GCP" };
}

function makeMockAxiosResponse(
  config: InternalAxiosRequestConfig,
  data: unknown
): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
    request: {},
  };
}

// ── Interceptors ──────────────────────────────────────────────────────────────

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (token === "demo-token") {
    // Override the adapter to return mock data without hitting the network
    config.adapter = async (cfg: InternalAxiosRequestConfig) => {
      try {
        const mockData = getMockResponse(cfg.url, cfg.method);
        return makeMockAxiosResponse(cfg, mockData);
      } catch (err) {
        return Promise.reject(err);
      }
    };
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const extractContext = async (
  payload: SourceExtractionRequest
): Promise<SourceExtractionResponse> => {
  const response = await apiClient.post<SourceExtractionResponse>(
    '/context/extract-from-source',
    payload
  );
  return response.data;
};

export default apiClient;
