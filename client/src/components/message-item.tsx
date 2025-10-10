import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageSquare, FileIcon, Download } from "lucide-react";
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

  const isImage = (type?: string | null) => {
    return type?.startsWith("image/");
  };

  const renderAttachment = () => {
    if (!message.attachmentUrl) return null;

    if (isImage(message.attachmentType)) {
      return (
        <div className="mt-2">
          <a 
            href={message.attachmentUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block max-w-md"
            data-testid={`link-image-attachment-${message.id}`}
          >
            <img 
              src={message.attachmentUrl} 
              alt={message.attachmentName || "Attachment"} 
              className="rounded-md border border-border max-h-96 object-contain hover-elevate"
              data-testid={`img-attachment-${message.id}`}
            />
          </a>
        </div>
      );
    }

    return (
      <div className="mt-2">
        <a
          href={message.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 p-3 bg-accent rounded-md hover-elevate"
          data-testid={`link-file-attachment-${message.id}`}
        >
          <FileIcon className="w-5 h-5" />
          <span className="text-sm font-medium">{message.attachmentName || "Download file"}</span>
          <Download className="w-4 h-4 ml-2" />
        </a>
      </div>
    );
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
          {message.content && (
            <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words" data-testid={`text-message-content-${message.id}`}>
              {message.content}
            </div>
          )}
          {renderAttachment()}
          {onReply && (
            <div className="mt-1 flex items-center gap-2">
              {message.threadReplies && message.threadReplies.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-chart-1 hover:text-chart-1 hover-elevate"
                  onClick={() => onReply(message.id)}
                  data-testid={`button-view-thread-${message.id}`}
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  {message.threadReplies.length} {message.threadReplies.length === 1 ? "reply" : "replies"}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover-elevate"
                  onClick={() => onReply(message.id)}
                  data-testid={`button-reply-thread-${message.id}`}
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Reply in thread
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
