"use client";

import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PDFViewerCanvasProps {
  pdfUrl: string;
  zoom: number;
  panPosition: { x: number; y: number };
  onPanChange?: (position: { x: number; y: number }) => void;
  children?: React.ReactNode;
  className?: string;
}

export function PDFViewerCanvas({
  pdfUrl,
  zoom,
  panPosition,
  onPanChange,
  children,
  className = '',
}: PDFViewerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPanPosition, setStartPanPosition] = useState({ x: 0, y: 0 });
  const [retryCount, setRetryCount] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  // Load and render PDF
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const loadPDF = async (attemptNumber = 0): Promise<void> => {
      if (!pdfUrl) {
        setError('No PDF URL provided');
        setLoading(false);
        return;
      }

      // Dynamic import pdfjs-dist only on client side
      let pdfjsLib: any = null;
      try {
        pdfjsLib = await import('pdfjs-dist');
        // Set worker source for Next.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      } catch (err) {
        console.error('Failed to load pdfjs-dist:', err);
        setError('Failed to load PDF library');
        setLoading(false);
        return;
      }

      const maxRetries = 2;
      const isRetry = attemptNumber > 0;
      let loadingTask: any = null;

      try {
        setLoading(true);
        setError(null);
        setLoadProgress(0);
        
        if (isRetry) {
          setRetrying(true);
          setRetryCount(attemptNumber);
          console.log(`[PDF Viewer] Retry attempt ${attemptNumber}/${maxRetries}`);
          // Wait 2 seconds before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log('[PDF Viewer] Loading PDF from URL:', pdfUrl);
        console.log('[PDF Viewer] Worker source:', pdfjsLib.GlobalWorkerOptions.workerSrc);

        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('PDF loading timeout after 30 seconds. The file may be too large or the URL may be expired.'));
          }, 30000);
        });

        // Load PDF with timeout and progress tracking
        loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          withCredentials: false,
        });

        // Track loading progress (only if component is mounted)
        loadingTask.onProgress = (progressData: { loaded: number; total: number }) => {
          if (!isMounted) return;
          if (progressData.total > 0) {
            const progress = Math.round((progressData.loaded / progressData.total) * 100);
            setLoadProgress(progress);
            console.log(`[PDF Viewer] Loading progress: ${progress}%`);
          }
        };

        console.log('[PDF Viewer] Loading task created, waiting for PDF...');

        // Race between loading and timeout
        const pdf = await Promise.race([
          loadingTask.promise,
          timeoutPromise
        ]) as any;

        clearTimeout(timeoutId);
        console.log('[PDF Viewer] PDF loaded successfully, pages:', pdf.numPages);

        if (!isMounted) {
          pdf.destroy();
          return;
        }

        const page = await pdf.getPage(1);
        console.log('[PDF Viewer] First page loaded');

        if (!isMounted) {
          return;
        }

        // Render to canvas
        await new Promise<void>((resolve, reject) => {
          requestAnimationFrame(() => {
            const canvas = canvasRef.current;
            
            if (!canvas) {
              console.error('[PDF Viewer] Canvas element not found');
              reject(new Error('Canvas element not found'));
              return;
            }

            const context = canvas.getContext('2d');
            if (!context) {
              console.error('[PDF Viewer] Canvas 2D context not available');
              reject(new Error('Canvas 2D context not available'));
              return;
            }

            const scale = zoom / 100;
            const viewport = page.getViewport({ scale });

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            setCanvasDimensions({ width: viewport.width, height: viewport.height });

            console.log('[PDF Viewer] Rendering page with zoom:', zoom, 'dimensions:', { width: viewport.width, height: viewport.height });

            const renderContext = {
              canvasContext: context,
              viewport: viewport,
            };

            page.render(renderContext as any).promise
              .then(() => {
                console.log('[PDF Viewer] Page rendered successfully');
                if (isMounted) {
                  setRetrying(false);
                  setRetryCount(0);
                  setLoading(false);
                }
                resolve();
              })
              .catch((renderErr) => {
                console.error('[PDF Viewer] Error rendering page:', renderErr);
                if (isMounted) {
                  setError('Failed to render PDF page');
                  setLoading(false);
                }
                reject(renderErr);
              });
          });
        });
      } catch (err) {
        if (isMounted) {
          console.error('[PDF Viewer] Error loading PDF:', err);
          console.error('[PDF Viewer] Error details:', {
            message: err instanceof Error ? err.message : String(err),
            name: err instanceof Error ? err.name : 'Unknown',
            stack: err instanceof Error ? err.stack : undefined,
          });
          
          // Retry logic
          if (attemptNumber < maxRetries) {
            console.log(`[PDF Viewer] Will retry (${attemptNumber + 1}/${maxRetries})`);
            loadPDF(attemptNumber + 1);
            return;
          }
          
          // Max retries exceeded, show error
          let errorMessage = 'Failed to load PDF';
          if (err instanceof Error) {
            if (err.message.includes('timeout')) {
              errorMessage = 'PDF loading timeout. The file may be too large or the URL may be expired.';
            } else if (err.message.includes('Invalid PDF')) {
              errorMessage = 'Invalid PDF file format.';
            } else if (err.message.includes('Network')) {
              errorMessage = 'Network error while loading PDF. Please check your connection.';
            } else {
              errorMessage = `PDF loading error: ${err.message}`;
            }
          }
          
          setError(errorMessage);
          setLoading(false);
          setRetrying(false);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Start loading
    loadPDF();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [pdfUrl, zoom]);

  // Handle panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (onPanChange) {
      setIsPanning(true);
      setStartPanPosition({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && onPanChange) {
      onPanChange({
        x: e.clientX - startPanPosition.x,
        y: e.clientY - startPanPosition.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-sm text-muted-foreground mb-2">
              {retrying ? `Retrying... (${retryCount}/2)` : 'Loading PDF...'}
            </p>
            {loadProgress > 0 && (
              <div className="w-48 bg-muted rounded-full h-2 mx-auto">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* PDF Canvas */}
      <canvas
        ref={canvasRef}
        data-testid="pdf-canvas"
        className="max-w-full max-h-full object-contain cursor-grab active:cursor-grabbing"
        style={{
          transform: `translate(${panPosition.x}px, ${panPosition.y}px)`,
          transformOrigin: 'top left',
        }}
      />

      {/* Children overlay */}
      {children}
    </div>
  );
}