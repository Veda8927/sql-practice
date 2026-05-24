import type {
  DatasetSummary,
  ReviewResponse,
  Rule,
  RunResponse,
  Step,
} from "./clean-types";

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
  review: (steps: Step[], rules: Rule[]) =>
    postJson<ReviewResponse>("/api/clean/review", { steps, rules }),
  reset: () => postJson<{ ok: boolean }>("/api/clean/reset", {}),
};
