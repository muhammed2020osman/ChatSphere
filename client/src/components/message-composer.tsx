import React, { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bold, Italic, Send, Paperclip, X, AtSign } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@shared/schema";
import { getUserInitials, getUserName } from "@/lib/utils";

interface MessageComposerProps {
  channelId?: string;
  recipientId?: string;
  placeholder?: string;
  threadParentId?: string;
}

export interface MessageComposerRef {
  insertMention: (user: User) => void;
}

export const MessageComposer = forwardRef<MessageComposerRef, MessageComposerProps>(({ 
  channelId, 
  recipientId, 
  placeholder = "Type a message...",
  threadParentId 
}, ref) => {
  const [content, setContent] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [attachmentType, setAttachmentType] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const mentionsPopoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch channel members if channelId exists, otherwise fetch all users (for DM)
  const { data: channelMembersData } = useQuery<Array<{ user: User }>>({
    queryKey: channelId ? [`/api/channels/${channelId}/members`] : ["/api/channels", channelId, "members"],
    enabled: !!channelId,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !channelId, // Only fetch all users for DM
  });

  // Extract users from channel members or use all users for DM
  const users: User[] = React.useMemo(() => {
    if (channelId) {
      if (!channelMembersData || channelMembersData.length === 0) {
        return [];
      }
      return channelMembersData
        .filter((member): member is { user: User } => 
          member !== null && 
          member !== undefined && 
          typeof member === 'object' && 
          'user' in member && 
          member.user !== null && 
          member.user !== undefined &&
          typeof member.user === 'object' &&
          'id' in member.user
        )
        .map(member => member.user)
        .filter((user): user is User => user !== undefined && user !== null);
    }
    return allUsers || [];
  }, [channelId, channelMembersData, allUsers]);

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
        queryClient.invalidateQueries({ queryKey: [`/api/channels/${channelId}/messages`] });
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

      // Upload file using FormData (multer expects 'file' field name)
      const formData = new FormData();
      formData.append('file', file);

      // Get authentication credentials
      const token = localStorage.getItem('auth_token');
      const companyId = localStorage.getItem('company_id');

      // Upload file with authentication
      const uploadFileResponse = await fetch(uploadResponse.uploadURL, {
        method: "PUT",
        body: formData,
        credentials: "include",
        headers: {
          // Don't set Content-Type - browser will set it with boundary for FormData
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(companyId ? { 'x-company-id': companyId } : {}),
        },
      });

      if (!uploadFileResponse.ok) {
        const errorText = await uploadFileResponse.text();
        throw new Error(`Upload failed: ${uploadFileResponse.status} ${errorText}`);
      }

      const uploadResult = await uploadFileResponse.json();

      // Set ACL policy
      const aclResponse = await apiRequest<{ objectPath: string }>("/api/attachments", {
        method: "PUT",
        body: {
          attachmentURL: uploadResult.fileUrl,
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
  };

  const handleMentionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMentions((prev) => !prev);
    setMentionSearch("");
    // Focus textarea after a short delay
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const insertMention = (user: User) => {
    const userName = getUserName(user);
    
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const before = content.slice(0, cursorPos);
    const after = content.slice(cursorPos);
    
    // Insert @username with a space after
    const mentionText = `@${userName} `;
    const newContent = `${before}${mentionText}${after}`;
    
    setContent(newContent);
    setShowMentions(false);
    setMentionSearch("");
    
    // Focus back on textarea and set cursor position after mention
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = cursorPos + mentionText.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Expose insertMention via ref
  useImperativeHandle(ref, () => ({
    insertMention,
  }));

  const filteredUsers = React.useMemo(() => {
    if (!users || users.length === 0) {
      return [];
    }
    return users
      .filter(user => {
        if (!user || !user.id) return false;
        if (!mentionSearch.trim()) return true;
        const search = mentionSearch.toLowerCase();
        const name = (user.name || user.email || "").toLowerCase();
        const email = (user.email || "").toLowerCase();
        return name.includes(search) || email.includes(search);
      })
      .slice(0, 8);
  }, [users, mentionSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSubmit(e);
    }
    
    if (e.key === "Escape" && showMentions) {
      setShowMentions(false);
      setMentionSearch("");
    }
    
    // Handle arrow keys for mention selection
    if (showMentions && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      // TODO: Implement keyboard navigation for mentions
    }
  };

  // Close mentions popover when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside both popover and button
      if (
        showMentions &&
        mentionsPopoverRef.current &&
        !mentionsPopoverRef.current.contains(target) &&
        textareaRef.current &&
        !textareaRef.current.contains(target) &&
        !(event.target as HTMLElement)?.closest('[data-testid="button-mention"]')
      ) {
        setShowMentions(false);
        setMentionSearch("");
      }
    };

    if (showMentions) {
      // Use a small delay to allow the click event to complete
      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showMentions]);

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

        {showMentions && (
          <div 
            ref={mentionsPopoverRef}
            className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-hidden z-50" 
            data-testid="mentions-popover"
          >
            <div className="p-2 border-b">
              <input
                type="text"
                placeholder="Search users..."
                value={mentionSearch}
                onChange={(e) => setMentionSearch(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-background border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="overflow-y-auto max-h-48">
              {filteredUsers.length > 0 ? (
                <div className="p-1">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      className="w-full flex items-center gap-2 p-2 hover:bg-accent rounded-md text-left"
                      onClick={() => insertMention(user)}
                      data-testid={`mention-user-${user.id}`}
                    >
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={user.profileImageUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {getUserInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {getUserName(user)}
                        </div>
                        {user.email && user.name && (
                          <div className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No users found
                </div>
              )}
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
              onClick={handleMentionClick}
              onMouseDown={(e) => e.stopPropagation()}
              data-testid="button-mention"
              className={showMentions ? "bg-accent" : ""}
            >
              <AtSign className="w-4 h-4" />
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
});
