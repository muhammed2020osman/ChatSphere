import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  X,
  MapPin,
  FileText,
  Calendar,
  Clock,
  User,
  AlertCircle,
  GitBranch,
  ShieldAlert,
  Eye as EyeIcon,
  CheckCircle2,
  Package,
  ClipboardCheck,
  Hammer,
  FileWarning,
  Circle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { Pin, TicketWithDetails } from "@shared/schema";

interface PinTimelineDrawerProps {
  pinId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTicketClick: (ticketId: string) => void;
}

interface PinWithDetails extends Pin {
  drawing?: {
    id: string;
    sheetNo: string;
    title: string;
  };
  creator?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
}

interface TimelineEvent {
  id: string;
  type: "pin_created" | "ticket_created" | "ticket_updated" | "ticket_resolved" | "status_change" | "comment_added";
  title: string;
  description?: string;
  timestamp: string;
  user?: {
    firstName: string | null;
    lastName: string | null;
  };
  ticketId?: string;
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

export function PinTimelineDrawer({
  pinId,
  isOpen,
  onClose,
  onTicketClick,
}: PinTimelineDrawerProps) {
  // Fetch pin details - we'll construct this from tickets data for now
  const { data: ticketsData, isLoading: ticketsLoading } = useQuery<{
    tickets: TicketWithDetails[];
  }>({
    queryKey: ["/api/tickets", { pinId: pinId ? [pinId] : undefined }],
    enabled: isOpen && !!pinId,
  });

  // Fetch pin timeline
  const { data: timeline = [], isLoading: timelineLoading } = useQuery<TimelineEvent[]>({
    queryKey: ["/api/pins", pinId, "timeline"],
    enabled: isOpen && !!pinId,
  });

  const tickets = ticketsData?.tickets || [];
  const isLoading = ticketsLoading || timelineLoading;

  // Derive pin details from first ticket if available
  const pinDetails: PinWithDetails | null = tickets.length > 0 && tickets[0].pin ? {
    ...tickets[0].pin,
    drawing: tickets[0].drawing,
    creator: tickets[0].creator,
  } : null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-[400px] p-0 flex flex-col"
        data-testid="sheet-pin-timeline"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-semibold mb-1" data-testid="text-pin-label">
                {isLoading ? (
                  <Skeleton className="h-6 w-48" />
                ) : pinDetails?.label ? (
                  pinDetails.label
                ) : (
                  "Pin Timeline"
                )}
              </SheetTitle>
              {!isLoading && pinDetails?.drawing && (
                <p className="text-sm text-muted-foreground" data-testid="text-drawing-info">
                  {pinDetails.drawing.sheetNo} - {pinDetails.drawing.title}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-6 w-6 rounded-sm"
              data-testid="button-close-timeline"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-6">
            {isLoading ? (
              <div className="space-y-6" data-testid="loading-skeleton">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : !pinDetails ? (
              <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-state">
                <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  No pin selected
                </p>
              </div>
            ) : (
              <>
                {/* Pin Location Info */}
                <div data-testid="section-pin-info">
                  <h3 className="text-sm font-semibold mb-3">Pin Location</h3>
                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Position:</span>
                          <span data-testid="text-pin-position">
                            X: {pinDetails.x}%, Y: {pinDetails.y}%
                          </span>
                        </div>
                        {pinDetails.description && (
                          <p className="text-sm text-muted-foreground" data-testid="text-pin-description">
                            {pinDetails.description}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                {/* Linked Tickets */}
                <div data-testid="section-linked-tickets">
                  <h3 className="text-sm font-semibold mb-3">
                    Linked Tickets ({tickets.length})
                  </h3>
                  {tickets.length === 0 ? (
                    <p className="text-sm text-muted-foreground" data-testid="text-no-tickets">
                      No tickets linked to this pin
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {tickets.map((ticket) => {
                        const TypeIcon = TICKET_TYPE_ICONS[ticket.type] || FileText;
                        return (
                          <Card
                            key={ticket.id}
                            className="hover-elevate cursor-pointer transition-colors"
                            onClick={() => {
                              onTicketClick(ticket.id);
                            }}
                            data-testid={`card-ticket-${ticket.id}`}
                          >
                            <CardHeader className="p-4">
                              <div className="flex items-start gap-3">
                                <TypeIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium mb-1" data-testid={`text-ticket-title-${ticket.id}`}>
                                    {ticket.title}
                                  </h4>
                                  <p className="text-xs text-muted-foreground mb-2" data-testid={`text-ticket-id-${ticket.id}`}>
                                    #{ticket.id.slice(0, 8)}
                                  </p>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge
                                      className={`${STATUS_COLORS[ticket.status] || STATUS_COLORS.Open} text-xs`}
                                      data-testid={`badge-status-${ticket.id}`}
                                    >
                                      {ticket.status}
                                    </Badge>
                                    <Badge
                                      className={`${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.Medium} text-xs`}
                                      data-testid={`badge-priority-${ticket.id}`}
                                    >
                                      {ticket.priority}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs" data-testid={`badge-type-${ticket.id}`}>
                                      {ticket.type}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </CardHeader>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Timeline */}
                <div data-testid="section-timeline">
                  <h3 className="text-sm font-semibold mb-3">Timeline</h3>
                  {timeline.length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground" data-testid="text-no-timeline">
                          No timeline events yet
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {timeline.map((event, index) => (
                        <div key={event.id} className="flex gap-3" data-testid={`timeline-event-${index}`}>
                          {/* Timeline line */}
                          <div className="flex flex-col items-center">
                            <div className="rounded-full bg-primary p-1">
                              <Circle className="h-2 w-2 fill-primary-foreground text-primary-foreground" />
                            </div>
                            {index < timeline.length - 1 && (
                              <div className="w-px bg-border flex-1 mt-1" />
                            )}
                          </div>

                          {/* Event content */}
                          <div className="flex-1 pb-4">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="text-sm font-medium" data-testid={`text-event-title-${index}`}>
                                {event.title}
                              </h4>
                              <span className="text-xs text-muted-foreground whitespace-nowrap" data-testid={`text-event-time-${index}`}>
                                {format(new Date(event.timestamp), "MMM d, h:mm a")}
                              </span>
                            </div>
                            {event.description && (
                              <p className="text-sm text-muted-foreground" data-testid={`text-event-description-${index}`}>
                                {event.description}
                              </p>
                            )}
                            {event.user && (
                              <div className="flex items-center gap-2 mt-2">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground" data-testid={`text-event-user-${index}`}>
                                  {event.user.firstName} {event.user.lastName}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mini Map - Placeholder */}
                <Separator />
                <div data-testid="section-mini-map">
                  <h3 className="text-sm font-semibold mb-3">Location on Drawing</h3>
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
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
