"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { format, differenceInHours, parseISO } from "date-fns";
import {
  X,
  Pencil,
  Trash2,
  MapPin,
  Calendar,
  Clock,
  User,
  FileText,
  Tag,
  AlertCircle,
  GitBranch,
  ShieldAlert,
  Eye as EyeIcon,
  CheckCircle2,
  Package,
  ClipboardCheck,
  Hammer,
  FileWarning,
  Layers,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { TicketWithDetails } from "@/shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface TicketPreviewPanelProps {
  ticketId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (ticketId: string) => void;
  onViewPin: (pinId: string) => void;
}

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

export function TicketPreviewPanel({
  ticketId,
  isOpen,
  onClose,
  onEdit,
  onViewPin,
}: TicketPreviewPanelProps) {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch ticket details
  const { data: ticket, isLoading, error } = useQuery<TicketWithDetails>({
    queryKey: ["/api/tickets", ticketId],
    enabled: isOpen && !!ticketId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/tickets/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({
        title: "Ticket deleted",
        description: "The ticket has been successfully deleted.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete ticket. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (ticketId) {
      deleteMutation.mutate(ticketId);
      setShowDeleteDialog(false);
    }
  };

  const getUserInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "?";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const getSLABadge = (ticket: TicketWithDetails) => {
    if (!ticket.dueDate) return null;

    const now = new Date();
    const dueDate = parseISO(ticket.dueDate as any);
    const hoursRemaining = differenceInHours(dueDate, now);

    if (hoursRemaining < 0) {
      return (
        <Badge variant="destructive" className="text-xs" data-testid="badge-sla-overdue">
          Overdue
        </Badge>
      );
    } else if (hoursRemaining <= 24) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 text-xs" data-testid="badge-sla-due-soon">
          Due Soon
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="text-xs" data-testid="badge-sla-on-track">
          On Track
        </Badge>
      );
    }
  };

  const TypeIcon = ticket ? TICKET_TYPE_ICONS[ticket.type] || FileText : FileText;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[400px] p-0 flex flex-col"
          data-testid="sheet-ticket-preview"
        >
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg font-semibold mb-1" data-testid="text-ticket-title">
                  {isLoading ? (
                    <Skeleton className="h-6 w-48" />
                  ) : (
                    ticket?.title || "Ticket Details"
                  )}
                </SheetTitle>
                {!isLoading && ticket && (
                  <p className="text-sm text-muted-foreground" data-testid="text-ticket-id">
                    Ticket #{ticket.id?.slice(0, 8) || ticket.id}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-6 w-6 rounded-sm"
                data-testid="button-close-preview"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {!isLoading && ticket && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  className={STATUS_COLORS[ticket.status] || STATUS_COLORS.Open}
                  data-testid="badge-status"
                >
                  {ticket.status}
                </Badge>
                <Badge
                  className={PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.Medium}
                  data-testid="badge-priority"
                >
                  {ticket.priority}
                </Badge>
                {getSLABadge(ticket)}
              </div>
            )}
          </SheetHeader>

          {/* Scrollable Content */}
          <ScrollArea className="flex-1">
            <div className="px-6 py-4 space-y-6">
              {isLoading ? (
                <div className="space-y-6" data-testid="loading-skeleton">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="error-state">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Failed to load ticket details
                  </p>
                </div>
              ) : !ticket ? (
                <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-state">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    No ticket selected
                  </p>
                </div>
              ) : (
                <>
                  {/* Quick Actions */}
                  <div data-testid="section-quick-actions">
                    <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(ticket.id)}
                        className="gap-2"
                        data-testid="button-edit-ticket"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      {ticket.pinId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewPin(ticket.pinId!)}
                          className="gap-2"
                          data-testid="button-view-pin"
                        >
                          <MapPin className="h-4 w-4" />
                          View Pin
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteDialog(true)}
                        className="gap-2"
                        data-testid="button-delete-ticket"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Details */}
                  <div data-testid="section-details">
                    <h3 className="text-sm font-semibold mb-3">Details</h3>
                    <div className="space-y-3">
                      {/* Type */}
                      <div className="flex items-center gap-3">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Type</p>
                          <p className="text-sm" data-testid="text-ticket-type">{ticket.type}</p>
                        </div>
                      </div>

                      {/* Assignee */}
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Assignee</p>
                          {ticket.assignee ? (
                            <div className="flex items-center gap-2 mt-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={ticket.assignee.profileImageUrl || undefined} />
                                <AvatarFallback className="text-xs">
                                  {getUserInitials(ticket.assignee.firstName || undefined, ticket.assignee.lastName || undefined)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm" data-testid="text-assignee-name">
                                {ticket.assignee?.firstName || ''} {ticket.assignee?.lastName || ''}
                              </span>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground" data-testid="text-unassigned">Unassigned</p>
                          )}
                        </div>
                      </div>

                      {/* Reporter */}
                      {ticket.reporter && (
                        <div className="flex items-center gap-3">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Reporter</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={ticket.reporter.profileImageUrl || undefined} />
                                <AvatarFallback className="text-xs">
                                  {getUserInitials(ticket.reporter.firstName || undefined, ticket.reporter.lastName || undefined)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm" data-testid="text-reporter-name">
                                {ticket.reporter.firstName} {ticket.reporter.lastName}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Drawing */}
                      {ticket.drawing && (
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Drawing</p>
                            <p className="text-sm" data-testid="text-drawing">
                              {ticket.drawing.sheetNo} - {ticket.drawing.title}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Layer */}
                      {ticket.layer && (
                        <div className="flex items-center gap-3">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Layer</p>
                            <p className="text-sm" data-testid="text-layer">{ticket.layer.name}</p>
                          </div>
                        </div>
                      )}

                      {/* Created Date */}
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Created</p>
                          <p className="text-sm" data-testid="text-created-date">
                            {ticket.createdAt && format(new Date(ticket.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>

                      {/* Due Date */}
                      {ticket.dueDate && (
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Due Date</p>
                            <p className="text-sm" data-testid="text-due-date">
                              {format(parseISO(ticket.dueDate as any), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Description */}
                  <div data-testid="section-description">
                    <h3 className="text-sm font-semibold mb-3">Description</h3>
                    {ticket.description ? (
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap" data-testid="text-description">
                        {ticket.description}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground" data-testid="text-no-description">
                        No description provided
                      </p>
                    )}
                  </div>

                  {/* Tags */}
                  {ticket.tags && ticket.tags.length > 0 && (
                    <>
                      <Separator />
                      <div data-testid="section-tags">
                        <h3 className="text-sm font-semibold mb-3">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                          {ticket.tags.map((tag, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className="gap-1"
                              data-testid={`badge-tag-${index}`}
                            >
                              <Tag className="h-3 w-3" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Mini Map - Placeholder for now */}
                  {ticket.pinId && (
                    <>
                      <Separator />
                      <div data-testid="section-mini-map">
                        <h3 className="text-sm font-semibold mb-3">Location</h3>
                        <Card className="overflow-hidden">
                          <CardContent className="p-0">
                            <div className="aspect-video bg-muted flex items-center justify-center">
                              <div className="text-center">
                                <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">
                                  Drawing preview
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  )}

                  {/* Recent Activity - Placeholder */}
                  <Separator />
                  <div data-testid="section-recent-activity">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">Recent Activity</h3>
                      {ticket.channel && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto py-1 px-2 text-xs"
                          data-testid="button-view-all-activity"
                        >
                          View All
                        </Button>
                      )}
                    </div>
                    {ticket.channel ? (
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-muted-foreground text-center">
                            Activity tracked in #{ticket.channel.name}
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <p className="text-sm text-muted-foreground" data-testid="text-no-activity">
                        No activity yet
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-confirmation">
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
    </>
  );
}
