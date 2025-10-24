import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
// @ts-ignore - Vite URL import
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Use local worker bundled by Vite instead of CDN to avoid network issues
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const loadPDF = async (attemptNumber = 0): Promise<void> => {
      if (!pdfUrl) {
        setError('No PDF URL provided');
        setLoading(false);
        return;
      }

      const maxRetries = 2;
      const isRetry = attemptNumber > 0;
      let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

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
        ]) as pdfjsLib.PDFDocumentProxy;

        clearTimeout(timeoutId);
        console.log('[PDF Viewer] PDF loaded successfully, pages:', pdf.numPages);

        if (!isMounted) {
          pdf.destroy();
          return;
        }

        pdfDocRef.current = pdf;

        const page = await pdf.getPage(1);
        console.log('[PDF Viewer] First page loaded');

        if (!isMounted) {
          return;
        }

        // Wait for canvas to be ready in DOM using requestAnimationFrame
        const renderOnCanvas = () => {
          return new Promise<void>((resolve, reject) => {
            requestAnimationFrame(() => {
              const canvas = canvasRef.current;
              
              if (!canvas) {
                console.error('[PDF Viewer] Canvas element not found in DOM');
                console.error('[PDF Viewer] canvasRef.current:', canvasRef.current);
                reject(new Error('Canvas element not found'));
                return;
              }

              console.log('[PDF Viewer] Canvas element found, dimensions:', {
                offsetWidth: canvas.offsetWidth,
                offsetHeight: canvas.offsetHeight,
                clientWidth: canvas.clientWidth,
                clientHeight: canvas.clientHeight,
              });

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

              console.log('[PDF Viewer] Rendering page with dimensions:', { width: viewport.width, height: viewport.height });

              const renderContext = {
                canvasContext: context,
                viewport: viewport,
              };

              page.render(renderContext as any).promise
                .then(() => {
                  if (isMounted) {
                    console.log('[PDF Viewer] Page rendered successfully');
                    setRetrying(false);
                    setRetryCount(0);
                    setLoading(false);
                  }
                  resolve();
                })
                .catch((renderErr) => {
                  console.error('[PDF Viewer] Error rendering page:', renderErr);
                  reject(renderErr);
                });
            });
          });
        };

        await renderOnCanvas();
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
              errorMessage = 'PDF loading timeout. The file may be too large or the signed URL may have expired. Please try refreshing the page.';
            } else if (err.message.includes('CORS')) {
              errorMessage = 'CORS error: Cannot load PDF from the provided URL. Please check server configuration.';
            } else if (err.message.includes('404') || err.message.includes('Not Found')) {
              errorMessage = 'PDF file not found. The signed URL may have expired. Please refresh the page.';
            } else if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
              errorMessage = 'Network error: Cannot reach the PDF file. Please check your internet connection.';
            } else {
              errorMessage = err.message;
            }
          }
          
          setError(errorMessage);
          setRetrying(false);
          setLoading(false);
        }
      } finally {
        // Always clean up timeout and abort loading task
        clearTimeout(timeoutId);
        if (loadingTask) {
          try {
            loadingTask.destroy();
            console.log('[PDF Viewer] Loading task destroyed');
          } catch (destroyErr) {
            console.warn('[PDF Viewer] Error destroying loading task:', destroyErr);
          }
        }
      }
    };

    loadPDF(0);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [pdfUrl, zoom]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setStartPanPosition({
      x: e.clientX - panPosition.x,
      y: e.clientY - panPosition.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    
    const newPosition = {
      x: e.clientX - startPanPosition.x,
      y: e.clientY - startPanPosition.y,
    };
    
    onPanChange?.(newPosition);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsPanning(true);
    setStartPanPosition({
      x: touch.clientX - panPosition.x,
      y: touch.clientY - panPosition.y,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPanning || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const newPosition = {
      x: touch.clientX - startPanPosition.x,
      y: touch.clientY - startPanPosition.y,
    };
    
    onPanChange?.(newPosition);
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      data-testid="pdf-viewer-container"
    >
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${panPosition.x}px, ${panPosition.y}px)`,
          opacity: loading || error ? 0 : 1,
        }}
        data-testid="pdf-canvas"
      />
      
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width={canvasDimensions.width}
        height={canvasDimensions.height}
        style={{
          transform: `translate(${panPosition.x}px, ${panPosition.y}px)`,
          opacity: loading || error ? 0 : 1,
        }}
        data-testid="pdf-svg-overlay"
      >
        <g style={{ pointerEvents: 'auto' }}>
          {children}
        </g>
      </svg>

      {loading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          data-testid="pdf-viewer-loading"
        >
          <div className="flex flex-col items-center gap-3 w-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground text-center">
              {retrying ? `Retrying... (Attempt ${retryCount}/2)` : 'Loading PDF...'}
            </p>
            {loadProgress > 0 && (
              <div className="w-full">
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${loadProgress}%` }}
                    data-testid="pdf-load-progress"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-1">{loadProgress}%</p>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6"
          data-testid="pdf-viewer-error"
        >
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error loading PDF:</strong> {error}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
