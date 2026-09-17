import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { StatusBar } from "@/components/asfalis/StatusBar";
import { Sidebar, type ViewKey } from "@/components/asfalis/Sidebar";
import { DocumentAnalyzer } from "@/components/asfalis/DocumentAnalyzer";
import { ChatView } from "@/components/asfalis/ChatView";
import { AuditView } from "@/components/asfalis/AuditView";
import { SettingsView } from "@/components/asfalis/SettingsView";
import { makeEvent, useLocalState, type AuditEvent } from "@/lib/asfalis-store";

const title = "Asfalis — Offline AI Workspace for Legal & Finance";
const description =
  "Asfalis analyses contracts and client documents entirely on your machine. No uploads, no cloud, no data leaving the device.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const SEED_LOGS: AuditEvent[] = [
  makeEvent("Workspace vault unlocked", "Encrypted Local Disk"),
  makeEvent("Model loaded: Llama 3 (8B)", "GPU VRAM (4.2 GB)"),
  makeEvent("Outbound network interface disabled", "Local Kernel Policy"),
];

function Index() {
  const [view, setView] = useLocalState<ViewKey>("asfalis.view", "analyzer");
  const [logs, setLogs] = useLocalState<AuditEvent[]>("asfalis.logs", SEED_LOGS);

  const onEvent = useCallback(
    (action: string) => setLogs((prev) => [makeEvent(action), ...prev]),
    [setLogs],
  );

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <StatusBar />
      <div className="flex flex-col md:flex-row">
        <Sidebar active={view} onSelect={setView} />
        <main className="grid-backdrop min-h-[calc(100vh-48px)] flex-1 overflow-x-hidden px-5 py-8 lg:px-12 lg:py-11">
          <div key={view} className="mx-auto max-w-[1480px] animate-in fade-in duration-300">
            <header className="mb-9 flex items-end justify-between gap-6 border-b border-border pb-7">
              <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Secure local workspace</p>
              <h1 className="font-display text-3xl font-semibold leading-tight">
                {view === "analyzer" && "Document Analyzer"}
                {view === "chat" && "Private Workspace Chat"}
                {view === "logs" && "Audit & Security Logs"}
                {view === "settings" && "Settings"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {view === "analyzer" &&
                  "Ingest client files and generate summaries without a network connection."}
                {view === "chat" &&
                  "Interrogate your matter documents with a locally hosted model."}
                {view === "logs" &&
                  "Every action, where the data lived, and what was sent to the web."}
                {view === "settings" &&
                  "Model, hardware and privacy configuration for this machine."}
              </p>
              </div>
              <span className="hidden border border-border bg-card/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground lg:block">Session 01 · Private</span>
            </header>

            {view === "analyzer" && <DocumentAnalyzer onEvent={onEvent} />}
            {view === "chat" && <ChatView onEvent={onEvent} />}
            {view === "logs" && <AuditView events={logs} />}
            {view === "settings" && <SettingsView onEvent={onEvent} />}
          </div>
        </main>
      </div>
    </div>
  );
}
