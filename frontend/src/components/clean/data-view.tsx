"use client";

import * as React from "react";
import { DataTable } from "@/components/data-table";
import type { TableResult } from "@/lib/types";

type Props = {
  raw: TableResult;
  cleaned: TableResult | null;
};

export function DataView({ raw, cleaned }: Props) {
  const [tab, setTab] = React.useState<"cleaned" | "raw">(cleaned ? "cleaned" : "raw");
  // A fresh run produces a new `cleaned` preview — surface it instead of leaving
  // the user staring at the raw data. (The useState initializer above only runs
  // on first mount, when `cleaned` is still null.)
  React.useEffect(() => {
    if (cleaned) setTab("cleaned");
  }, [cleaned]);
  const active = tab === "cleaned" && cleaned ? cleaned : raw;
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-1 self-end rounded-full border border-border bg-muted/40 p-0.5">
        {(["cleaned", "raw"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            disabled={t === "cleaned" && !cleaned}
            className={
              "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-40 " +
              (tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")
            }
          >
            {t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <DataTable columns={active.columns} rows={active.rows} maxRows={100} className="h-full" />
      </div>
    </div>
  );
}
