import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";

type ResponsesBody = Record<string, unknown>;

/**
 * Calls the Lovable AI Gateway Responses API in streaming mode and returns the
 * accumulated output text. Streaming is required: reasoning runs can take
 * minutes and a buffered call would be severed by the platform.
 */
async function callGateway(body: ResponsesBody): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this workspace.");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({ ...body, model: MODEL, stream: true }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429)
      throw new Error("The AI service is busy. Please try again shortly.");
    if (res.status === 402)
      throw new Error(
        "AI credits are exhausted for this workspace. Add credits to continue.",
      );
    throw new Error(
      `AI request failed (${res.status}). ${detail.slice(0, 200)}`.trim(),
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (evt.type === "response.output_text.delta" && evt.delta) {
          text += evt.delta;
        } else if (
          evt.type === "response.completed" &&
          !text &&
          evt.response?.output_text
        ) {
          text = evt.response.output_text;
        }
      } catch {
        // ignore malformed keep-alive frames
      }
    }
  }

  return text.trim();
}

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: {
      type: "array",
      items: { type: "string" },
      description: "4-6 concise bullet points summarising the document",
    },
    actions: {
      type: "array",
      items: { type: "string" },
      description: "Concrete action items a professional should take",
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          level: { type: "string", enum: ["High", "Medium", "Low"] },
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["level", "title", "detail"],
      },
    },
  },
  required: ["summary", "actions", "risks"],
} as const;

const AnalysisResult = z.object({
  summary: z.array(z.string()),
  actions: z.array(z.string()),
  risks: z.array(
    z.object({
      level: z.enum(["High", "Medium", "Low"]),
      title: z.string(),
      detail: z.string(),
    }),
  ),
});

export type AiAnalysis = z.infer<typeof AnalysisResult>;

export const analyzeDocument = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ fileName: z.string().min(1), text: z.string().min(1) })
      .parse(input),
  )
  .handler(async ({ data }): Promise<AiAnalysis> => {
    const excerpt = data.text.slice(0, 60000);
    const raw = await callGateway({
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          name: "document_analysis",
          strict: true,
          schema: analysisSchema,
        },
      },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are a senior legal and financial analyst. Analyse ONLY the document text provided. Never invent clauses, parties, numbers or dates that are not present. Be specific and quote defined terms where useful. Keep each bullet under 40 words.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Document file name: ${data.fileName}\n\n---\n${excerpt}\n---\n\nReturn a bullet-point summary, concrete key action items, and a risk assessment based solely on this text.`,
            },
          ],
        },
      ],
    });

    return AnalysisResult.parse(JSON.parse(raw));
  });

export const chatWithDocument = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          }),
        ),
        documentName: z.string().optional(),
        documentText: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<string> => {
    const context = data.documentText
      ? `The user has loaded a document named "${data.documentName ?? "document"}". Its text follows between markers. Answer strictly from it where relevant.\n<<<DOC\n${data.documentText.slice(0, 40000)}\nDOC>>>`
      : "No document is currently loaded. Answer generally and invite the user to upload one.";

    const reply = await callGateway({
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `You are Asfalis, a precise legal and financial document assistant for professionals. Answer in short structured bullet points. Never fabricate clause numbers or facts. ${context}`,
            },
          ],
        },
        ...data.messages.slice(-12).map((m) => ({
          role: m.role,
          content: [
            {
              type: m.role === "assistant" ? "output_text" : "input_text",
              text: m.content,
            },
          ],
        })),
      ],
    });

    return reply || "No response was generated. Please try rephrasing.";
  });
