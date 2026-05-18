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

export type QuestionSchemaTable = {
  name: string;
  columns: string[];
};

export type QuestionSchemaJoin = {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
};

export type QuestionSchemaContext = {
  tables: QuestionSchemaTable[];
  joins: QuestionSchemaJoin[];
};

export type Question = {
  id: string;
  question: string;
  ordered_results: boolean;
  concepts: string[];
  difficulty: Difficulty;
  expected_output: TableResult | null;
  schema_context: QuestionSchemaContext | null;
};

export type QuestionHistoryItem = {
  id: string;
  question: string;
  concepts: string[];
  difficulty: Difficulty;
};

export type GradeStatus = "correct" | "wrong" | "error";

export type GradeResult = {
  status: GradeStatus;
  user_output: TableResult | null;
  expected_output: TableResult | null;
  error_message: string | null;
  execution_time_ms: number | null;
  reference_time_ms: number | null;
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

export type HintResponse = {
  hint: string;
};

export type ErrorHelpResponse = {
  explanation: string;
  next_step: string;
};

export type PerformanceResponse = {
  user_time_ms: number | null;
  reference_time_ms: number | null;
  raw_plan: unknown;
  summary: string;
  suggestions: string[];
  optimized_sql: string | null;
};
