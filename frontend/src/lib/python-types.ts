export type PyDifficulty = "easy" | "medium" | "hard";
export type PyKind = "function" | "script";

export type PyTestCase = {
  args?: unknown[];
  kwargs?: Record<string, unknown>;
  expected?: unknown;
  stdin?: string;
  expected_stdout?: string | null;
};

export type PyHint = { hint: string; suggested_code: string | null };

export type PySolutionStep = {
  title: string;
  what_it_does: string;
  code: string;
  how_it_runs: string;
};

/** Full exercise (curated mode ships this from the client). */
export type PyExercise = {
  id: string;
  concept: string;
  difficulty: PyDifficulty;
  kind: PyKind;
  prompt: string;
  starter_code: string;
  entrypoint: string | null;
  reference_solution: string;
  test_cases: PyTestCase[];
  hints?: PyHint[];
  solution_steps?: PySolutionStep[];
  solution_summary?: string;
  solution_final_thought?: string;
};

/** Server view of an active exercise (no reference / expected leakage). */
export type PyQuestion = {
  id: string;
  concept: string;
  difficulty: PyDifficulty;
  kind: PyKind;
  prompt: string;
  starter_code: string;
  entrypoint: string | null;
  test_count: number;
};

export type PyRunResponse = {
  stdout: string;
  stderr: string;
  timed_out: boolean;
  duration_ms: number;
  sandboxed: boolean;
};

export type PyTestResult = {
  index: number;
  passed: boolean;
  got: string | null;
  expected: string | null;
  stdout: string;
  error: string | null;
};

export type PyGradeResult = {
  status: "correct" | "wrong" | "error";
  tests: PyTestResult[];
  passed: number;
  total: number;
  error_message: string | null;
  duration_ms: number;
};

export type PyHintResponse = { hint: string; suggested_code: string | null };
export type PyExplainResponse = { explanation: string };
export type PyGiveUpResponse = {
  reference_solution: string;
  summary: string;
  steps: PySolutionStep[];
  final_thought: string;
};

export type PyConceptIndex = {
  concept: string;
  label: string;
  count: number;
  file: string;
};
export type PyCuratedIndex = { generated_at: string; concepts: PyConceptIndex[] };
