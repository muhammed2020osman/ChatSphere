import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, Link } from "wouter";
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

type Tool = "pan" | "zoom-in" | "zoom-out" | "pin" | "ruler";

interface Pin {
  id: string;
  x: number;
  y: number;
  type: string;
  title: string;
  status: string;
}

interface TempPin {
  x: number;
  y: number;
}

export default function SheetViewer() {
  const { id } = useParams();
  const [activeTool, setActiveTool] = useState<Tool>("pan");
  const [zoom, setZoom] = useState(100);
  const [pins, setPins] = useState<Pin[]>([]);
  const [showLayers, setShowLayers] = useState(true);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [tempPin, setTempPin] = useState<TempPin | null>(null);
  const [crosshairPosition, setCrosshairPosition] = useState({ x: 0, y: 0 });
  const [showCrosshair, setShowCrosshair] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  // Mock plan data
  const plan = {
    id: id || "1",
    sheetNo: "A-101",
    title: "Architectural - Floor 02 - Tower A",
    discipline: "Architectural",
    floor: "Floor 02",
    revision: "3",
    status: "approved",
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuClkpxrlywCUB6FBFEpz1MqmUVNsaboO4lQx_daxG5RrVolhPaqKLc_1J3XzZcB9iSKMFSSOldOPQxZvgPKdFjc0-nJQBUa3aeoCD12S1uRft2fh59pBU-YiPmMdPdJdiMdRJjQzebBz4CsQDDxBNLK2i2iaSUbhoAjtgDTjg73Uvbut66h6QqemaISlluWiRUy2DTes7feeGkY0VE4QHA4TOXmuEHcrZiY8V26ujQANak4A_aOpFmjn_Z7W7r97w8jUOoFwCZmOOI",
  };

  const layers = [
    { id: "arch", name: "Architectural", visible: true, color: "#0E7490" },
    { id: "str", name: "Structural", visible: true, color: "#8B5CF6" },
    { id: "mep", name: "MEP", visible: false, color: "#059669" },
    { id: "annotations", name: "Annotations", visible: true, color: "#D97706" },
  ];

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
    }
  }, [activeTool, panPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning && activeTool === "pan") {
      setPanPosition({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
    
    // Update crosshair position when pin tool is active
    if (activeTool === "pin" && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setCrosshairPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setShowCrosshair(true);
    }
  }, [isPanning, activeTool, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);
  
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
      const newPin: Pin = {
        id: `pin-${Date.now()}`,
        x: tempPin.x,
        y: tempPin.y,
        type: "generic",
        title: `Pin ${pins.length + 1}`,
        status: "open",
      };
      setPins([...pins, newPin]);
      setTempPin(null);
      // TODO: Open ticket creation modal
    }
  }, [tempPin, pins]);
  
  const handleCancelPin = useCallback(() => {
    setTempPin(null);
  }, []);

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
                    <p>{tool.label} ({tool.shortcut})</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
          
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
                src={plan.imageUrl}
                alt={plan.title}
                className="max-w-full h-auto pointer-events-none"
                data-testid="img-plan-canvas"
                draggable={false}
              />
              
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
                showLayers ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
              }`}
              onClick={() => setShowLayers(true)}
              data-testid="tab-layers"
            >
              Layers
            </button>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                !showLayers ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
              }`}
              onClick={() => setShowLayers(false)}
              data-testid="tab-pins"
            >
              Pins ({pins.length})
            </button>
          </div>

          <ScrollArea className="flex-1">
            {showLayers ? (
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Visible Layers</h3>
                  <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary">
                    Toggle All
                  </Button>
                </div>
                {layers.map((layer) => (
                  <Card key={layer.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: layer.color }}
                      />
                      <span className="text-sm text-foreground">{layer.name}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={layer.visible}
                      onChange={() => {}}
                      className="rounded border-border"
                    />
                  </Card>
                ))}
              </div>
            ) : (
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
                
                {pins.length === 0 ? (
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
                          <p className="text-sm font-medium text-foreground">{pin.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Position: ({Math.round(pin.x)}, {Math.round(pin.y)})
                          </p>
                          <Badge variant="secondary" className="mt-2 text-xs">
                            {pin.status}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
