export const SCANNED_PDF_MESSAGE =
  "Scanned document detected. Please use a text-selectable digital document for this local beta trial.";

export class PdfReadError extends Error {}

let workerReady: Promise<void> | null = null;

async function configureWorker(pdfjs: typeof import("pdfjs-dist")) {
  if (!workerReady) {
    workerReady = (async () => {
      try {
        const mod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = mod.default as string;
      } catch {
        // Fall back to in-thread parsing if the worker asset cannot be loaded.
        pdfjs.GlobalWorkerOptions.workerSrc = "";
      }
    })();
  }
  await workerReady;
}

/**
 * Reads a PDF's binary stream in the browser and concatenates the selectable
 * text of every page into a single string. Returns "" only when no page in the
 * document exposes any text layer (a scanned image).
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  await configureWorker(pdfjs);

  const data = new Uint8Array(await file.arrayBuffer());

  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  } catch (e) {
    throw new PdfReadError(
      e instanceof Error && e.message
        ? `This PDF could not be opened: ${e.message}`
        : "This PDF could not be opened.",
    );
  }

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str;
        // pdf.js marks the end of a text run / line explicitly.
        if (item.hasEOL) text += "\n";
        else if (!item.str.endsWith(" ")) text += " ";
      }
      // Normalise whitespace without discarding line structure.
      const cleaned = text
        .replace(/[ \t\u00a0]+/g, " ")
        .replace(/ *\n */g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (cleaned.replace(/\s/g, "").length > 0) pages.push(cleaned);
      page.cleanup();
    } catch {
      // A single unreadable page must not fail the whole document.
    }
  }

  await pdf.cleanup();
  return pages.join("\n\n").trim();
}
