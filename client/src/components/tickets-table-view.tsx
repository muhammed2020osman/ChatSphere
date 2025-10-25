import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInHours, parseISO } from "date-fns";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  FileText,
  AlertCircle,
  GitBranch,
  ShieldAlert,
  Eye as EyeIcon,
  CheckCircle2,
  Package,
  ClipboardCheck,
  Hammer,
  FileWarning,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { TicketFilters } from "./tickets-filters-panel";
import type { TicketWithDetails } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TicketsTableViewProps {
  filters: TicketFilters;
  searchQuery: string;
  selectedTickets: string[];
  onSelectionChange: (ticketIds: string[]) => void;
  onTicketClick: (ticketId: string) => void;
}

type SortField = "id" | "title" | "type" | "status" | "priority" | "assignedTo" | "dueDate" | "createdAt";
type SortOrder = "asc" | "desc";

const TICKET_TYPE_ICONS: Record<string, any> = {
  RFI: FileText,
  Issue: AlertCircle,
  Clash: GitBranch,
  "Change Request": FileWarning,
  Observation: EyeIcon,
  Safety: ShieldAlert,
  Quality: CheckCircle2,
  Submittal: Package,
  "Material Request": Package,
  NCR: FileWarning,
  "Inspection Request": ClipboardCheck,
  Punch: Hammer,
  "Site Instruction": FileText,
};

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  "In Review": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  "Awaiting Info": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  "In Progress": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
  Resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  Closed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  Medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  High: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  Blocker: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export function TicketsTableView({
  filters,
  searchQuery,
  selectedTickets,
  onSelectionChange,
  onTicketClick,
}: TicketsTableViewProps) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [deleteTicketId, setDeleteTicketId] = useState<string | null>(null);
  const limit = 20;

  // Build query params
  const queryParams = useMemo(() => {
    const params: Record<string, any> = {
      page,
      limit,
      sortBy,
      sortOrder,
    };

    if (searchQuery) params.search = searchQuery;
    if (filters.disciplineId?.length) params.disciplineId = filters.disciplineId;
    if (filters.floorId?.length) params.floorId = filters.floorId;
    if (filters.drawingId?.length) params.drawingId = filters.drawingId;
    if (filters.type?.length) params.type = filters.type;
    if (filters.status?.length) params.status = filters.status;
    if (filters.priority?.length) params.priority = filters.priority;
    if (filters.assignedTo?.length) params.assignedTo = filters.assignedTo;
    if (filters.layerId?.length) params.layerId = filters.layerId;
    if (filters.slaStatus) params.slaStatus = filters.slaStatus;
    if (filters.tags?.length) params.tags = filters.tags;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;

    return params;
  }, [filters, searchQuery, page, limit, sortBy, sortOrder]);

  // Fetch tickets
  const { data, isLoading, error } = useQuery<{
    tickets: TicketWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ["/api/tickets", queryParams],
  });

  const tickets = data?.tickets || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortBy !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  // Handle selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(tickets.map((t) => t.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectTicket = (ticketId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedTickets, ticketId]);
    } else {
      onSelectionChange(selectedTickets.filter((id) => id !== ticketId));
    }
  };

  const isAllSelected = tickets.length > 0 && tickets.every((t) => selectedTickets.includes(t.id));
  const isSomeSelected = tickets.some((t) => selectedTickets.includes(t.id)) && !isAllSelected;

  // Handle delete
  const handleDelete = async () => {
    if (!deleteTicketId) return;

    try {
      await apiRequest(`/api/tickets/${deleteTicketId}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({
        title: "Ticket deleted",
        description: "The ticket has been successfully deleted.",
      });
      setDeleteTicketId(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete ticket. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Get SLA badge
  const getSLABadge = (ticket: TicketWithDetails) => {
    if (!ticket.dueDate) return null;

    const now = new Date();
    const dueDate = parseISO(ticket.dueDate as any);
    const hoursRemaining = differenceInHours(dueDate, now);

    if (hoursRemaining < 0) {
      return (
        <Badge variant="destructive" className="text-xs" data-testid={`badge-sla-overdue-${ticket.id}`}>
          Overdue
        </Badge>
      );
    } else if (hoursRemaining <= 24) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 text-xs" data-testid={`badge-sla-due-soon-${ticket.id}`}>
          Due Soon
        </Badge>
      );
    } else {
      return (
        <span className="text-sm text-muted-foreground" data-testid={`text-sla-date-${ticket.id}`}>
          {format(dueDate, "MMM d, yyyy")}
        </span>
      );
    }
  };

  // Get user initials
  const getUserInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "?";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  // Render pagination
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxVisible = 5;

    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <Pagination className="mt-4" data-testid="pagination-container">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => setPage(Math.max(1, page - 1))}
              className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              data-testid="button-pagination-previous"
            />
          </PaginationItem>

          {startPage > 1 && (
            <>
              <PaginationItem>
                <PaginationLink
                  onClick={() => setPage(1)}
                  className="cursor-pointer"
                  data-testid="button-pagination-page-1"
                >
                  1
                </PaginationLink>
              </PaginationItem>
              {startPage > 2 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
            </>
          )}

          {pageNumbers.map((pageNum) => (
            <PaginationItem key={pageNum}>
              <PaginationLink
                onClick={() => setPage(pageNum)}
                isActive={page === pageNum}
                className="cursor-pointer"
                data-testid={`button-pagination-page-${pageNum}`}
              >
                {pageNum}
              </PaginationLink>
            </PaginationItem>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationLink
                  onClick={() => setPage(totalPages)}
                  className="cursor-pointer"
                  data-testid={`button-pagination-page-${totalPages}`}
                >
                  {totalPages}
                </PaginationLink>
              </PaginationItem>
            </>
          )}

          <PaginationItem>
            <PaginationNext
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              data-testid="button-pagination-next"
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Skeleton className="h-4 w-4" />
                </TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Drawing</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error loading tickets</h3>
          <p className="text-muted-foreground">
            Failed to load tickets. Please try again.
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (tickets.length === 0) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="empty-state">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No tickets found</h3>
          <p className="text-muted-foreground">
            {searchQuery || Object.keys(filters).length > 0
              ? "Try adjusting your search or filters"
              : "Get started by creating your first ticket"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Results info */}
      <div className="text-sm text-muted-foreground" data-testid="text-results-info">
        Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total} tickets
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                  data-testid="checkbox-select-all"
                  className={isSomeSelected ? "opacity-50" : ""}
                />
              </TableHead>
              <TableHead className="w-28">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("id")}
                  className="h-8 px-2"
                  data-testid="button-sort-id"
                >
                  ID
                  {getSortIcon("id")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("title")}
                  className="h-8 px-2"
                  data-testid="button-sort-title"
                >
                  Title
                  {getSortIcon("title")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("type")}
                  className="h-8 px-2"
                  data-testid="button-sort-type"
                >
                  Type
                  {getSortIcon("type")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("status")}
                  className="h-8 px-2"
                  data-testid="button-sort-status"
                >
                  Status
                  {getSortIcon("status")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("priority")}
                  className="h-8 px-2"
                  data-testid="button-sort-priority"
                >
                  Priority
                  {getSortIcon("priority")}
                </Button>
              </TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Drawing</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("dueDate")}
                  className="h-8 px-2"
                  data-testid="button-sort-sla"
                >
                  SLA
                  {getSortIcon("dueDate")}
                </Button>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => {
              const TypeIcon = TICKET_TYPE_ICONS[ticket.type] || FileText;

              return (
                <TableRow
                  key={ticket.id}
                  data-state={selectedTickets.includes(ticket.id) ? "selected" : undefined}
                  className="cursor-pointer"
                  data-testid={`row-ticket-${ticket.id}`}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedTickets.includes(ticket.id)}
                      onCheckedChange={(checked) =>
                        handleSelectTicket(ticket.id, checked as boolean)
                      }
                      aria-label={`Select ticket ${ticket.id}`}
                      data-testid={`checkbox-ticket-${ticket.id}`}
                    />
                  </TableCell>
                  <TableCell
                    onClick={() => onTicketClick(ticket.id)}
                    className="font-mono text-xs"
                    data-testid={`text-ticket-id-${ticket.id}`}
                  >
                    {ticket.id.substring(0, 8)}
                  </TableCell>
                  <TableCell
                    onClick={() => onTicketClick(ticket.id)}
                    className="font-medium"
                    data-testid={`text-ticket-title-${ticket.id}`}
                  >
                    {ticket.title}
                  </TableCell>
                  <TableCell onClick={() => onTicketClick(ticket.id)}>
                    <Badge
                      variant="outline"
                      className="gap-1"
                      data-testid={`badge-ticket-type-${ticket.id}`}
                    >
                      <TypeIcon className="h-3 w-3" />
                      {ticket.type}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={() => onTicketClick(ticket.id)}>
                    <Badge
                      className={STATUS_COLORS[ticket.status] || ""}
                      data-testid={`badge-ticket-status-${ticket.id}`}
                    >
                      {ticket.status}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={() => onTicketClick(ticket.id)}>
                    <Badge
                      className={PRIORITY_COLORS[ticket.priority] || ""}
                      data-testid={`badge-ticket-priority-${ticket.id}`}
                    >
                      {ticket.priority}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={() => onTicketClick(ticket.id)}>
                    {ticket.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={ticket.assignee.profileImageUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {getUserInitials(
                              ticket.assignee.firstName || undefined,
                              ticket.assignee.lastName || undefined
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm" data-testid={`text-ticket-assignee-${ticket.id}`}>
                          {ticket.assignee.firstName} {ticket.assignee.lastName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground" data-testid={`text-ticket-unassigned-${ticket.id}`}>
                        Unassigned
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    onClick={() => onTicketClick(ticket.id)}
                    className="text-sm"
                    data-testid={`text-ticket-drawing-${ticket.id}`}
                  >
                    {ticket.drawing?.sheetNo || 'N/A'}
                  </TableCell>
                  <TableCell onClick={() => onTicketClick(ticket.id)}>
                    {getSLABadge(ticket)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-actions-${ticket.id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onTicketClick(ticket.id)}
                          data-testid={`menu-item-view-${ticket.id}`}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem data-testid={`menu-item-edit-${ticket.id}`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteTicketId(ticket.id)}
                          className="text-destructive"
                          data-testid={`menu-item-delete-${ticket.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {renderPagination()}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTicketId} onOpenChange={(open) => !open && setDeleteTicketId(null)}>
        <AlertDialogContent data-testid="dialog-delete-ticket">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ticket</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this ticket? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
