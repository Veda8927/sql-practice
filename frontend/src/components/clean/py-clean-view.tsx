"use client";

import * as React from "react";
import {
  ChevronDown,
  Clock,
  Download,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataView } from "@/components/clean/data-view";
import { PipelinePanel } from "@/components/clean/pipeline-panel";
import { UploadDropzone } from "@/components/clean/upload-dropzone";
import { cleanApi, type PyCleanResult } from "@/lib/clean-api";
import { pythonApi } from "@/lib/python-api";
import type { DatasetSummary, Step } from "@/lib/clean-types";

const STEPS_KEY = "sql-practice:py-clean-steps";
const SAVED_KEY = "sql-practice:py-clean-saved";

type SavedPipeline = { id: string; name: string; steps: Step[]; ts: number };

function loadSteps(): Step[] {
  try {
    const v = window.localStorage.getItem(STEPS_KEY);
    const p = v ? JSON.parse(v) : [];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function loadSaved(): SavedPipeline[] {
  try {
    const v = window.localStorage.getItem(SAVED_KEY);
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
  const [tab, setTab] = React.useState("data");
  const [saved, setSaved] = React.useState<SavedPipeline[]>([]);
  const [savedOpen, setSavedOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const stepsRef = React.useRef(steps);
  stepsRef.current = steps;
  const datasetRef = React.useRef(dataset);
  datasetRef.current = dataset;

  React.useEffect(() => setSaved(loadSaved()), []);

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
      setTab("data");
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

  function persistSaved(next: SavedPipeline[]) {
    setSaved(next);
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      // best effort
    }
  }

  function savePipeline() {
    if (steps.length === 0) {
      toast.error("Add a step before saving.");
      return;
    }
    const entry: SavedPipeline = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()),
      name: `${steps.length} step${steps.length > 1 ? "s" : ""} · ${new Date().toLocaleString()}`,
      steps,
      ts: Date.now(),
    };
    persistSaved([entry, ...saved].slice(0, 20));
    toast.success("Pipeline saved");
  }

  function restorePipeline(p: SavedPipeline) {
    setSteps(p.steps);
    setRun(null);
    setSavedOpen(false);
    toast.success("Pipeline restored");
  }

  function deletePipeline(id: string) {
    persistSaved(saved.filter((p) => p.id !== id));
  }

  async function downloadCsv() {
    setExporting(true);
    try {
      const blob = await cleanApi.pyExportCsv(stepsRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cleaned.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Downloaded cleaned.csv");
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setExporting(false);
    }
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
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-lg text-muted-foreground"
              onClick={savePipeline}
            >
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-lg text-muted-foreground"
                onClick={() => setSavedOpen((o) => !o)}
              >
                <Clock className="h-3.5 w-3.5" /> Saved
                {saved.length > 0 && (
                  <span className="rounded bg-muted px-1 text-[10px] tabular-nums">
                    {saved.length}
                  </span>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
              {savedOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setSavedOpen(false)}
                  />
                  <div className="absolute right-0 z-50 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-background shadow-xl">
                    {saved.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        No saved pipelines yet.
                      </div>
                    ) : (
                      <ul className="max-h-72 overflow-auto py-1">
                        {saved.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50"
                          >
                            <button
                              type="button"
                              onClick={() => restorePipeline(p)}
                              className="min-w-0 flex-1 truncate text-left text-xs"
                            >
                              {p.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => deletePipeline(p.id)}
                              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                              aria-label="Delete saved pipeline"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-lg text-muted-foreground"
              onClick={downloadCsv}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-lg"
              onClick={reset}
            >
              <RotateCcw className="h-3.5 w-3.5" /> New dataset
            </Button>
          </div>
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
          <Tabs value={tab} onValueChange={setTab} className="flex h-full min-h-0 flex-col">
            <TabsList className="m-3 mb-0 self-start">
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              <TabsContent value="data" className="mt-0 h-full">
                <DataView raw={dataset.raw_preview} cleaned={run?.final_preview ?? null} />
              </TabsContent>
              <TabsContent value="audit" className="mt-0">
                {run?.stages.length ? (
                  <div className="space-y-1.5">
                    {run.stages.map((s, i) => {
                      const before = i > 0 ? run.stages[i - 1].row_count : null;
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-md border border-border/60 bg-card/50 px-3 py-2 text-sm"
                        >
                          <span className="font-medium">{s.label}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {before !== null ? `${before} → ` : ""}
                            {s.row_count} rows
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Run the pipeline to see per-step row counts.
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </Panel>
      </PanelGroup>
    </div>
  );
}
