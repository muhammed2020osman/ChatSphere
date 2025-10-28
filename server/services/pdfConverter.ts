import { PDFDocument } from 'pdf-lib';
// import { createCanvas } from 'canvas';
// import { Canvas as createCanvas } from 'skia-canvas';
import { createCanvas } from '@napi-rs/canvas';

export interface PDFConversionResult {
  imageBuffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  pageCount: number;
}

/**
 * Convert the first page of a PDF to PNG image
 * Note: This creates a placeholder image with PDF metadata
 * For full PDF rendering, consider using system tools like pdf2image
 * @param pdfBuffer - The PDF file buffer
 * @param dpi - DPI for output image (default: 300)
 * @returns Image buffer and metadata
 */
export async function convertPDFToImage(
  pdfBuffer: Buffer,
  dpi: number = 300
): Promise<PDFConversionResult> {
  try {
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    if (pageCount === 0) {
      throw new Error('PDF has no pages');
    }

    // Get the first page dimensions
    const page = pdfDoc.getPages()[0];
    const { width: pdfWidth, height: pdfHeight } = page.getSize();

    // Convert PDF points to pixels at specified DPI
    // PDF uses 72 DPI by default
    const scale = dpi / 72;
    const canvasWidth = Math.floor(pdfWidth * scale);
    const canvasHeight = Math.floor(pdfHeight * scale);

    // Create canvas
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext('2d');

    // Fill with white background
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw placeholder content
    // TODO: For full PDF rendering, integrate with system tools like poppler
    context.fillStyle = '#333';
    context.font = 'bold 64px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('Engineering Drawing', canvasWidth / 2, canvasHeight / 2 - 80);
    
    context.font = '32px Arial';
    context.fillStyle = '#666';
    context.fillText(`PDF: ${pdfWidth.toFixed(0)} × ${pdfHeight.toFixed(0)} pts`, canvasWidth / 2, canvasHeight / 2);
    context.fillText(`${pageCount} page(s) • ${dpi} DPI`, canvasWidth / 2, canvasHeight / 2 + 50);

    // Convert canvas to PNG buffer
    const imageBuffer = canvas.toBuffer('image/png');

    return {
      imageBuffer,
      mimeType: 'image/png',
      width: canvasWidth,
      height: canvasHeight,
      pageCount,
    };
  } catch (error) {
    console.error('Error converting PDF to image:', error);
    throw new Error(`Failed to convert PDF to image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert all pages of a PDF to PNG images
 * @param pdfBuffer - The PDF file buffer
 * @param dpi - DPI for output images (default: 300)
 * @returns Array of image buffers and metadata for each page
 */
export async function convertPDFPagesToImages(
  pdfBuffer: Buffer,
  dpi: number = 300
): Promise<PDFConversionResult[]> {
  try {
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    if (pageCount === 0) {
      throw new Error('PDF has no pages');
    }

    const results: PDFConversionResult[] = [];

    // Process each page
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const page = pdfDoc.getPages()[pageIndex];
      const { width: pdfWidth, height: pdfHeight } = page.getSize();

      // Convert PDF points to pixels at specified DPI
      const scale = dpi / 72;
      const canvasWidth = Math.floor(pdfWidth * scale);
      const canvasHeight = Math.floor(pdfHeight * scale);

      // Create canvas for this page
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const context = canvas.getContext('2d');

      // Fill with white background
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvasWidth, canvasHeight);

      // Draw placeholder content
      context.fillStyle = '#333';
      context.font = 'bold 48px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('Engineering Drawing', canvasWidth / 2, canvasHeight / 2 - 60);
      
      context.font = '28px Arial';
      context.fillStyle = '#666';
      context.fillText(`Page ${pageIndex + 1} of ${pageCount}`, canvasWidth / 2, canvasHeight / 2);
      context.fillText(`${pdfWidth.toFixed(0)} × ${pdfHeight.toFixed(0)} pts • ${dpi} DPI`, canvasWidth / 2, canvasHeight / 2 + 40);

      // Convert canvas to PNG buffer
      const imageBuffer = canvas.toBuffer('image/png');

      results.push({
        imageBuffer,
        mimeType: 'image/png',
        width: canvasWidth,
        height: canvasHeight,
        pageCount,
      });
    }

    return results;
  } catch (error) {
    console.error('Error converting PDF pages to images:', error);
    throw new Error(`Failed to convert PDF pages to images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a buffer is a valid PDF
 */
export function isPDF(buffer: Buffer): boolean {
  // PDF files start with %PDF-
  return buffer.slice(0, 5).toString() === '%PDF-';
}
