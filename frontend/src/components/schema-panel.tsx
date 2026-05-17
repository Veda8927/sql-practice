"use client";

import * as React from "react";
import { ChevronRight, KeyRound, Link2, List, Table as TableIcon } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { DataTable } from "@/components/data-table";
import type { SchemaInfo, TableInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "table";

function KeyBadge({ kind, hint }: { kind: "pk" | "fk"; hint?: string }) {
  if (kind === "pk") {
    return (
      <span
        title="Primary key"
        className="inline-flex items-center gap-1 rounded bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
      >
        <KeyRound className="h-2.5 w-2.5" />
        PK
      </span>
    );
  }
  return (
    <span
      title={`Foreign key → ${hint}`}
      className="inline-flex items-center gap-1 rounded bg-blue-500/12 px-1.5 py-0.5 font-mono text-[10px] font-medium text-blue-700 dark:text-blue-400"
    >
      <Link2 className="h-2.5 w-2.5" />
      {hint}
    </span>
  );
}

function ListView({ table }: { table: TableInfo }) {
  const [open, setOpen] = React.useState(false);
  const rows = React.useMemo(
    () => table.sample_rows.map((r) => table.columns.map((c) => r[c.name])),
    [table],
  );

  return (
    <div className="py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-baseline justify-between gap-2 text-left"
      >
        <span className="flex items-baseline gap-2">
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="font-mono text-sm text-foreground">
            {table.name}
          </span>
        </span>
        <span className="tabular-nums text-[11px] text-muted-foreground">
          {table.row_count.toLocaleString()}
        </span>
      </button>

      <ul className="mt-1.5 space-y-1 pl-5 font-mono text-[12px]">
        {table.columns.map((c) => (
          <li key={c.name} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-foreground">{c.name}</span>
            <span className="text-muted-foreground/80">{c.type}</span>
            {c.nullable && (
              <span className="text-[10px] text-muted-foreground/60">null</span>
            )}
            {c.primary_key && <KeyBadge kind="pk" />}
            {c.foreign_key && <KeyBadge kind="fk" hint={c.foreign_key} />}
          </li>
        ))}
      </ul>

      {open && (
        <div className="mt-3 pl-5">
          <DataTable
            columns={table.columns.map((c) => c.name)}
            rows={rows}
            maxRows={5}
          />
        </div>
      )}
    </div>
  );
}

function TableView({ table }: { table: TableInfo }) {
  return (
    <div className="py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-sm text-foreground">{table.name}</span>
        <span className="tabular-nums text-[11px] text-muted-foreground">
          {table.row_count.toLocaleString()} rows
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2.5 py-1.5 text-left font-medium">Column</th>
              <th className="px-2.5 py-1.5 text-left font-medium">Type</th>
              <th className="px-2.5 py-1.5 text-left font-medium">Null</th>
              <th className="px-2.5 py-1.5 text-left font-medium">Key</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono">
            {table.columns.map((c) => (
              <tr key={c.name}>
                <td className="px-2.5 py-1.5 text-foreground">{c.name}</td>
                <td className="px-2.5 py-1.5 text-muted-foreground">{c.type}</td>
                <td className="px-2.5 py-1.5 text-muted-foreground">
                  {c.nullable ? "yes" : "no"}
                </td>
                <td className="px-2.5 py-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {c.primary_key && <KeyBadge kind="pk" />}
                    {c.foreign_key && <KeyBadge kind="fk" hint={c.foreign_key} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SchemaPanel({ schema }: { schema: SchemaInfo | undefined }) {
  const [mode, setMode] = React.useState<ViewMode>("list");

  return (
    <ScrollArea className="h-full">
      <div className="px-5 py-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {schema?.scenario_label ?? "Schema"}
            </h2>
            {schema && (
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                seed {schema.seed}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setMode("list")}
              className={cn(
                "flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-medium transition-colors",
                mode === "list"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="List view"
            >
              <List className="h-3 w-3" />
              List
            </button>
            <button
              type="button"
              onClick={() => setMode("table")}
              className={cn(
                "flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-medium transition-colors",
                mode === "table"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Table view"
            >
              <TableIcon className="h-3 w-3" />
              Table
            </button>
          </div>
        </div>

        {!schema && (
          <div className="text-sm text-muted-foreground">Loading…</div>
        )}

        <div className="divide-y divide-border">
          {schema?.tables.map((t) =>
            mode === "list" ? (
              <ListView key={t.name} table={t} />
            ) : (
              <TableView key={t.name} table={t} />
            ),
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
