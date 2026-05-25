"use client";

import * as React from "react";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onFile: (f: File) => void;
  onGenerate: () => void;
  busy: boolean;
};

export function UploadDropzone({ onFile, onGenerate, busy }: Props) {
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto px-6 py-10">
      <div className="flex w-full max-w-xl flex-col items-center text-center">
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground sm:text-[38px]">
          Let&apos;s clean some data.
        </h1>
        <p className="mb-8 mt-2 text-sm text-muted-foreground">
          Drop a CSV or generate a sample, then build a pipeline to audit and validate.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card px-6 py-12 transition-colors hover:border-primary/50",
            drag && "border-primary bg-primary/5",
          )}
        >
          <Upload className="h-7 w-7 text-muted-foreground" />
          <div className="text-sm font-medium">Drop a CSV here, or click to choose</div>
          <div className="text-xs text-muted-foreground">
            Up to 25 MB · 200,000 rows · 60 columns
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={busy}
          className="mt-5 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/80 shadow-sm transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          )}
          {busy ? "Generating…" : "Generate a sample dataset"}
        </button>
      </div>
    </div>
  );
}
