"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  ChevronDown,
  AlertTriangle,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PDFViewerCanvas } from "@/components/pdf-viewer-canvas";
import Link from "next/link";

// Types
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
  points?: { x: number; y: number }[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  text?: string;
  position?: { x: number; y: number };
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
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const [activeTool, setActiveTool] = useState<Tool>("pan");
  const [zoom, setZoom] = useState(100);
  const [initialZoomSet, setInitialZoomSet] = useState(false);
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
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  // Fetch drawing data
  const { data: drawing, isLoading: drawingLoading, error: drawingError } = useQuery({
    queryKey: ['/api/drawings', id],
    queryFn: () => apiRequest(`/api/drawings/${id}`),
    enabled: !!id,
  });

  // Fetch all revisions for this drawing (sorted by uploadedAt descending)
  const { data: revisions = [] } = useQuery({
    queryKey: [`/api/drawings/${id}/revisions`],
    queryFn: () => apiRequest(`/api/drawings/${id}/revisions`),
    enabled: !!id,
  });

  // Get latest revision (first one, assuming sorted by uploadedAt desc)
  const latestRevision = revisions.length > 0 ? revisions[0] : null;
  
  // Get selected revision or fall back to latest
  const selectedRevision = revisions.find((r: any) => r.id === selectedRevisionId) || latestRevision;
  
  // Determine if viewing latest revision
  const isLatestRevision = !selectedRevisionId || selectedRevisionId === latestRevision?.id;

  // Fetch layers for this drawing
  const { data: layers = [], isLoading: layersLoading } = useQuery({
    queryKey: [`/api/drawings/${id}/layers`],
    queryFn: () => apiRequest(`/api/drawings/${id}/layers`),
    enabled: !!id,
  });

  // Fetch pins for this drawing
  const { data: pins = [], isLoading: pinsLoading } = useQuery({
    queryKey: [`/api/drawings/${id}/pins`],
    queryFn: () => apiRequest(`/api/drawings/${id}/pins`),
    enabled: !!id,
  });

  // Fetch disciplines for display names
  const { data: disciplines = [] } = useQuery({
    queryKey: ['/api/disciplines'],
    queryFn: () => apiRequest('/api/disciplines'),
  });

  // Fetch floors for display names
  const { data: floors = [] } = useQuery({
    queryKey: ['/api/floors'],
    queryFn: () => apiRequest('/api/floors'),
  });

  // Fetch drawing pages for the selected revision
  const { data: drawingPages = [], isLoading: pagesLoading } = useQuery({
    queryKey: [`/api/revisions/${selectedRevision?.id}/pages`],
    queryFn: () => apiRequest(`/api/revisions/${selectedRevision?.id}/pages`),
    enabled: !!selectedRevision?.id,
  });

  // Helper to find discipline/floor names
  const getDisciplineName = (disciplineId?: string | null) => {
    if (!disciplineId) return "Unknown";
    const discipline = disciplines.find((d: any) => d.id === disciplineId);
    return discipline?.name || "Unknown";
  };

  const getFloorName = (floorId?: string | null) => {
    if (!floorId) return "N/A";
    const floor = floors.find((f: any) => f.id === floorId);
    return floor?.name || "N/A";
  };

  // Use real data or fallback to placeholder
  const plan = drawing ? {
    id: drawing.id,
    sheetNo: (typeof drawing.data === 'string' ? JSON.parse(drawing.data) : drawing.data)?.sheetNo || "N/A",
    title: (typeof drawing.data === 'string' ? JSON.parse(drawing.data) : drawing.data)?.title || drawing.name || "Drawing",
    discipline: getDisciplineName(drawing.disciplineId),
    floor: getFloorName(drawing.floorId),
    revision: selectedRevision?.version || "0",
    status: selectedRevision?.status || "draft",
    imageUrl: selectedRevision?.fileUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuClkpxrlywCUB6FBFEpz1MqmUVNsaboO4lQx_daxG5RrVolhPaqKLc_1J3XzZcB9iSKMFSSOldOPQxZvgPKdFjc0-nJQBUa3aeoCD12S1uRft2fh59pBU-YiPmMdPdJdiMdRJjQzebBz4CsQDDxBNLK2i2iaSUbhoAjtgDTjg73Uvbut66h6QqemaISlluWiRUy2DTes7feeGkY0VE4QHA4TOXmuEHcrZiY8V26ujQANak4A_aOpFmjn_Z7W7r97w8jUOoFwCZmOOI",
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
  const currentPageData = drawingPages.find((p: any) => p.pageNumber === currentPage) || null;
  const displayImageUrl = currentPageData?.imageUrl || selectedRevision?.fileUrl || plan.imageUrl;
  
  // Determine display mode: PDF or Image
  const displayMode = selectedRevision?.fileType === 'application/pdf' ? 'pdf' : 'image';

  // Group layers by discipline
  const layersByDiscipline = layers.reduce((acc: Record<string, any[]>, layer: any) => {
    if (!acc[layer.disciplineId]) {
      acc[layer.disciplineId] = [];
    }
    acc[layer.disciplineId].push(layer);
    return acc;
  }, {} as Record<string, any[]>);

  // Filter pins based on visible layers
  const visiblePins = pins.filter((pin: any) => {
    if (!pin.layerId) return true;
    const layer = layers.find((l: any) => l.id === pin.layerId);
    return layer && layer.visible;
  });

  // Count visible pins by discipline (via layers)
  const pinsByDiscipline = visiblePins.reduce((acc: Record<string, number>, pin: any) => {
    const layer = layers.find((l: any) => l.id === pin.layerId);
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

  // Reset auto-fit when image changes
  useEffect(() => {
    setInitialZoomSet(false);
    setPanPosition({ x: 0, y: 0 });
  }, [displayImageUrl]);

  // Auto-fit zoom on initial load
  useEffect(() => {
    if (!initialZoomSet && canvasRef.current && imageRef.current && displayImageUrl) {
      const container = canvasRef.current;
      const imageContainer = imageRef.current;
      const img = imageContainer.querySelector('img') as HTMLImageElement;
      
      if (!img) return;
      
      const handleImageLoad = () => {
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const imageWidth = img.naturalWidth;
        const imageHeight = img.naturalHeight;
        
        if (imageWidth && imageHeight && containerWidth && containerHeight) {
          const widthRatio = (containerWidth * 0.8) / imageWidth;
          const heightRatio = (containerHeight * 0.8) / imageHeight;
          const fitRatio = Math.min(widthRatio, heightRatio);
          const fitZoom = Math.round(fitRatio * 100);
          
          const finalZoom = Math.max(25, Math.min(200, fitZoom));
          setZoom(finalZoom);
          setInitialZoomSet(true);
        }
      };
      
      if (img.complete && img.naturalWidth > 0) {
        handleImageLoad();
      } else {
        img.addEventListener('load', handleImageLoad, { once: true });
        return () => img.removeEventListener('load', handleImageLoad);
      }
    }
  }, [displayImageUrl, initialZoomSet]);

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
  }, [isPanning, activeTool, panStart, isDrawing, currentDrawing, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    
    // Drawing tools: Finish drawing
    if (isDrawing && currentDrawing) {
      setDrawings([...drawings, currentDrawing]);
      setCurrentDrawing(null);
      setIsDrawing(false);
    }
  }, [isDrawing, currentDrawing, drawings]);
  
  const handleMouseLeave = useCallback(() => {
    setShowCrosshair(false);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== "pin" || tempPin) return;

    if (displayMode === 'pdf' && canvasRef.current) {
      const canvas = canvasRef.current.querySelector('canvas[data-testid="pdf-canvas"]') as HTMLCanvasElement;
      if (!canvas) {
        console.error('[Pin] PDF canvas not found');
        return;
      }

      const canvasRect = canvas.getBoundingClientRect();
      const clickX = e.clientX - canvasRect.left;
      const clickY = e.clientY - canvasRect.top;
      
      const x = (clickX / canvasRect.width) * 100;
      const y = (clickY / canvasRect.height) * 100;
      
      const clampedX = Math.max(0, Math.min(100, x));
      const clampedY = Math.max(0, Math.min(100, y));
      
      setTempPin({ x: clampedX, y: clampedY });
    } else if (displayMode === 'image' && imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const img = imageRef.current.querySelector('img');
      if (!img) return;
      
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const scale = zoom / 100;
      
      const offsetX = clickX - centerX;
      const offsetY = clickY - centerY;
      
      const unscaledX = offsetX / scale;
      const unscaledY = offsetY / scale;
      
      const displayWidth = img.offsetWidth;
      const displayHeight = img.offsetHeight;
      const imageX = unscaledX + (displayWidth / 2);
      const imageY = unscaledY + (displayHeight / 2);
      
      const x = (imageX / displayWidth) * 100;
      const y = (imageY / displayHeight) * 100;
      
      const clampedX = Math.max(0, Math.min(100, x));
      const clampedY = Math.max(0, Math.min(100, y));
      
      setTempPin({ x: clampedX, y: clampedY });
    }
  }, [activeTool, tempPin, zoom, displayMode]);
  
  const handleConfirmPin = useCallback(() => {
    if (tempPin) {
      setShowTicketModal(true);
    }
  }, [tempPin]);
  
  const handleCancelPin = useCallback(() => {
    setTempPin(null);
  }, []);

  // Mutation to create a pin
  const createPinMutation = useMutation({
    mutationFn: async (pinData: { drawingId: string; layerId: string; x: string; y: string; label?: string; description?: string }) => {
      return await apiRequest(`/api/pins`, {
        method: 'POST',
        body: pinData,
      });
    },
    onSuccess: () => {
      // Invalidate pins query
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: "فشل في إنشاء الدبوس",
        variant: "destructive",
      });
      console.error("Error creating pin:", error);
    },
  });

  // Mutation to create a ticket
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: any) => {
      return await apiRequest(`/api/tickets`, {
        method: 'POST',
        body: ticketData,
      });
    },
    onSuccess: () => {
      toast({
        title: "تم!",
        description: "تم إنشاء الدبوس والتذكرة بنجاح",
      });
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: "فشل في إنشاء التذكرة",
        variant: "destructive",
      });
      console.error("Error creating ticket:", error);
    },
  });

  const handleTicketSubmit = useCallback(async (ticketData: any) => {
    if (!tempPin) return;
    
    try {
      const pinResponse = await createPinMutation.mutateAsync({
        drawingId: id!,
        layerId: ticketData.layerId || null,
        x: tempPin.x.toString(),
        y: tempPin.y.toString(),
        label: ticketData.title,
        description: ticketData.description,
      });
      
      await createTicketMutation.mutateAsync({
        ...ticketData,
        drawingId: id!,
        pinId: (pinResponse as any).id,
      });
      
      setTempPin(null);
      setShowTicketModal(false);
    } catch (error) {
      console.error("Error in handleTicketSubmit:", error);
    }
  }, [tempPin, id, createPinMutation, createTicketMutation]);

  // Mutation to toggle layer visibility
  const toggleLayerMutation = useMutation({
    mutationFn: async ({ layerId, visible }: { layerId: string; visible: boolean }) => {
      return await apiRequest(`/api/layers/${layerId}/visibility`, {
        method: 'PATCH',
        body: { visible },
      });
    },
    onSuccess: () => {
      // Invalidate layers query
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to toggle layer visibility",
        variant: "destructive",
      });
      console.error("Error toggling layer:", error);
    },
  });

  const handleToggleLayer = useCallback((layerId: string, currentVisibility: boolean) => {
    toggleLayerMutation.mutate({ layerId, visible: !currentVisibility });
  }, [toggleLayerMutation]);

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
      return await apiRequest('/api/layers', {
        method: 'POST',
        body: layerData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Layer saved successfully",
        description: `Saved ${drawings.length} drawing${drawings.length === 1 ? '' : 's'}`,
      });
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
    if (drawings.length === 0 || !disciplines.length) {
      return;
    }
    
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

  if (drawingLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading drawing...</p>
        </div>
      </div>
    );
  }

  if (drawingError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Error Loading Drawing</h2>
          <p className="text-muted-foreground mb-4">
            {drawingError instanceof Error ? drawingError.message : 'Unknown error occurred'}
          </p>
          <Link href="/drawings">
            <Button>Back to Drawings</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <Link href="/drawings">
            <Button variant="ghost" size="icon" data-testid="button-back-to-drawings">
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
                          className={`w-4 h-4 rounded border-2 ${
                            drawingSettings.color === color ? 'border-foreground' : 'border-border'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setDrawingSettings(prev => ({ ...prev, color }))}
                        />
                      ))}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Drawing Color</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Sidebar */}
          <div className="w-80 border-r border-border bg-background/50 backdrop-blur-sm flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1">
                  <h1 className="text-lg font-semibold">{plan.sheetNo}</h1>
                  <p className="text-sm text-muted-foreground">{plan.title}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{plan.discipline}</Badge>
                <Badge variant="outline">{plan.floor}</Badge>
                <Badge variant="outline">Rev {plan.revision}</Badge>
                <Badge variant={plan.status === 'approved' ? 'default' : 'secondary'}>
                  {plan.status}
                </Badge>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
              <Button
                variant={activeTab === "layers" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("layers")}
                className="flex-1 rounded-none"
              >
                <Layers className="h-4 w-4 mr-2" />
                Layers
              </Button>
              <Button
                variant={activeTab === "pins" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("pins")}
                className="flex-1 rounded-none"
              >
                <MapPin className="h-4 w-4 mr-2" />
                Pins
              </Button>
              <Button
                variant={activeTab === "pages" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("pages")}
                className="flex-1 rounded-none"
              >
                <FileText className="h-4 w-4 mr-2" />
                Pages
              </Button>
            </div>

            {/* Tab Content */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                {activeTab === "layers" && (
                  <div className="space-y-4">
                    {Object.entries(layersByDiscipline).map(([disciplineId, disciplineLayers]) => (
                      <div key={disciplineId}>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">
                          {getDisciplineName(disciplineId)}
                        </h3>
                        <div className="space-y-2">
                          {(disciplineLayers as any[]).map((layer: any) => (
                            <div key={layer.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full border"
                                  style={{ backgroundColor: layer.color || '#666' }}
                                />
                                <span className="text-sm">{layer.name}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleToggleLayer(layer.id, layer.visible !== false)}
                              >
                                {layer.visible !== false ? (
                                  <Eye className="h-3 w-3" />
                                ) : (
                                  <EyeOff className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "pins" && (
                  <div className="space-y-2">
                    {visiblePins.map((pin: any) => (
                      <Card key={pin.id} className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{pin.description || 'No description'}</p>
                            <p className="text-xs text-muted-foreground">
                              {pin.createdAt ? new Date(pin.createdAt).toLocaleDateString() : 'Unknown date'}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {pin.type || 'General'}
                          </Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {activeTab === "pages" && (
                  <div className="space-y-2">
                    {drawingPages.map((page: any) => (
                      <Button
                        key={page.id}
                        variant={currentPage === page.pageNumber ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => setCurrentPage(page.pageNumber)}
                      >
                        Page {page.pageNumber}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 relative overflow-hidden bg-muted/20">
            <div
              ref={canvasRef}
              className="w-full h-full relative cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onClick={handleCanvasClick}
            >
              {/* Drawing Image/PDF */}
              <div
                ref={imageRef}
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoom / 100})`,
                  transformOrigin: 'center center',
                }}
              >
                {displayMode === 'pdf' ? (
                  <PDFViewerCanvas
                    pdfUrl={displayImageUrl}
                    zoom={zoom}
                    panPosition={panPosition}
                    onPanChange={setPanPosition}
                    className="max-w-full max-h-full"
                  />
                ) : (
                  <img
                    src={displayImageUrl}
                    alt={plan.title}
                    className="max-w-full max-h-full object-contain"
                    draggable={false}
                  />
                )}
              </div>

              {/* Crosshair */}
              {showCrosshair && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: crosshairPosition.x,
                    top: crosshairPosition.y,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="w-4 h-4 border-2 border-primary rounded-full" />
                </div>
              )}

              {/* Existing Pins */}
              {visiblePins.map((pin: any) => (
                <div
                  key={pin.id}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${pin.x || 0}%`,
                    top: `${pin.y || 0}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="w-6 h-6 bg-primary rounded-full border-2 border-background shadow-lg flex items-center justify-center">
                    <MapPin className="h-3 w-3 text-primary-foreground" />
                  </div>
                </div>
              ))}

              {/* Temporary Pin */}
              {tempPin && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${tempPin.x}%`,
                    top: `${tempPin.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="w-8 h-8 bg-accent rounded-full border-2 border-background shadow-lg flex items-center justify-center animate-pulse">
                    <MapPin className="h-4 w-4 text-accent-foreground" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Temporary Pin Modal */}
      {tempPin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96 p-6">
            <h3 className="text-lg font-semibold mb-4">Add Pin</h3>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Pin will be placed at ({Math.round(tempPin.x)}%, {Math.round(tempPin.y)}%)
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelPin}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmPin}
                >
                  Create Ticket
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Ticket Creation Modal */}
      <CreateTicketModal
        open={showTicketModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowTicketModal(false);
            setTempPin(null);
          }
        }}
        pinPosition={tempPin || { x: 0, y: 0 }}
        drawingId={id}
        drawingDisciplineId={drawing?.disciplineId}
        layers={layers}
        onSubmit={handleTicketSubmit}
      />
    </div>
  );
}