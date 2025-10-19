import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';

// Configure PDF.js worker; Vite will resolve this URL at build time.
// If this path ever fails in your bundler, consider importing from 'pdfjs-dist/webpack' helpers.
GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

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


