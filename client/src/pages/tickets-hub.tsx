import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, Filter, ChevronDown, MoreHorizontal } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TicketsFiltersPanel, type TicketFilters } from "@/components/tickets-filters-panel";
import { TicketsTableView } from "@/components/tickets-table-view";

type TabValue = "table" | "map";

export default function TicketsHub() {
  const [, setLocation] = useLocation();
  
  // Get initial tab from URL query params
  const getInitialTab = (): TabValue => {
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

  // Persist tab selection in query params
  useEffect(() => {
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
    // TODO: Open ticket detail panel
    console.log("Opening ticket:", ticketId);
  };

  // Handle selection change
  const handleSelectionChange = (ticketIds: string[]) => {
    setSelectedTickets(ticketIds);
  };

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
                  <span>Views</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem data-testid="menu-item-all-tickets">
                  All Tickets
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-item-my-tickets">
                  My Tickets
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-item-unassigned">
                  Unassigned
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-item-overdue">
                  Overdue
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
          className="flex-1 overflow-y-auto p-6 bg-background/30 m-0"
          data-testid="tab-content-map"
        >
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Map View
              </h2>
              <p className="text-muted-foreground">
                Map view content will be implemented here
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
