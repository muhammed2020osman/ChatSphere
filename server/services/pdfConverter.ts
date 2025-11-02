import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { NodeCanvasFactory } from './pdfCanvasFactory';

const execFileAsync = promisify(execFile);

// In Node.js with legacy build, we don't need to set workerSrc
// The legacy build handles Node.js environment automatically

// Check if pdftoppm is available (lazy initialization)
let popplerChecked = false;
let usePoppler = false;

async function checkPopplerAvailability(): Promise<boolean> {
  if (popplerChecked) {
    return usePoppler;
  }
  
  try {
    await execFileAsync('which', ['pdftoppm']);
    usePoppler = true;
    console.log('Using pdftoppm (poppler-utils) for PDF rendering - better quality');
  } catch {
    console.log('pdftoppm not found, falling back to pdfjs-dist');
    usePoppler = false;
  }
  
  popplerChecked = true;
  return usePoppler;
}

export interface PDFConversionResult {
  imageBuffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  pageCount: number;
}

/**
 * Convert the first page of a PDF to PNG image
 * Uses pdfjs-dist to render actual PDF content
 * @param pdfBuffer - The PDF file buffer
 * @param dpi - DPI for output image (default: 300)
 * @returns Image buffer and metadata
 */
export async function convertPDFToImage(
  pdfBuffer: Buffer,
  dpi: number = 300
): Promise<PDFConversionResult> {
  const results = await convertPDFPagesToImages(pdfBuffer, dpi);
  return results[0];
}

/**
 * Convert all pages of a PDF to PNG images
 * Uses pdfjs-dist to render actual PDF content on each page
 * @param pdfBuffer - The PDF file buffer
 * @param dpi - DPI for output images (default: 300)
 * @returns Array of image buffers and metadata for each page
 */
export async function convertPDFPagesToImages(
  pdfBuffer: Buffer,
  dpi: number = 300
): Promise<PDFConversionResult[]> {
  try {
    // Check if pdftoppm is available
    const canUsePoppler = await checkPopplerAvailability();
    
    // Use pdftoppm if available - it renders PDFs with full quality
    // For AutoCAD drawings, use higher DPI for better detail preservation
    if (canUsePoppler) {
      // Increase DPI for better quality (especially for technical drawings)
      const effectiveDpi = Math.max(dpi, 600); // At least 600 DPI for technical drawings
      console.log(`Using ${effectiveDpi} DPI for high-quality rendering`);
      return await convertPDFPagesWithPoppler(pdfBuffer, effectiveDpi);
    }
    
    // Fallback to pdfjs-dist
    return await convertPDFPagesWithPdfJs(pdfBuffer, dpi);
  } catch (error) {
    console.error('Error converting PDF pages to images:', error);
    throw new Error(`Failed to convert PDF pages to images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert PDF pages using pdftoppm (poppler-utils) - High quality rendering
 */
async function convertPDFPagesWithPoppler(
  pdfBuffer: Buffer,
  dpi: number = 300
): Promise<PDFConversionResult[]> {
  const tempDir = tmpdir();
  const timestamp = Date.now();
  const tempPdfPath = join(tempDir, `pdf_${timestamp}.pdf`);
  const outputPrefix = join(tempDir, `pdf_${timestamp}_page`);
  
  try {
    // Write PDF to temp file
    writeFileSync(tempPdfPath, pdfBuffer);
    
    // Get page count first using pdfjs-dist (lightweight)
    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      verbosity: 0,
    }).promise;
    const pageCount = pdf.numPages;
    pdf.destroy();
    
    if (pageCount === 0) {
      throw new Error('PDF has no pages');
    }
    
    console.log(`Converting ${pageCount} pages using pdftoppm at ${dpi} DPI...`);
    
    // Convert all pages to PNG using pdftoppm
    // -png: output PNG format
    // -r: resolution (DPI) - higher DPI for AutoCAD drawings
    // -f 1 -l <pageCount>: first and last page
    // Note: pdftoppm should preserve all graphics, colors, and text from AutoCAD PDFs
    const pdftoppmArgs = [
      '-png',
      '-r', dpi.toString(),
      '-f', '1',
      '-l', pageCount.toString(),
      tempPdfPath,
      outputPrefix,
    ];
    
    console.log(`Running pdftoppm with args: ${pdftoppmArgs.join(' ')}`);
    console.log(`PDF file size: ${pdfBuffer.length} bytes`);
    
    try {
      const { stdout, stderr } = await execFileAsync('pdftoppm', pdftoppmArgs);
      if (stderr && stderr.trim()) {
        console.log('pdftoppm stderr:', stderr);
      }
      if (stdout && stdout.trim()) {
        console.log('pdftoppm stdout:', stdout);
      }
      console.log('pdftoppm completed successfully');
    } catch (error: any) {
      console.error('pdftoppm error:', error);
      console.error('pdftoppm error code:', error.code);
      console.error('pdftoppm error message:', error.message);
      if (error.stdout) {
        console.error('pdftoppm stdout:', error.stdout);
      }
      if (error.stderr) {
        console.error('pdftoppm stderr:', error.stderr);
      }
      throw new Error(`pdftoppm failed: ${error.message}`);
    }
    
    const results: PDFConversionResult[] = [];
    
    // Read generated PNG files
    // pdftoppm outputs files as: prefix-pageNumber.png (1-indexed, zero-padded to match total pages)
    for (let pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
      // pdftoppm formats: prefix-01.png, prefix-02.png, etc. (zero-padded)
      // For single digit pages with multi-digit total: 01, 02, etc.
      // For multi-digit pages: 01, 02, 10, 11, etc.
      const pageNumberStr = String(pageIndex).padStart(pageCount.toString().length, '0');
      const pngPath = `${outputPrefix}-${pageNumberStr}.png`;
      
      console.log(`Checking for PNG file at: ${pngPath}`);
      
      if (!existsSync(pngPath)) {
        // Try alternative format (without zero-padding for single page)
        const altPath = `${outputPrefix}-${pageIndex}.png`;
        if (existsSync(altPath)) {
          console.log(`Found PNG at alternative path: ${altPath}`);
          const imageBuffer = readFileSync(altPath);
          
          // Get image dimensions
          const pdfInfo = await pdfjsLib.getDocument({
            data: new Uint8Array(pdfBuffer),
            verbosity: 0,
          }).promise;
          const page = await pdfInfo.getPage(pageIndex);
          const viewport = page.getViewport({ scale: dpi / 72 });
          pdfInfo.destroy();
          
          results.push({
            imageBuffer,
            mimeType: 'image/png',
            width: Math.floor(viewport.width),
            height: Math.floor(viewport.height),
            pageCount,
          });
          
          unlinkSync(altPath);
          console.log(`Successfully converted page ${pageIndex}/${pageCount} using pdftoppm`);
          continue;
        }
        throw new Error(`Failed to generate PNG for page ${pageIndex} at path: ${pngPath}`);
      }
      
      const imageBuffer = readFileSync(pngPath);
      const imageSize = imageBuffer.length;
      console.log(`Read PNG file for page ${pageIndex}, size: ${imageSize} bytes`);
      
      // Validate that the image has content (not just white/empty)
      // PNG files should be at least a few KB for meaningful content
      if (imageSize < 5000) {
        console.warn(`Warning: PNG file for page ${pageIndex} is very small (${imageSize} bytes). May be empty or corrupted.`);
      }
      
      // Get actual image dimensions from the PNG file
      // PNG format stores dimensions in bytes 16-23 (width) and 24-27 (height)
      let width = 0;
      let height = 0;
      
      if (imageSize > 24) {
        // Read PNG dimensions from IHDR chunk
        // Width: bytes 16-19, Height: bytes 20-23 (big-endian)
        width = (imageBuffer[16] << 24) | (imageBuffer[17] << 16) | (imageBuffer[18] << 8) | imageBuffer[19];
        height = (imageBuffer[20] << 24) | (imageBuffer[21] << 16) | (imageBuffer[22] << 8) | imageBuffer[23];
        console.log(`PNG dimensions for page ${pageIndex}: ${width}x${height} pixels`);
      }
      
      // Fallback to PDF viewport if PNG dimensions couldn't be read
      if (width === 0 || height === 0) {
        console.log(`Could not read PNG dimensions, using PDF viewport instead`);
        const pdfInfo = await pdfjsLib.getDocument({
          data: new Uint8Array(pdfBuffer),
          verbosity: 0,
        }).promise;
        const page = await pdfInfo.getPage(pageIndex);
        const viewport = page.getViewport({ scale: dpi / 72 });
        pdfInfo.destroy();
        width = Math.floor(viewport.width);
        height = Math.floor(viewport.height);
      }
      
      results.push({
        imageBuffer,
        mimeType: 'image/png',
        width,
        height,
        pageCount,
      });
      
      // Clean up temp PNG file
      unlinkSync(pngPath);
      
      console.log(`Successfully converted page ${pageIndex}/${pageCount} using pdftoppm (${width}x${height}, ${imageSize} bytes)`);
    }
    
    return results;
  } finally {
    // Clean up temp PDF file
    if (existsSync(tempPdfPath)) {
      unlinkSync(tempPdfPath);
    }
  }
}

/**
 * Convert PDF pages using pdfjs-dist - Fallback method
 */
async function convertPDFPagesWithPdfJs(
  pdfBuffer: Buffer,
  dpi: number = 300
): Promise<PDFConversionResult[]> {
  // Create canvas factory for Node.js environment
  const canvasFactory = new NodeCanvasFactory();
  
  // Load PDF document
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    canvasFactory: canvasFactory as any,
    verbosity: 0, // Suppress console warnings
  });
  
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  if (pageCount === 0) {
    throw new Error('PDF has no pages');
  }

  const results: PDFConversionResult[] = [];

  // Process each page
  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
    const page = await pdf.getPage(pageIndex);
    
    // Calculate scale based on DPI
    // PDF uses 72 DPI by default, so scale = desired_dpi / 72
    const scale = dpi / 72;
    const viewport = page.getViewport({ scale });
    
    const canvasWidth = Math.floor(viewport.width);
    const canvasHeight = Math.floor(viewport.height);

    // Create canvas using the factory - pdfjs-dist needs this for proper rendering
    const canvasAndContext = canvasFactory.create(canvasWidth, canvasHeight);
    const canvas = canvasAndContext.canvas;
    const context = canvasAndContext.context;

    // Fill with white background first
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    // Render PDF page to canvas
    // pdfjs-dist requires canvasContext and viewport for rendering
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    console.log(`Rendering page ${pageIndex}/${pageCount} (${canvasWidth}x${canvasHeight})...`);
    
    // Render the page - this should render all graphics, text, and colors
    const renderTask = page.render(renderContext as any);
    await renderTask.promise;
    
    console.log(`Page ${pageIndex} rendered successfully, converting to PNG...`);

    // Convert canvas to PNG buffer
    const imageBuffer = canvas.toBuffer('image/png');

    results.push({
      imageBuffer,
      mimeType: 'image/png',
      width: canvasWidth,
      height: canvasHeight,
      pageCount,
    });
    
    console.log(`Successfully converted page ${pageIndex}/${pageCount} at ${dpi} DPI`);
    
    // Clean up canvas factory resources for this page
    canvasFactory.destroy(canvasAndContext);
  }

  // Clean up
  pdf.destroy();

  return results;
}

/**
 * Check if a buffer is a valid PDF
 */
export function isPDF(buffer: Buffer): boolean {
  // PDF files start with %PDF-
  return buffer.slice(0, 5).toString() === '%PDF-';
}
