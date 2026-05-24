import type {
  PyCuratedIndex,
  PyDifficulty,
  PyExercise,
  PyHintResponse,
} from "./python-types";

import indexJson from "@/data/py-questions/index.json";

const INDEX: PyCuratedIndex = indexJson as PyCuratedIndex;
const cache = new Map<string, PyExercise[]>();

export function listPyConcepts() {
  return INDEX.concepts;
}

export async function loadPyConceptBank(concept: string): Promise<PyExercise[]> {
  const hit = cache.get(concept);
  if (hit) return hit;
  const entry = INDEX.concepts.find((c) => c.concept === concept);
  if (!entry) return [];
  const mod = await import(`@/data/py-questions/${entry.file}`);
  const bank = (mod.default ?? mod) as PyExercise[];
  cache.set(concept, bank);
  return bank;
}

export function pickPyExercise(
  bank: PyExercise[],
  opts: { difficulty?: PyDifficulty; excludeId?: string | null },
): PyExercise | null {
  let pool = bank;
  if (opts.difficulty) pool = pool.filter((q) => q.difficulty === opts.difficulty);
  if (opts.excludeId && pool.length > 1) pool = pool.filter((q) => q.id !== opts.excludeId);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Client-side curated hints (offline): advance through the exercise's hints[]. */
export function curatedPyHintAt(exercise: PyExercise, index: number): PyHintResponse {
  const hints = exercise.hints ?? [];
  if (hints.length === 0) {
    return { hint: "Break the problem into small steps and test each piece.", suggested_code: null };
  }
  const i = Math.min(Math.max(index, 0), hints.length - 1);
  return { hint: hints[i].hint, suggested_code: hints[i].suggested_code };
}
