import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ZoomIn,
  ZoomOut,
  Hand,
  MapPin,
  Ruler,
  Layers,
  ChevronLeft,
  Download,
  Maximize2,
  Plus,
  Check,
  X,
  Eye,
  EyeOff,
  Pen,
  Minus,
  Square,
  Circle,
  Type,
  Eraser,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CreateTicketModal } from "@/components/create-ticket-modal";
import type { Layer, Pin, Discipline, DrawingRevision, DrawingWithDetails, Floor } from "@shared/schema";

type Tool = "pan" | "zoom-in" | "zoom-out" | "pin" | "ruler" | "pen" | "line" | "rectangle" | "circle" | "text" | "eraser";

interface TempPin {
  x: number;
  y: number;
}

interface DrawingSettings {
  color: string;
  strokeWidth: number;
}

interface DrawingShape {
  id: string;
  type: "pen" | "line" | "rectangle" | "circle" | "text";
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[]; // For pen (freehand)
  start?: { x: number; y: number }; // For line, rectangle, circle
  end?: { x: number; y: number }; // For line, rectangle, circle
  text?: string; // For text
  position?: { x: number; y: number }; // For text
}

interface DrawingPage {
  id: number;
  pageNumber: number;
  imageUrl: string | null;
  extractedText: string | null;
  aiExtractedData: any;
}

type SidebarTab = "layers" | "pins" | "pages";

export default function SheetViewer() {
  const { id } = useParams();
  const { toast } = useToast();
  const [activeTool, setActiveTool] = useState<Tool>("pan");
  const [zoom, setZoom] = useState(100);
  const [activeTab, setActiveTab] = useState<SidebarTab>("layers");
  const [currentPage, setCurrentPage] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [tempPin, setTempPin] = useState<TempPin | null>(null);
  const [crosshairPosition, setCrosshairPosition] = useState({ x: 0, y: 0 });
  const [showCrosshair, setShowCrosshair] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [drawingSettings, setDrawingSettings] = useState<DrawingSettings>({
    color: "#D97706", // Default amber color
    strokeWidth: 2,
  });
  const [drawings, setDrawings] = useState<DrawingShape[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<DrawingShape | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  // Fetch drawing data
  const { data: drawing, isLoading: drawingLoading } = useQuery<DrawingWithDetails>({
    queryKey: ['/api/drawings', id],
    enabled: !!id,
  });

  // Fetch latest revision for this drawing
  const { data: revisions = [] } = useQuery<DrawingRevision[]>({
    queryKey: ['/api/drawings', id, 'revisions'],
    enabled: !!id,
  });

  // Get latest revision with file
  const latestRevision: DrawingRevision | null = revisions.length > 0 ? revisions[0] : null;

  // Fetch layers for this drawing
  const { data: layers = [], isLoading: layersLoading } = useQuery<Layer[]>({
    queryKey: ['/api/drawings', id, 'layers'],
    enabled: !!id,
  });

  // Fetch pins for this drawing
  const { data: pins = [], isLoading: pinsLoading } = useQuery<Pin[]>({
    queryKey: ['/api/drawings', id, 'pins'],
    enabled: !!id,
  });

  // Fetch disciplines for display names
  const { data: disciplines = [] } = useQuery<Discipline[]>({
    queryKey: ['/api/disciplines'],
  });

  // Fetch floors for display names
  const { data: floors = [] } = useQuery<Floor[]>({
    queryKey: ['/api/floors'],
  });

  // Fetch drawing pages if there's a latest revision
  const { data: drawingPages = [], isLoading: pagesLoading } = useQuery<DrawingPage[]>({
    queryKey: ['/api/revisions', latestRevision?.id, 'pages'],
    enabled: !!latestRevision?.id,
  });

  // Helper to find discipline/floor names
  const getDisciplineName = (disciplineId?: string | null) => {
    if (!disciplineId) return "Unknown";
    const discipline = disciplines.find(d => d.id === disciplineId);
    return discipline?.name || "Unknown";
  };

  const getFloorName = (floorId?: string | null) => {
    if (!floorId) return "N/A";
    const floor = floors.find(f => f.id === floorId);
    return floor?.name || "N/A";
  };

  // Use real data or fallback to placeholder
  const plan = drawing ? {
    id: drawing.id,
    sheetNo: drawing.sheetNo || "N/A",
    title: drawing.title || "Drawing",
    discipline: drawing.discipline?.name || getDisciplineName(drawing.disciplineId),
    floor: drawing.floor?.name || getFloorName(drawing.floorId),
    revision: latestRevision?.revisionNo || "0",
    status: latestRevision?.status || "draft",
    imageUrl: latestRevision?.fileUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuClkpxrlywCUB6FBFEpz1MqmUVNsaboO4lQx_daxG5RrVolhPaqKLc_1J3XzZcB9iSKMFSSOldOPQxZvgPKdFjc0-nJQBUa3aeoCD12S1uRft2fh59pBU-YiPmMdPdJdiMdRJjQzebBz4CsQDDxBNLK2i2iaSUbhoAjtgDTjg73Uvbut66h6QqemaISlluWiRUy2DTes7feeGkY0VE4QHA4TOXmuEHcrZiY8V26ujQANak4A_aOpFmjn_Z7W7r97w8jUOoFwCZmOOI",
  } : {
    id: id || "1",
    sheetNo: "Loading...",
    title: "Loading drawing...",
    discipline: "...",
    floor: "...",
    revision: "...",
    status: "draft",
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuClkpxrlywCUB6FBFEpz1MqmUVNsaboO4lQx_daxG5RrVolhPaqKLc_1J3XzZcB9iSKMFSSOldOPQxZvgPKdFjc0-nJQBUa3aeoCD12S1uRft2fh59pBU-YiPmMdPdJdiMdRJjQzebBz4CsQDDxBNLK2i2iaSUbhoAjtgDTjg73Uvbut66h6QqemaISlluWiRUy2DTes7feeGkY0VE4QHA4TOXmuEHcrZiY8V26ujQANak4A_aOpFmjn_Z7W7r97w8jUOoFwCZmOOI",
  };

  // Get current page data and display image
  const currentPageData = drawingPages.find(p => p.pageNumber === currentPage) || null;
  const displayImageUrl = currentPageData?.imageUrl || latestRevision?.fileUrl || plan.imageUrl;

  // Group layers by discipline
  const layersByDiscipline = layers.reduce((acc, layer) => {
    if (!acc[layer.disciplineId]) {
      acc[layer.disciplineId] = [];
    }
    acc[layer.disciplineId].push(layer);
    return acc;
  }, {} as Record<string, Layer[]>);

  // Count pins by discipline (via layers)
  const pinsByDiscipline = pins.reduce((acc, pin) => {
    const layer = layers.find(l => l.id === pin.layerId);
    if (layer) {
      acc[layer.disciplineId] = (acc[layer.disciplineId] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Discipline colors (matching ConstructFlow design)
  const disciplineColors: Record<string, string> = {
    architectural: "#0E7490",
    structural: "#8B5CF6",
    mep: "#059669",
    annotations: "#D97706",
  };

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 25, 400));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 25, 25));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === "pan") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
      e.preventDefault();
      return;
    }
    
    // Drawing tools: Pen (freehand drawing)
    if (activeTool === "pen" && imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const scale = zoom / 100;
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      
      setCurrentDrawing({
        id: `shape-${Date.now()}`,
        type: "pen",
        color: drawingSettings.color,
        strokeWidth: drawingSettings.strokeWidth,
        points: [{ x, y }],
      });
      setIsDrawing(true);
      return;
    }
    
    // TODO: Implement other drawing tools (line, rectangle, circle, text)
    // For line/rectangle/circle: set start point and wait for mouse move/up
    // For text: show input dialog
  }, [activeTool, panPosition, zoom, drawingSettings]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning && activeTool === "pan") {
      setPanPosition({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }
    
    // Update crosshair position when pin tool is active
    if (activeTool === "pin" && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setCrosshairPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setShowCrosshair(true);
      return;
    }
    
    // Drawing tools: Pen (freehand drawing)
    if (isDrawing && activeTool === "pen" && imageRef.current && currentDrawing?.type === "pen") {
      const rect = imageRef.current.getBoundingClientRect();
      const scale = zoom / 100;
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      
      setCurrentDrawing({
        ...currentDrawing,
        points: [...(currentDrawing.points || []), { x, y }],
      });
      return;
    }
    
    // TODO: Implement other drawing tools mouse move logic
  }, [isPanning, activeTool, panStart, isDrawing, currentDrawing, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    
    // Drawing tools: Finish drawing
    if (isDrawing && currentDrawing) {
      // Add the completed drawing to drawings array
      setDrawings([...drawings, currentDrawing]);
      setCurrentDrawing(null);
      setIsDrawing(false);
    }
  }, [isDrawing, currentDrawing, drawings]);
  
  const handleMouseLeave = useCallback(() => {
    setShowCrosshair(false);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === "pin" && imageRef.current && !tempPin) {
      const rect = imageRef.current.getBoundingClientRect();
      const img = imageRef.current.querySelector('img');
      if (!img) return;
      
      // Get click position relative to transformed image
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      // Calculate the center of the transformed image
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Inverse transform: undo scale and translate
      const scale = zoom / 100;
      
      // First, undo the translate (offset from center)
      const offsetX = clickX - centerX;
      const offsetY = clickY - centerY;
      
      // Then, undo the scale
      const unscaledX = offsetX / scale;
      const unscaledY = offsetY / scale;
      
      // Convert back to position relative to image (from center to top-left)
      const displayWidth = img.offsetWidth;
      const displayHeight = img.offsetHeight;
      const imageX = unscaledX + (displayWidth / 2);
      const imageY = unscaledY + (displayHeight / 2);
      
      // Convert to percentage
      const x = (imageX / displayWidth) * 100;
      const y = (imageY / displayHeight) * 100;
      
      // Clamp to 0-100% range
      const clampedX = Math.max(0, Math.min(100, x));
      const clampedY = Math.max(0, Math.min(100, y));
      
      // Create temporary pin instead of adding directly
      setTempPin({ x: clampedX, y: clampedY });
    }
  }, [activeTool, tempPin, zoom]);
  
  const handleConfirmPin = useCallback(() => {
    if (tempPin) {
      // Open ticket modal immediately
      setShowTicketModal(true);
    }
  }, [tempPin]);
  
  const handleCancelPin = useCallback(() => {
    setTempPin(null);
  }, []);
  
  const handleTicketSubmit = useCallback((ticketData: any) => {
    if (tempPin) {
      // TODO: Create pin and ticket via API mutations
      // For now, just close modal and reset tempPin
      setTempPin(null);
      setShowTicketModal(false);
      
      console.log("Creating pin and ticket:", { 
        pin: { x: tempPin.x, y: tempPin.y }, 
        ticket: ticketData 
      });
    }
  }, [tempPin]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-") {
        handleZoomOut();
      } else if (e.key === "h" || e.key === "H") {
        setActiveTool("pan");
      } else if (e.key === "p" || e.key === "P") {
        setActiveTool("pin");
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleZoomIn, handleZoomOut]);

  const handleToolClick = (toolId: Tool) => {
    if (toolId === "zoom-in") {
      handleZoomIn();
    } else if (toolId === "zoom-out") {
      handleZoomOut();
    } else {
      setActiveTool(toolId);
    }
  };

  const tools = [
    { id: "pan" as Tool, icon: Hand, label: "Pan", shortcut: "H" },
    { id: "zoom-in" as Tool, icon: ZoomIn, label: "Zoom In", shortcut: "+" },
    { id: "zoom-out" as Tool, icon: ZoomOut, label: "Zoom Out", shortcut: "-" },
    { id: "pin" as Tool, icon: MapPin, label: "Place Pin", shortcut: "P" },
    { id: "ruler" as Tool, icon: Ruler, label: "Measure", shortcut: "M" },
  ];
  
  const drawingTools = [
    { id: "pen" as Tool, icon: Pen, label: "Pen (Freehand)", shortcut: "" },
    { id: "line" as Tool, icon: Minus, label: "Line", shortcut: "" },
    { id: "rectangle" as Tool, icon: Square, label: "Rectangle", shortcut: "" },
    { id: "circle" as Tool, icon: Circle, label: "Circle", shortcut: "" },
    { id: "text" as Tool, icon: Type, label: "Text", shortcut: "" },
    { id: "eraser" as Tool, icon: Eraser, label: "Eraser", shortcut: "" },
  ];

  const drawingToolIds = drawingTools.map(t => t.id);
  const isDrawingTool = drawingToolIds.includes(activeTool);

  const predefinedColors = [
    "#D97706", // Amber - Annotations
    "#EF4444", // Red - Issues
    "#0E7490", // Teal - Architectural
    "#8B5CF6", // Purple - Structural
    "#059669", // Green - MEP
    "#3B82F6", // Blue - General
    "#000000", // Black
  ];

  // Save layer mutation
  const saveLayerMutation = useMutation({
    mutationFn: async (layerData: {
      drawingId: string;
      disciplineId: string;
      name: string;
      type: string;
      data: DrawingShape[];
    }) => {
      return await apiRequest('POST', '/api/layers', layerData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drawings', id, 'layers'] });
      toast({
        title: "Layer saved successfully",
        description: `Saved ${drawings.length} drawing${drawings.length === 1 ? '' : 's'}`,
      });
      // Clear drawings after successful save
      setDrawings([]);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save layer",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSaveLayer = useCallback(() => {
    if (drawings.length === 0 ||!disciplines.length) {
      return;
    }
    
    // Use first discipline as default (TODO: let user select discipline for layer)
    const disciplineId = disciplines[0]?.id;
    
    if (!disciplineId) {
      toast({
        title: "Cannot save layer",
        description: "No disciplines available",
        variant: "destructive",
      });
      return;
    }
    
    saveLayerMutation.mutate({
      drawingId: plan.id,
      disciplineId,
      name: `Drawing Layer ${new Date().toLocaleString()}`,
      type: "drawing",
      data: drawings,
    });
  }, [drawings, plan.id, disciplines, saveLayerMutation, toast]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <Link href="/plans">
            <Button variant="ghost" size="icon" data-testid="button-back-to-plans">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground" data-testid="text-sheet-title">
              {plan.sheetNo} - {plan.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">{plan.discipline}</span>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{plan.floor}</span>
              <span className="text-sm text-muted-foreground">•</span>
              <Badge variant="secondary" className="text-xs">Rev {plan.revision}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {drawings.length > 0 && (
            <Button 
              variant="default" 
              size="sm" 
              className="gap-2 bg-primary" 
              onClick={handleSaveLayer}
              data-testid="button-save-layer"
            >
              <Layers className="h-4 w-4" />
              <span>Save Layer ({drawings.length})</span>
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2" data-testid="button-download-plan">
            <Download className="h-4 w-4" />
            <span>Download</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Maximize2 className="h-4 w-4" />
            <span>Fullscreen</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="w-16 border-r border-border bg-card flex flex-col items-center py-4 gap-2">
          <TooltipProvider>
            {tools.map((tool) => {
              const isActive = activeTool === tool.id && tool.id !== "zoom-in" && tool.id !== "zoom-out";
              const isPinTool = tool.id === "pin";
              
              return (
                <Tooltip key={tool.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="icon"
                      onClick={() => handleToolClick(tool.id)}
                      data-testid={`button-tool-${tool.id}`}
                      className={isPinTool && isActive ? "bg-accent hover:bg-accent/90" : ""}
                    >
                      <tool.icon className={isPinTool && isActive ? "h-6 w-6" : "h-5 w-5"} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{tool.label} {tool.shortcut && `(${tool.shortcut})`}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
            
            <Separator className="my-2 w-10" />
            
            {/* Drawing Tools */}
            {drawingTools.map((tool) => {
              const isActive = activeTool === tool.id;
              
              return (
                <Tooltip key={tool.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="icon"
                      onClick={() => handleToolClick(tool.id)}
                      data-testid={`button-tool-${tool.id}`}
                    >
                      <tool.icon className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{tool.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
          
          <Separator className="my-2 w-10" />
          
          {/* Color Picker - Only show when drawing tool is active */}
          {isDrawingTool && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col gap-1 items-center w-full px-2">
                    <div className="text-[10px] text-muted-foreground">Color</div>
                    <div className="grid grid-cols-2 gap-1">
                      {predefinedColors.map((color) => (
                        <button
                          key={color}
                          className={`w-5 h-5 rounded border-2 ${
                            drawingSettings.color === color 
                              ? "border-primary" 
                              : "border-border"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setDrawingSettings({ ...drawingSettings, color })}
                          data-testid={`color-${color}`}
                        />
                      ))}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Select Color</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {/* Stroke Width Picker - Only show when drawing tool is active (except text/eraser) */}
          {isDrawingTool && activeTool !== "text" && activeTool !== "eraser" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col gap-1 items-center w-full px-2 mt-2">
                    <div className="text-[10px] text-muted-foreground">Stroke</div>
                    <div className="flex flex-col gap-1">
                      {[1, 2, 3, 4].map((width) => (
                        <button
                          key={width}
                          className={`w-10 h-4 rounded flex items-center justify-center ${
                            drawingSettings.strokeWidth === width 
                              ? "bg-primary/20" 
                              : "hover-elevate"
                          }`}
                          onClick={() => setDrawingSettings({ ...drawingSettings, strokeWidth: width })}
                          data-testid={`stroke-${width}`}
                        >
                          <div 
                            className="bg-foreground rounded-full"
                            style={{ width: '80%', height: `${width}px` }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Stroke Width</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <div className="flex-1" />
          
          <Separator className="my-2 w-10" />
          
          <div className="text-xs text-muted-foreground text-center px-1">
            {zoom}%
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-hidden bg-background/30 relative">
          <div
            ref={canvasRef}
            className="w-full h-full overflow-hidden flex items-center justify-center p-8"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={(e) => {
              handleMouseUp();
              handleMouseLeave();
            }}
            style={{ 
              cursor: activeTool === "pan" ? (isPanning ? "grabbing" : "grab") : activeTool === "pin" ? "none" : "default",
              userSelect: "none",
            }}
            data-testid="canvas-viewer"
          >
            {/* Crosshair cursor for pin tool */}
            {activeTool === "pin" && showCrosshair && !tempPin && (
              <>
                {/* Vertical line */}
                <div
                  className="absolute w-px bg-accent pointer-events-none z-50"
                  style={{
                    left: crosshairPosition.x,
                    top: 0,
                    bottom: 0,
                    opacity: 0.6,
                  }}
                />
                {/* Horizontal line */}
                <div
                  className="absolute h-px bg-accent pointer-events-none z-50"
                  style={{
                    top: crosshairPosition.y,
                    left: 0,
                    right: 0,
                    opacity: 0.6,
                  }}
                />
              </>
            )}
            <div
              ref={imageRef}
              className="relative bg-white shadow-2xl"
              onClick={handleCanvasClick}
              style={{
                transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoom / 100})`,
                transformOrigin: "center",
                transition: isPanning ? "none" : "transform 0.2s ease-out",
              }}
            >
              <img
                src={displayImageUrl}
                alt={plan.title}
                className="max-w-full h-auto pointer-events-none"
                data-testid="img-plan-canvas"
                draggable={false}
              />
              
              {/* SVG Drawing Layer */}
              <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ zIndex: 10 }}
              >
                {/* Render saved drawings */}
                {drawings.map((shape) => {
                  if (shape.type === "pen" && shape.points && shape.points.length > 1) {
                    const pathData = shape.points
                      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                      .join(' ');
                    return (
                      <path
                        key={shape.id}
                        d={pathData}
                        stroke={shape.color}
                        strokeWidth={shape.strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  }
                  if (shape.type === "line" && shape.start && shape.end) {
                    return (
                      <line
                        key={shape.id}
                        x1={shape.start.x}
                        y1={shape.start.y}
                        x2={shape.end.x}
                        y2={shape.end.y}
                        stroke={shape.color}
                        strokeWidth={shape.strokeWidth}
                        strokeLinecap="round"
                      />
                    );
                  }
                  if (shape.type === "rectangle" && shape.start && shape.end) {
                    const width = shape.end.x - shape.start.x;
                    const height = shape.end.y - shape.start.y;
                    return (
                      <rect
                        key={shape.id}
                        x={shape.start.x}
                        y={shape.start.y}
                        width={width}
                        height={height}
                        stroke={shape.color}
                        strokeWidth={shape.strokeWidth}
                        fill="none"
                      />
                    );
                  }
                  if (shape.type === "circle" && shape.start && shape.end) {
                    const radius = Math.sqrt(
                      Math.pow(shape.end.x - shape.start.x, 2) +
                      Math.pow(shape.end.y - shape.start.y, 2)
                    );
                    return (
                      <circle
                        key={shape.id}
                        cx={shape.start.x}
                        cy={shape.start.y}
                        r={radius}
                        stroke={shape.color}
                        strokeWidth={shape.strokeWidth}
                        fill="none"
                      />
                    );
                  }
                  if (shape.type === "text" && shape.position && shape.text) {
                    return (
                      <text
                        key={shape.id}
                        x={shape.position.x}
                        y={shape.position.y}
                        fill={shape.color}
                        fontSize={shape.strokeWidth * 6}
                        fontFamily="Arial, sans-serif"
                      >
                        {shape.text}
                      </text>
                    );
                  }
                  return null;
                })}
                
                {/* Render current drawing in progress */}
                {currentDrawing && (
                  <>
                    {currentDrawing.type === "pen" && currentDrawing.points && currentDrawing.points.length > 1 && (
                      <path
                        d={currentDrawing.points
                          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                          .join(' ')}
                        stroke={currentDrawing.color}
                        strokeWidth={currentDrawing.strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {currentDrawing.type === "line" && currentDrawing.start && currentDrawing.end && (
                      <line
                        x1={currentDrawing.start.x}
                        y1={currentDrawing.start.y}
                        x2={currentDrawing.end.x}
                        y2={currentDrawing.end.y}
                        stroke={currentDrawing.color}
                        strokeWidth={currentDrawing.strokeWidth}
                        strokeLinecap="round"
                      />
                    )}
                    {currentDrawing.type === "rectangle" && currentDrawing.start && currentDrawing.end && (
                      <rect
                        x={currentDrawing.start.x}
                        y={currentDrawing.start.y}
                        width={currentDrawing.end.x - currentDrawing.start.x}
                        height={currentDrawing.end.y - currentDrawing.start.y}
                        stroke={currentDrawing.color}
                        strokeWidth={currentDrawing.strokeWidth}
                        fill="none"
                      />
                    )}
                    {currentDrawing.type === "circle" && currentDrawing.start && currentDrawing.end && (
                      <circle
                        cx={currentDrawing.start.x}
                        cy={currentDrawing.start.y}
                        r={Math.sqrt(
                          Math.pow(currentDrawing.end.x - currentDrawing.start.x, 2) +
                          Math.pow(currentDrawing.end.y - currentDrawing.start.y, 2)
                        )}
                        stroke={currentDrawing.color}
                        strokeWidth={currentDrawing.strokeWidth}
                        fill="none"
                      />
                    )}
                  </>
                )}
              </svg>
              
              {/* Render temporary pin with confirm/cancel buttons */}
              {tempPin && (
                <div
                  className="absolute pointer-events-auto"
                  style={{
                    left: `${tempPin.x}%`,
                    top: `${tempPin.y}%`,
                  }}
                  data-testid="temp-pin"
                >
                  <div className="relative -ml-3 -mt-6">
                    <MapPin className="h-6 w-6 text-accent fill-accent/30" />
                    <div className="absolute top-0 left-8 flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-6 px-2 gap-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmPin();
                        }}
                        data-testid="button-confirm-pin"
                      >
                        <Check className="h-3 w-3" />
                        <span className="text-xs">تأكيد</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelPin();
                        }}
                        data-testid="button-cancel-pin"
                      >
                        <X className="h-3 w-3" />
                        <span className="text-xs">إلغاء</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Render confirmed pins */}
              {pins.map((pin) => (
                <div
                  key={pin.id}
                  className="absolute w-6 h-6 -ml-3 -mt-6 cursor-pointer pointer-events-auto"
                  style={{
                    left: `${pin.x}%`,
                    top: `${pin.y}%`,
                  }}
                  data-testid={`pin-${pin.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <MapPin className="h-6 w-6 text-primary fill-primary/20" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 border-l border-border bg-card flex flex-col">
          {/* Panel Tabs */}
          <div className="flex border-b border-border">
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === "layers" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
              }`}
              onClick={() => setActiveTab("layers")}
              data-testid="tab-layers"
            >
              Layers
            </button>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === "pins" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
              }`}
              onClick={() => setActiveTab("pins")}
              data-testid="tab-pins"
            >
              Pins ({pins.length})
            </button>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === "pages" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
              }`}
              onClick={() => setActiveTab("pages")}
              data-testid="tab-pages"
            >
              Pages ({drawingPages.length || 1})
            </button>
          </div>

          <ScrollArea className="flex-1">
            {activeTab === "layers" ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Layers by Discipline</h3>
                </div>
                
                {layersLoading ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">Loading layers...</p>
                  </div>
                ) : disciplines.length === 0 ? (
                  <div className="text-center py-8">
                    <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No layers available</p>
                  </div>
                ) : (
                  disciplines.map((discipline) => {
                    const disciplineLayers = layersByDiscipline[discipline.id] || [];
                    const pinCount = pinsByDiscipline[discipline.id] || 0;
                    const color = disciplineColors[discipline.name.toLowerCase()] || "#6B7280";
                    
                    return (
                      <div key={discipline.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-sm font-medium text-foreground">
                              {discipline.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {pinCount} {pinCount === 1 ? 'pin' : 'pins'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {disciplineLayers.length} {disciplineLayers.length === 1 ? 'layer' : 'layers'}
                            </Badge>
                          </div>
                        </div>
                        
                        {disciplineLayers.map((layer) => (
                          <Card key={layer.id} className="p-2 ml-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{layer.name}</span>
                              </div>
                              <button
                                className="p-1 hover-elevate rounded"
                                onClick={() => {
                                  // TODO: Toggle layer visibility
                                }}
                                data-testid={`toggle-layer-${layer.id}`}
                              >
                                {layer.visible ? (
                                  <Eye className="h-3 w-3 text-primary" />
                                ) : (
                                  <EyeOff className="h-3 w-3 text-muted-foreground" />
                                )}
                              </button>
                            </div>
                          </Card>
                        ))}
                        
                        {disciplineLayers.length === 0 && (
                          <p className="text-xs text-muted-foreground ml-4">No layers in this discipline</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : activeTab === "pins" ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Pins on this Sheet</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 gap-1 text-xs text-primary"
                    onClick={() => setActiveTool("pin")}
                  >
                    <Plus className="h-3 w-3" />
                    Add Pin
                  </Button>
                </div>
                
                {pinsLoading ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">Loading pins...</p>
                  </div>
                ) : pins.length === 0 ? (
                  <div className="text-center py-8">
                    <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No pins yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Click the pin tool and click on the plan to add pins
                    </p>
                  </div>
                ) : (
                  pins.map((pin) => (
                    <Card
                      key={pin.id}
                      className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                      data-testid={`pin-card-${pin.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{pin.label || "Untitled Pin"}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Position: ({Math.round(parseFloat(pin.x))}, {Math.round(parseFloat(pin.y))})
                          </p>
                          {pin.description && (
                            <p className="text-xs text-muted-foreground mt-1">{pin.description}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Drawing Pages</h3>
                  {drawingPages.length > 1 && (
                    <Badge variant="outline" className="text-xs">
                      Page {currentPage} of {drawingPages.length}
                    </Badge>
                  )}
                </div>
                
                {pagesLoading ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">Loading pages...</p>
                  </div>
                ) : drawingPages.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Single page drawing</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {drawingPages.map((page) => (
                      <div
                        key={page.id}
                        className={`group relative rounded-md border overflow-hidden cursor-pointer transition-all ${
                          currentPage === page.pageNumber
                            ? "border-primary border-2 shadow-md"
                            : "border-border hover-elevate active-elevate-2"
                        }`}
                        onClick={() => setCurrentPage(page.pageNumber)}
                        data-testid={`page-thumbnail-${page.pageNumber}`}
                      >
                        <div className="aspect-[8.5/11] bg-muted flex items-center justify-center relative">
                          {page.imageUrl ? (
                            <img
                              src={page.imageUrl}
                              alt={`Page ${page.pageNumber}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FileText className="h-8 w-8 text-muted-foreground" />
                          )}
                          {currentPage === page.pageNumber && (
                            <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                        <div className="p-1.5 border-t bg-card text-center">
                          <p className="text-xs font-medium text-foreground">
                            Page {page.pageNumber}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Create Ticket Modal */}
      {tempPin && (
        <CreateTicketModal
          open={showTicketModal}
          onOpenChange={setShowTicketModal}
          pinPosition={tempPin}
          drawingId={plan.id}
          onSubmit={handleTicketSubmit}
        />
      )}
    </div>
  );
}
