"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ZoomIn,
  ZoomOut,
  Hand,
  MapPin,
  ChevronDown,
  Maximize2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PDFViewerCanvas } from "@/components/pdf-viewer-canvas";
import type { TicketFilters } from "./tickets-filters-panel";
import type { DrawingWithDetails, Pin, Ticket, TicketWithDetails } from "@shared/schema";
import mapLocationIcon from "../attached_assets/map-location_1761314621260.png";

interface TicketsMapViewProps {
  filters: TicketFilters;
  searchQuery: string;
  selectedDrawingId?: string;
  onDrawingChange: (drawingId: string) => void;
  onPinClick: (pinId: string, ticketId: string) => void;
}

type Tool = "pan" | "zoom-in" | "zoom-out";

interface PinWithTicket extends Pin {
  ticket?: TicketWithDetails;
}

export function TicketsMapView({
  filters,
  searchQuery,
  selectedDrawingId,
  onDrawingChange,
  onPinClick,
}: TicketsMapViewProps) {
  const [activeTool, setActiveTool] = useState<Tool>("pan");
  const [zoom, setZoom] = useState(100);
  const [initialZoomSet, setInitialZoomSet] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  // Build query params for drawings (filtered by discipline/floor if specified)
  const drawingsParams = useMemo(() => {
    const params: Record<string, any> = {};
    if (filters.disciplineId?.length) params.disciplineId = filters.disciplineId;
    if (filters.floorId?.length) params.floorId = filters.floorId;
    return params;
  }, [filters.disciplineId, filters.floorId]);

  // Fetch drawings list
  const { data: drawingsData, isLoading: drawingsLoading } = useQuery<{
    drawings: DrawingWithDetails[];
  }>({
    queryKey: ['/api/drawings', drawingsParams],
  });

  const drawings = drawingsData?.drawings || [];

  // Fetch selected drawing details
  const { data: selectedDrawing, isLoading: drawingLoading } = useQuery<DrawingWithDetails>({
    queryKey: ['/api/drawings', selectedDrawingId],
    enabled: !!selectedDrawingId,
  });

  // Fetch pins for selected drawing
  const { data: pins = [], isLoading: pinsLoading } = useQuery<Pin[]>({
    queryKey: ['/api/drawings', selectedDrawingId, 'pins'],
    enabled: !!selectedDrawingId,
  });

  // Build query params for tickets
  const ticketsParams = useMemo(() => {
    const params: Record<string, any> = {
      drawingId: selectedDrawingId ? [selectedDrawingId] : undefined,
    };
    if (searchQuery) params.search = searchQuery;
    if (filters.disciplineId?.length) params.disciplineId = filters.disciplineId;
    if (filters.floorId?.length) params.floorId = filters.floorId;
    if (filters.type?.length) params.type = filters.type;
    if (filters.status?.length) params.status = filters.status;
    if (filters.priority?.length) params.priority = filters.priority;
    if (filters.assignedTo?.length) params.assignedTo = filters.assignedTo;
    if (filters.slaStatus) params.slaStatus = filters.slaStatus;
    if (filters.tags?.length) params.tags = filters.tags;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    return params;
  }, [filters, searchQuery, selectedDrawingId]);

  // Fetch tickets for selected drawing with filters applied
  const { data: ticketsData, isLoading: ticketsLoading } = useQuery<{
    tickets: TicketWithDetails[];
    total: number;
  }>({
    queryKey: ["/api/tickets", ticketsParams],
    enabled: !!selectedDrawingId,
  });

  const tickets = ticketsData?.tickets || [];

  // Match pins to tickets
  const pinsWithTickets: PinWithTicket[] = useMemo(() => {
    return pins.map(pin => {
      const ticket = tickets.find(t => t.pinId === pin.id);
      return { ...pin, ticket };
    });
  }, [pins, tickets]);

  // Filter pins to only show those with matching tickets
  const visiblePins = useMemo(() => {
    return pinsWithTickets.filter(pin => pin.ticket);
  }, [pinsWithTickets]);

  // Get latest revision for selected drawing
  const latestRevision = selectedDrawing?.revisions?.[0];
  const displayImageUrl = latestRevision?.fileUrl;
  const displayMode = latestRevision?.uploadMethod === 'manual' && 
                      latestRevision?.fileType === 'application/pdf' 
                        ? 'pdf' : 'image';

  // Reset zoom when drawing changes
  useEffect(() => {
    setInitialZoomSet(false);
    setPanPosition({ x: 0, y: 0 });
  }, [selectedDrawingId, displayImageUrl]);

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

  const handleAutoFit = useCallback(() => {
    setInitialZoomSet(false);
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
  }, [isPanning, activeTool, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handlePinClick = useCallback((pinId: string, ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onPinClick(pinId, ticketId);
  }, [onPinClick]);

  const isLoading = drawingsLoading || drawingLoading || pinsLoading || ticketsLoading;

  // Empty state - no drawing selected
  if (!selectedDrawingId) {
    return (
      <div className="flex flex-col h-full">
        {/* Sheet Selector */}
        <div className="px-6 py-4 border-b border-border bg-card sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <label htmlFor="sheet-selector" className="text-sm font-medium text-foreground min-w-fit">
              Select Drawing:
            </label>
            <Select
              value={selectedDrawingId || ""}
              onValueChange={onDrawingChange}
              disabled={drawingsLoading || drawings.length === 0}
            >
              <SelectTrigger
                id="sheet-selector"
                className="w-full max-w-md"
                data-testid="select-drawing"
              >
                <SelectValue placeholder={drawingsLoading ? "Loading drawings..." : "Choose a drawing..."} />
              </SelectTrigger>
              <SelectContent>
                {drawings.map((drawing) => (
                  <SelectItem key={drawing.id} value={drawing.id} data-testid={`select-item-drawing-${drawing.id}`}>
                    {drawing.sheetNo} - {drawing.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md" data-testid="empty-state-no-drawing">
            <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Drawing Selected</h3>
            <p className="text-muted-foreground mb-4">
              {drawings.length === 0
                ? "No drawings available. Please adjust your filters or add drawings to the project."
                : "Select a drawing from the dropdown above to view tickets on the map."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sheet Selector */}
      <div className="px-6 py-4 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center gap-4 flex-wrap">
          <label htmlFor="sheet-selector" className="text-sm font-medium text-foreground min-w-fit">
            Drawing:
          </label>
          <Select
            value={selectedDrawingId}
            onValueChange={onDrawingChange}
            disabled={drawingsLoading}
          >
            <SelectTrigger
              id="sheet-selector"
              className="w-full max-w-md"
              data-testid="select-drawing"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {drawings.map((drawing) => (
                <SelectItem key={drawing.id} value={drawing.id} data-testid={`select-item-drawing-${drawing.id}`}>
                  {drawing.sheetNo} - {drawing.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedDrawing && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" data-testid="badge-discipline">
                {selectedDrawing.discipline?.name || "N/A"}
              </Badge>
              {selectedDrawing.floor && (
                <Badge variant="outline" data-testid="badge-floor">
                  {selectedDrawing.floor.name}
                </Badge>
              )}
              <Badge variant="secondary" data-testid="badge-tickets-count">
                {visiblePins.length} {visiblePins.length === 1 ? 'Ticket' : 'Tickets'}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Viewer Area */}
      <div className="flex-1 relative overflow-hidden bg-background/30">
        {isLoading ? (
          <div className="flex items-center justify-center h-full" data-testid="loading-state">
            <div className="text-center">
              <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
              <Skeleton className="h-4 w-32 mx-auto" />
            </div>
          </div>
        ) : !displayImageUrl ? (
          <div className="flex items-center justify-center h-full" data-testid="empty-state-no-image">
            <div className="text-center max-w-md">
              <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Drawing Available</h3>
              <p className="text-muted-foreground">
                This drawing doesn't have any revisions uploaded yet.
              </p>
            </div>
          </div>
        ) : (
          <div
            ref={canvasRef}
            className="relative w-full h-full overflow-hidden"
            style={{ cursor: activeTool === "pan" ? (isPanning ? "grabbing" : "grab") : "crosshair" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            data-testid="viewer-canvas"
          >
            {displayMode === 'pdf' ? (
              <PDFViewerCanvas
                pdfUrl={displayImageUrl}
                zoom={zoom}
                panPosition={panPosition}
                onPanChange={setPanPosition}
              >
                {/* Render pins as SVG overlay */}
                {visiblePins.map((pin) => {
                  const x = parseFloat(pin.x);
                  const y = parseFloat(pin.y);
                  
                  if (!pin.ticket) return null;

                  return (
                    <g
                      key={pin.id}
                      onClick={(e: any) => handlePinClick(pin.id, pin.ticket!.id, e)}
                      style={{ cursor: 'pointer' }}
                      data-testid={`pin-${pin.id}`}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <image
                              href={mapLocationIcon}
                              x={`${x}%`}
                              y={`${y}%`}
                              width="32"
                              height="32"
                              transform="translate(-16, -32)"
                              className="hover:opacity-80 transition-opacity"
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-semibold">{pin.ticket.title}</p>
                              <div className="flex gap-2 text-xs">
                                <Badge variant="outline" className="text-xs">
                                  {pin.ticket.type}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {pin.ticket.priority}
                                </Badge>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </g>
                  );
                })}
              </PDFViewerCanvas>
            ) : (
              <div
                ref={imageRef}
                className="absolute top-0 left-0 w-full h-full flex items-center justify-center"
              >
                <div
                  style={{
                    transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoom / 100})`,
                    transformOrigin: 'center',
                    position: 'relative',
                  }}
                >
                  <img
                    src={displayImageUrl}
                    alt={selectedDrawing?.title || "Drawing"}
                    className="max-w-none"
                    style={{ pointerEvents: 'none' }}
                    data-testid="viewer-image"
                  />
                  
                  {/* Pins overlay for image mode */}
                  {visiblePins.map((pin) => {
                    const x = parseFloat(pin.x);
                    const y = parseFloat(pin.y);
                    
                    if (!pin.ticket) return null;

                    return (
                      <TooltipProvider key={pin.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => handlePinClick(pin.id, pin.ticket!.id, e)}
                              className="absolute hover:opacity-80 transition-opacity"
                              style={{
                                left: `${x}%`,
                                top: `${y}%`,
                                transform: 'translate(-50%, -100%)',
                                cursor: 'pointer',
                                pointerEvents: 'auto',
                              }}
                              data-testid={`pin-${pin.id}`}
                            >
                              <img
                                src={mapLocationIcon}
                                alt="Pin"
                                className="w-8 h-8"
                              />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-semibold">{pin.ticket.title}</p>
                              <div className="flex gap-2 text-xs">
                                <Badge variant="outline" className="text-xs">
                                  {pin.ticket.type}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {pin.ticket.priority}
                                </Badge>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Zoom Controls - Bottom Right */}
        {displayImageUrl && !isLoading && (
          <Card className="absolute bottom-6 right-6 p-2 shadow-lg" data-testid="zoom-controls">
            <div className="flex flex-col gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant={activeTool === "pan" ? "default" : "ghost"}
                      onClick={() => setActiveTool("pan")}
                      data-testid="button-tool-pan"
                    >
                      <Hand className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Pan (Drag to move)</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleZoomIn}
                      disabled={zoom >= 400}
                      data-testid="button-zoom-in"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Zoom In</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="text-xs text-center font-mono px-1" data-testid="text-zoom-level">
                {zoom}%
              </div>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleZoomOut}
                      disabled={zoom <= 25}
                      data-testid="button-zoom-out"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Zoom Out</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleAutoFit}
                      data-testid="button-auto-fit"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Auto Fit</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </Card>
        )}

        {/* Empty state - no tickets */}
        {!isLoading && displayImageUrl && visiblePins.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Card className="p-6 max-w-md pointer-events-auto" data-testid="empty-state-no-tickets">
              <div className="text-center">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Tickets Found</h3>
                <p className="text-muted-foreground text-sm">
                  {searchQuery || Object.keys(filters).length > 0
                    ? "No tickets match your current filters for this drawing. Try adjusting your search or filters."
                    : "This drawing doesn't have any tickets yet. Create a ticket to get started."}
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
