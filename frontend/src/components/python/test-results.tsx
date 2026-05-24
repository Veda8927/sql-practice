"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import type { PyGradeResult } from "@/lib/python-types";

export function TestResults({ grade }: { grade: PyGradeResult }) {
  if (grade.status === "error") {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <div className="mb-1 font-medium text-destructive">Couldn&apos;t run your code</div>
        <pre className="whitespace-pre-wrap font-mono text-xs text-foreground/80">
          {grade.error_message}
        </pre>
      </div>
    );
  }

  const allPass = grade.status === "correct";
  return (
    <div className="flex flex-col gap-2">
      <div
        className={
          "flex items-center gap-2 text-sm font-medium " +
          (allPass ? "text-emerald-600" : "text-amber-600")
        }
      >
        {allPass ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {grade.passed}/{grade.total} tests passed
        <span className="text-xs font-normal text-muted-foreground">· {grade.duration_ms} ms</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {grade.tests.map((t) => (
          <div
            key={t.index}
            className={
              "rounded-md border px-3 py-2 text-xs " +
              (t.passed ? "border-border/60" : "border-amber-500/40 bg-amber-500/5")
            }
          >
            <div className="flex items-center gap-1.5">
              {t.passed ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-amber-600" />
              )}
              <span className="font-medium">Test {t.index + 1}</span>
            </div>
            {!t.passed && t.error && (
              <div className="mt-1 font-mono text-destructive">{t.error}</div>
            )}
            {!t.passed && !t.error && (
              <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono">
                <span className="text-muted-foreground">got</span>
                <span className="truncate">{t.got}</span>
                <span className="text-muted-foreground">expected</span>
                <span className="truncate text-emerald-700 dark:text-emerald-400">{t.expected}</span>
              </div>
            )}
            {t.stdout && (
              <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/50 p-1.5 font-mono text-[11px] text-muted-foreground">
                {t.stdout}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
