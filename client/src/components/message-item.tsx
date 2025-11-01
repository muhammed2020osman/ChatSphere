import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageSquare, FileIcon, Download, Smile, ThumbsUp, Heart, Laugh, PartyPopper, CheckCircle, MoreVertical, Edit, Trash, Star } from "lucide-react";
import type { MessageWithUser, ReactionWithUser } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
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
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || "");
  const { toast } = useToast();

  const { data: currentUser } = useQuery<{ id: string }>({
    queryKey: ["/api/auth/user"],
  });

  // Use reactions from message if available, otherwise fetch them
  const reactionsFromMessage = (message as any)?.reactions;
  const { data: reactions = [] } = useQuery<ReactionWithUser[]>({
    queryKey: ["/api/messages", message.id, "reactions"],
    enabled: !!message.id && !reactionsFromMessage,
  });
  
  const allReactions = reactionsFromMessage || reactions;

  // Use isStarred from message if available, otherwise fetch it
  const isStarredFromMessage = (message as any)?.isStarred;
  const { data: starredStatus, isLoading: isStarredLoading } = useQuery<{ isStarred: boolean }>({
    queryKey: ["/api/messages", message.id, "starred"],
    enabled: !!message.id && isStarredFromMessage === undefined,
    retry: 3,
    staleTime: 0,
  });
  
  const isStarred = isStarredFromMessage !== undefined ? isStarredFromMessage : starredStatus?.isStarred || false;

  const toggleStarMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/messages/${message.id}/star`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", message.id, "starred"] });
      queryClient.invalidateQueries({ queryKey: ["/api/starred"] });
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${message.channelId}/messages`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle star",
        variant: "destructive",
      });
    },
  });

  const addReactionMutation = useMutation({
    mutationFn: async (icon: string) => {
      return await apiRequest("/api/reactions", {
        method: "POST",
        body: {
          messageId: message.id,
          icon,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", message.id, "reactions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${message.channelId}/messages`] });
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
      return await apiRequest(`/api/reactions/${message.id}/${icon}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", message.id, "reactions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${message.channelId}/messages`] });
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
    
    // Check if current user already reacted with this icon
    const userReaction = allReactions.find(r => {
      const reactionUserId = typeof r.userId === 'number' ? r.userId.toString() : r.userId;
      const currentUserId = typeof currentUser.id === 'number' ? currentUser.id.toString() : currentUser.id;
      return r.icon === iconName && reactionUserId === currentUserId;
    });
    
    if (userReaction) {
      removeReactionMutation.mutate(iconName);
    } else {
      addReactionMutation.mutate(iconName);
    }
    setShowReactions(false);
  };

  const editMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest(`/api/messages/${message.id}`, {
        method: "PATCH",
        body: { content },
      });
    },
    onSuccess: () => {
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Message updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${channelId}/messages`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update message",
        variant: "destructive",
      });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/messages/${message.id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Message deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${channelId}/messages`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete message",
        variant: "destructive",
      });
    },
  });

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(message.content || "");
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(message.content || "");
  };

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      editMessageMutation.mutate(editContent);
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this message?")) {
      deleteMessageMutation.mutate();
    }
  };

  const isOwnMessage = currentUser?.id === message.userId;
  const getUserInitials = () => {
    if (message.user?.name) {
      return `${message.user.name[0]}`.toUpperCase();
    }
    return message.user?.email?.[0]?.toUpperCase() || "?";
  };

  const getUserName = () => {
    if (message.user?.name ) {
      return `${message.user.name}`;
    }
    return message.user?.email || "Unknown";
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
          <AvatarImage src={message.user?.profileImageUrl || undefined} />
          <AvatarFallback>{getUserInitials()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-semibold text-[15px]" data-testid={`text-message-author-${message.id}`}>
              {getUserName()}
            </span>
            <span className="text-xs text-muted-foreground" data-testid={`text-message-time-${message.id}`}>
              {formatTime(message.createdAt!)}
              {message.editedAt && " (edited)"}
            </span>
            {isOwnMessage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`button-message-menu-${message.id}`}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleEdit} data-testid={`menu-item-edit-${message.id}`}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit message
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleDelete} 
                    className="text-destructive"
                    data-testid={`menu-item-delete-${message.id}`}
                  >
                    <Trash className="w-4 h-4 mr-2" />
                    Delete message
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-20"
                data-testid={`textarea-edit-message-${message.id}`}
              />
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleSaveEdit}
                  disabled={!editContent.trim() || editMessageMutation.isPending}
                  data-testid={`button-save-edit-${message.id}`}
                >
                  Save
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleCancelEdit}
                  data-testid={`button-cancel-edit-${message.id}`}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {message.content && (
                <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words" data-testid={`text-message-content-${message.id}`}>
                  {message.content}
                </div>
              )}
              {renderAttachment()}
            </>
          )}
          
          {/* Reactions */}
          {allReactions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1" data-testid={`reactions-${message.id}`}>
              {Object.entries(
                allReactions.reduce((acc, r) => {
                  if (!acc[r.icon]) acc[r.icon] = [];
                  acc[r.icon].push(r);
                  return acc;
                }, {} as Record<string, ReactionWithUser[]>)
              ).map(([iconName, reacts]) => {
                const IconComponent = REACTION_ICONS.find(ri => ri.name === iconName)?.icon || Smile;
                // Check if current user reacted - compare userId (may be number or string)
                const hasUserReacted = reacts.some(r => {
                  const reactionUserId = typeof r.userId === 'number' ? r.userId.toString() : r.userId;
                  const currentUserId = typeof currentUser?.id === 'number' ? currentUser.id.toString() : currentUser?.id;
                  return reactionUserId === currentUserId;
                });
                return (
                  <Button
                    key={iconName}
                    variant={hasUserReacted ? "default" : "outline"}
                    size="sm"
                    className={`h-7 px-2 gap-1 hover-elevate ${hasUserReacted ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700' : 'border-border dark:border-gray-600'}`}
                    onClick={() => handleReactionClick(iconName)}
                    data-testid={`reaction-${iconName}-${message.id}`}
                  >
                    <IconComponent className={`w-3 h-3 ${hasUserReacted ? '1fill-yellow-600 dark:1fill-yellow-400 1text-yellow-600 dark:1text-yellow-400' : 'text-foreground dark:text-gray-300'}`} />
                    <span className={`text-xs ${hasUserReacted ? 'text-yellow-700 dark:text-yellow-300 font-medium' : 'text-foreground dark:text-gray-300'}`}>{reacts.length}</span>
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
            
            <Button
              variant="ghost"
              size="sm"
              className="hover-elevate p-2"
              onClick={() => toggleStarMutation.mutate()}
              disabled={(isStarredFromMessage === undefined && isStarredLoading) || toggleStarMutation.isPending}
              data-testid={`button-star-${message.id}`}
            >
              <Star className={`w-4 h-4 ${isStarred ? 'fill-yellow-500 dark:fill-yellow-400 text-yellow-500 dark:text-yellow-400' : 'text-foreground dark:text-gray-300 hover:text-yellow-500 dark:hover:text-yellow-400'}`} />
            </Button>
            
            {channelId && (
              <Popover open={showReactions} onOpenChange={setShowReactions}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover-elevate"
                    data-testid={`button-add-reaction-${message.id}`}
                  >
                    <Smile className="w-4 h-4 text-foreground dark:text-gray-300 hover:text-yellow-500 dark:hover:text-yellow-400" />
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
                        <Icon className="w-5 h-5 text-foreground dark:text-gray-300 hover:text-yellow-500 dark:hover:text-yellow-400" />
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
