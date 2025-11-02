import { createCanvas } from '@napi-rs/canvas';

/**
 * Canvas factory for pdfjs-dist in Node.js environment
 * This allows pdfjs-dist to work with @napi-rs/canvas
 * 
 * The factory must return objects with canvas and context properties
 * that are compatible with pdfjs-dist's expectations
 * 
 * IMPORTANT: The canvas returned must support toBuffer() method for PNG export
 */
export class NodeCanvasFactory {
  create(width: number, height: number): { canvas: any; context: any } {
    // Create canvas using @napi-rs/canvas which supports toBuffer()
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    
    // Ensure canvas has all necessary methods
    // @napi-rs/canvas already supports toBuffer('image/png')
    return {
      canvas: canvas,
      context: context,
    };
  }

  reset(canvasAndContext: { canvas: any; context: any }, width: number, height: number): void {
    if (canvasAndContext.canvas) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    }
  }

  destroy(canvasAndContext: { canvas: any; context: any }): void {
    // Clean up if needed - pdfjs-dist expects this method
    // Note: We don't actually need to destroy the canvas, but pdfjs-dist expects this method
    if (canvasAndContext.canvas) {
      // The canvas will be garbage collected
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    }
  }
}

