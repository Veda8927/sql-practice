import type { TableResult } from "./types";

export type ColumnMeta = { name: string; ident: string; guessed_type: string };
export type ColumnProfile = { ident: string; non_null: number; nulls: number; distinct: number };
export type StageProfile = {
  index: number;
  label: string;
  row_count: number;
  distinct_row_count: number;
  columns: ColumnProfile[];
};
export type RuleType =
  | "not_null" | "unique" | "unique_combo" | "no_duplicate_rows"
  | "regex" | "allowed_values" | "range";
export type Rule = {
  id: string;
  type: RuleType;
  label: string;
  params: Record<string, unknown>;
  enabled: boolean;
};
export type RuleResult = {
  id: string;
  label: string;
  status: "pass" | "fail" | "error";
  violations: number;
  message: string | null;
};
export type DatasetSummary = {
  dataset_id: string;
  source: "upload" | "generated";
  row_count: number;
  columns: ColumnMeta[];
  raw_preview: TableResult;
  profile: ColumnProfile[];
  suggested_rules: Rule[];
};
export type Step = { title: string; sql: string };
export type RunResponse = {
  ok: boolean;
  failed_step_index: number | null;
  error_message: string | null;
  final_preview: TableResult | null;
  stages: StageProfile[];
  validation: RuleResult[];
};
export type ReviewResponse = {
  assessment: string;
  remaining_issues: string[];
  suggestions: string[];
  praise: string[];
  score: number;
};
