import type {
  CuratedIndex,
  CuratedQuestion,
  Difficulty,
  GiveUpResponse,
  HintResponse,
} from "./types";

import indexJson from "@/data/questions/index.json";

const INDEX: CuratedIndex = indexJson as CuratedIndex;

const cache = new Map<string, CuratedQuestion[]>();

export function listCuratedConcepts() {
  return INDEX.concepts;
}

export async function loadConceptBank(
  conceptSlug: string,
): Promise<CuratedQuestion[]> {
  const hit = cache.get(conceptSlug);
  if (hit) return hit;
  const entry = INDEX.concepts.find((c) => c.concept === conceptSlug);
  if (!entry) return [];
  // Dynamic import keeps each concept's JSON in its own chunk.
  const mod = await import(`@/data/questions/${entry.file}`);
  const bank = (mod.default ?? mod) as CuratedQuestion[];
  cache.set(conceptSlug, bank);
  return bank;
}

export function pickCuratedQuestion(
  bank: CuratedQuestion[],
  opts: { difficulty?: Difficulty; excludeId?: string | null },
): CuratedQuestion | null {
  let pool = bank;
  if (opts.difficulty) {
    pool = pool.filter((q) => q.difficulty === opts.difficulty);
  }
  if (opts.excludeId && pool.length > 1) {
    pool = pool.filter((q) => q.id !== opts.excludeId);
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Pre-baked hint responses for curated mode. Each call advances through
 * the hints[] array; once exhausted, we keep returning the last hint.
 */
export function curatedHintAt(
  q: CuratedQuestion,
  index: number,
): HintResponse {
  const i = Math.min(Math.max(index, 0), q.hints.length - 1);
  const h = q.hints[i];
  return { hint: h.hint, suggested_sql: h.suggested_sql };
}

export function curatedGiveUp(q: CuratedQuestion): GiveUpResponse {
  return {
    reference_sql: q.reference_solution_sql,
    summary: q.solution_summary,
    breakdown: [],
    approach: "",
    steps: q.solution_steps,
    final_thought: q.solution_final_thought,
  };
}
