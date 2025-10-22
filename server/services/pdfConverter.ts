import * as pdfjsLib from 'pdfjs-dist';
import { createCanvas } from 'canvas';

// Set the worker source path
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PDFConversionResult {
  imageBuffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  pageCount: number;
}

/**
 * Convert the first page of a PDF to PNG image
 * @param pdfBuffer - The PDF file buffer
 * @param scale - Scale factor for rendering (default: 2.0 for high quality)
 * @returns Image buffer and metadata
 */
export async function convertPDFToImage(
  pdfBuffer: Buffer,
  scale: number = 2.0
): Promise<PDFConversionResult> {
  try {
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
    });

    const pdfDocument = await loadingTask.promise;
    const pageCount = pdfDocument.numPages;

    // Get the first page
    const page = await pdfDocument.getPage(1);

    // Get viewport with scale
    const viewport = page.getViewport({ scale });

    // Create canvas with proper dimensions
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    // Render the page
    const renderContext = {
      canvasContext: context as any,
      viewport: viewport,
      background: 'white',
    };

    await page.render(renderContext as any).promise;

    // Convert canvas to PNG buffer
    const imageBuffer = canvas.toBuffer('image/png');

    // Cleanup
    await pdfDocument.destroy();

    return {
      imageBuffer,
      mimeType: 'image/png',
      width: viewport.width,
      height: viewport.height,
      pageCount,
    };
  } catch (error) {
    console.error('Error converting PDF to image:', error);
    throw new Error(`Failed to convert PDF to image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a buffer is a valid PDF
 */
export function isPDF(buffer: Buffer): boolean {
  // PDF files start with %PDF-
  return buffer.slice(0, 5).toString() === '%PDF-';
}
