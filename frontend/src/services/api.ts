import axios from "axios";
import type { InternalAxiosRequestConfig, AxiosResponse } from "axios";
import { API_BASE_URL } from "@/config/constants";
import { useAuthStore } from "@/store/authStore";

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

export default apiClient;
