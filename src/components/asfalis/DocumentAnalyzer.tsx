import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ListChecks,
  Loader2,
  ShieldAlert,
  UploadCloud,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useLocalState } from "@/lib/asfalis-store";
import { analyzeDocument } from "@/lib/asfalis-ai.functions";
import { extractPdfText, SCANNED_PDF_MESSAGE } from "@/lib/pdf-text";

type Risk = { level: "High" | "Medium" | "Low"; title: string; detail: string };

export type Analysis = {
  fileName: string;
  fileSize: number;
  parsed: boolean;
  words: number;
  characters: number;
  keyTerms: { term: string; count: number }[];
  redactions: { label: string; count: number }[];
  summary: string[];
  actions: string[];
  risks: Risk[];
  completedAt: string;
};

const STEPS = [
  "Step 1: Parsing text locally...",
  "Step 2: Redacting PII...",
  "Step 3: Generating private summary...",
];

const SECURITY_FOOTER = "Processed on-device — 0 KB transmitted.";


// Generic English + legal boilerplate words excluded from key-term extraction.
const STOPWORDS = new Set(
  ("the and that with this from for shall such any all will may not are was were has " +
    "have had been their them they which where when whom whose whose herein hereof " +
    "hereby thereof thereto pursuant subject including included other either neither " +
    "both each between among within without under above below before after during " +
    "these those there whereof whereby what whose into upon per via than then also " +
    "only some more most less least must would could should might being does done " +
    "party parties agreement made enter entered made effective first second third " +
    "written provided however respect means meaning person persons time times date " +
    "days day month months year years section clause schedule exhibit page pages " +
    "total amount amounts value values terms term use used using new one two no yes")
    .split(/\s+/),
);


/**
 * Extracts the top recurring long words from real document text.
 * - normalises case and strips punctuation
 * - ignores numbers, short words (<5 chars) and generic stop-words
 * - returns the 3-4 most frequent terms with their counts
 */
function extractKeyTerms(text: string): { term: string; count: number }[] {
  const counts = new Map<string, number>();
  const words = text.toLowerCase().match(/[a-z][a-z'-]{4,}/g) ?? [];
  for (const raw of words) {
    const word = raw.replace(/['-]+$/, "");
    if (word.length < 5 || STOPWORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([term, count]) => ({
      term: term.charAt(0).toUpperCase() + term.slice(1),
      count,
    }));
}

function buildSummary(
  fileName: string,
  words: number,
  keyTerms: { term: string; count: number }[],
): string[] {
  const focus = keyTerms.length
    ? keyTerms.map((k) => k.term).join(", ")
    : "no dominant recurring terms were detected";
  return [
    `Successfully read ${fileName} locally. Detected ${words.toLocaleString()} words. Key focus areas identified: ${focus}.`,
  ];
}

function analyseText(
  text: string,
  fileName: string,
  fileSize: number,
): Analysis {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const emails = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g)?.length ?? 0;
  const phones = text.match(/(\+?\d[\d\s().-]{7,}\d)/g)?.length ?? 0;
  const ids = text.match(/\b\d{3}-\d{2}-\d{4}\b/g)?.length ?? 0;
  const dates =
    text.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g)?.length ?? 0;
  const keyTerms = extractKeyTerms(text);

  const actions = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40)
    .filter((s) => /\b(shall|must|will|require[sd]?|agree[sd]?|deadline)\b/i.test(s))
    .slice(0, 5)
    .map((s) => (s.length > 220 ? `${s.slice(0, 217)}...` : s));

  const risks: Risk[] = [];
  if (/indemnif|liabilit/i.test(text))
    risks.push({
      level: "High",
      title: "Liability / indemnity language detected",
      detail:
        "The document contains indemnity or liability wording. Verify whether an aggregate cap is present.",
    });
  if (/terminat|renew/i.test(text))
    risks.push({
      level: "Medium",
      title: "Termination or renewal mechanics",
      detail:
        "Termination or renewal clauses were found. Confirm notice periods and diarise key dates.",
    });
  if (emails + phones + ids > 0)
    risks.push({
      level: "Medium",
      title: "Personal data present in source file",
      detail: `${emails + phones + ids} personal identifier(s) were found and redacted in memory before summarisation.`,
    });
  if (!risks.length)
    risks.push({
      level: "Low",
      title: "No high-signal risk language detected",
      detail:
        "The local model found no indemnity, liability, or termination clauses in this document.",
    });

  return {
    fileName,
    fileSize,
    parsed: true,
    words,
    characters: text.length,
    keyTerms,
    redactions: [
      { label: "Email addresses", count: emails },
      { label: "Phone numbers", count: phones },
      { label: "National ID numbers", count: ids },
      { label: "Dates", count: dates },
    ],
    summary: buildSummary(fileName, words, keyTerms),
    actions: actions.length
      ? actions
      : ["No obligation language ('shall', 'must', 'require') was detected."],
    risks,
    completedAt: new Date().toISOString(),
  };
}


const TABS = [
  { key: "summary", label: "Bullet Point Summary", icon: FileText },
  { key: "actions", label: "Key Action Items", icon: ListChecks },
  { key: "risks", label: "Risk Analysis Report", icon: ShieldAlert },
] as const;

const riskTone: Record<Risk["level"], string> = {
  High: "border-destructive/40 bg-destructive/10 text-destructive",
  Medium: "border-warning/40 bg-warning/10 text-warning",
  Low: "border-primary/40 bg-primary/10 text-primary",
};

export function DocumentAnalyzer({
  onEvent,
}: {
  onEvent: (action: string) => void;
}) {
  const [storedAnalysis, setAnalysis] = useLocalState<Analysis | null>(
    "asfalis.analysis",
    null,
  );
  // Older saved sessions may lack newer fields — normalise before render.
  const analysis: Analysis | null = storedAnalysis
    ? {
        ...storedAnalysis,
        keyTerms: storedAnalysis.keyTerms ?? [],
        summary: storedAnalysis.summary ?? [],
        actions: storedAnalysis.actions ?? [],
        risks: storedAnalysis.risks ?? [],
        words: storedAnalysis.words ?? 0,
        characters: storedAnalysis.characters ?? 0,
      }
    : null;
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState(-1);
  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("summary");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setDocContext] = useLocalState<{
    name: string;
    text: string;
  } | null>("asfalis.doc", null);
  const runAnalysis = useServerFn(analyzeDocument);

  // Shared pipeline: takes already-extracted text (from a file or pasted
  // directly) and runs the local metrics + AI analysis steps.
  const analyze = useCallback(
    async (name: string, readable: string) => {
      setCurrent(name);
      setAnalysis(null);
      setError(null);
      onEvent(`Document ingested: ${name}`);

      // Step 1 — text content is in hand.
      setStep(0);
      await new Promise((r) => setTimeout(r, 350));

      // Step 2 — local metrics + PII scan.
      setStep(1);
      const local = analyseText(readable, name, readable.length);
      setDocContext({ name, text: readable.slice(0, 40000) });
      await new Promise((r) => setTimeout(r, 350));

      // Step 3 — AI-generated summary, action items and risk assessment.
      setStep(2);
      try {
        const ai = await runAnalysis({
          data: { fileName: name, text: readable },
        });
        setAnalysis({
          ...local,
          summary: ai.summary.length ? ai.summary : local.summary,
          actions: ai.actions.length ? ai.actions : local.actions,
          risks: ai.risks.length ? ai.risks : local.risks,
        });
        onEvent(`AI document summary generated: ${name}`);
      } catch (e) {
        setAnalysis(local);
        setError(
          e instanceof Error
            ? e.message
            : "The AI analysis could not be completed.",
        );
        onEvent(`AI analysis failed, local metrics shown: ${name}`);
      }
      setStep(STEPS.length);
      setTab("summary");
    },
    [onEvent, runAnalysis, setAnalysis, setDocContext],
  );

  const process = useCallback(
    async (file: File) => {
      // Step 1 — read the real text content of the file in the browser.
      setCurrent(file.name);
      setAnalysis(null);
      setError(null);
      onEvent(`Document ingested: ${file.name}`);
      setStep(0);
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      let readable = "";

      if (isPdf) {
        try {
          readable = await extractPdfText(file);
        } catch (e) {
          setStep(-1);
          setError(
            e instanceof Error
              ? e.message
              : "This PDF could not be opened on this machine.",
          );
          onEvent(`PDF could not be opened: ${file.name}`);
          return;
        }
        // Only a document with no text layer at all is treated as a scan.
        if (readable.replace(/\s/g, "").length === 0) {
          setStep(-1);
          setError(SCANNED_PDF_MESSAGE);
          onEvent(`Scanned PDF rejected (no text layer): ${file.name}`);
          return;
        }
      } else {
        let text = "";
        try {
          text = await file.text();
        } catch {
          text = "";
        }
        const printable = text.replace(
          /[^\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]/g,
          "",
        );
        readable =
          text.length > 0 && printable.length / text.length > 0.7
            ? printable
            : "";

        if (readable.trim().length < 40) {
          setStep(-1);
          setError(
            `Could not extract readable text from ${file.name}. Text-selectable PDFs and plain-text formats (.txt, .md, .csv, .json, .log) are supported.`,
          );
          onEvent(`Text extraction failed: ${file.name}`);
          return;
        }
      }

      await analyze(file.name, readable);
    },
    [analyze, onEvent],
  );

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void process(file);
  };

  const analyzePasted = () => {
    const text = pasted.trim();
    if (text.length < 40) {
      setError("Paste at least a few sentences of text to analyze.");
      return;
    }
    setPasted("");
    void analyze("Pasted Text", text);
  };

  const running = step >= 0 && step < STEPS.length;
  const progress =
    step < 0 ? 0 : Math.min(100, ((step + 1) / STEPS.length) * 100);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files);
          }}
          className={`relative flex min-h-72 flex-col items-center justify-center rounded-sm border border-dashed p-10 text-center transition-all duration-200 ${
            dragging
              ? "glow-primary border-primary bg-primary/8"
              : current
                ? "border-primary/60 bg-primary/[0.04]"
                : "border-border bg-card/45 hover:border-primary/50 hover:bg-card/70"
          }`}
        >
          <UploadCloud
            className={`mb-5 size-10 ${dragging || current ? "text-primary" : "text-muted-foreground"}`}
          />
          <p className="font-display text-lg font-semibold">
            Drag &amp; Drop Client Documents Here
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            PDF, DOCX or TXT — files never leave this machine.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-6 rounded-sm border border-primary/50 bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Browse local files
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,.csv,.json,.log"
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          {current && (
            <p className="mt-4 font-mono text-xs text-primary">
              Loaded: {current}
            </p>
          )}
        </div>

        <div className="panel rounded-sm p-6">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.15em]">
            Alternative: Paste Document Text Natively
          </h2>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="If your file is an unreadable format, paste the raw text here for instant local analysis..."
            rows={6}
            className="mt-4 w-full resize-y rounded-md border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-secondary/60"
          />
          <div className="mt-4 flex items-center justify-between gap-4">
            <span className="font-mono text-[11px] text-muted-foreground">
              {pasted.trim().length.toLocaleString()} characters pasted
            </span>
            <button
              type="button"
              onClick={analyzePasted}
              disabled={running || pasted.trim().length < 40}
              className="rounded-sm border border-primary/50 bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Analyze Pasted Text
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-sm border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </p>
        )}


        <div className="panel rounded-sm p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.15em]">
              Local Processing Timeline
            </h2>
            <span className="font-mono text-[11px] text-muted-foreground">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <ol className="space-y-3">
            {STEPS.map((label, i) => {
              const done = step > i;
              const active = step === i;
              return (
                <li key={label} className="flex items-center gap-3 text-sm">
                  {done ? (
                    <CheckCircle2 className="size-4 text-primary" />
                  ) : active ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <span className="size-4 rounded-full border border-border" />
                  )}
                  <span
                    className={
                      done || active ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
          {step === -1 && (
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              Awaiting document. Pipeline idle.
            </p>
          )}
        </div>
      </div>

      <div className="panel flex min-h-[30rem] flex-col rounded-sm p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.15em]">
            Insights Dashboard
          </h2>
          {analysis && (
            <span className="font-mono text-[11px] text-primary">
              AI analysis of {analysis.fileName}
            </span>
          )}
        </div>

        {!analysis ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            {running ? (
              <>
                <Loader2 className="mb-3 size-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{STEPS[step]}</p>
              </>
            ) : (
              <>
                <FileText className="mb-3 size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Upload a document to populate summary, action items and risk
                  analysis.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {[
                { k: "Word Count", v: analysis.words.toLocaleString() },
                { k: "Characters", v: analysis.characters.toLocaleString() },
                {
                  k: "PII redacted",
                  v: analysis.redactions
                    .reduce((a, r) => a + r.count, 0)
                    .toString(),
                },
              ].map((s) => (
                <div
                  key={s.k}
                  className="rounded-md border border-border bg-surface-raised p-3"
                >
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.k}
                  </p>
                  <p className="mt-1 font-display text-lg">{s.v}</p>
                </div>
              ))}
            </div>

            <div className="mb-4 flex flex-wrap gap-1 rounded-md border border-border bg-secondary/50 p-1">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-xs transition-colors ${
                    tab === key
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-1 text-sm leading-relaxed">
              {tab === "summary" && (
                <div className="space-y-4">
                  <ul className="space-y-3">
                    {analysis.summary.map((s, i) => (
                      <li
                        key={i}
                        className="flex gap-3 rounded-md border border-primary/30 bg-primary/[0.06] p-4"
                      >
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="text-foreground">{s}</span>
                      </li>
                    ))}
                  </ul>
                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Key Terms Found
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.keyTerms.length ? (
                        analysis.keyTerms.map((k) => (
                          <span
                            key={k.term}
                            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface-raised px-3 py-1.5 text-xs text-foreground"
                          >
                            {k.term}
                            <span className="font-mono text-[10px] text-primary">
                              ×{k.count}
                            </span>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No recurring terms of 5+ letters were detected in this
                          file.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {tab === "actions" && (
                <ul className="space-y-2">
                  {analysis.actions.map((a, i) => (
                    <li
                      key={i}
                      className="flex gap-3 rounded-md border border-border bg-surface-raised p-3"
                    >
                      <ListChecks className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              )}
              {tab === "risks" && (
                <ul className="space-y-3">
                  {analysis.risks.map((r, i) => (
                    <li
                      key={i}
                      className="rounded-md border border-border bg-surface-raised p-3"
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <AlertTriangle className="size-4 text-muted-foreground" />
                        <span className="font-medium">{r.title}</span>
                        <span
                          className={`ml-auto rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${riskTone[r.level]}`}
                        >
                          {r.level}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{r.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="mt-4 border-t border-border pt-3 text-center font-mono text-[11px] text-muted-foreground">
              {SECURITY_FOOTER}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
