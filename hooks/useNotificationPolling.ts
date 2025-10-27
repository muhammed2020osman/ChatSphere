import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

interface UseNotificationPollingOptions {
  enabled?: boolean;
  interval?: number;
  lastNotificationId?: string;
  lastTimestamp?: string;
}

interface NotificationPollingResult {
  notifications: any[];
  hasNewNotifications: boolean;
  timestamp: string;
}

export function useNotificationPolling({
  enabled = true,
  interval = 5000, // 5 seconds
  lastNotificationId,
  lastTimestamp,
}: UseNotificationPollingOptions = {}) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimestampRef = useRef<string | undefined>(lastTimestamp);

  const pollNotifications = useCallback(async (): Promise<NotificationPollingResult> => {
    const params = new URLSearchParams({
      ...(lastTimestampRef.current && { lastTimestamp: lastTimestampRef.current }),
    });

    const response = await fetch(`/api/notifications/poll?${params}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to poll notifications');
    }

    const data = await response.json();
    
    // Update the last timestamp if we got new notifications
    if (data.hasNewNotifications && data.notifications.length > 0) {
      lastTimestampRef.current = data.timestamp;
    }

    return data;
  }, []);

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['notifications-poll', lastTimestampRef.current],
    queryFn: pollNotifications,
    enabled: enabled,
    refetchInterval: interval,
    refetchIntervalInBackground: true,
    staleTime: 0,
    cacheTime: 0,
  });

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    notifications: data?.notifications || [],
    hasNewNotifications: data?.hasNewNotifications || false,
    isLoading,
    error,
    refetch,
    lastTimestamp: lastTimestampRef.current,
  };
}

