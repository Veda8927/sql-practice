"use client";

import * as React from "react";
import { CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ColumnMeta, Rule, RuleResult, RuleType } from "@/lib/clean-types";

const RULE_LABELS: Record<RuleType, string> = {
  not_null: "No nulls",
  unique: "Unique values",
  unique_combo: "Unique combination",
  no_duplicate_rows: "No duplicate rows",
  regex: "Matches pattern",
  allowed_values: "Allowed values",
  range: "Numeric range",
};

type Props = {
  columns: ColumnMeta[];
  rules: Rule[];
  results: RuleResult[];
  onChange: (rules: Rule[]) => void;
};

export function ValidationPanel({ columns, rules, results, onChange }: Props) {
  const resultById = React.useMemo(
    () => Object.fromEntries(results.map((r) => [r.id, r])),
    [results],
  );
  const [adding, setAdding] = React.useState(false);

  function update(id: string, patch: Partial<Rule>) {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function remove(id: string) {
    onChange(rules.filter((r) => r.id !== id));
  }
  function add(type: RuleType, column: string) {
    const id = `u${Date.now()}`;
    const params: Record<string, unknown> = {};
    if (type !== "no_duplicate_rows" && type !== "unique_combo") params.column = column;
    if (type === "regex") params.pattern = "^.+$";
    if (type === "range") {
      params.min = 0;
      params.max = 100;
    }
    const label =
      type === "no_duplicate_rows"
        ? RULE_LABELS[type]
        : `${column}: ${RULE_LABELS[type]}`;
    onChange([...rules, { id, type, label, params, enabled: true }]);
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {rules.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No rules yet. Add one to validate the cleaned data.
        </div>
      )}
      {rules.map((rule) => {
        const res = resultById[rule.id];
        return (
          <div
            key={rule.id}
            className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-1.5"
          >
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={(e) => update(rule.id, { enabled: e.target.checked })}
              className="h-3.5 w-3.5 accent-primary"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{rule.label}</div>
              {res?.status === "error" && res.message && (
                <div className="truncate text-[11px] text-destructive">{res.message}</div>
              )}
            </div>
            {res && rule.enabled && (
              <div className="flex items-center gap-1 text-xs">
                {res.status === "pass" ? (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> pass
                  </span>
                ) : res.status === "fail" ? (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-4 w-4" /> {res.violations}
                  </span>
                ) : (
                  <span className="text-muted-foreground">error</span>
                )}
              </div>
            )}
            <button
              onClick={() => remove(rule.id)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remove rule"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      {adding ? (
        <AddRuleForm columns={columns} onAdd={add} onCancel={() => setAdding(false)} />
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 self-start"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Add rule
        </Button>
      )}
    </div>
  );
}

function AddRuleForm({
  columns,
  onAdd,
  onCancel,
}: {
  columns: ColumnMeta[];
  onAdd: (t: RuleType, c: string) => void;
  onCancel: () => void;
}) {
  const [type, setType] = React.useState<RuleType>("not_null");
  const [column, setColumn] = React.useState(columns[0]?.ident ?? "");
  const needsColumn = type !== "no_duplicate_rows" && type !== "unique_combo";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-2">
      <select
        value={type}
        onChange={(e) => setType(e.target.value as RuleType)}
        className="rounded border border-border bg-background px-2 py-1 text-xs"
      >
        {(Object.keys(RULE_LABELS) as RuleType[]).map((t) => (
          <option key={t} value={t}>
            {RULE_LABELS[t]}
          </option>
        ))}
      </select>
      {needsColumn && (
        <select
          value={column}
          onChange={(e) => setColumn(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1 text-xs"
        >
          {columns.map((c) => (
            <option key={c.ident} value={c.ident}>
              {c.ident}
            </option>
          ))}
        </select>
      )}
      <Button size="sm" className="h-7 text-xs" onClick={() => onAdd(type, column)}>
        Add
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
