/**
 * PDF Parsing Service - Client-side PDF text extraction.
 *
 * Uses pdf.js to extract text content from uploaded PDF files.
 * Primarily used for parsing resumes for the recommendation feature.
 */
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';

// Configure PDF.js worker - Vite resolves this URL at build time
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Extracts all text content from a PDF file.
 * @param file - The PDF file to parse
 * @returns Combined text from all pages
 */
export async function parsePdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: arrayBuffer });
  const pdf: PDFDocumentProxy = await loadingTask.promise;

  let fullText = '';
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const strings = textContent.items
      .map((item: any) => ('str' in item ? String(item.str) : ''))
      .filter(Boolean);
    fullText += strings.join(' ') + '\n\n';
  }

  return fullText.trim();
}


