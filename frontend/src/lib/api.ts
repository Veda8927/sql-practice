import type {
  ExplainResponse,
  GiveUpResponse,
  GradeResult,
  HintResponse,
  Question,
  SchemaInfo,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>("/api/health"),
  getSchema: () => request<SchemaInfo>("/api/schema"),
  resetData: (seed?: number) =>
    request<SchemaInfo>("/api/reset_data", {
      method: "POST",
      body: JSON.stringify({ seed: seed ?? null }),
    }),
  newQuestion: (opts?: { concept?: string; difficulty?: string }) =>
    request<Question>("/api/new_question", {
      method: "POST",
      body: JSON.stringify({
        concept: opts?.concept ?? null,
        difficulty: opts?.difficulty ?? null,
      }),
    }),
  submit: (sql: string) =>
    request<GradeResult>("/api/submit", {
      method: "POST",
      body: JSON.stringify({ sql }),
    }),
  explain: (sql: string) =>
    request<ExplainResponse>("/api/explain", {
      method: "POST",
      body: JSON.stringify({ sql }),
    }),
  giveUp: () =>
    request<GiveUpResponse>("/api/give_up", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  hint: (sql?: string) =>
    request<HintResponse>("/api/hint", {
      method: "POST",
      body: JSON.stringify({ sql: sql ?? null }),
    }),
};
