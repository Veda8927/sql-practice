"use client";

import * as React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DataTableProps = {
  columns: string[];
  rows: unknown[][];
  maxRows?: number;
  className?: string;
};

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;

function renderCell(val: unknown) {
  if (val === null || val === undefined) {
    return (
      <span className="italic text-muted-foreground">NULL</span>
    );
  }
  if (typeof val === "boolean") {
    return String(val);
  }
  if (typeof val === "number") {
    return val.toString();
  }
  return String(val);
}

function isNumericColumn(rows: unknown[][], colIdx: number): boolean {
  let seen = 0;
  for (const r of rows) {
    const v = r[colIdx];
    if (v === null || v === undefined) continue;
    if (typeof v === "number") {
      seen++;
      continue;
    }
    if (typeof v === "string" && NUMERIC_RE.test(v)) {
      seen++;
      continue;
    }
    return false;
  }
  return seen > 0;
}

export function DataTable({
  columns,
  rows,
  maxRows = 50,
  className,
}: DataTableProps) {
  const truncated = rows.length > maxRows;
  const visibleRows = truncated ? rows.slice(0, maxRows) : rows;

  const numericCols = React.useMemo(
    () => columns.map((_, i) => isNumericColumn(rows, i)),
    [columns, rows],
  );

  if (columns.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No columns returned.
      </div>
    );
  }

  return (
    <div className={cn("w-full overflow-auto rounded-lg border border-border bg-card", className)}>
      <Table className="font-mono text-xs">
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow className="border-border">
            {columns.map((c, i) => (
              <TableHead
                key={`${c}-${i}`}
                className={cn(
                  "bg-card text-[11px] font-medium text-muted-foreground",
                  numericCols[i] && "text-right",
                )}
              >
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-center text-muted-foreground py-6"
              >
                0 rows
              </TableCell>
            </TableRow>
          )}
          {visibleRows.map((row, ri) => (
            <TableRow key={ri}>
              {row.map((cell, ci) => {
                const text = cell === null || cell === undefined ? "" : String(cell);
                return (
                  <TableCell
                    key={ci}
                    className={cn(
                      "max-w-[280px] truncate",
                      numericCols[ci] && "text-right tabular-nums",
                    )}
                    title={text}
                  >
                    {renderCell(cell)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {truncated && (
        <div className="border-t border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          Showing {maxRows} of {rows.length} rows
        </div>
      )}
    </div>
  );
}
