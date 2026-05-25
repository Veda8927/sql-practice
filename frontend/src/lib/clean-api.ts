import type {
  DatasetSummary,
  ReviewResponse,
  Rule,
  RuleResult,
  RunResponse,
  Step,
  ValidateResponse,
} from "./clean-types";
import type { TableResult } from "./types";

export type PyCleanResult = {
  ok: boolean;
  failed_step_index: number | null;
  error_message: string | null;
  stages: { label: string; row_count: number }[];
  final_preview: TableResult | null;
  validation: RuleResult[];
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function detailFrom(res: Response): Promise<string> {
  try {
    return (await res.json()).detail || `Request failed: ${res.status}`;
  } catch {
    return (await res.text()) || `Request failed: ${res.status}`;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await detailFrom(res));
  return res.json() as Promise<T>;
}

export const cleanApi = {
  upload: async (file: File): Promise<DatasetSummary> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE_URL}/api/clean/upload`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) throw new Error(await detailFrom(res));
    return res.json() as Promise<DatasetSummary>;
  },
  generate: (seed?: number) =>
    postJson<DatasetSummary>("/api/clean/generate", { seed: seed ?? null }),
  getDataset: async (): Promise<DatasetSummary | null> => {
    const res = await fetch(`${BASE_URL}/api/clean/dataset`, { credentials: "include" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await detailFrom(res));
    return res.json() as Promise<DatasetSummary>;
  },
  run: (steps: Step[], rules: Rule[], upToIndex?: number) =>
    postJson<RunResponse>("/api/clean/run", {
      steps,
      rules,
      up_to_index: upToIndex ?? null,
    }),
  pyRun: (steps: Step[], rules: Rule[]) =>
    postJson<PyCleanResult>("/api/clean/py_run", { steps, rules }),
  pyReview: (steps: Step[], rules: Rule[]) =>
    postJson<ReviewResponse>("/api/clean/py_review", { steps, rules }),
  pyExportCsv: async (steps: Step[]): Promise<Blob> => {
    const res = await fetch(`${BASE_URL}/api/clean/py_export`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps, rules: [] }),
    });
    if (!res.ok) throw new Error(await detailFrom(res));
    return res.blob();
  },
  exportCsv: async (steps: Step[], rules: Rule[]): Promise<Blob> => {
    const res = await fetch(`${BASE_URL}/api/clean/export`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps, rules }),
    });
    if (!res.ok) throw new Error(await detailFrom(res));
    return res.blob();
  },
  review: (steps: Step[], rules: Rule[]) =>
    postJson<ReviewResponse>("/api/clean/review", { steps, rules }),
  validate: (steps: Step[], rules: Rule[]) =>
    postJson<ValidateResponse>("/api/clean/validate", { steps, rules }),
  reset: () => postJson<{ ok: boolean }>("/api/clean/reset", {}),
};
