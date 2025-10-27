import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

interface UseMessagePollingOptions {
  channelId: string;
  enabled?: boolean;
  interval?: number;
  lastMessageId?: string;
  lastTimestamp?: string;
}

interface PollingResult {
  messages: any[];
  hasNewMessages: boolean;
  timestamp: string;
}

export function useMessagePolling({
  channelId,
  enabled = true,
  interval = 3000, // 3 seconds
  lastMessageId,
  lastTimestamp,
}: UseMessagePollingOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimestampRef = useRef<string | undefined>(lastTimestamp);

  const pollMessages = useCallback(async (): Promise<PollingResult> => {
    const params = new URLSearchParams({
      channelId,
      ...(lastTimestampRef.current && { lastTimestamp: lastTimestampRef.current }),
    });

    const response = await fetch(`/api/messages/poll?${params}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to poll messages');
    }

    const data = await response.json();
    
    // Update the last timestamp if we got new messages
    if (data.hasNewMessages && data.messages.length > 0) {
      lastTimestampRef.current = data.timestamp;
    }

    return data;
  }, [channelId]);

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['messages-poll', channelId, lastTimestampRef.current],
    queryFn: pollMessages,
    enabled: enabled && !!channelId,
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
    messages: data?.messages || [],
    hasNewMessages: data?.hasNewMessages || false,
    isLoading,
    error,
    refetch,
    lastTimestamp: lastTimestampRef.current,
  };
}

