import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import type { MessageWithUser } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface MessageItemProps {
  message: MessageWithUser;
  onReply?: (messageId: string) => void;
}

export function MessageItem({ message, onReply }: MessageItemProps) {
  const getUserInitials = () => {
    if (message.user.firstName && message.user.lastName) {
      return `${message.user.firstName[0]}${message.user.lastName[0]}`.toUpperCase();
    }
    return message.user.email?.[0]?.toUpperCase() || "?";
  };

  const getUserName = () => {
    if (message.user.firstName && message.user.lastName) {
      return `${message.user.firstName} ${message.user.lastName}`;
    }
    return message.user.email || "Unknown";
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return formatDistanceToNow(d, { addSuffix: true });
  };

  return (
    <div
      className="group py-2 px-4 hover-elevate rounded-md"
      data-testid={`message-${message.id}`}
    >
      <div className="flex gap-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={message.user.profileImageUrl || undefined} />
          <AvatarFallback>{getUserInitials()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-semibold text-[15px]" data-testid={`text-message-author-${message.id}`}>
              {getUserName()}
            </span>
            <span className="text-xs text-muted-foreground" data-testid={`text-message-time-${message.id}`}>
              {formatTime(message.createdAt!)}
            </span>
          </div>
          <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words" data-testid={`text-message-content-${message.id}`}>
            {message.content}
          </div>
          {message.threadReplies && message.threadReplies.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-chart-1 hover:text-chart-1 hover-elevate"
              onClick={() => onReply?.(message.id)}
              data-testid={`button-view-thread-${message.id}`}
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              {message.threadReplies.length} {message.threadReplies.length === 1 ? "reply" : "replies"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
