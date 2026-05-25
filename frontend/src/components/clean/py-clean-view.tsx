"use client";

import * as React from "react";
import {
  ChevronDown,
  Clock,
  Download,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
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
import { DataToolbar, DataView, type DataTab } from "@/components/clean/data-view";
import { PipelinePanel } from "@/components/clean/pipeline-panel";
import { ReviewCard } from "@/components/clean/review-card";
import { UploadDropzone } from "@/components/clean/upload-dropzone";
import { ValidationPanel } from "@/components/clean/validation-panel";
import { HeaderPortal } from "@/components/header-portal";
import { cleanApi, type PyCleanResult } from "@/lib/clean-api";
import { pythonApi } from "@/lib/python-api";
import type {
  DatasetSummary,
  ReviewResponse,
  Rule,
  Step,
} from "@/lib/clean-types";

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
  const [rules, setRules] = React.useState<Rule[]>([]);
  const [run, setRun] = React.useState<PyCleanResult | null>(null);
  const [review, setReview] = React.useState<ReviewResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [reviewing, setReviewing] = React.useState(false);
  const [tab, setTab] = React.useState("data");
  const [dataTab, setDataTab] = React.useState<DataTab>("raw");
  const [saved, setSaved] = React.useState<SavedPipeline[]>([]);
  const [savedOpen, setSavedOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const stepsRef = React.useRef(steps);
  stepsRef.current = steps;
  const rulesRef = React.useRef(rules);
  rulesRef.current = rules;
  const datasetRef = React.useRef(dataset);
  datasetRef.current = dataset;

  React.useEffect(() => setSaved(loadSaved()), []);

  // A fresh run produces cleaned output — surface it. Fall back to raw when
  // there's no cleaned preview (new dataset, reset).
  React.useEffect(() => {
    setDataTab(run?.final_preview ? "cleaned" : "raw");
  }, [run?.final_preview]);

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
      .then((d) => {
        if (d) {
          setDataset(d);
          setRules(d.suggested_rules);
        }
      })
      .catch(() => {});
  }, []);

  async function loadFile(file: File) {
    setLoading(true);
    try {
      const d = await cleanApi.upload(file);
      setDataset(d);
      setRules(d.suggested_rules);
      setSteps([]);
      setRun(null);
      setReview(null);
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
      setRules(d.suggested_rules);
      setSteps([]);
      setRun(null);
      setReview(null);
      toast.success("Generated a messy dataset");
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }

  async function doReview() {
    setReviewing(true);
    try {
      setReview(await cleanApi.pyReview(stepsRef.current, rulesRef.current));
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setReviewing(false);
    }
  }

  const doRun = React.useCallback(async () => {
    setRunning(true);
    try {
      const r = await cleanApi.pyRun(stepsRef.current, rulesRef.current);
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
    setRules([]);
    setRun(null);
    setReview(null);
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
    // No steps yet = the dataset is still raw, so export it as-is.
    const filename = stepsRef.current.length === 0 ? "dataset.csv" : "cleaned.csv";
    try {
      const blob = await cleanApi.pyExportCsv(stepsRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${filename}`);
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
  const cleaned = run?.final_preview ?? null;
  const activeTable = dataTab === "cleaned" && cleaned ? cleaned : dataset.raw_preview;

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
        </div>
      </div>

      {/* Toolbar lives in the global top-right header (like Practice). */}
      <HeaderPortal>
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
      </HeaderPortal>

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
            <div className="m-3 mb-0 flex items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="data">Data</TabsTrigger>
                <TabsTrigger value="audit">Audit</TabsTrigger>
                <TabsTrigger value="validation">Validation</TabsTrigger>
                <TabsTrigger value="review">Coach</TabsTrigger>
              </TabsList>
              {tab === "data" && (
                <DataToolbar
                  view={dataTab}
                  onViewChange={setDataTab}
                  hasCleaned={!!cleaned}
                  table={activeTable}
                />
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              <TabsContent value="data" className="mt-0 h-full">
                <DataView table={activeTable} />
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
              <TabsContent value="validation" className="mt-0">
                <ValidationPanel
                  columns={dataset.columns}
                  rules={rules}
                  results={run?.validation ?? []}
                  onChange={setRules}
                />
              </TabsContent>
              <TabsContent value="review" className="mt-0">
                {reviewing ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Reviewing…
                  </div>
                ) : review ? (
                  <div className="flex flex-col gap-3">
                    <ReviewCard review={review} />
                    <button
                      onClick={doReview}
                      className="self-start text-xs text-primary hover:underline"
                    >
                      Re-run review
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <p className="text-sm text-muted-foreground">
                      Get a coach review of your cleaning pipeline.
                    </p>
                    <Button size="sm" className="gap-1.5" onClick={doReview}>
                      <Sparkles className="h-3.5 w-3.5" /> Get review
                    </Button>
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
