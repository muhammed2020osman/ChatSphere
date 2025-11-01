import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { NotificationWithUsers } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";

export function NotificationBell() {
  const { toast } = useToast();
  const { socket } = useWebSocket();

  // Fetch notifications
  const { data: notifications = [] } = useQuery<NotificationWithUsers[]>({
    queryKey: ["/api/notifications"],
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Fetch unread count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const unreadCount = unreadData?.count || 0;

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return await apiRequest(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/notifications/mark-all-read", {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Listen for new notifications via WebSocket
  useEffect(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    const handleNewNotification = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_notification') {
          // Show toast for new notification
          toast({
            title: "New Mention",
            description: `${data.notification.fromUser.name || data.notification.fromUser.email} mentioned you in #${data.notification.channel?.name || 'a channel'}`,
          });

          // Refresh notifications
          queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
          queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
        }
      } catch (error) {
        console.error('Failed to parse notification:', error);
      }
    };

    socket.addEventListener('message', handleNewNotification);

    return () => {
      socket.removeEventListener('message', handleNewNotification);
    };
  }, [socket, toast]);

  const handleNotificationClick = (notification: NotificationWithUsers) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              data-testid="badge-unread-count"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => markAllAsReadMutation.mutate()}
              data-testid="button-mark-all-read"
            >
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover-elevate cursor-pointer transition-colors ${
                    !notification.isRead ? 'bg-accent/50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">
                          {notification.fromUser.name || notification.fromUser.email}
                        </span>
                        {' '}mentioned you in{' '}
                        <span className="font-semibold">
                          #{notification.channel?.name || 'a channel'}
                        </span>
                      </p>
                      {notification.content && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {notification.content}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt!), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-1" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
