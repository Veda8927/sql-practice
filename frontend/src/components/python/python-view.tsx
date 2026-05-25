"use client";

import * as React from "react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
  usePanelRef,
} from "react-resizable-panels";
import { ArrowRight, Filter, Gauge, Lightbulb, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SourceToggle } from "@/components/source-toggle";
import { CommandSelect, type SelectOption } from "@/components/command-select";
import { PyEditor } from "@/components/python/py-editor";
import { TestResults } from "@/components/python/test-results";
import { SyllabusView } from "@/components/syllabus-view";
import { PY_SYLLABUS } from "@/lib/python-syllabus";
import { pythonApi } from "@/lib/python-api";
import {
  curatedPyHintAt,
  listPyConcepts,
  loadPyConceptBank,
  pickPyExercise,
} from "@/lib/python-curated";
import type {
  PyDifficulty,
  PyExercise,
  PyExplainResponse,
  PyGiveUpResponse,
  PyGradeResult,
  PyHintResponse,
  PyQuestion,
  PyRunResponse,
} from "@/lib/python-types";

type Source = "ai" | "curated";
const DIFFS: PyDifficulty[] = ["easy", "medium", "hard"];

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

type PythonViewProps = {
  view: "learn" | "practice";
  onSwitchToPractice: () => void;
};

export function PythonView({ view, onSwitchToPractice }: PythonViewProps) {
  const wide = useWide();
  const concepts = React.useMemo(() => listPyConcepts(), []);
  const [source, setSource] = React.useState<Source>("ai");
  const [concept, setConcept] = React.useState(concepts[0]?.concept ?? "basics");
  const [difficulty, setDifficulty] = React.useState<PyDifficulty>("easy");

  const [question, setQuestion] = React.useState<PyQuestion | null>(null);
  const [curated, setCurated] = React.useState<PyExercise | null>(null);
  const [code, setCode] = React.useState("");
  const [runResult, setRunResult] = React.useState<PyRunResponse | null>(null);
  const [grade, setGrade] = React.useState<PyGradeResult | null>(null);
  const [hint, setHint] = React.useState<PyHintResponse | null>(null);
  const hintIndex = React.useRef(0);
  const [explanation, setExplanation] = React.useState<PyExplainResponse | null>(null);
  const [solution, setSolution] = React.useState<PyGiveUpResponse | null>(null);

  const [loadingNew, setLoadingNew] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [coachBusy, setCoachBusy] = React.useState(false);
  const [tab, setTab] = React.useState("output");

  const codeRef = React.useRef(code);
  codeRef.current = code;
  const questionRef = React.useRef(question);
  questionRef.current = question;
  const viewRef = React.useRef(view);
  viewRef.current = view;

  // Auto-size the prompt panel to the exercise so the editor/results take the
  // rest of the space (mirrors SQL practice).
  const promptPanelRef = usePanelRef();
  const promptContentRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = promptContentRef.current;
    if (!el) return;
    let frame = 0;
    const obs = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const h = el.scrollHeight;
        if (h > 0) promptPanelRef.current?.resize(`${h + 16}px`);
      });
    });
    obs.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      obs.disconnect();
    };
  }, [promptPanelRef, question]);

  function resetCoach() {
    setRunResult(null);
    setGrade(null);
    setHint(null);
    setExplanation(null);
    setSolution(null);
    hintIndex.current = 0;
  }

  const runNew = React.useCallback(
    async (src: Source, con: string, diff: PyDifficulty) => {
      setLoadingNew(true);
      resetCoach();
      try {
        if (src === "curated") {
          const bank = await loadPyConceptBank(con);
          const ex = pickPyExercise(bank, { difficulty: diff, excludeId: questionRef.current?.id ?? null });
          if (!ex) {
            toast.error(`No curated ${diff} exercises for "${con}" yet. Try AI mode or another concept.`);
            return;
          }
          const q = await pythonApi.loadCurated(ex);
          setQuestion(q);
          setCurated(ex);
          setCode(ex.starter_code || "");
        } else {
          const q = await pythonApi.newQuestion({ concept: con, difficulty: diff });
          setQuestion(q);
          setCurated(null);
          setCode(q.starter_code || "");
        }
        setTab("output");
      } catch (e) {
        toast.error(String((e as Error).message));
      } finally {
        setLoadingNew(false);
      }
    },
    [],
  );

  const newExercise = React.useCallback(
    () => runNew(source, concept, difficulty),
    [runNew, source, concept, difficulty],
  );

  function practiceConcept(con: string) {
    onSwitchToPractice();
    setSource("ai"); // AI mode handles any concept, including ones without a curated bank
    setConcept(con);
    void runNew("ai", con, difficulty);
  }

  async function run() {
    if (!question) return;
    setRunning(true);
    try {
      const r = await pythonApi.run(codeRef.current);
      setRunResult(r);
      setTab("output");
      if (r.timed_out) toast.error("Your code ran too long and was stopped.");
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setRunning(false);
    }
  }

  async function submit() {
    if (!question) return;
    setSubmitting(true);
    try {
      const g = await pythonApi.submit(codeRef.current);
      setGrade(g);
      setTab("tests");
      if (g.status === "correct") toast.success("All tests passed! 🎉");
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFormat() {
    try {
      setCode(await pythonApi.format(codeRef.current));
    } catch (e) {
      toast.error(String((e as Error).message));
    }
  }

  async function getHint() {
    if (!question) return;
    setTab("coach");
    if (source === "curated" && curated) {
      setHint(curatedPyHintAt(curated, hintIndex.current));
      hintIndex.current += 1;
      return;
    }
    setCoachBusy(true);
    try {
      setHint(await pythonApi.hint(codeRef.current));
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setCoachBusy(false);
    }
  }

  async function explain() {
    setTab("coach");
    setCoachBusy(true);
    try {
      setExplanation(await pythonApi.explain());
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setCoachBusy(false);
    }
  }

  async function giveUp() {
    setTab("coach");
    setCoachBusy(true);
    try {
      setSolution(await pythonApi.giveUp());
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setCoachBusy(false);
    }
  }

  // Global ⌘↵ run / ⌘⇧↵ submit, matching SQL practice. Kept in refs so the
  // listener stays attached once while always calling the latest handlers.
  const runFnRef = React.useRef(run);
  runFnRef.current = run;
  const submitFnRef = React.useRef(submit);
  submitFnRef.current = submit;
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key !== "Enter") return;
      if (viewRef.current !== "practice" || !questionRef.current) return;
      const target = e.target as HTMLElement | null;
      // Monaco binds ⌘↵ / ⌘⇧↵ inside the editor — let it handle those itself.
      if (target?.closest(".monaco-editor")) return;
      e.preventDefault();
      if (e.shiftKey) submitFnRef.current();
      else runFnRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const conceptOptions: SelectOption<string>[] = concepts.map((c) => ({
    value: c.concept,
    label: c.label,
  }));
  const diffOptions: SelectOption<PyDifficulty>[] = DIFFS.map((d) => ({
    value: d,
    label: d.charAt(0).toUpperCase() + d.slice(1),
  }));

  // Shared prompt zone (SQL-practice style). Shown alone before an exercise
  // exists, then in the top panel once the editor/results split appears.
  const promptZone = (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-8 flex justify-center">
        <div className="w-[220px]">
          <SourceToggle value={source} onChange={setSource} disabled={loadingNew} />
        </div>
      </div>
      <div className="min-h-[64px]">
        {loadingNew ? (
          <div className="flex items-center gap-3 text-base text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Writing your exercise…
          </div>
        ) : question ? (
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
              {question.entrypoint && (
                <span className="font-mono text-foreground/70">
                  def {question.entrypoint}(…)
                </span>
              )}
              <span>· {question.test_count} tests</span>
            </div>
            <h2 className="whitespace-pre-wrap text-[20px] font-medium leading-snug tracking-tight text-foreground sm:text-[22px]">
              {question.prompt}
            </h2>
          </div>
        ) : (
          <p className="max-w-2xl text-[22px] font-medium leading-snug tracking-tight text-muted-foreground">
            Choose a concept, then{" "}
            <span className="text-foreground">start your first exercise</span>.
          </p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <CommandSelect
            label="Concept"
            value={concept}
            options={conceptOptions}
            icon={<Filter className="h-3.5 w-3.5" />}
            disabled={loadingNew}
            onChange={setConcept}
          />
          <CommandSelect
            label="Difficulty"
            value={difficulty}
            options={diffOptions}
            icon={<Gauge className="h-3.5 w-3.5" />}
            disabled={loadingNew}
            onChange={setDifficulty}
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {question && (
            <Button size="sm" variant="ghost" onClick={getHint} className="h-8 shrink-0 rounded-lg text-xs">
              <Lightbulb className="h-3.5 w-3.5" /> Hint
            </Button>
          )}
          {question && (
            <Button size="sm" variant="ghost" onClick={giveUp} className="h-8 shrink-0 rounded-lg text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Solution
            </Button>
          )}
          <Button size="sm" onClick={newExercise} disabled={loadingNew} className="h-8 shrink-0 rounded-lg">
            {loadingNew ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
            {question ? "New exercise" : "Start exercise"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {view === "learn" ? (
        <div className="min-h-0 flex-1">
          <SyllabusView syllabus={PY_SYLLABUS} onPracticeConcept={practiceConcept} />
        </div>
      ) : !question ? (
        <div className="h-full overflow-auto">
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full">{promptZone}</div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <PanelGroup orientation="vertical" className="h-full w-full">
            <Panel
              defaultSize="40%"
              minSize="12%"
              panelRef={promptPanelRef}
              className="min-h-0"
            >
              <div className="h-full overflow-auto">
                <div ref={promptContentRef}>{promptZone}</div>
              </div>
            </Panel>
            <PanelResizeHandle className="h-px bg-border transition-colors hover:bg-primary/40" />
            <Panel defaultSize="60%" minSize="30%" className="min-h-0">
              <PanelGroup orientation={wide ? "horizontal" : "vertical"} className="h-full w-full">
            <Panel defaultSize="50%" minSize="25%" className="min-h-0">
              <div className="h-full p-3">
                <PyEditor
                  value={code}
                  onChange={setCode}
                  onRun={run}
                  onSubmit={submit}
                  onFormat={handleFormat}
                  running={running}
                  submitting={submitting}
                />
              </div>
            </Panel>
            <PanelResizeHandle
              className={wide ? "w-px bg-border hover:bg-primary/40" : "h-px bg-border hover:bg-primary/40"}
            />
            <Panel defaultSize="50%" minSize="25%" className="min-h-0">
            <Tabs value={tab} onValueChange={setTab} className="flex h-full min-h-0 flex-col">
              <TabsList className="m-3 mb-0 self-start">
                <TabsTrigger value="output">Output</TabsTrigger>
                <TabsTrigger value="tests">Tests</TabsTrigger>
                <TabsTrigger value="coach">Coach</TabsTrigger>
              </TabsList>
              <div className="min-h-0 flex-1 overflow-auto p-3">
                <TabsContent value="output" className="mt-0">
                  {runResult ? (
                    <div className="flex flex-col gap-2">
                      {runResult.stdout && (
                        <pre className="whitespace-pre-wrap rounded-md border border-border/60 bg-card/50 p-3 font-mono text-xs">
                          {runResult.stdout}
                        </pre>
                      )}
                      {runResult.stderr && (
                        <pre className="whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/5 p-3 font-mono text-xs text-destructive">
                          {runResult.stderr}
                        </pre>
                      )}
                      {!runResult.stdout && !runResult.stderr && (
                        <div className="text-sm text-muted-foreground">No output.</div>
                      )}
                      <div className="text-[11px] text-muted-foreground">
                        {runResult.duration_ms} ms{runResult.sandboxed ? " · sandboxed" : " · UNSANDBOXED"}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Press <span className="font-medium">Run</span> (⌘↵) to execute your code.
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="tests" className="mt-0">
                  {grade ? (
                    <TestResults grade={grade} />
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Press <span className="font-medium">Submit</span> (⌘⇧↵) to run the tests.
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="coach" className="mt-0">
                  <div className="flex flex-col gap-3">
                    {coachBusy && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                      </div>
                    )}
                    {hint && (
                      <div className="rounded-lg border border-border bg-card p-3">
                        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Lightbulb className="h-3.5 w-3.5 text-primary" /> Hint
                        </div>
                        <p className="text-sm">{hint.hint}</p>
                        {hint.suggested_code && (
                          <pre className="mt-2 whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono text-xs">
                            {hint.suggested_code}
                          </pre>
                        )}
                        {source === "curated" && curated && (
                          <button onClick={getHint} className="mt-2 text-xs text-primary hover:underline">
                            Next hint
                          </button>
                        )}
                      </div>
                    )}
                    {source === "ai" && grade && grade.status === "wrong" && (
                      <Button size="sm" variant="outline" className="self-start" onClick={explain}>
                        Explain what went wrong
                      </Button>
                    )}
                    {explanation && (
                      <div className="rounded-lg border border-border bg-card p-3 text-sm">
                        {explanation.explanation}
                      </div>
                    )}
                    {solution && (
                      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                        <div className="text-sm font-medium">Solution</div>
                        {solution.summary && <p className="text-sm text-foreground/90">{solution.summary}</p>}
                        {solution.steps.map((s, i) => (
                          <div key={i} className="border-t border-border/60 pt-2">
                            <div className="text-sm font-medium">{s.title}</div>
                            <p className="text-xs text-muted-foreground">{s.what_it_does}</p>
                            {s.code && (
                              <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono text-xs">
                                {s.code}
                              </pre>
                            )}
                            <p className="mt-1 text-xs text-foreground/80">{s.how_it_runs}</p>
                          </div>
                        ))}
                        {solution.reference_solution && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground">Full reference solution</summary>
                            <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono">
                              {solution.reference_solution}
                            </pre>
                          </details>
                        )}
                        {solution.final_thought && (
                          <p className="text-xs italic text-muted-foreground">{solution.final_thought}</p>
                        )}
                      </div>
                    )}
                    {!hint && !explanation && !solution && !coachBusy && (
                      <div className="text-sm text-muted-foreground">
                        Stuck? Use <span className="font-medium">Hint</span> or{" "}
                        <span className="font-medium">Solution</span>.
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
        </div>
      )}
    </div>
  );
}
