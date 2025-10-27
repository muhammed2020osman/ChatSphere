"use client";

import { useState, useMemo } from "react";
import { X, Calendar as CalendarIcon, Search } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

export interface TicketFilters {
  disciplineId?: string[];
  floorId?: string[];
  drawingId?: string[];
  type?: string[];
  status?: string[];
  priority?: string[];
  assignedTo?: string[];
  layerId?: string[];
  slaStatus?: 'overdue' | 'due_soon' | 'on_track';
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
}

interface FiltersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: TicketFilters;
  onFiltersChange: (filters: TicketFilters) => void;
  onApply: () => void;
}

const TICKET_TYPES = [
  "RFI",
  "Issue",
  "Clash",
  "Change Request",
  "Observation",
  "Safety",
  "Quality",
  "Submittal",
  "Material Request",
  "NCR",
  "Inspection Request",
  "Punch",
  "Site Instruction",
];

const TICKET_STATUSES = [
  "Open",
  "In Review",
  "Awaiting Info",
  "In Progress",
  "Resolved",
  "Closed",
];

const PRIORITIES = [
  { value: "Low", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
  { value: "Medium", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" },
  { value: "High", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300" },
  { value: "Blocker", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" },
];

const SLA_STATUSES = [
  { value: "all", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "due_soon", label: "Due Soon" },
  { value: "on_track", label: "On Track" },
];

export function TicketsFiltersPanel({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onApply,
}: FiltersPanelProps) {
  const [tagInput, setTagInput] = useState("");
  const [drawingSearchQuery, setDrawingSearchQuery] = useState("");

  // Fetch disciplines
  const { data: disciplines, isLoading: isLoadingDisciplines } = useQuery<Array<{
    id: string;
    code: string;
    name: string;
  }>>({
    queryKey: ['/api/disciplines'],
    enabled: isOpen,
  });

  // Fetch floors
  const { data: floors, isLoading: isLoadingFloors } = useQuery<Array<{
    id: string;
    code: string;
    name: string;
  }>>({
    queryKey: ['/api/floors'],
    enabled: isOpen,
  });

  // Fetch drawings
  const { data: drawingsData, isLoading: isLoadingDrawings } = useQuery<{
    drawings: Array<{
      id: string;
      sheetNo: string;
      title: string;
    }>;
  }>({
    queryKey: ['/api/drawings'],
    enabled: isOpen,
  });

  // Fetch users
  const { data: users, isLoading: isLoadingUsers } = useQuery<Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }>>({
    queryKey: ['/api/users'],
    enabled: isOpen,
  });

  const drawings = drawingsData?.drawings || [];

  // Filter drawings based on search query
  const filteredDrawings = useMemo(() => {
    if (!drawingSearchQuery) return drawings;
    const query = drawingSearchQuery.toLowerCase();
    return drawings.filter(
      (d) =>
        (d.sheetNo || "").toLowerCase().includes(query) ||
        (d.title || "").toLowerCase().includes(query)
    );
  }, [drawings, drawingSearchQuery]);

  // Count active filters per section
  const filterCounts = useMemo(() => ({
    discipline: filters.disciplineId?.length || 0,
    floor: filters.floorId?.length || 0,
    drawing: filters.drawingId?.length || 0,
    type: filters.type?.length || 0,
    status: filters.status?.length || 0,
    priority: filters.priority?.length || 0,
    assignee: filters.assignedTo?.length || 0,
    layer: filters.layerId?.length || 0,
    sla: filters.slaStatus && filters.slaStatus !== 'on_track' ? 1 : 0,
    tags: filters.tags?.length || 0,
    dateRange: (filters.dateFrom || filters.dateTo) ? 1 : 0,
  }), [filters]);

  const handleToggleArrayFilter = (
    key: keyof TicketFilters,
    value: string
  ) => {
    const currentValues = (filters[key] as string[] | undefined) || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    
    onFiltersChange({
      ...filters,
      [key]: newValues.length > 0 ? newValues : undefined,
    });
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const currentTags = filters.tags || [];
    if (!currentTags.includes(tagInput.trim())) {
      onFiltersChange({
        ...filters,
        tags: [...currentTags, tagInput.trim()],
      });
    }
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    const newTags = (filters.tags || []).filter((t) => t !== tag);
    onFiltersChange({
      ...filters,
      tags: newTags.length > 0 ? newTags : undefined,
    });
  };

  const handleClearAll = () => {
    onFiltersChange({});
  };

  const handleDateSelect = (key: 'dateFrom' | 'dateTo', date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: date ? format(date, 'yyyy-MM-dd') : undefined,
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-80 p-0 flex flex-col" data-testid="sheet-filters-panel">
        {/* Header - Sticky */}
        <SheetHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle data-testid="text-filters-title">Filters</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-close-filters"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 px-6">
          <Accordion type="multiple" defaultValue={["discipline", "floor", "type", "status", "priority"]} className="w-full">
            {/* Discipline Filter */}
            <AccordionItem value="discipline" data-testid="accordion-item-discipline">
              <AccordionTrigger data-testid="accordion-trigger-discipline">
                <div className="flex items-center justify-between w-full pr-2">
                  <span>Discipline</span>
                  {filterCounts.discipline > 0 && (
                    <Badge variant="secondary" className="ml-2" data-testid="badge-discipline-count">
                      {filterCounts.discipline}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {isLoadingDisciplines ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-5 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {disciplines?.map((discipline) => (
                      <div key={discipline.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`discipline-${discipline.id}`}
                          checked={filters.disciplineId?.includes(discipline.id)}
                          onCheckedChange={() =>
                            handleToggleArrayFilter("disciplineId", discipline.id)
                          }
                          data-testid={`checkbox-discipline-${discipline.id}`}
                        />
                        <Label
                          htmlFor={`discipline-${discipline.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {discipline.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Floor Filter */}
            <AccordionItem value="floor" data-testid="accordion-item-floor">
              <AccordionTrigger data-testid="accordion-trigger-floor">
                <div className="flex items-center justify-between w-full pr-2">
                  <span>Floor</span>
                  {filterCounts.floor > 0 && (
                    <Badge variant="secondary" className="ml-2" data-testid="badge-floor-count">
                      {filterCounts.floor}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {isLoadingFloors ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-5 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {floors?.map((floor) => (
                      <div key={floor.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`floor-${floor.id}`}
                          checked={filters.floorId?.includes(floor.id)}
                          onCheckedChange={() =>
                            handleToggleArrayFilter("floorId", floor.id)
                          }
                          data-testid={`checkbox-floor-${floor.id}`}
                        />
                        <Label
                          htmlFor={`floor-${floor.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {floor.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Drawing Filter */}
            <AccordionItem value="drawing" data-testid="accordion-item-drawing">
              <AccordionTrigger data-testid="accordion-trigger-drawing">
                <div className="flex items-center justify-between w-full pr-2">
                  <span>Drawing</span>
                  {filterCounts.drawing > 0 && (
                    <Badge variant="secondary" className="ml-2" data-testid="badge-drawing-count">
                      {filterCounts.drawing}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search drawings..."
                      value={drawingSearchQuery}
                      onChange={(e) => setDrawingSearchQuery(e.target.value)}
                      className="pl-8"
                      data-testid="input-search-drawings"
                    />
                  </div>
                  
                  {isLoadingDrawings ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-5 w-full" />
                      ))}
                    </div>
                  ) : (
                    <ScrollArea className="h-48">
                      <div className="space-y-3 pr-4">
                        {filteredDrawings.map((drawing) => (
                          <div key={drawing.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`drawing-${drawing.id}`}
                              checked={filters.drawingId?.includes(drawing.id)}
                              onCheckedChange={() =>
                                handleToggleArrayFilter("drawingId", drawing.id)
                              }
                              data-testid={`checkbox-drawing-${drawing.id}`}
                            />
                            <Label
                              htmlFor={`drawing-${drawing.id}`}
                              className="text-sm font-normal cursor-pointer flex-1"
                            >
                              {drawing.sheetNo} - {drawing.title}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Type Filter */}
            <AccordionItem value="type" data-testid="accordion-item-type">
              <AccordionTrigger data-testid="accordion-trigger-type">
                <div className="flex items-center justify-between w-full pr-2">
                  <span>Type</span>
                  {filterCounts.type > 0 && (
                    <Badge variant="secondary" className="ml-2" data-testid="badge-type-count">
                      {filterCounts.type}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ScrollArea className="h-60">
                  <div className="space-y-3 pr-4">
                    {TICKET_TYPES.map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={`type-${type}`}
                          checked={filters.type?.includes(type)}
                          onCheckedChange={() => handleToggleArrayFilter("type", type)}
                          data-testid={`checkbox-type-${type.toLowerCase().replace(/\s+/g, '-')}`}
                        />
                        <Label
                          htmlFor={`type-${type}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </AccordionContent>
            </AccordionItem>

            {/* Status Filter */}
            <AccordionItem value="status" data-testid="accordion-item-status">
              <AccordionTrigger data-testid="accordion-trigger-status">
                <div className="flex items-center justify-between w-full pr-2">
                  <span>Status</span>
                  {filterCounts.status > 0 && (
                    <Badge variant="secondary" className="ml-2" data-testid="badge-status-count">
                      {filterCounts.status}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {TICKET_STATUSES.map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={filters.status?.includes(status)}
                        onCheckedChange={() => handleToggleArrayFilter("status", status)}
                        data-testid={`checkbox-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
                      />
                      <Label
                        htmlFor={`status-${status}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {status}
                      </Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Priority Filter */}
            <AccordionItem value="priority" data-testid="accordion-item-priority">
              <AccordionTrigger data-testid="accordion-trigger-priority">
                <div className="flex items-center justify-between w-full pr-2">
                  <span>Priority</span>
                  {filterCounts.priority > 0 && (
                    <Badge variant="secondary" className="ml-2" data-testid="badge-priority-count">
                      {filterCounts.priority}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {PRIORITIES.map((priority) => (
                    <div key={priority.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`priority-${priority.value}`}
                        checked={filters.priority?.includes(priority.value)}
                        onCheckedChange={() =>
                          handleToggleArrayFilter("priority", priority.value)
                        }
                        data-testid={`checkbox-priority-${priority.value.toLowerCase()}`}
                      />
                      <Label
                        htmlFor={`priority-${priority.value}`}
                        className="text-sm font-normal cursor-pointer flex items-center gap-2"
                      >
                        <Badge className={priority.color}>{priority.value}</Badge>
                      </Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Assignee Filter */}
            <AccordionItem value="assignee" data-testid="accordion-item-assignee">
              <AccordionTrigger data-testid="accordion-trigger-assignee">
                <div className="flex items-center justify-between w-full pr-2">
                  <span>Assignee</span>
                  {filterCounts.assignee > 0 && (
                    <Badge variant="secondary" className="ml-2" data-testid="badge-assignee-count">
                      {filterCounts.assignee}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {isLoadingUsers ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-5 w-full" />
                    ))}
                  </div>
                ) : (
                  <ScrollArea className="h-48">
                    <div className="space-y-3 pr-4">
                      {users?.map((user) => (
                        <div key={user.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`assignee-${user.id}`}
                            checked={filters.assignedTo?.includes(user.id)}
                            onCheckedChange={() =>
                              handleToggleArrayFilter("assignedTo", user.id)
                            }
                            data-testid={`checkbox-assignee-${user.id}`}
                          />
                          <Label
                            htmlFor={`assignee-${user.id}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {user.firstName || ''} {user.lastName || ''}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Layer Filter */}
            <AccordionItem value="layer" data-testid="accordion-item-layer">
              <AccordionTrigger data-testid="accordion-trigger-layer">
                <div className="flex items-center justify-between w-full pr-2">
                  <span>Layer</span>
                  {filterCounts.layer > 0 && (
                    <Badge variant="secondary" className="ml-2" data-testid="badge-layer-count">
                      {filterCounts.layer}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {!filters.drawingId || filters.drawingId.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-layer-no-drawing">
                    Please select a drawing first to view available layers
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground" data-testid="text-layer-placeholder">
                      Layer filtering will be available when backend API is implemented
                    </p>
                    {/* Placeholder for future layer implementation
                    <ScrollArea className="h-48">
                      <div className="space-y-3 pr-4">
                        {layers?.map((layer) => (
                          <div key={layer.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`layer-${layer.id}`}
                              checked={filters.layerId?.includes(layer.id)}
                              onCheckedChange={() =>
                                handleToggleArrayFilter("layerId", layer.id)
                              }
                              data-testid={`checkbox-layer-${layer.id}`}
                            />
                            <Label
                              htmlFor={`layer-${layer.id}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {layer.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    */}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* SLA Status Filter */}
            <AccordionItem value="sla" data-testid="accordion-item-sla">
              <AccordionTrigger data-testid="accordion-trigger-sla">
                <div className="flex items-center justify-between w-full pr-2">
                  <span>SLA Status</span>
                  {filterCounts.sla > 0 && (
                    <Badge variant="secondary" className="ml-2" data-testid="badge-sla-count">
                      {filterCounts.sla}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <RadioGroup
                  value={filters.slaStatus || 'all'}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      slaStatus: value === 'all' ? undefined : (value as 'overdue' | 'due_soon' | 'on_track'),
                    })
                  }
                  data-testid="radio-group-sla"
                >
                  {SLA_STATUSES.map((sla) => (
                    <div key={sla.value} className="flex items-center space-x-2">
                      <RadioGroupItem
                        value={sla.value}
                        id={`sla-${sla.value}`}
                        data-testid={`radio-sla-${sla.value}`}
                      />
                      <Label
                        htmlFor={`sla-${sla.value}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {sla.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </AccordionContent>
            </AccordionItem>

            {/* Tags Filter */}
            <AccordionItem value="tags" data-testid="accordion-item-tags">
              <AccordionTrigger data-testid="accordion-trigger-tags">
                <div className="flex items-center justify-between w-full pr-2">
                  <span>Tags</span>
                  {filterCounts.tags > 0 && (
                    <Badge variant="secondary" className="ml-2" data-testid="badge-tags-count">
                      {filterCounts.tags}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add tag..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      data-testid="input-add-tag"
                    />
                    <Button
                      variant="outline"
                      onClick={handleAddTag}
                      data-testid="button-add-tag"
                    >
                      Add
                    </Button>
                  </div>
                  {filters.tags && filters.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {filters.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="gap-1"
                          data-testid={`badge-tag-${tag}`}
                        >
                          {tag}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => handleRemoveTag(tag)}
                            data-testid={`button-remove-tag-${tag}`}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Date Range Filter */}
            <AccordionItem value="dateRange" data-testid="accordion-item-date-range">
              <AccordionTrigger data-testid="accordion-trigger-date-range">
                <div className="flex items-center justify-between w-full pr-2">
                  <span>Date Range</span>
                  {filterCounts.dateRange > 0 && (
                    <Badge variant="secondary" className="ml-2" data-testid="badge-date-range-count">
                      {filterCounts.dateRange}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {/* From Date */}
                  <div className="space-y-2">
                    <Label className="text-sm">From</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          data-testid="button-date-from"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.dateFrom ? (
                            format(new Date(filters.dateFrom), 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                          onSelect={(date) => handleDateSelect('dateFrom', date)}
                          initialFocus
                          data-testid="calendar-date-from"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* To Date */}
                  <div className="space-y-2">
                    <Label className="text-sm">To</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          data-testid="button-date-to"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.dateTo ? (
                            format(new Date(filters.dateTo), 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
                          onSelect={(date) => handleDateSelect('dateTo', date)}
                          initialFocus
                          data-testid="calendar-date-to"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollArea>

        {/* Footer - Sticky */}
        <SheetFooter className="px-6 py-4 border-t border-border">
          <div className="flex flex-col gap-2 w-full">
            <Button
              variant="outline"
              onClick={handleClearAll}
              className="w-full"
              data-testid="button-clear-all"
            >
              Clear All Filters
            </Button>
            <Button
              onClick={onApply}
              className="w-full"
              data-testid="button-apply-filters"
            >
              Apply Filters
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
