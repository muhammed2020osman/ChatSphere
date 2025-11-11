import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { queryClient } from "@/lib/queryClient";

export function useWebSocket() {
  const { user, isAuthenticated } = useAuth();
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = 'localhost:5000'; // Force localhost:5000 for development
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log('WebSocket setup:', { protocol, host, wsUrl });
    
    console.log('WebSocket URL:', wsUrl);

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setIsConnected(true);
      // Authenticate WebSocket connection
      socket.send(JSON.stringify({ type: "auth", userId: user.id }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "new_message":
            // Invalidate channel messages query
            queryClient.invalidateQueries({
              queryKey: [`/api/channels/${data.channelId}/messages`],
            });
            break;

          case "new_dm":
            // Invalidate direct messages queries
            queryClient.invalidateQueries({
              queryKey: [`/api/direct-messages/${data.fromUserId}`],
            });
            queryClient.invalidateQueries({
              queryKey: [`/api/direct-messages/${data.toUserId}`],
            });
            break;

          case "channel_created":
            // Invalidate channels list
            queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
            break;

          case "user_status":
            // Invalidate users list to update online status
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            break;

          case "new_reaction":
            // Invalidate reactions for the message
            if (data.messageId) {
              queryClient.invalidateQueries({
                queryKey: ["/api/messages", data.messageId, "reactions"],
              });
              // Also invalidate channel messages to update UI
              if (data.channelId) {
                queryClient.invalidateQueries({
                  queryKey: [`/api/channels/${data.channelId}/messages`],
                });
              }
            }
            break;

          case "remove_reaction":
            // Invalidate reactions for the message
            if (data.messageId) {
              queryClient.invalidateQueries({
                queryKey: ["/api/messages", data.messageId, "reactions"],
              });
              // Also invalidate channel messages to update UI
              if (data.channelId) {
                queryClient.invalidateQueries({
                  queryKey: [`/api/channels/${data.channelId}/messages`],
                });
              }
            }
            break;

          case "message_updated":
            // Invalidate channel messages to show updated content
            if (data.message && data.message.channelId) {
              queryClient.invalidateQueries({
                queryKey: [`/api/channels/${data.message.channelId}/messages`],
              });
            }
            break;

          case "message_deleted":
            // Invalidate channel messages to remove deleted message
            if (data.channelId) {
              queryClient.invalidateQueries({
                queryKey: [`/api/channels/${data.channelId}/messages`],
              });
            }
            break;

          case "typing":
            // Handle typing indicators (could emit custom event)
            window.dispatchEvent(
              new CustomEvent("user-typing", {
                detail: {
                  channelId: data.channelId,
                  userId: data.userId,
                  userName: data.userName,
                },
              })
            );
            break;

          case "new_notification":
            // Invalidate notifications queries to refresh the list
            queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
            queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
            break;
        }
      } catch (error) {
        console.error("WebSocket message parsing error:", error);
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };

    ws.current = socket;

    return () => {
      socket.close();
    };
  }, [isAuthenticated, user]);

  const sendTyping = (channelId: string, userName: string) => {
    if (ws.current?.readyState === WebSocket.OPEN && user) {
      ws.current.send(
        JSON.stringify({
          type: "typing",
          channelId,
          userId: user.id,
          userName,
        })
      );
    }
  };

  return { socket: ws.current, isConnected, sendTyping };
}
