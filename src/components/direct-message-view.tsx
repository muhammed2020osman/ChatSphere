"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import type { DirectMessageWithUser, User } from "@/shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageComposer } from "./message-composer";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

export function DirectMessageView() {
  const { userId } = useParams();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: recipient, isLoading: recipientLoading } = useQuery<User>({
    queryKey: ["/api/users", userId],
    enabled: !!userId,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<DirectMessageWithUser[]>({
    queryKey: ["/api/direct-messages", userId],
    enabled: !!userId,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getUserInitials = (user: User | undefined) => {
    if (!user) return "?";
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || "?";
  };

  const getUserName = (user: User | undefined) => {
    if (!user) return "Unknown";
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email || "Unknown";
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return formatDistanceToNow(d, { addSuffix: true });
  };

  if (recipientLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-border px-6 py-3">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (!recipient) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="w-8 h-8">
              <AvatarImage src={recipient.profileImageUrl || undefined} />
              <AvatarFallback>{getUserInitials(recipient)}</AvatarFallback>
            </Avatar>
            {recipient.isOnline && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-status-online rounded-full border-2 border-background" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold" data-testid="text-dm-recipient-name">
              {getUserName(recipient)}
            </h2>
            {recipient.status && (
              <p className="text-xs text-muted-foreground">{recipient.status}</p>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="py-4">
          {messagesLoading ? (
            <div className="space-y-4 px-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : messages && messages.length > 0 ? (
            messages.map((message) => (
              <div
                key={message.id}
                className="py-2 px-4 hover-elevate rounded-md"
                data-testid={`dm-message-${message.id}`}
              >
                <div className="flex gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={message.sender.profileImageUrl || undefined} />
                    <AvatarFallback>{getUserInitials(message.sender)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-[15px]">
                        {getUserName(message.sender)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(message.createdAt!)}
                      </span>
                    </div>
                    <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <Avatar className="w-20 h-20 mb-4">
                <AvatarImage src={recipient.profileImageUrl || undefined} />
                <AvatarFallback className="text-2xl">{getUserInitials(recipient)}</AvatarFallback>
              </Avatar>
              <h3 className="text-lg font-semibold mb-2">
                This is the beginning of your conversation with {getUserName(recipient)}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Send your first message to start chatting!
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      <MessageComposer recipientId={userId} placeholder={`Message ${getUserName(recipient)}`} />
    </div>
  );
}
