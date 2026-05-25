"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataView } from "@/components/clean/data-view";
import { PipelinePanel } from "@/components/clean/pipeline-panel";
import { UploadDropzone } from "@/components/clean/upload-dropzone";
import { cleanApi, type PyCleanResult } from "@/lib/clean-api";
import { pythonApi } from "@/lib/python-api";
import type { DatasetSummary, Step } from "@/lib/clean-types";

const STEPS_KEY = "sql-practice:py-clean-steps";

function loadSteps(): Step[] {
  try {
    const v = window.localStorage.getItem(STEPS_KEY);
    const p = v ? JSON.parse(v) : [];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function useWide() {
  const [wide, setWide] = React.useState(true);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

export function PyCleanView() {
  const wide = useWide();
  const [dataset, setDataset] = React.useState<DatasetSummary | null>(null);
  const [steps, setSteps] = React.useState<Step[]>(loadSteps);
  const [run, setRun] = React.useState<PyCleanResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [running, setRunning] = React.useState(false);

  const stepsRef = React.useRef(steps);
  stepsRef.current = steps;
  const datasetRef = React.useRef(dataset);
  datasetRef.current = dataset;

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STEPS_KEY, JSON.stringify(steps));
    } catch {
      // best effort
    }
  }, [steps]);

  React.useEffect(() => {
    cleanApi
      .getDataset()
      .then((d) => d && setDataset(d))
      .catch(() => {});
  }, []);

  async function loadFile(file: File) {
    setLoading(true);
    try {
      const d = await cleanApi.upload(file);
      setDataset(d);
      setSteps([]);
      setRun(null);
      toast.success(`Loaded ${d.row_count} rows`);
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    setLoading(true);
    try {
      const d = await cleanApi.generate();
      setDataset(d);
      setSteps([]);
      setRun(null);
      toast.success("Generated a messy dataset");
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }

  const doRun = React.useCallback(async () => {
    setRunning(true);
    try {
      const r = await cleanApi.pyRun(stepsRef.current);
      setRun(r);
      if (!r.ok && r.error_message) toast.error(r.error_message);
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setRunning(false);
    }
  }, []);

  const doFormat = React.useCallback(async () => {
    const current = stepsRef.current;
    if (current.length === 0) return;
    try {
      const formatted = await Promise.all(
        current.map((s) => pythonApi.format(s.sql)),
      );
      setSteps(current.map((s, i) => ({ ...s, sql: formatted[i] })));
    } catch (e) {
      toast.error(String((e as Error).message));
    }
  }, []);

  const doFormatRef = React.useRef(doFormat);
  doFormatRef.current = doFormat;

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || !datasetRef.current || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (e.key === "Enter" && !e.shiftKey) {
        if (target?.closest(".monaco-editor")) return;
        e.preventDefault();
        void doRun();
      } else if (e.key.toLowerCase() === "f" && !e.shiftKey) {
        // Capture phase + stopPropagation so this beats Monaco's find widget.
        e.preventDefault();
        e.stopPropagation();
        void doFormatRef.current();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [doRun]);

  async function reset() {
    await cleanApi.reset().catch(() => {});
    setDataset(null);
    setSteps([]);
    setRun(null);
  }

  if (!dataset) {
    return <UploadDropzone onFile={loadFile} onGenerate={generate} busy={loading} />;
  }

  const stageRowCounts = run?.stages.map((s) => s.row_count) ?? [dataset.row_count];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-start justify-between gap-3 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-[18px] font-medium leading-snug tracking-tight text-foreground">
              Clean the {dataset.source === "generated" ? "sample" : "uploaded"} dataset
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {dataset.row_count} rows · {dataset.columns.length} cols · build a
              pipeline of <code className="font-mono">pandas</code> steps on{" "}
              <code className="font-mono">prev</code>.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1.5 rounded-lg"
            onClick={reset}
          >
            <RotateCcw className="h-3.5 w-3.5" /> New dataset
          </Button>
        </div>
      </div>

      <PanelGroup orientation={wide ? "horizontal" : "vertical"} className="min-h-0 flex-1">
        <Panel defaultSize="45%" minSize="25%" className="min-h-0">
          <PipelinePanel
            language="python"
            steps={steps}
            onChange={setSteps}
            onRun={doRun}
            onFormat={doFormat}
            running={running}
            failedIndex={run?.failed_step_index ?? null}
            errorMessage={run?.error_message ?? null}
            stageRowCounts={stageRowCounts}
          />
        </Panel>
        <PanelResizeHandle
          className={
            wide
              ? "w-px bg-border transition-colors hover:bg-primary/40"
              : "h-px bg-border transition-colors hover:bg-primary/40"
          }
        />
        <Panel defaultSize="55%" minSize="30%" className="min-h-0">
          <div className="flex h-full min-h-0 flex-col p-3">
            <DataView raw={dataset.raw_preview} cleaned={run?.final_preview ?? null} />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
