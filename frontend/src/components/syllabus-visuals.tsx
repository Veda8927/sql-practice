"use client";

import * as React from "react";

import type {
  CellHighlight,
  TableViz,
  VennType,
} from "@/lib/syllabus";
import { cn } from "@/lib/utils";

// ── Venn diagram (for JOIN topics) ───────────────────────────────────────────

type VennRegions = {
  leftOnly: boolean;
  intersection: boolean;
  rightOnly: boolean;
};

const VENN_FILL_BY_TYPE: Record<VennType, VennRegions> = {
  inner: { leftOnly: false, intersection: true, rightOnly: false },
  left: { leftOnly: true, intersection: true, rightOnly: false },
  right: { leftOnly: false, intersection: true, rightOnly: true },
  full: { leftOnly: true, intersection: true, rightOnly: true },
  leftOnly: { leftOnly: true, intersection: false, rightOnly: false },
  rightOnly: { leftOnly: false, intersection: false, rightOnly: true },
  outer: { leftOnly: true, intersection: false, rightOnly: true },
};

export function VennDiagram({
  type,
  leftLabel = "A",
  rightLabel = "B",
  caption,
  legend,
}: {
  type: VennType;
  leftLabel?: string;
  rightLabel?: string;
  caption?: string;
  legend?: string;
}) {
  const regions = VENN_FILL_BY_TYPE[type];
  const filledClass = "fill-primary/30";
  const idLeft = React.useId();
  const idRight = React.useId();

  return (
    <figure className="my-5 flex flex-col items-center gap-2">
      <div className="rounded-xl border border-border bg-muted/30 px-6 py-4">
        <svg
          viewBox="0 0 220 140"
          width="220"
          height="140"
          role="img"
          aria-label={`Venn diagram for ${type} join`}
        >
          <defs>
            <clipPath id={`${idLeft}-clip`}>
              <circle cx="80" cy="70" r="55" />
            </clipPath>
            <clipPath id={`${idRight}-clip`}>
              <circle cx="140" cy="70" r="55" />
            </clipPath>
          </defs>

          {/* base circles (outlines) */}
          <circle
            cx="80"
            cy="70"
            r="55"
            className="fill-muted/40 stroke-border"
            strokeWidth="1.5"
          />
          <circle
            cx="140"
            cy="70"
            r="55"
            className="fill-muted/40 stroke-border"
            strokeWidth="1.5"
          />

          {/* left-only region: left circle minus the right (mask via clip-path-right exclusion not supported in plain SVG — use the trick of drawing right circle with bg color over left) */}
          {regions.leftOnly && (
            <g>
              {/* fill the entire left circle */}
              <circle cx="80" cy="70" r="55" className={filledClass} />
              {/* then knock out the intersection by drawing a circle that matches the background, clipped to right */}
              {!regions.intersection && (
                <g clipPath={`url(#${idLeft}-clip)`}>
                  <circle cx="140" cy="70" r="55" className="fill-muted/40" />
                </g>
              )}
            </g>
          )}
          {regions.rightOnly && (
            <g>
              <circle cx="140" cy="70" r="55" className={filledClass} />
              {!regions.intersection && (
                <g clipPath={`url(#${idRight}-clip)`}>
                  <circle cx="80" cy="70" r="55" className="fill-muted/40" />
                </g>
              )}
            </g>
          )}
          {/* intersection: only fill if it should be filled AND wasn't already filled by left/right */}
          {regions.intersection && !regions.leftOnly && !regions.rightOnly && (
            <g clipPath={`url(#${idLeft}-clip)`}>
              <circle cx="140" cy="70" r="55" className={filledClass} />
            </g>
          )}

          {/* outlines on top */}
          <circle
            cx="80"
            cy="70"
            r="55"
            fill="none"
            className="stroke-border"
            strokeWidth="1.5"
          />
          <circle
            cx="140"
            cy="70"
            r="55"
            fill="none"
            className="stroke-border"
            strokeWidth="1.5"
          />

          {/* labels */}
          <text
            x="42"
            y="74"
            className="fill-foreground font-mono"
            fontSize="11"
            textAnchor="middle"
          >
            {leftLabel}
          </text>
          <text
            x="178"
            y="74"
            className="fill-foreground font-mono"
            fontSize="11"
            textAnchor="middle"
          >
            {rightLabel}
          </text>
        </svg>
      </div>
      {(caption || legend) && (
        <figcaption className="text-center text-[12px] text-muted-foreground">
          {caption && (
            <div className="font-medium text-foreground">{caption}</div>
          )}
          {legend && <div className="mt-0.5">{legend}</div>}
        </figcaption>
      )}
    </figure>
  );
}

// ── Mini data table (for showing tables and filtered/joined results) ────────

const HIGHLIGHT_CLASS: Record<CellHighlight, string> = {
  match: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  drop: "bg-rose-500/12 text-rose-700 dark:text-rose-400 line-through opacity-60",
  new: "bg-blue-500/12 text-blue-700 dark:text-blue-400",
};

export function MiniTable({ table }: { table: TableViz }) {
  return (
    <figure className="my-5 inline-block min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-card">
      {table.caption && (
        <figcaption className="border-b border-border bg-muted/40 px-3 py-1.5 font-mono text-[11px] text-foreground">
          {table.caption}
        </figcaption>
      )}
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-[12px]">
          <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border bg-background">
              {table.columns.map((c, i) => (
                <th key={i} className="px-3 py-1.5 text-left font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {table.rows.map((row, ri) => {
              const tone = table.rowHighlights?.[ri];
              return (
                <tr
                  key={ri}
                  className={cn(tone ? HIGHLIGHT_CLASS[tone] : "")}
                >
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-1 tabular-nums">
                      {cell === null ? (
                        <span className="italic text-muted-foreground/70">
                          NULL
                        </span>
                      ) : (
                        String(cell)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {table.note && (
        <div className="border-t border-border bg-muted/30 px-3 py-1.5 text-[11.5px] text-muted-foreground">
          {table.note}
        </div>
      )}
    </figure>
  );
}

export function TablePair({
  left,
  right,
  caption,
  arrow = "→",
}: {
  left: TableViz;
  right: TableViz;
  caption?: string;
  arrow?: "→" | "⇒" | "↓";
}) {
  return (
    <figure className="my-5">
      {caption && (
        <figcaption className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {caption}
        </figcaption>
      )}
      <div
        className={cn(
          "flex flex-col items-center gap-3",
          arrow !== "↓" && "md:flex-row md:items-start",
        )}
      >
        <div className="min-w-0">
          <MiniTable table={left} />
        </div>
        <div
          className={cn(
            "flex items-center justify-center text-2xl text-muted-foreground",
            arrow === "↓" ? "rotate-0" : "",
          )}
        >
          {arrow}
        </div>
        <div className="min-w-0">
          <MiniTable table={right} />
        </div>
      </div>
    </figure>
  );
}

// ── Flow strip (for execution order, processes) ─────────────────────────────

export function FlowStrip({
  steps,
  caption,
}: {
  steps: { label: string; sub?: string }[];
  caption?: string;
}) {
  return (
    <figure className="my-5">
      {caption && (
        <figcaption className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {caption}
        </figcaption>
      )}
      <div className="flex flex-wrap items-stretch gap-1.5">
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            <div className="flex min-w-[88px] flex-1 flex-col items-center justify-center rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-center">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-foreground">
                {step.label}
              </div>
              {step.sub && (
                <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                  {step.sub}
                </div>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center text-muted-foreground">
                →
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </figure>
  );
}

// ── Side-by-side compare ─────────────────────────────────────────────────────

export function ComparePanel({
  caption,
  left,
  right,
}: {
  caption?: string;
  left: { title: string; items: string[] };
  right: { title: string; items: string[] };
}) {
  return (
    <figure className="my-5">
      {caption && (
        <figcaption className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {caption}
        </figcaption>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {[left, right].map((side, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-muted/30 p-3"
          >
            <div className="mb-2 text-[12.5px] font-semibold text-foreground">
              {side.title}
            </div>
            <ul className="space-y-1">
              {side.items.map((item, j) => (
                <li
                  key={j}
                  className="flex gap-2 text-[13px] leading-relaxed text-foreground/90"
                >
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/60" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </figure>
  );
}
