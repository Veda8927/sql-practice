import type {
  CuratedQuestion,
  ExplainResponse,
  ErrorHelpResponse,
  GiveUpResponse,
  GradeResult,
  HintResponse,
  PerformanceResponse,
  Question,
  QuestionHistoryItem,
  RunQueryResponse,
  SchemaInfo,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: "include", // round-trip the per-session cookie
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
  resetData: (opts?: {
    seed?: number;
    mode?: "auto" | "ai" | "ai_fresh";
    scenario?: string;
  }) =>
    request<SchemaInfo>("/api/reset_data", {
      method: "POST",
      body: JSON.stringify({
        seed: opts?.seed ?? null,
        mode: opts?.mode ?? "auto",
        scenario: opts?.scenario ?? null,
      }),
    }),
  newQuestion: (opts?: { concept?: string; difficulty?: string }) =>
    request<Question>("/api/new_question", {
      method: "POST",
      body: JSON.stringify({
        concept: opts?.concept ?? null,
        difficulty: opts?.difficulty ?? null,
      }),
    }),
  questionHistory: () =>
    request<QuestionHistoryItem[]>("/api/question_history"),
  selectQuestion: (questionId: string) =>
    request<Question>("/api/select_question", {
      method: "POST",
      body: JSON.stringify({ question_id: questionId }),
    }),
  runQuery: (sql: string) =>
    request<RunQueryResponse>("/api/run_query", {
      method: "POST",
      body: JSON.stringify({ sql }),
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
  errorHelp: () =>
    request<ErrorHelpResponse>("/api/error_help", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  performance: (sql: string) =>
    request<PerformanceResponse>("/api/performance", {
      method: "POST",
      body: JSON.stringify({ sql }),
    }),
  loadCurated: (q: CuratedQuestion) =>
    request<Question>("/api/curated/load", {
      method: "POST",
      body: JSON.stringify({
        id: q.id,
        concept: q.concept,
        difficulty: q.difficulty,
        prompt: q.prompt,
        ordered_results: q.ordered_results,
        schema_setup_sql: q.schema_setup_sql,
        schema_context: q.schema_context,
        expected_output: q.expected_output,
        reference_solution_sql: q.reference_solution_sql,
      }),
    }),
};
