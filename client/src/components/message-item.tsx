import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageSquare, FileIcon, Download, Smile, ThumbsUp, Heart, Laugh, PartyPopper, CheckCircle } from "lucide-react";
import type { MessageWithUser, ReactionWithUser } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MessageItemProps {
  message: MessageWithUser;
  onReply?: (messageId: string) => void;
  channelId?: string;
}

const REACTION_ICONS = [
  { icon: ThumbsUp, name: "thumbs-up" },
  { icon: Heart, name: "heart" },
  { icon: Laugh, name: "laugh" },
  { icon: PartyPopper, name: "party" },
  { icon: CheckCircle, name: "check" },
  { icon: Smile, name: "smile" },
];

export function MessageItem({ message, onReply, channelId }: MessageItemProps) {
  const [showReactions, setShowReactions] = useState(false);
  const { toast } = useToast();

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  const { data: reactions = [] } = useQuery<ReactionWithUser[]>({
    queryKey: ["/api/messages", message.id, "reactions"],
    enabled: !!message.id,
  });

  const addReactionMutation = useMutation({
    mutationFn: async (icon: string) => {
      return await apiRequest("POST", "/api/reactions", {
        messageId: message.id,
        icon,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", message.id, "reactions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add reaction",
        variant: "destructive",
      });
    },
  });

  const removeReactionMutation = useMutation({
    mutationFn: async (icon: string) => {
      return await apiRequest("DELETE", `/api/reactions/${message.id}/${icon}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", message.id, "reactions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove reaction",
        variant: "destructive",
      });
    },
  });

  const handleReactionClick = (iconName: string) => {
    if (!currentUser?.id) return;
    
    const userReaction = reactions.find(r => r.icon === iconName && r.userId === currentUser.id);
    if (userReaction) {
      removeReactionMutation.mutate(iconName);
    } else {
      addReactionMutation.mutate(iconName);
    }
    setShowReactions(false);
  };
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
          
          {/* Reactions */}
          {reactions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1" data-testid={`reactions-${message.id}`}>
              {Object.entries(
                reactions.reduce((acc, r) => {
                  if (!acc[r.icon]) acc[r.icon] = [];
                  acc[r.icon].push(r);
                  return acc;
                }, {} as Record<string, ReactionWithUser[]>)
              ).map(([iconName, reacts]) => {
                const IconComponent = REACTION_ICONS.find(ri => ri.name === iconName)?.icon || Smile;
                const hasUserReacted = reacts.some(r => r.userId === currentUser?.id);
                return (
                  <Button
                    key={iconName}
                    variant={hasUserReacted ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2 gap-1 hover-elevate"
                    onClick={() => handleReactionClick(iconName)}
                    data-testid={`reaction-${iconName}-${message.id}`}
                  >
                    <IconComponent className="w-3 h-3" />
                    <span className="text-xs">{reacts.length}</span>
                  </Button>
                );
              })}
            </div>
          )}

          <div className="mt-1 flex items-center gap-2">
            {onReply && (
              <>
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
              </>
            )}
            
            {channelId && (
              <Popover open={showReactions} onOpenChange={setShowReactions}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover-elevate"
                    data-testid={`button-add-reaction-${message.id}`}
                  >
                    <Smile className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="flex gap-1">
                    {REACTION_ICONS.map(({ icon: Icon, name }) => (
                      <Button
                        key={name}
                        variant="ghost"
                        size="sm"
                        className="w-8 h-8 p-0 hover-elevate"
                        onClick={() => handleReactionClick(name)}
                        data-testid={`reaction-option-${name}`}
                      >
                        <Icon className="w-5 h-5" />
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
