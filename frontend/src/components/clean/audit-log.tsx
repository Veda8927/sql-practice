"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import type { StageProfile } from "@/lib/clean-types";

function delta(before: number, after: number) {
  const d = after - before;
  if (d === 0) return <span className="text-muted-foreground">no change</span>;
  const up = d > 0;
  return (
    <span className={up ? "text-emerald-600" : "text-amber-600"}>
      {up ? <Plus className="inline h-3 w-3" /> : <Minus className="inline h-3 w-3" />}
      {Math.abs(d)}
    </span>
  );
}

export function AuditLog({ stages }: { stages: StageProfile[] }) {
  if (stages.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Run the pipeline to see the audit trail.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {stages.map((stage, i) => {
        const prev = i > 0 ? stages[i - 1] : null;
        const prevCols = new Set(prev?.columns.map((c) => c.ident) ?? []);
        const curCols = new Set(stage.columns.map((c) => c.ident));
        const added = [...curCols].filter((c) => !prevCols.has(c));
        const removed = [...prevCols].filter((c) => !curCols.has(c));
        const nullsBefore = prev ? prev.columns.reduce((a, c) => a + c.nulls, 0) : 0;
        const nullsNow = stage.columns.reduce((a, c) => a + c.nulls, 0);
        const dupBefore = prev ? prev.row_count - prev.distinct_row_count : 0;
        const dupNow = stage.row_count - stage.distinct_row_count;
        return (
          <div key={stage.index} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px]">
                {stage.index}
              </span>
              {stage.label}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
              <Stat label="Rows" value={stage.row_count} extra={prev ? delta(prev.row_count, stage.row_count) : null} />
              <Stat label="Duplicates" value={dupNow} extra={prev ? delta(dupBefore, dupNow) : null} />
              <Stat label="Total nulls" value={nullsNow} extra={prev ? delta(nullsBefore, nullsNow) : null} />
              <Stat label="Columns" value={stage.columns.length} extra={null} />
            </dl>
            {(added.length > 0 || removed.length > 0) && (
              <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
                {added.map((c) => (
                  <span
                    key={`a${c}`}
                    className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400"
                  >
                    +{c}
                  </span>
                ))}
                {removed.map((c) => (
                  <span
                    key={`r${c}`}
                    className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 line-through dark:text-amber-400"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  extra,
}: {
  label: string;
  value: number;
  extra: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 font-medium tabular-nums">
        {value} {extra && <span className="text-[11px]">{extra}</span>}
      </dd>
    </div>
  );
}
