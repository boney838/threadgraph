const BASE = "/api";

async function req<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as unknown as T;

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? `HTTP ${res.status}`;
    const code = data?.error?.code ?? "UNKNOWN";
    throw Object.assign(new Error(msg), { code });
  }
  return data as T;
}

export const api = {
  // Auth
  register: (email: string, password: string) =>
    req("POST", "/auth/sign-up/email", { email, password, name: email }),
  login: (email: string, password: string) =>
    req("POST", "/auth/sign-in/email", { email, password }),
  logout: () => req("POST", "/auth/sign-out", {}),
  getSession: () => req<{ user?: { id: string; email: string } }>("GET", "/auth/get-session"),

  // Account / API key
  getApiKey: () => req<{ configured: boolean }>("GET", "/v1/account/api-key"),
  setApiKey: (apiKey: string) => req("PUT", "/v1/account/api-key", { apiKey }),
  deleteApiKey: () => req("DELETE", "/v1/account/api-key"),

  // Graphs
  listGraphs: () =>
    req<GraphListItem[]>("GET", "/v1/graphs"),
  getGraph: (id: string) =>
    req<GraphRecord>("GET", `/v1/graphs/${id}`),
  updateGraphTitle: (id: string, title: string) =>
    req("PATCH", `/v1/graphs/${id}`, { title }),
  deleteGraph: (id: string) =>
    req("DELETE", `/v1/graphs/${id}`),
  exportGraph: (id: string, format: "json" | "markdown") =>
    fetch(`${BASE}/v1/graphs/${id}/export?format=${format}`, { credentials: "include" }),

  // Jobs
  createJob: (payload: {
    transcript: string;
    source_platform: "claude" | "chatgpt";
    source_url?: string;
    title?: string;
  }) => req<{ jobId: string }>("POST", "/v1/jobs", payload),
  pollJob: (id: string) =>
    req<{ status: string; graphId?: string; error?: string }>("GET", `/v1/jobs/${id}`),
};

export interface PassUsage {
  pass: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface PipelineUsage {
  passes: PassUsage[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
}

export interface GraphListItem {
  id: string;
  title: string;
  source_platform: string;
  source_url?: string;
  pipeline_version: string;
  usage_json?: PipelineUsage | null;
  created_at: string;
  updated_at: string;
}

export interface GraphRecord extends GraphListItem {
  raw_turns: unknown[];
  graph_json: import("@threadgraph/shared").Graph;
}
