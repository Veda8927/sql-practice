"use client";

import * as React from "react";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-16 text-center">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Clean a messy dataset</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV, then clean it with SQL — audited, validated, and reviewed step by step.
        </p>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-card px-6 py-12 transition-colors hover:border-primary/50",
          drag && "border-primary bg-primary/5",
        )}
      >
        <Upload className="h-7 w-7 text-muted-foreground" />
        <div className="text-sm font-medium">Drop a CSV here, or click to choose</div>
        <div className="text-xs text-muted-foreground">Up to 25 MB · 200,000 rows · 60 columns</div>
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-px w-8 bg-border" /> or <span className="h-px w-8 bg-border" />
      </div>
      <Button variant="outline" onClick={onGenerate} disabled={busy} className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Generate a sample messy dataset
      </Button>
    </div>
  );
}
