import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPDF = async () => {
      if (!pdfUrl) {
        setError('No PDF URL provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        if (!isMounted) {
          pdf.destroy();
          return;
        }

        pdfDocRef.current = pdf;

        const page = await pdf.getPage(1);

        if (!isMounted) {
          return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const scale = zoom / 100;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setCanvasDimensions({ width: viewport.width, height: viewport.height });

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext as any).promise;

        if (isMounted) {
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error loading PDF:', err);
          setError(err instanceof Error ? err.message : 'Failed to load PDF');
          setLoading(false);
        }
      }
    };

    loadPDF();

    return () => {
      isMounted = false;
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

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center min-h-[400px] ${className}`}
        data-testid="pdf-viewer-loading"
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center min-h-[400px] p-6 ${className}`} data-testid="pdf-viewer-error">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Error loading PDF:</strong> {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

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
        }}
        data-testid="pdf-canvas"
      />
      
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width={canvasDimensions.width}
        height={canvasDimensions.height}
        style={{
          transform: `translate(${panPosition.x}px, ${panPosition.y}px)`,
        }}
        data-testid="pdf-svg-overlay"
      >
        <g style={{ pointerEvents: 'auto' }}>
          {children}
        </g>
      </svg>
    </div>
  );
}
