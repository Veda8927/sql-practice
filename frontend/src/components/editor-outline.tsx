"use client";

import * as React from "react";

import {
  CLAUSE_ORDER,
  outlineSql,
  type Clause,
} from "@/lib/sql-outline";
import { cn } from "@/lib/utils";

type Props = {
  sql: string;
  schemaIdentifiers: Set<string>;
  expectedTables?: string[];
};

/**
 * "Tier 1" feedback: a thin status strip beneath the editor. Shows what your
 * SQL currently has (which clauses + which tables) so you can see what's
 * missing at a glance — without anything telling you the answer.
 */
export function EditorOutline({
  sql,
  schemaIdentifiers,
  expectedTables,
}: Props) {
  const outline = React.useMemo(() => outlineSql(sql), [sql]);

  // Don't render at all while the user has only the placeholder comment.
  const trimmed = sql.trim();
  const isEmpty =
    trimmed.length === 0 ||
    (trimmed.startsWith("--") && !/\n/.test(trimmed));
  if (isEmpty) return null;

  const expectedSet = new Set(
    (expectedTables ?? []).map((t) => t.toLowerCase()),
  );

  return (
    <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-t border-border bg-muted/40 px-3 py-1.5 text-[10.5px] text-muted-foreground">
      {/* Clause chips */}
      <div className="flex shrink-0 items-center gap-1">
        {CLAUSE_ORDER.map((clause: Clause) => {
          const present = outline.clauses.includes(clause);
          return (
            <span
              key={clause}
              title={
                present
                  ? `${clause} detected`
                  : `${clause} not in your query`
              }
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[10px] tracking-tight transition-colors",
                present
                  ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                  : "text-muted-foreground/60",
              )}
            >
              {clause}
            </span>
          );
        })}
        {(outline.hasAggregate ||
          outline.hasSubquery ||
          outline.hasCte ||
          outline.hasDistinct) && (
          <span className="mx-1 h-3 w-px bg-border" />
        )}
        {outline.hasDistinct && (
          <span className="rounded bg-blue-500/12 px-1.5 py-0.5 font-mono text-[10px] text-blue-700 dark:text-blue-400">
            DISTINCT
          </span>
        )}
        {outline.hasAggregate && (
          <span className="rounded bg-blue-500/12 px-1.5 py-0.5 font-mono text-[10px] text-blue-700 dark:text-blue-400">
            aggregate
          </span>
        )}
        {outline.hasCte && (
          <span className="rounded bg-blue-500/12 px-1.5 py-0.5 font-mono text-[10px] text-blue-700 dark:text-blue-400">
            CTE
          </span>
        )}
        {outline.hasSubquery && (
          <span className="rounded bg-blue-500/12 px-1.5 py-0.5 font-mono text-[10px] text-blue-700 dark:text-blue-400">
            subquery
          </span>
        )}
      </div>

      {/* Tables touched */}
      {outline.tables.length > 0 && (
        <>
          <span className="h-3 w-px shrink-0 bg-border" />
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-[10px] text-muted-foreground/80">
              tables
            </span>
            {outline.tables.map((t) => {
              const exists = schemaIdentifiers.has(t);
              const expected = expectedSet.has(t);
              return (
                <span
                  key={t}
                  title={
                    !exists
                      ? `\`${t}\` is not a table in this schema`
                      : expected
                        ? `\`${t}\` is one of the tables the answer uses`
                        : `\`${t}\` is in this schema`
                  }
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[10px]",
                    !exists
                      ? "bg-rose-500/12 text-rose-700 dark:text-rose-400"
                      : expected
                        ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {t}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
