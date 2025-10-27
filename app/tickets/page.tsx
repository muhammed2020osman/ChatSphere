"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, ChevronDown, MoreHorizontal, Star, Settings2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TicketsFiltersPanel, type TicketFilters } from "@/components/tickets-filters-panel";
import { TicketsTableView } from "@/components/tickets-table-view";
import { TicketsMapView } from "@/components/tickets-map-view";
import { TicketPreviewPanel } from "@/components/ticket-preview-panel";
import { PinTimelineDrawer } from "@/components/pin-timeline-drawer";
import { SavedViewsDialog } from "@/components/saved-views-dialog";
import { BulkActionsDialog } from "@/components/bulk-actions-dialog";
import { queryClient } from "@/lib/queryClient";
import type { SavedView } from "@/lib/db/schema";

type TabValue = "table" | "map";

export default function TicketsHub() {
  const router = useRouter();
  
  // Get initial tab from URL query params
  const getInitialTab = (): TabValue => {
    if (typeof window === 'undefined') return "table";
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    return (tab === "map" || tab === "table") ? tab : "table";
  };

  // State management
  const [activeTab, setActiveTab] = useState<TabValue>(getInitialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [filters, setFilters] = useState<TicketFilters>({});
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>("desc");

  // Saved views state
  const [isSavedViewsDialogOpen, setIsSavedViewsDialogOpen] = useState(false);
  const [currentViewId, setCurrentViewId] = useState<string | null>(null);

  // Bulk actions state
  const [isBulkActionsDialogOpen, setIsBulkActionsDialogOpen] = useState(false);

  // Preview panel state
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Pin timeline drawer state
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [isPinTimelineOpen, setIsPinTimelineOpen] = useState(false);

  // Fetch saved views
  const { data: savedViews } = useQuery<SavedView[]>({
    queryKey: ['/api/saved-views'],
  });

  // Persist tab selection in query params
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, [activeTab]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue);
  };

  // Handle filter toggle
  const handleFilterToggle = () => {
    setIsFilterPanelOpen(!isFilterPanelOpen);
  };

  // Handle filters change
  const handleFiltersChange = (newFilters: TicketFilters) => {
    setFilters(newFilters);
  };

  // Handle apply filters
  const handleApplyFilters = () => {
    // Close the panel
    setIsFilterPanelOpen(false);
  };

  // Handle ticket click
  const handleTicketClick = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setIsPreviewOpen(true);
    // Close pin timeline if open
    setIsPinTimelineOpen(false);
  };

  // Handle selection change
  const handleSelectionChange = (ticketIds: string[]) => {
    setSelectedTickets(ticketIds);
  };

  // Handle drawing change (for map view)
  const handleDrawingChange = (drawingId: string) => {
    setSelectedDrawingId(drawingId);
  };

  // Handle pin click (for map view)
  const handlePinClick = (pinId: string, ticketId: string) => {
    setSelectedPinId(pinId);
    setIsPinTimelineOpen(true);
    // Close preview panel if open
    setIsPreviewOpen(false);
  };

  // Handle edit ticket
  const handleEditTicket = (ticketId: string) => {
    // TODO: Open edit ticket modal
    console.log("Editing ticket:", ticketId);
  };

  // Handle view pin from preview panel
  const handleViewPin = (pinId: string) => {
    setSelectedPinId(pinId);
    setIsPinTimelineOpen(true);
    // Keep preview panel open - user can have both open
  };

  // Handle ticket click from pin timeline
  const handleTicketClickFromTimeline = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setIsPreviewOpen(true);
    // Keep timeline drawer open - user can have both open
  };

  // Handle load saved view
  const handleLoadView = (view: SavedView) => {
    setFilters(view.filters as TicketFilters);
    setSortBy(view.sortBy || "createdAt");
    setSortOrder((view.sortOrder as 'asc' | 'desc') || "desc");
    setCurrentViewId(view.id);
  };

  // Handle bulk actions success
  const handleBulkActionsSuccess = () => {
    // Clear selection
    setSelectedTickets([]);
    // Refetch tickets
    queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
  };

  // Load default view on mount
  useEffect(() => {
    if (savedViews && savedViews.length > 0) {
      const defaultView = savedViews.find((v) => v.isDefault);
      if (defaultView && !currentViewId) {
        handleLoadView(defaultView);
      }
    }
  }, [savedViews]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Global Header */}
      <div className="px-6 py-4 border-b border-border bg-card">
        <div className="flex flex-col gap-4">
          {/* Title Row */}
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground">
                Tickets Hub
              </h1>
              <p className="text-muted-foreground text-base font-normal leading-normal">
                Manage and track all tickets across your projects
              </p>
            </div>
            
            {/* Bulk Actions Button */}
            <Button
              variant="outline"
              disabled={selectedTickets.length === 0}
              onClick={() => setIsBulkActionsDialogOpen(true)}
              className="gap-2"
              data-testid="button-bulk-actions"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span>Bulk Actions</span>
              {selectedTickets.length > 0 && (
                <span className="ml-1 text-muted-foreground">
                  ({selectedTickets.length})
                </span>
              )}
            </Button>
          </div>

          {/* Search and Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-tickets"
              />
            </div>

            {/* Filter Button */}
            <Button
              variant="outline"
              onClick={handleFilterToggle}
              className="gap-2"
              data-testid="button-filter"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {isFilterPanelOpen && (
                <span className="ml-1 h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>

            {/* View Selector Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2"
                  data-testid="button-view-selector"
                >
                  <span>
                    {currentViewId 
                      ? savedViews?.find((v) => v.id === currentViewId)?.name || "Views"
                      : "Views"
                    }
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* Saved Views */}
                {savedViews && savedViews.length > 0 && (
                  <>
                    {savedViews.map((view) => (
                      <DropdownMenuItem
                        key={view.id}
                        onClick={() => handleLoadView(view)}
                        className="flex items-center justify-between gap-2"
                        data-testid={`menu-item-view-${view.id}`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {view.isDefault && <Star className="h-3 w-3 shrink-0" />}
                          <span className="truncate">{view.name}</span>
                        </div>
                        {currentViewId === view.id && (
                          <Check className="h-4 w-4 shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}
                
                {/* Manage Views Button */}
                <DropdownMenuItem
                  onClick={() => setIsSavedViewsDialogOpen(true)}
                  className="flex items-center gap-2"
                  data-testid="menu-item-manage-views"
                >
                  <Settings2 className="h-4 w-4" />
                  <span>Manage Views</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <TicketsFiltersPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onApply={handleApplyFilters}
      />

      {/* Tabs Content Area */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* Tabs List */}
        <div className="px-6 border-b border-border bg-card">
          <TabsList className="h-12 bg-transparent" data-testid="tabs-list">
            <TabsTrigger
              value="table"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
              data-testid="tab-trigger-table"
            >
              Table
            </TabsTrigger>
            <TabsTrigger
              value="map"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
              data-testid="tab-trigger-map"
            >
              Map
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Table View Content */}
        <TabsContent
          value="table"
          className="flex-1 overflow-y-auto p-6 bg-background/30 m-0"
          data-testid="tab-content-table"
        >
          <TicketsTableView
            filters={filters}
            searchQuery={searchQuery}
            selectedTickets={selectedTickets}
            onSelectionChange={handleSelectionChange}
            onTicketClick={handleTicketClick}
          />
        </TabsContent>

        {/* Map View Content */}
        <TabsContent
          value="map"
          className="flex-1 overflow-hidden m-0"
          data-testid="tab-content-map"
        >
          <TicketsMapView
            filters={filters}
            searchQuery={searchQuery}
            selectedDrawingId={selectedDrawingId}
            onDrawingChange={handleDrawingChange}
            onPinClick={handlePinClick}
          />
        </TabsContent>
      </Tabs>

      {/* Preview Panels */}
      <TicketPreviewPanel
        ticketId={selectedTicketId}
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setSelectedTicketId(null);
        }}
        onEdit={handleEditTicket}
        onViewPin={handleViewPin}
      />

      <PinTimelineDrawer
        pinId={selectedPinId}
        isOpen={isPinTimelineOpen}
        onClose={() => {
          setIsPinTimelineOpen(false);
          setSelectedPinId(null);
        }}
        onTicketClick={handleTicketClickFromTimeline}
      />

      {/* Saved Views Dialog */}
      <SavedViewsDialog
        isOpen={isSavedViewsDialogOpen}
        onClose={() => setIsSavedViewsDialogOpen(false)}
        currentFilters={filters}
        currentSort={{ sortBy, sortOrder }}
        onLoadView={handleLoadView}
      />

      {/* Bulk Actions Dialog */}
      <BulkActionsDialog
        isOpen={isBulkActionsDialogOpen}
        onClose={() => setIsBulkActionsDialogOpen(false)}
        selectedTicketIds={selectedTickets}
        onSuccess={handleBulkActionsSuccess}
      />
    </div>
  );
}