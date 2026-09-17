import { useEffect, useRef, useState } from "react";
import { FileText, Paperclip, ShieldCheck, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useLocalState } from "@/lib/asfalis-store";
import { chatWithDocument } from "@/lib/asfalis-ai.functions";
import { extractPdfText, SCANNED_PDF_MESSAGE } from "@/lib/pdf-text";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";

type Message = { id: string; role: "user" | "assistant"; content: string };

const SECURITY_FOOTER = "Processed on-device — 0 KB transmitted.";

function withFooter(text: string) {
  return text.includes(SECURITY_FOOTER)
    ? text
    : `${text.trim()}\n\n${SECURITY_FOOTER}`;
}

export function ChatView({ onEvent }: { onEvent: (action: string) => void }) {
  const [messages, setMessages] = useLocalState<Message[]>("asfalis.chat.v3", []);
  const [doc, setDoc] = useLocalState<{ name: string; text: string } | null>(
    "asfalis.chat.document.v2",
    null,
  );
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const askAi = useServerFn(chatWithDocument);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const attachFile = async (file: File) => {
    setAttachmentError(null);
    setLoadingFile(true);
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const text = isPdf ? await extractPdfText(file) : await file.text();
      if (!text.replace(/\s/g, "")) throw new Error(isPdf ? SCANNED_PDF_MESSAGE : "This text file is empty.");
      setDoc({ name: file.name, text: text.slice(0, 40000) });
      setAttachment(file.name);
      onEvent(`Document attached to Private Workspace Chat: ${file.name}`);
    } catch (error) {
      setAttachment(null);
      setAttachmentError(error instanceof Error ? error.message : "This document could not be opened.");
    } finally {
      setLoadingFile(false);
      inputRef.current?.focus();
    }
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || typing) return;
    const history = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content },
    ];
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content },
    ]);
    setDraft("");
    setTyping(true);
    onEvent("Inference request submitted from Private Workspace Chat");

    let reply: string;
    try {
      reply = await askAi({
        data: {
          messages: history,
          ...(doc ? { documentName: doc.name, documentText: doc.text } : {}),
        },
      });
      onEvent("AI response generated for Private Workspace Chat");
    } catch (e) {
      reply =
        e instanceof Error
          ? `I could not complete that request: ${e.message}`
          : "I could not complete that request.";
      onEvent("AI response failed in Private Workspace Chat");
    }

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: withFooter(reply),
      },
    ]);
    setTyping(false);
    inputRef.current?.focus();
  };

  return (
    <TooltipProvider>
    <section className="panel flex h-[calc(100vh-12.5rem)] min-h-[34rem] flex-col overflow-hidden rounded-sm">
        <div className="flex items-center justify-between border-b border-border px-7 py-5 lg:px-9">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Confidential session</p>
            <h2 className="mt-1 font-display text-base font-semibold">Private Workspace Chat</h2>
          </div>
          <span className="hidden items-center gap-2 border border-border bg-secondary/50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:flex">
            <ShieldCheck className="size-3.5 text-primary" /> Protected workspace
          </span>
        </div>

        <Conversation className="min-h-0 bg-background/25">
          <ConversationContent className="mx-auto w-full max-w-4xl gap-7 px-6 py-8 lg:px-10">
            {messages.length === 0 && !typing && (
              <ConversationEmptyState className="min-h-[22rem] justify-start pt-2" title="" description="">
                <div className="mx-auto flex max-w-2xl items-center justify-center gap-3 border border-primary/25 bg-primary/[0.06] px-5 py-3 text-center text-xs leading-relaxed text-foreground shadow-[0_18px_50px_-36px_var(--primary)]">
                  <span>🔒 Secure local memory initialized. Cache cleared. Ready for offline query processing.</span>
                </div>
              </ConversationEmptyState>
            )}
            {messages.map((message) => (
              <Message key={message.id} from={message.role} className={message.role === "user" ? "max-w-[78%]" : "max-w-[88%]"}>
                <MessageContent className={message.role === "user" ? "rounded-sm bg-primary px-4 py-3 text-primary-foreground" : "bg-transparent px-0 py-0 leading-relaxed"}>
                  {message.role === "assistant" ? <MessageResponse>{message.content}</MessageResponse> : message.content}
                </MessageContent>
              </Message>
            ))}
            {typing && <div className="flex items-center gap-3 text-xs"><span className="flex size-7 items-center justify-center border border-primary/40 bg-primary/10 font-semibold text-primary">A</span><Shimmer>Reviewing in private workspace...</Shimmer></div>}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-border bg-card/55 px-5 py-4 lg:px-8 lg:py-5">
          <div className="mx-auto max-w-4xl">
            {attachment && <div className="mb-2 inline-flex max-w-full items-center gap-2 border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs text-foreground"><FileText className="size-3.5 shrink-0 text-primary" /><span className="truncate">{attachment}</span><Button type="button" variant="ghost" size="icon-sm" aria-label="Remove attachment" className="ml-1 size-5" onClick={() => { setAttachment(null); setDoc(null); }}><X className="size-3" /></Button></div>}
            {attachmentError && <p className="mb-2 border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">{attachmentError}</p>}
            <PromptInput className="border-border bg-surface-raised shadow-[0_16px_40px_-28px_var(--shadow-color)] focus-within:border-primary/70" onSubmit={() => void send()}>
              <PromptInputTextarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={doc ? `Ask about ${doc.name}` : "Ask a confidential question or attach a document"} className="min-h-16 max-h-32 px-4 pt-4" />
              <PromptInputFooter className="px-3 pb-3">
                <PromptInputTools>
                  <PromptInputButton type="button" tooltip="Attach PDF or text document" onClick={() => fileInputRef.current?.click()} disabled={loadingFile}><Paperclip className="size-4" /></PromptInputButton>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{loadingFile ? "Reading document..." : "PDF · TXT"}</span>
                  <input ref={fileInputRef} type="file" accept=".pdf,.txt,text/plain,application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void attachFile(file); }} />
                </PromptInputTools>
                <PromptInputSubmit status={typing ? "submitted" : "ready"} disabled={!draft.trim() || typing || loadingFile} />
              </PromptInputFooter>
            </PromptInput>
            <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Encrypted working session · document context is isolated</p>
          </div>
        </div>
    </section>
    </TooltipProvider>
  );
}
