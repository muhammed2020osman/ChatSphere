import { useState, useRef } from "react";
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

export default function SheetViewer() {
  const { id } = useParams();
  const [activeTool, setActiveTool] = useState<Tool>("pan");
  const [zoom, setZoom] = useState(100);
  const [pins, setPins] = useState<Pin[]>([]);
  const [showLayers, setShowLayers] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

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

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 400));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 25));
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === "pin" && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      const newPin: Pin = {
        id: `pin-${Date.now()}`,
        x,
        y,
        type: "generic",
        title: `Pin ${pins.length + 1}`,
        status: "open",
      };
      setPins([...pins, newPin]);
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
            {tools.map((tool) => (
              <Tooltip key={tool.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTool === tool.id ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setActiveTool(tool.id)}
                    data-testid={`button-tool-${tool.id}`}
                  >
                    <tool.icon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{tool.label} ({tool.shortcut})</p>
                </TooltipContent>
              </Tooltip>
            ))}
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
            className="w-full h-full overflow-auto flex items-center justify-center p-8"
            onClick={handleCanvasClick}
            style={{ cursor: activeTool === "pan" ? "grab" : activeTool === "pin" ? "crosshair" : "default" }}
            data-testid="canvas-viewer"
          >
            <div
              className="relative bg-white shadow-2xl"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "center",
                transition: "transform 0.2s ease-out",
              }}
            >
              <img
                src={plan.imageUrl}
                alt={plan.title}
                className="max-w-full h-auto"
                data-testid="img-plan-canvas"
              />
              
              {/* Render pins */}
              {pins.map((pin) => (
                <div
                  key={pin.id}
                  className="absolute w-6 h-6 -ml-3 -mt-6 cursor-pointer"
                  style={{
                    left: `${pin.x}%`,
                    top: `${pin.y}%`,
                  }}
                  data-testid={`pin-${pin.id}`}
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
