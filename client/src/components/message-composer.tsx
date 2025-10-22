import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bold, Italic, Send, Paperclip, X } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@shared/schema";

interface MessageComposerProps {
  channelId?: string;
  recipientId?: string;
  placeholder?: string;
  threadParentId?: string;
}

export function MessageComposer({ 
  channelId, 
  recipientId, 
  placeholder = "Type a message...",
  threadParentId 
}: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [attachmentType, setAttachmentType] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      
      if (content.trim()) {
        payload.content = content.trim();
      }
      
      if (attachmentUrl) {
        payload.attachmentUrl = attachmentUrl;
        payload.attachmentName = attachmentName;
        payload.attachmentType = attachmentType;
      }

      if (channelId) {
        payload.channelId = channelId;
        payload.threadParentId = threadParentId;
        return await apiRequest("/api/messages", {
          method: "POST",
          body: payload,
        });
      } else if (recipientId) {
        payload.toUserId = recipientId;
        return await apiRequest("/api/direct-messages", {
          method: "POST",
          body: payload,
        });
      }
    },
    onSuccess: () => {
      if (channelId) {
        queryClient.invalidateQueries({ queryKey: ["/api/channels", channelId, "messages"] });
      } else if (recipientId) {
        queryClient.invalidateQueries({ queryKey: ["/api/direct-messages", recipientId] });
      }
      setContent("");
      setAttachmentUrl(null);
      setAttachmentName(null);
      setAttachmentType(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !attachmentUrl) return;
    sendMessageMutation.mutate();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (10MB max)
    if (file.size > 10485760) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);

      // Get upload URL
      const uploadResponse = await apiRequest<{ uploadURL: string }>("/api/objects/upload", {
        method: "POST",
      });

      // Upload file
      await fetch(uploadResponse.uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      // Set ACL policy
      const aclResponse = await apiRequest<{ objectPath: string }>("/api/attachments", {
        method: "PUT",
        body: {
          attachmentURL: uploadResponse.uploadURL,
          fileName: file.name,
        },
      });

      setAttachmentUrl(aclResponse.objectPath);
      setAttachmentName(file.name);
      setAttachmentType(file.type || "application/octet-stream");

      toast({
        title: "File attached",
        description: `${file.name} is ready to send`,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeAttachment = () => {
    setAttachmentUrl(null);
    setAttachmentName(null);
    setAttachmentType(null);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Check for @ mentions
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newContent.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      
      // Only show mentions if @ is at start or preceded by space, and followed by text or nothing
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if ((charBeforeAt === ' ' || charBeforeAt === '\n') && !textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionSearch(textAfterAt);
        setMentionStartPos(lastAtIndex);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (user: User) => {
    const userName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : user.email || "Unknown";
    
    const before = content.slice(0, mentionStartPos);
    const after = content.slice(mentionStartPos + mentionSearch.length + 1);
    const newContent = `${before}@${userName} ${after}`;
    
    setContent(newContent);
    setShowMentions(false);
    
    // Focus back on textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = mentionStartPos + userName.length + 2;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const filteredUsers = users.filter(user => {
    if (!mentionSearch) return true;
    const search = mentionSearch.toLowerCase();
    const name = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}`.toLowerCase()
      : (user.email || "").toLowerCase();
    return name.includes(search);
  }).slice(0, 5);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSubmit(e);
    }
    
    if (e.key === "Escape" && showMentions) {
      setShowMentions(false);
    }
  };

  return (
    <div className="p-4 border-t">
      <div className="border rounded-lg bg-background overflow-hidden relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[80px] border-0 resize-none text-base focus-visible:ring-0 focus-visible:ring-offset-0"
          data-testid="textarea-message-composer"
        />

        {showMentions && filteredUsers.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-y-auto z-50" data-testid="mentions-popover">
            <div className="p-2">
              <div className="text-xs text-muted-foreground mb-1 px-2">Mention someone</div>
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  className="w-full flex items-center gap-2 p-2 hover-elevate rounded-md text-left"
                  onClick={() => insertMention(user)}
                  data-testid={`mention-user-${user.id}`}
                >
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={user.profileImageUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {user.firstName && user.lastName 
                        ? `${user.firstName} ${user.lastName}` 
                        : user.email}
                    </div>
                    {user.email && user.firstName && (
                      <div className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {attachmentUrl && (
          <div className="flex items-center gap-2 px-3 py-2 border-t bg-muted/30">
            <Paperclip className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm flex-1 truncate">{attachmentName}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={removeAttachment}
              data-testid="button-remove-attachment"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        
        <div className="flex items-center justify-between px-3 pb-2 pt-1 border-t bg-muted/30">
          <div className="flex items-center gap-0.5">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px' }}
              accept="*/*"
              data-testid="input-file-upload"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              data-testid="button-attach-file"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-testid="button-format-bold"
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-testid="button-format-italic"
            >
              <Italic className="w-4 h-4" />
            </Button>
          </div>
          
          <Button
            type="button"
            onClick={handleSubmit}
            size="icon"
            variant="default"
            disabled={(!content.trim() && !attachmentUrl) || sendMessageMutation.isPending || isUploading}
            className="h-8 w-8"
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
