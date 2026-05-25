"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import type { TableResult } from "@/lib/types";

export type DataTab = "cleaned" | "raw";

// Copy + Cleaned/Raw toggle. Rendered by the parent in the tabs row so it sits
// inline with Data / Audit / Validation / Coach.
export function DataToolbar({
  view,
  onViewChange,
  hasCleaned,
  table,
}: {
  view: DataTab;
  onViewChange: (v: DataTab) => void;
  hasCleaned: boolean;
  table: TableResult;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    // Tab-separated so it pastes cleanly into spreadsheets.
    const header = table.columns.join("\t");
    const body = table.rows
      .map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c))).join("\t"))
      .join("\n");
    try {
      await navigator.clipboard.writeText(`${header}\n${body}`);
      setCopied(true);
      toast.success("Copied table to clipboard");
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="flex h-7 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        Copy
      </button>
      <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-0.5">
        {(["cleaned", "raw"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onViewChange(t)}
            disabled={t === "cleaned" && !hasCleaned}
            className={
              "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-40 " +
              (view === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")
            }
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DataView({ table }: { table: TableResult }) {
  return (
    <DataTable columns={table.columns} rows={table.rows} maxRows={100} className="h-full" />
  );
}
