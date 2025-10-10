import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Hash, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Channel, MessageWithUser } from "@shared/schema";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SearchOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchOverlay({ open, onOpenChange }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();

  const { data: channels } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
    enabled: open,
  });

  const { data: messages } = useQuery<MessageWithUser[]>({
    queryKey: ["/api/search", query],
    enabled: open && query.length > 2,
  });

  const filteredChannels = channels?.filter((channel) =>
    channel.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleChannelClick = (channelId: string) => {
    setLocation(`/channel/${channelId}`);
    onOpenChange(false);
    setQuery("");
  };

  const getUserInitials = (user: any) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || "?";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0" data-testid="dialog-search">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search channels and messages..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto p-4 space-y-4">
          {filteredChannels && filteredChannels.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Channels</h3>
              <div className="space-y-1">
                {filteredChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => handleChannelClick(channel.id)}
                    className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate text-left"
                    data-testid={`search-result-channel-${channel.id}`}
                  >
                    <Hash className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{channel.name}</p>
                      {channel.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {channel.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages && messages.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Messages</h3>
              <div className="space-y-2">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="flex items-start gap-3 p-2 rounded-md hover-elevate"
                    data-testid={`search-result-message-${message.id}`}
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={message.user.profileImageUrl || undefined} />
                      <AvatarFallback className="text-xs">{getUserInitials(message.user)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {message.user.firstName} {message.user.lastName}
                        </span>
                        <MessageSquare className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {query.length > 0 && !filteredChannels?.length && !messages?.length && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No results found for "{query}"</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
