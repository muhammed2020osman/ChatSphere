import React, { useEffect, useRef, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import type { Channel, MessageWithUser, User } from "@shared/schema";
import { MessageItem } from "./message-item";
import { MessageComposer, type MessageComposerRef } from "./message-composer";
import { Hash, Lock, Users, X, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function ChannelView() {
  const { id } = useParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const messageComposerRef = useRef<MessageComposerRef>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get messageId from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const targetMessageId = urlParams.get("messageId");

  const { data: channel, isLoading: channelLoading } = useQuery<Channel>({
    queryKey: ["/api/channels", id],
    enabled: !!id,
  });

  const { data: currentUser, isLoading: currentUserLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const isCompanyManager = currentUser?.role === 'company_manager';
  
  // Debug: Log user role
  console.log('ChannelView - Current user:', currentUser);
  console.log('ChannelView - User role:', currentUser?.role);
  console.log('ChannelView - Is company manager:', isCompanyManager);

  const isChannelRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/channel/');
  const { data: messages, isLoading: messagesLoading } = useQuery<MessageWithUser[]>({
    queryKey: [`/api/channels/${id}/messages`],
    enabled: !!id && isChannelRoute,
    refetchInterval: isChannelRoute ? 3000 : false,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (channelId: string) => {
      const response = await fetch(`/api/channels/${channelId}/mark-read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to mark notifications as read');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate notifications query to refresh the unread count
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mentions/count"] });
    },
  });

  useEffect(() => {
    if (id) {
      markAsReadMutation.mutate(id);
    }
  }, [id]);


  // Scroll to bottom on new messages (only if no target message)
  useEffect(() => {
    if (scrollRef.current && messages && !targetMessageId) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, targetMessageId]);

  // Scroll to target message when it's loaded
  useEffect(() => {
    if (targetMessageId && messages && messages.length > 0) {
      // Check if message exists in the messages array
      const messageExists = messages.some(m => String(m.id) === targetMessageId);
      if (messageExists) {
        // Wait for refs to be set
        const timeoutId = setTimeout(() => {
          const messageElement = messageRefs.current.get(targetMessageId);
          if (messageElement && scrollRef.current) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Remove messageId from URL after scrolling
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('messageId');
            window.history.replaceState({}, '', newUrl.toString());
          }
        }, 300);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [targetMessageId, messages]);

  const activeThread = activeThreadId ? messages?.find(m => String(m.id) === activeThreadId) : null;
  const threadReplies = messages?.filter(m => m.threadParentId && String(m.threadParentId) === activeThreadId) || [];

  if (channelLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-border px-6 py-3">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Channel not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main channel view */}
      <div className="flex flex-col flex-1">
        <div className="border-b border-border px-6 py-3">
          <div className="flex items-center gap-2">
            {channel.isPrivate ? (
              <Lock className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Hash className="w-5 h-5 text-muted-foreground" />
            )}
            <h2 className="text-lg font-semibold" data-testid="text-channel-name">
              {channel.name}
            </h2>
            <div className="flex items-center gap-2 ml-auto">
              {!currentUserLoading && currentUser && currentUser.role === 'company_manager' && (
                <Link href={`/channel/${id}/settings`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8"
                    title="Channel Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
          {channel.description && (
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-channel-description">
              {channel.description}
            </p>
          )}
        </div>

        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="py-4">
            {messagesLoading ? (
              <div className="space-y-4 px-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : messages && messages.length > 0 ? (
              messages
                .filter((msg) => !msg.threadParentId)
                .map((message) => {
                  const replies = messages.filter(m => m.threadParentId === message.id);
                  const isTargetMessage = targetMessageId === String(message.id);
                  return (
                    <div
                      key={message.id}
                      ref={(el) => {
                        if (el) {
                          messageRefs.current.set(String(message.id), el);
                        } else {
                          messageRefs.current.delete(String(message.id));
                        }
                      }}
                      className={isTargetMessage ? "ring-2 ring-yellow-400 rounded-lg p-1 -m-1" : ""}
                    >
                      <MessageItem 
                        message={{ ...message, threadReplies: replies } as any} 
                        onReply={(id) => setActiveThreadId(String(id))}
                        channelId={id}
                      />
                    </div>
                  );
                })
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <Hash className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  This is the beginning of #{channel.name}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  This channel is for everything about {channel.name}. Send your first message to get the conversation started!
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <MessageComposer ref={messageComposerRef} channelId={id} placeholder={`Message #${channel.name}`} />
      </div>

      {/* Thread panel */}
      {activeThreadId && activeThread && (
        <div className="w-96 border-l border-border flex flex-col">
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold" data-testid="text-thread-title">Thread</h3>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={() => setActiveThreadId(null)}
              data-testid="button-close-thread"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="py-4">
              <MessageItem message={activeThread} channelId={id} />
              <div className="px-4 py-2">
                <div className="border-l-2 border-border pl-4">
                  <p className="text-sm font-semibold mb-2" data-testid="text-thread-replies-count">
                    {threadReplies.length} {threadReplies.length === 1 ? 'reply' : 'replies'}
                  </p>
                  {threadReplies.map((reply) => (
                    <MessageItem key={reply.id} message={reply} channelId={id} />
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          <MessageComposer 
            channelId={id} 
            threadParentId={activeThreadId}
            placeholder="Reply to thread..." 
          />
        </div>
      )}
    </div>
  );
}
