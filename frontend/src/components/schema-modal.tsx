"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Database,
  KeyRound,
  Link2,
  Network,
  Table as TableIcon,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { ERDView } from "@/components/erd-view";
import type { SchemaInfo, TableInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

type ViewMode = "diagram" | "tables";

type Props = {
  open: boolean;
  schema: SchemaInfo | undefined;
  onClose: () => void;
};

function KeyBadge({ kind, hint }: { kind: "pk" | "fk"; hint?: string }) {
  if (kind === "pk") {
    return (
      <span
        title="Primary key"
        className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
      >
        <KeyRound className="h-2.5 w-2.5" />
        PK
      </span>
    );
  }
  return (
    <span
      title={`Foreign key → ${hint}`}
      className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-blue-700 dark:text-blue-400"
    >
      <Link2 className="h-2.5 w-2.5" />
      {hint}
    </span>
  );
}

/** Compute the join graph: which tables connect to which, and on what columns. */
function buildJoins(tables: TableInfo[]) {
  const joins: {
    from_table: string;
    from_column: string;
    to_table: string;
    to_column: string;
  }[] = [];
  for (const t of tables) {
    for (const c of t.columns) {
      if (c.foreign_key) {
        const [toTable, toCol] = c.foreign_key.split(".");
        joins.push({
          from_table: t.name,
          from_column: c.name,
          to_table: toTable,
          to_column: toCol,
        });
      }
    }
  }
  return joins;
}

function TableCard({ table }: { table: TableInfo }) {
  const [showSample, setShowSample] = React.useState(false);
  const rows = React.useMemo(
    () => table.sample_rows.map((r) => table.columns.map((c) => r[c.name])),
    [table],
  );

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-sm font-semibold text-foreground">
            {table.name}
          </span>
        </div>
        <span className="tabular-nums text-[11px] text-muted-foreground">
          {table.row_count.toLocaleString()} rows
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left font-medium">Column</th>
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-left font-medium">Null</th>
              <th className="px-4 py-2 text-left font-medium">Key</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono">
            {table.columns.map((c) => (
              <tr key={c.name}>
                <td className="px-4 py-1.5 text-foreground">{c.name}</td>
                <td className="px-4 py-1.5 text-muted-foreground">{c.type}</td>
                <td className="px-4 py-1.5 text-muted-foreground">
                  {c.nullable ? "yes" : "no"}
                </td>
                <td className="px-4 py-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {c.primary_key && <KeyBadge kind="pk" />}
                    {c.foreign_key && (
                      <KeyBadge kind="fk" hint={c.foreign_key} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border bg-muted/20 px-4 py-2">
        <button
          type="button"
          onClick={() => setShowSample((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {showSample ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Sample rows
        </button>
        {showSample && (
          <div className="mt-2">
            <DataTable
              columns={table.columns.map((c) => c.name)}
              rows={rows}
              maxRows={5}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function SchemaModal({ open, schema, onClose }: Props) {
  const [mode, setMode] = React.useState<ViewMode>("diagram");
  const joins = React.useMemo(
    () => (schema ? buildJoins(schema.tables) : []),
    [schema],
  );

  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-[min(90vh,860px)] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-4">
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Scenario
                </div>
                <h2 className="truncate text-lg font-semibold text-foreground">
                  {schema?.scenario_label ?? "Schema"}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5">
                  <button
                    type="button"
                    onClick={() => setMode("diagram")}
                    className={cn(
                      "flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                      mode === "diagram"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    title="Diagram view"
                  >
                    <Network className="h-3.5 w-3.5" />
                    Diagram
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("tables")}
                    className={cn(
                      "flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                      mode === "tables"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    title="Tables view"
                  >
                    <TableIcon className="h-3.5 w-3.5" />
                    Tables
                  </button>
                </div>
                {schema && (
                  <div className="hidden text-xs text-muted-foreground sm:block">
                    seed{" "}
                    <span className="font-mono tabular-nums">{schema.seed}</span>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>

            {!schema ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : mode === "diagram" ? (
              <div className="min-h-0 flex-1 overflow-hidden bg-muted/20">
                <ERDView schema={schema} />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto p-6">
                {joins.length > 0 && (
                  <section className="mb-6">
                    <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Relationships
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {joins.map((j, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11.5px]"
                        >
                          <span className="text-foreground">
                            {j.from_table}.
                            <span className="text-muted-foreground">
                              {j.from_column}
                            </span>
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-foreground">
                            {j.to_table}.
                            <span className="text-muted-foreground">
                              {j.to_column}
                            </span>
                          </span>
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Use these to write your JOINs.{" "}
                      <span className="font-mono">
                        JOIN {joins[0]?.to_table} ON {joins[0]?.from_table}.
                        {joins[0]?.from_column} = {joins[0]?.to_table}.
                        {joins[0]?.to_column}
                      </span>
                    </p>
                  </section>
                )}

                <section>
                  <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Tables
                  </h3>
                  <div
                    className={cn(
                      "grid gap-4",
                      "grid-cols-1",
                      schema.tables.length > 1 && "lg:grid-cols-2",
                    )}
                  >
                    {schema.tables.map((t) => (
                      <TableCard key={t.name} table={t} />
                    ))}
                  </div>
                </section>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
