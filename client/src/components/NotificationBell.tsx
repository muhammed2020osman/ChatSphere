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
import { useToast } from "@/hooks/use-toast";

interface NotificationBellProps {
  showCountInHeader?: boolean;
}

export function NotificationBell({ showCountInHeader = false }: NotificationBellProps = {}) {
  const { toast } = useToast();

  // Fetch notifications - refetch every 5 seconds to get new notifications from database
  const { data: notifications = [] } = useQuery<NotificationWithUsers[]>({
    queryKey: ["/api/notifications"],
    retry: 1,
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  // Fetch unread count - refetch every 5 seconds
  const { data: unreadData, isLoading: unreadCountLoading } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    retry: 1,
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  // Calculate unread count from notifications list (more reliable)
  // Check both isRead === false and isRead === null/undefined
  const unreadCountFromNotifications = notifications.filter(n => 
    n.isRead === false || n.isRead === null || n.isRead === undefined
  ).length;
  
  // Use API count if available and valid, otherwise use count from notifications list
  const unreadCount = (unreadData?.count !== undefined && unreadData.count >= 0) 
    ? unreadData.count 
    : unreadCountFromNotifications;
  
  // Debug logging
  useEffect(() => {
    if (notifications.length > 0) {
      console.log('[NotificationBell] Unread count debug:', {
        unreadData,
        unreadCountFromNotifications,
        finalUnreadCount: unreadCount,
        notificationsLength: notifications.length,
        unreadNotifications: notifications.filter(n => !n.isRead || n.isRead === null || n.isRead === undefined).map(n => ({ 
          id: n.id, 
          isRead: n.isRead,
          type: typeof n.isRead 
        })),
      });
    }
  }, [unreadData, notifications, unreadCount, unreadCountFromNotifications]);

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

  // Helper function to get notification message based on type
  const getNotificationMessage = (notification: NotificationWithUsers) => {
    const fromUserName = notification.fromUser?.name || notification.fromUser?.email || 'Someone';
    const channelName = notification.channel?.name || 'a channel';
    
    switch (notification.type) {
      case 'channel_added':
        return {
          title: 'Added to Channel',
          description: `${fromUserName} added you to #${channelName}`,
          displayText: `${fromUserName} added you to #${channelName}`,
        };
      case 'mention':
        return {
          title: 'Mentioned',
          description: `${fromUserName} mentioned you in #${channelName}`,
          displayText: `${fromUserName} mentioned you in #${channelName}`,
        };
      case 'channel_message':
        return {
          title: 'New Message',
          description: `${fromUserName} sent a message in #${channelName}`,
          displayText: `${fromUserName} sent a message in #${channelName}`,
        };
      default:
        return {
          title: 'Notification',
          description: 'You have a new notification',
          displayText: 'You have a new notification',
        };
    }
  };

  // Refresh notifications when component mounts or when window gains focus
  useEffect(() => {
    // Refresh notifications immediately when component mounts
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
  }, []);

  const handleNotificationClick = (notification: NotificationWithUsers) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  // Always show badge if there are unread notifications (even if count is 0 from API)
  const hasUnreadNotifications = notifications.some(n => 
    n.isRead === false || n.isRead === null || n.isRead === undefined
  );
  
  // Use unreadCount if available, otherwise use count from notifications list
  const displayCount = unreadCount > 0 ? unreadCount : (hasUnreadNotifications ? unreadCountFromNotifications : 0);

  return (
    <div className="flex items-center gap-2">
      {showCountInHeader && displayCount > 0 && (
        <></>
        // <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10 border border-destructive/20">
        //   <span className="text-sm font-semibold text-destructive">إشعارات غير مقروءة:</span>
        //   <Badge 
        //     variant="destructive" 
        //     className="h-6 min-w-6 flex items-center justify-center px-2 text-xs font-bold"
        //     data-testid="badge-unread-count-header-text"
        //   >
        //     {displayCount > 99 ? '99+' : displayCount}
        //   </Badge>
        // </div>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
            <Bell className={`w-5 h-5 ${displayCount > 0 ? 'text-destructive' : ''}`} />
            {displayCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-0.5 -right-0.5 h-6 min-w-6 flex items-center justify-center px-1.5 text-xs font-bold shadow-lg z-10 border-2 border-background"
                data-testid="badge-unread-count"
                style={{ 
                  fontSize: '11px',
                  fontWeight: '700',
                  lineHeight: '1',
                }}
              >
                {displayCount > 99 ? '99+' : displayCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Notifications</h3>
            {displayCount > 0 && (
              <Badge 
                variant="destructive" 
                className="h-6 min-w-6 flex items-center justify-center px-2 text-xs font-bold"
                data-testid="badge-unread-count-header"
              >
                {displayCount > 99 ? '99+' : displayCount}
              </Badge>
            )}
          </div>
          {displayCount > 0 && (
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
                        {getNotificationMessage(notification).displayText}
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
    </div>
  );
}
