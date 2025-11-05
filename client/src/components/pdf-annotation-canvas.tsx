import { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { Button } from '@/components/ui/button';
import { Pen, Square, Circle, Type, Minus, Eraser, Undo2, Save, Hand } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface PDFAnnotationCanvasProps {
  pdfCanvas: HTMLCanvasElement | null;
  pdfDimensions: { width: number; height: number };
  zoom: number;
  panPosition: { x: number; y: number };
  currentPage?: number;
  totalPages?: number;
  onSave?: (images: Map<number, string>) => Promise<void>;
  className?: string;
}

type Tool = 'select' | 'pen' | 'line' | 'rectangle' | 'circle' | 'text' | 'eraser';

export function PDFAnnotationCanvas({
  pdfCanvas,
  pdfDimensions,
  zoom,
  panPosition,
  currentPage = 1,
  totalPages,
  onSave,
  className = '',
}: PDFAnnotationCanvasProps) {
  const fabricCanvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [strokeColor, setStrokeColor] = useState('#D97706');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  // Store annotations for each page
  const [pageAnnotations, setPageAnnotations] = useState<Map<number, string>>(new Map());
  const [currentPageAnnotations, setCurrentPageAnnotations] = useState<string | null>(null);

  // Helper function to verify canvas context is valid
  const verifyCanvasContext = useCallback((canvas: fabric.Canvas | null): boolean => {
    if (!canvas) return false;
    try {
      const canvasElement = canvas.getElement();
      if (!canvasElement) return false;
      const context = canvasElement.getContext('2d');
      return context !== null;
    } catch (error) {
      console.error('[PDFAnnotationCanvas] Error verifying canvas context:', error);
      return false;
    }
  }, []);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!fabricCanvasRef.current || !pdfCanvas || !pdfDimensions || !pdfDimensions.width || !pdfDimensions.height) {
      console.log('[PDFAnnotationCanvas] Skipping canvas initialization:', {
        hasRef: !!fabricCanvasRef.current,
        hasPdfCanvas: !!pdfCanvas,
        hasPdfDimensions: !!pdfDimensions,
        width: pdfDimensions?.width,
        height: pdfDimensions?.height,
      });
      return;
    }

    // Check if canvas element is in DOM
    const canvasElement = fabricCanvasRef.current;
    if (!canvasElement || !canvasElement.parentElement) {
      console.log('[PDFAnnotationCanvas] Canvas element not in DOM yet, waiting...');
      // Wait a bit for DOM to be ready using requestAnimationFrame
      const frameId = requestAnimationFrame(() => {
        // Check again in next frame
        if (canvasElement && canvasElement.parentElement) {
          // Force re-render by updating a state or trigger effect again
        }
      });
      return () => cancelAnimationFrame(frameId);
    }

    // Verify canvas has a valid context before creating Fabric canvas
    let testContext: CanvasRenderingContext2D | null = null;
    try {
      testContext = canvasElement.getContext('2d');
    } catch (error) {
      console.error('[PDFAnnotationCanvas] Error getting canvas context:', error);
      return;
    }
    
    if (!testContext) {
      console.error('[PDFAnnotationCanvas] Canvas 2D context not available');
      return;
    }

    // Dispose existing canvas if any
    if (fabricCanvas) {
      try {
        // Check if canvas element exists before disposing
        const existingElement = fabricCanvas.getElement();
        if (existingElement && existingElement.parentElement) {
          fabricCanvas.dispose();
        } else {
          // Canvas already removed from DOM, just clear the state
          setFabricCanvas(null);
        }
      } catch (error) {
        console.warn('[PDFAnnotationCanvas] Error disposing existing canvas:', error);
        // Continue anyway - the canvas might already be disposed
      }
    }

    try {
      const canvas = new fabric.Canvas(canvasElement, {
        width: pdfDimensions.width,
        height: pdfDimensions.height,
        backgroundColor: 'transparent',
        selection: activeTool === 'select',
      });

      setFabricCanvas(canvas);

    // Save initial state to history
    const initialState = canvas.toJSON();
    const initialStateJson = JSON.stringify(initialState);
    setHistory([initialStateJson]);
    setHistoryIndex(0);

    // Load annotations for current page if they exist
    const savedAnnotations = pageAnnotations.get(currentPage);
    if (savedAnnotations) {
      canvas.loadFromJSON(savedAnnotations, () => {
        canvas.renderAll();
      });
      setCurrentPageAnnotations(savedAnnotations);
    } else {
      setCurrentPageAnnotations(initialStateJson);
    }

      return () => {
        try {
          // Check if canvas element exists before disposing
          const canvasElement = canvas.getElement();
          if (canvasElement && canvasElement.parentElement) {
            canvas.dispose();
          }
        } catch (error) {
          console.warn('[PDFAnnotationCanvas] Error disposing canvas:', error);
        }
      };
    } catch (error) {
      console.error('[PDFAnnotationCanvas] Error initializing Fabric.js canvas:', error);
      // Reset fabricCanvas state on error
      setFabricCanvas(null);
    }
  }, [pdfCanvas, pdfDimensions, activeTool]);

  // Handle page changes - save current annotations and load new page
  useEffect(() => {
    if (!fabricCanvas || !pdfCanvas) return;

    // Save current page annotations before switching
    const currentState = fabricCanvas.toJSON();
    const currentStateJson = JSON.stringify(currentState);
    
    // Update annotations map and load new page
    setPageAnnotations((prev) => {
      const newAnnotations = new Map(prev);
      // Save current state before switching
      newAnnotations.set(currentPage, currentStateJson);
      
      // Load annotations for new page
      const savedAnnotations = newAnnotations.get(currentPage);
      if (savedAnnotations && savedAnnotations !== currentStateJson) {
        // Load saved annotations for this page
        if (!verifyCanvasContext(fabricCanvas)) {
          console.warn('[PDFAnnotationCanvas] Canvas context not valid, skipping loadFromJSON');
          return;
        }
        try {
          fabricCanvas.loadFromJSON(savedAnnotations, () => {
            if (verifyCanvasContext(fabricCanvas)) {
              fabricCanvas.renderAll();
            }
          });
          setCurrentPageAnnotations(savedAnnotations);
        } catch (error) {
          console.error('[PDFAnnotationCanvas] Error loading annotations:', error);
        }
        
        // Reset history for new page
        const newHistory = [savedAnnotations];
        setHistory(newHistory);
        setHistoryIndex(0);
      } else if (!savedAnnotations) {
        // Clear canvas for new page if no saved annotations
        try {
          // Verify canvas context is still valid before clearing
          const canvasElement = fabricCanvas.getElement();
          if (canvasElement) {
            const context = canvasElement.getContext('2d');
            if (context) {
              fabricCanvas.clear();
              fabricCanvas.renderAll();
            } else {
              console.warn('[PDFAnnotationCanvas] Canvas context not available, skipping clear');
            }
          }
        } catch (error) {
          console.error('[PDFAnnotationCanvas] Error clearing canvas:', error);
        }
        
        // Reset history
        const initialState = fabricCanvas.toJSON();
        const initialStateJson = JSON.stringify(initialState);
        setHistory([initialStateJson]);
        setHistoryIndex(0);
        setCurrentPageAnnotations(initialStateJson);
      } else {
        setCurrentPageAnnotations(currentStateJson);
      }
      
      return newAnnotations;
    });
  }, [currentPage, fabricCanvas, pdfCanvas]);

  // Update canvas size when PDF dimensions change
  useEffect(() => {
    if (!fabricCanvas || !pdfDimensions || !pdfDimensions.width || !pdfDimensions.height) {
      console.log('[PDFAnnotationCanvas] Skipping canvas size update:', {
        hasFabricCanvas: !!fabricCanvas,
        hasPdfDimensions: !!pdfDimensions,
        width: pdfDimensions?.width,
        height: pdfDimensions?.height,
      });
      return;
    }

    if (!verifyCanvasContext(fabricCanvas)) {
      console.warn('[PDFAnnotationCanvas] Canvas context not valid, skipping dimension update');
      return;
    }

    try {
      fabricCanvas.setDimensions({
        width: pdfDimensions.width,
        height: pdfDimensions.height,
      });
      if (verifyCanvasContext(fabricCanvas)) {
        fabricCanvas.renderAll();
      }
    } catch (error) {
      console.error('[PDFAnnotationCanvas] Error updating canvas dimensions:', error);
    }
  }, [fabricCanvas, pdfDimensions]);

  // Handle tool changes
  useEffect(() => {
    if (!fabricCanvas) return;

    if (!verifyCanvasContext(fabricCanvas)) {
      console.warn('[PDFAnnotationCanvas] Canvas context not valid, skipping tool change');
      return;
    }

    fabricCanvas.selection = activeTool === 'select';
    fabricCanvas.defaultCursor = activeTool === 'select' ? 'default' : 'crosshair';
    fabricCanvas.hoverCursor = activeTool === 'select' ? 'move' : 'crosshair';

    // Disable all drawing modes
    fabricCanvas.isDrawingMode = false;
    fabricCanvas.freeDrawingBrush = undefined;

    // Enable specific tool
    switch (activeTool) {
      case 'pen':
        fabricCanvas.isDrawingMode = true;
        const brush = new fabric.PencilBrush(fabricCanvas);
        brush.color = strokeColor;
        brush.width = strokeWidth;
        fabricCanvas.freeDrawingBrush = brush;
        break;
      case 'line':
      case 'rectangle':
      case 'circle':
      case 'text':
        // These will be handled in mouse events
        break;
      case 'eraser':
        // Eraser will be handled in mouse events
        break;
    }

    if (verifyCanvasContext(fabricCanvas)) {
      fabricCanvas.renderAll();
    }
  }, [fabricCanvas, activeTool, strokeColor, strokeWidth]);

  // Save state to history
  const saveToHistory = useCallback(() => {
    if (!fabricCanvas) return;

    const state = fabricCanvas.toJSON();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.stringify(state));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [fabricCanvas, history, historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (!fabricCanvas || historyIndex <= 0) return;
    if (!verifyCanvasContext(fabricCanvas)) {
      console.warn('[PDFAnnotationCanvas] Canvas context not valid, skipping undo');
      return;
    }

    const prevIndex = historyIndex - 1;
    const prevState = JSON.parse(history[prevIndex]);
    try {
      fabricCanvas.loadFromJSON(prevState, () => {
        if (verifyCanvasContext(fabricCanvas)) {
          fabricCanvas.renderAll();
        }
        setHistoryIndex(prevIndex);
      });
    } catch (error) {
      console.error('[PDFAnnotationCanvas] Error undoing:', error);
    }
  }, [fabricCanvas, history, historyIndex, verifyCanvasContext]);

  // Handle object creation (line, rectangle, circle)
  useEffect(() => {
    if (!fabricCanvas || (activeTool !== 'line' && activeTool !== 'rectangle' && activeTool !== 'circle')) {
      return;
    }

    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let currentObject: fabric.Object | null = null;

    const handleMouseDown = (e: fabric.IEvent) => {
      const pointer = fabricCanvas.getPointer(e.e);
      startX = pointer.x;
      startY = pointer.y;

      switch (activeTool) {
        case 'line':
          currentObject = new fabric.Line([startX, startY, startX, startY], {
            stroke: strokeColor,
            strokeWidth,
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
          });
          break;
        case 'rectangle':
          currentObject = new fabric.Rect({
            left: startX,
            top: startY,
            width: 0,
            height: 0,
            stroke: strokeColor,
            fill: 'transparent',
            strokeWidth,
          });
          break;
        case 'circle':
          currentObject = new fabric.Circle({
            left: startX,
            top: startY,
            radius: 0,
            stroke: strokeColor,
            fill: 'transparent',
            strokeWidth,
          });
          break;
      }

      if (currentObject && verifyCanvasContext(fabricCanvas)) {
        try {
          fabricCanvas.add(currentObject);
          fabricCanvas.setActiveObject(currentObject);
          isDrawing = true;
        } catch (error) {
          console.error('[PDFAnnotationCanvas] Error adding object:', error);
        }
      }
    };

    const handleMouseMove = (e: fabric.IEvent) => {
      if (!isDrawing || !currentObject) return;

      const pointer = fabricCanvas.getPointer(e.e);

      switch (activeTool) {
        case 'line':
          (currentObject as fabric.Line).set({
            x2: pointer.x,
            y2: pointer.y,
          });
          break;
        case 'rectangle':
          (currentObject as fabric.Rect).set({
            width: Math.abs(pointer.x - startX),
            height: Math.abs(pointer.y - startY),
            left: Math.min(startX, pointer.x),
            top: Math.min(startY, pointer.y),
          });
          break;
        case 'circle':
          const radius = Math.sqrt(
            Math.pow(pointer.x - startX, 2) + Math.pow(pointer.y - startY, 2)
          );
          (currentObject as fabric.Circle).set({
            radius,
          });
          break;
      }

      if (verifyCanvasContext(fabricCanvas)) {
        fabricCanvas.renderAll();
      }
    };

    const handleMouseUp = () => {
      if (isDrawing && currentObject) {
        saveToHistory();
        isDrawing = false;
        currentObject = null;
      }
    };

    fabricCanvas.on('mouse:down', handleMouseDown);
    fabricCanvas.on('mouse:move', handleMouseMove);
    fabricCanvas.on('mouse:up', handleMouseUp);

    // Handle drawing mode changes
    fabricCanvas.on('path:created', () => {
      saveToHistory();
    });

    return () => {
      fabricCanvas.off('mouse:down', handleMouseDown);
      fabricCanvas.off('mouse:move', handleMouseMove);
      fabricCanvas.off('mouse:up', handleMouseUp);
    };
  }, [fabricCanvas, activeTool, strokeColor, strokeWidth, saveToHistory]);

  // Handle text tool
  useEffect(() => {
    if (!fabricCanvas || activeTool !== 'text') return;

    const handleMouseDown = (e: fabric.IEvent) => {
      const pointer = fabricCanvas.getPointer(e.e);
      setTextPosition({ x: pointer.x, y: pointer.y });
      setShowTextInput(true);
    };

    fabricCanvas.on('mouse:down', handleMouseDown);

    return () => {
      fabricCanvas.off('mouse:down', handleMouseDown);
    };
  }, [fabricCanvas, activeTool]);

  // Handle eraser
  useEffect(() => {
    if (!fabricCanvas || activeTool !== 'eraser') return;

    const handleMouseDown = (e: fabric.IEvent) => {
      const pointer = fabricCanvas.getPointer(e.e);
      const objects = fabricCanvas.getObjects();
      
      if (!verifyCanvasContext(fabricCanvas)) {
        console.warn('[PDFAnnotationCanvas] Canvas context not valid, skipping eraser');
        return;
      }

      for (const obj of objects) {
        if (obj.containsPoint(pointer)) {
          try {
            fabricCanvas.remove(obj);
            saveToHistory();
            if (verifyCanvasContext(fabricCanvas)) {
              fabricCanvas.renderAll();
            }
          } catch (error) {
            console.error('[PDFAnnotationCanvas] Error removing object:', error);
          }
          break;
        }
      }
    };

    fabricCanvas.on('mouse:down', handleMouseDown);

    return () => {
      fabricCanvas.off('mouse:down', handleMouseDown);
    };
  }, [fabricCanvas, activeTool, saveToHistory]);

  // Add text when input is submitted
  const handleAddText = () => {
    if (!fabricCanvas || !textInput || !textPosition) return;
    if (!verifyCanvasContext(fabricCanvas)) {
      console.warn('[PDFAnnotationCanvas] Canvas context not valid, skipping add text');
      return;
    }

    try {
      const text = new fabric.Text(textInput, {
        left: textPosition.x,
        top: textPosition.y,
        fontSize: 20,
        fill: strokeColor,
        fontFamily: 'Arial',
      });

      fabricCanvas.add(text);
      if (verifyCanvasContext(fabricCanvas)) {
        fabricCanvas.renderAll();
      }
      saveToHistory();

      setTextInput('');
      setTextPosition(null);
      setShowTextInput(false);
      setActiveTool('select');
    } catch (error) {
      console.error('[PDFAnnotationCanvas] Error adding text:', error);
    }
  };

  // Save annotations as images for all pages
  const handleSave = async () => {
    if (!fabricCanvas || !onSave || !totalPages) return;

    try {
      // Save current page annotations first
      const currentState = fabricCanvas.toJSON();
      const currentStateJson = JSON.stringify(currentState);
      const currentAnnotations = new Map(pageAnnotations);
      currentAnnotations.set(currentPage, currentStateJson);
      setPageAnnotations(currentAnnotations);

      // Create a temporary canvas to render each page's annotations
      const allAnnotations = new Map<number, string>();
      
      // Add current page annotations
      allAnnotations.set(currentPage, currentStateJson);
      
      // Add all other saved page annotations
      pageAnnotations.forEach((annotations, pageNum) => {
        if (pageNum !== currentPage) {
          allAnnotations.set(pageNum, annotations);
        }
      });

      // Convert all annotations to images
      const annotationsMap = new Map<number, string>();
      
      if (!pdfDimensions || !pdfDimensions.width || !pdfDimensions.height) {
        console.error('[PDFAnnotationCanvas] Cannot save: pdfDimensions is invalid');
        return;
      }

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const annotationsJson = allAnnotations.get(pageNum);
        if (!annotationsJson) {
          // Empty page - create empty canvas
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = pdfDimensions.width;
          tempCanvas.height = pdfDimensions.height;
          const emptyDataUrl = tempCanvas.toDataURL('image/png');
          const emptyBase64 = emptyDataUrl.includes(',') ? emptyDataUrl.split(',')[1] : emptyDataUrl;
          annotationsMap.set(pageNum, emptyBase64);
          continue;
        }

        // Create temporary canvas to render annotations
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = pdfDimensions.width;
        tempCanvas.height = pdfDimensions.height;
        
        // Verify context is available before creating Fabric canvas
        const tempContext = tempCanvas.getContext('2d');
        if (!tempContext) {
          console.error('[PDFAnnotationCanvas] Cannot create temp canvas context');
          continue;
        }
        
        const tempFabricCanvas = new fabric.Canvas(tempCanvas, {
          width: pdfDimensions.width,
          height: pdfDimensions.height,
          backgroundColor: 'transparent',
        });

        // Load annotations and render
        await new Promise<void>((resolve) => {
          tempFabricCanvas.loadFromJSON(annotationsJson, () => {
            const dataUrl = tempFabricCanvas.toDataURL({
              format: 'png',
              quality: 1,
              multiplier: 1,
            });
            const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            annotationsMap.set(pageNum, base64Data);
            tempFabricCanvas.dispose();
            resolve();
          });
        });
      }

      await onSave(annotationsMap);
    } catch (error) {
      console.error('Error saving annotations:', error);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-50 flex gap-2 bg-background/90 backdrop-blur-sm p-2 rounded-lg shadow-lg border">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === 'select' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setActiveTool('select')}
              >
                <Hand className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Select</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === 'pen' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setActiveTool('pen')}
              >
                <Pen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pen</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === 'line' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setActiveTool('line')}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Line</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === 'rectangle' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setActiveTool('rectangle')}
              >
                <Square className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rectangle</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === 'circle' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setActiveTool('circle')}
              >
                <Circle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Circle</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === 'text' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setActiveTool('text')}
              >
                <Type className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Text</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === 'eraser' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setActiveTool('eraser')}
              >
                <Eraser className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eraser</TooltipContent>
          </Tooltip>

          <div className="w-px bg-border mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSave}
                disabled={!onSave}
              >
                <Save className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save</TooltipContent>
          </Tooltip>

          <div className="w-px bg-border mx-1" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <div
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: strokeColor }}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-4">
                <div>
                  <Label>Color</Label>
                  <Input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => setStrokeColor(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Stroke Width</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </TooltipProvider>
      </div>

      {/* Fabric.js Canvas */}
      <canvas
        ref={fabricCanvasRef}
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoom / 100})`,
          transformOrigin: 'top left',
        }}
      />

      {/* Text Input Dialog */}
      {showTextInput && textPosition && (
        <div
          className="absolute bg-background border rounded-lg p-4 shadow-lg z-50"
          style={{
            left: `${textPosition.x + panPosition.x}px`,
            top: `${textPosition.y + panPosition.y}px`,
          }}
        >
          <Input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Enter text..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddText();
              } else if (e.key === 'Escape') {
                setShowTextInput(false);
                setTextInput('');
                setTextPosition(null);
              }
            }}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={handleAddText}>
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowTextInput(false);
                setTextInput('');
                setTextPosition(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

