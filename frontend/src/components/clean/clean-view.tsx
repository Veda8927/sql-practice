"use client";

import * as React from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLog } from "@/components/clean/audit-log";
import { DataView } from "@/components/clean/data-view";
import { PipelinePanel } from "@/components/clean/pipeline-panel";
import { ReviewCard } from "@/components/clean/review-card";
import { UploadDropzone } from "@/components/clean/upload-dropzone";
import { ValidationPanel } from "@/components/clean/validation-panel";
import { cleanApi } from "@/lib/clean-api";
import type {
  DatasetSummary,
  ReviewResponse,
  Rule,
  RunResponse,
  Step,
} from "@/lib/clean-types";

export function CleanView() {
  const [dataset, setDataset] = React.useState<DatasetSummary | null>(null);
  const [steps, setSteps] = React.useState<Step[]>([]);
  const [rules, setRules] = React.useState<Rule[]>([]);
  const [run, setRun] = React.useState<RunResponse | null>(null);
  const [review, setReview] = React.useState<ReviewResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [reviewing, setReviewing] = React.useState(false);
  const [tab, setTab] = React.useState("data");

  // Keep the latest steps/rules in refs so callbacks used by effects stay current.
  const stepsRef = React.useRef(steps);
  stepsRef.current = steps;
  const rulesRef = React.useRef(rules);
  rulesRef.current = rules;

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

  const doRun = React.useCallback(async () => {
    setRunning(true);
    try {
      const r = await cleanApi.run(stepsRef.current, rulesRef.current);
      setRun(r);
      if (!r.ok && r.error_message) toast.error(r.error_message);
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setRunning(false);
    }
  }, []);

  // Re-validate when rules change, but only once we already have a successful run.
  const hasRun = run?.ok ?? false;
  React.useEffect(() => {
    if (hasRun) void doRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules]);

  async function doReview() {
    setReviewing(true);
    setTab("review");
    try {
      setReview(await cleanApi.review(stepsRef.current, rulesRef.current));
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setReviewing(false);
    }
  }

  async function reset() {
    await cleanApi.reset().catch(() => {});
    setDataset(null);
    setSteps([]);
    setRules([]);
    setRun(null);
    setReview(null);
  }

  if (!dataset) {
    return <UploadDropzone onFile={loadFile} onGenerate={generate} busy={loading} />;
  }

  const stageRowCounts = run?.stages.map((s) => s.row_count) ?? [dataset.row_count];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">
            {dataset.source === "generated" ? "Sample dataset" : "Your dataset"}
          </span>
          <span className="text-muted-foreground">
            · {dataset.row_count} rows · {dataset.columns.length} cols
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={doReview}
            disabled={reviewing}
          >
            {reviewing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            AI review
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground"
            onClick={reset}
          >
            <RotateCcw className="h-3.5 w-3.5" /> New dataset
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="min-h-0 border-b border-border lg:border-b-0 lg:border-r">
          <PipelinePanel
            steps={steps}
            onChange={setSteps}
            onRun={doRun}
            running={running}
            failedIndex={run?.failed_step_index ?? null}
            errorMessage={run?.error_message ?? null}
            stageRowCounts={stageRowCounts}
          />
        </div>

        <div className="flex min-h-0 flex-col">
          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="m-3 mb-0 self-start">
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="review">AI review</TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              <TabsContent value="data" className="mt-0 h-full">
                <DataView raw={dataset.raw_preview} cleaned={run?.final_preview ?? null} />
              </TabsContent>
              <TabsContent value="audit" className="mt-0">
                <AuditLog stages={run?.stages ?? []} />
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
                  <ReviewCard review={review} />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Click “AI review” to get feedback on your pipeline.
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
