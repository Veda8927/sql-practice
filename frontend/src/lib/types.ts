export type ColumnInfo = {
  name: string;
  type: string;
  nullable: boolean;
  primary_key: boolean;
  foreign_key: string | null;
};

export type TableInfo = {
  name: string;
  columns: ColumnInfo[];
  sample_rows: Record<string, unknown>[];
  row_count: number;
};

export type SchemaInfo = {
  tables: TableInfo[];
  seed: number;
  scenario_id: string | null;
  scenario_label: string | null;
};

export type Difficulty = "easy" | "medium" | "hard";

export type TableResult = {
  columns: string[];
  rows: unknown[][];
};

export type Question = {
  question: string;
  ordered_results: boolean;
  concepts: string[];
  difficulty: Difficulty;
  expected_output: TableResult | null;
};

export type GradeStatus = "correct" | "wrong" | "error";

export type GradeResult = {
  status: GradeStatus;
  user_output: TableResult | null;
  expected_output: TableResult | null;
  error_message: string | null;
};

export type TypoCorrection = { wrong: string; right: string };

export type ExplainResponse = {
  explanation: string;
  typo_corrections: TypoCorrection[];
};

export type SolutionStep = {
  title: string;
  what_it_does: string;
  sql_snippet: string;
  how_postgres_reads_it: string;
};

export type GiveUpResponse = {
  reference_sql: string;
  summary: string;
  steps: SolutionStep[];
  final_thought: string;
};
