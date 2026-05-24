import type {
  PyExercise,
  PyExplainResponse,
  PyGiveUpResponse,
  PyGradeResult,
  PyHintResponse,
  PyQuestion,
  PyRunResponse,
} from "./python-types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).detail;
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const pythonApi = {
  newQuestion: (opts?: { concept?: string; difficulty?: string }) =>
    post<PyQuestion>("/api/py/new_question", {
      concept: opts?.concept ?? null,
      difficulty: opts?.difficulty ?? null,
    }),
  loadCurated: (exercise: PyExercise) =>
    post<PyQuestion>("/api/py/curated/load", { exercise }),
  run: (code: string) => post<PyRunResponse>("/api/py/run", { code }),
  submit: (code: string) => post<PyGradeResult>("/api/py/submit", { code }),
  hint: (code?: string) => post<PyHintResponse>("/api/py/hint", { code: code ?? null }),
  explain: () => post<PyExplainResponse>("/api/py/explain", {}),
  giveUp: () => post<PyGiveUpResponse>("/api/py/give_up", {}),
};
