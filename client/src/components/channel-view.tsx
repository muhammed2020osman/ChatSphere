import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import type { Channel, MessageWithUser } from "@shared/schema";
import { MessageItem } from "./message-item";
import { MessageComposer } from "./message-composer";
import { Hash, Lock, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ChannelView() {
  const { id } = useParams();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: channel, isLoading: channelLoading } = useQuery<Channel>({
    queryKey: ["/api/channels", id],
    enabled: !!id,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<MessageWithUser[]>({
    queryKey: ["/api/channels", id, "messages"],
    enabled: !!id,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
    <div className="flex flex-col h-full">
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
          <Users className="w-4 h-4 text-muted-foreground ml-auto" />
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
              .map((message) => (
                <MessageItem key={message.id} message={message} />
              ))
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

      <MessageComposer channelId={id} placeholder={`Message #${channel.name}`} />
    </div>
  );
}
