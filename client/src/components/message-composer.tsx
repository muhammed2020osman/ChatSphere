import React, { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bold, Italic, Send, Paperclip, X, AtSign } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
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
  const [mentionedUsers, setMentionedUsers] = useState<User[]>([]);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const mentionsPopoverRef = useRef<HTMLDivElement>(null);
  const mentionButtonRef = useRef<HTMLButtonElement>(null);
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

      // Extract mentionedUserIds from mentionedUsers array
      console.log('========================================');
      console.log('[MessageComposer] ===== PREPARING TO SEND MESSAGE =====');
      console.log('[MessageComposer] mentionedUsers array:', mentionedUsers);
      console.log('[MessageComposer] mentionedUsers length:', mentionedUsers.length);
      console.log('[MessageComposer] mentionedUsers type:', typeof mentionedUsers);
      console.log('[MessageComposer] mentionedUsers isArray:', Array.isArray(mentionedUsers));
      
      const mentionedUserIds = mentionedUsers.map(u => {
        console.log('[MessageComposer] Processing user for mention:', u);
        console.log('[MessageComposer] User id:', u.id, 'type:', typeof u.id);
        // Ensure id is a number
        const id = typeof u.id === 'string' ? parseInt(u.id, 10) : u.id;
        const result = isNaN(id) ? null : id;
        console.log('[MessageComposer] Converted id:', result);
        return result;
      }).filter((id): id is number => id !== null);
      
      console.log('[MessageComposer] Extracted mentionedUserIds:', mentionedUserIds);
      console.log('[MessageComposer] mentionedUserIds length:', mentionedUserIds.length);
      console.log('[MessageComposer] mentionedUserIds type:', typeof mentionedUserIds);
      console.log('[MessageComposer] mentionedUserIds isArray:', Array.isArray(mentionedUserIds));
      console.log('[MessageComposer] ===== END PREPARATION =====');
      console.log('========================================');
      
      console.log('[MessageComposer] Sending message with mentions:', {
        mentionedUsers,
        mentionedUsersLength: mentionedUsers.length,
        mentionedUserIds,
        mentionedUserIdsLength: mentionedUserIds.length,
        payload
      });
      
      if (channelId) {
        payload.channelId = channelId;
        payload.threadParentId = threadParentId;
        payload.mentionedUserIds = mentionedUserIds;
        console.log('[MessageComposer] Final payload with mentionedUserIds:', JSON.stringify(payload, null, 2));
        console.log('[MessageComposer] Payload mentionedUserIds:', payload.mentionedUserIds);
        console.log('[MessageComposer] Payload mentionedUserIds type:', typeof payload.mentionedUserIds);
        console.log('[MessageComposer] Payload mentionedUserIds isArray:', Array.isArray(payload.mentionedUserIds));
        console.log('[MessageComposer] Payload mentionedUserIds length:', payload.mentionedUserIds?.length);
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
        queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/${recipientId}`] });
      }
      setContent("");
      setAttachmentUrl(null);
      setAttachmentName(null);
      setAttachmentType(null);
      setMentionedUsers([]);
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
    console.log('[MessageComposer] Mention button clicked, current showMentions:', showMentions);
    console.log('[MessageComposer] Users available:', users.length);
    const newValue = !showMentions;
    setShowMentions(newValue);
    console.log('[MessageComposer] Setting showMentions to:', newValue);
    setMentionSearch("");
    // Focus textarea after a short delay
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const insertMention = (user: User) => {
    console.log('[MessageComposer] insertMention called with user:', user);
    
    // Check if user is already mentioned
    if (mentionedUsers.some(u => u.id === user.id)) {
      console.log('[MessageComposer] User already mentioned, closing popover');
      setShowMentions(false);
      setMentionSearch("");
      return;
    }
    
    // Add user to mentionedUsers array
    console.log('[MessageComposer] Adding user to mentionedUsers');
    setMentionedUsers(prev => {
      const newMentions = [...prev, user];
      console.log('[MessageComposer] New mentionedUsers:', newMentions);
      return newMentions;
    });
    setShowMentions(false);
    setMentionSearch("");
    
    // Focus back on textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  };
  
  const removeMention = (userId: number) => {
    setMentionedUsers(prev => prev.filter(u => u.id !== userId));
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

  // Calculate popover position when it opens
  React.useEffect(() => {
    if (!showMentions) {
      setPopoverPosition(null);
      return;
    }

    if (!textareaRef.current) return;

    const calculatePosition = () => {
      if (!textareaRef.current) return;
      
      const rect = textareaRef.current.getBoundingClientRect();
      setPopoverPosition({
        top: rect.top - 10, // Position above textarea with some margin
        left: rect.left
      });
    };

    // Calculate position immediately and after a short delay to ensure DOM is updated
    calculatePosition();
    const timeoutId = setTimeout(calculatePosition, 0);

    return () => clearTimeout(timeoutId);
  }, [showMentions]);

  // Close mentions popover when clicking outside
  React.useEffect(() => {
    if (!showMentions) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is inside popover or mention button
      const isInsidePopover = mentionsPopoverRef.current?.contains(target as Node);
      const isInsideMentionButton = mentionButtonRef.current?.contains(target as Node) || target?.closest('[data-testid="button-mention"]');
      const isInsideMentionUser = target?.closest('[data-testid^="mention-user-"]');
      
      // Don't close if clicking inside popover or mention button
      if (isInsidePopover || isInsideMentionButton || isInsideMentionUser) {
        return;
      }
      
      // Check if click is outside both popover and button
      if (
        showMentions &&
        mentionsPopoverRef.current &&
        !mentionsPopoverRef.current.contains(target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(target as Node) &&
        !target?.closest('[data-testid="button-mention"]')
      ) {
        setShowMentions(false);
        setMentionSearch("");
      }
    };

    // Delay adding the listener to avoid capturing the click that opened the popover
    const timeoutId = setTimeout(() => {
      // Use click event with capture: false to avoid conflicts
      document.addEventListener("click", handleClickOutside, false);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside, false);
    };
  }, [showMentions]);

  return (
    <div className="p-4 border-t relative">
      <div className="border rounded-lg bg-background relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[80px] border-0 resize-none text-base focus-visible:ring-0 focus-visible:ring-offset-0"
          data-testid="textarea-message-composer"
        />

        {showMentions && popoverPosition && (
          <div 
            ref={mentionsPopoverRef}
            className="fixed bg-popover border rounded-lg shadow-lg max-h-60 overflow-hidden w-64 z-[99999]" 
            data-testid="mentions-popover"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              position: 'fixed',
              top: `${popoverPosition.top}px`,
              left: `${popoverPosition.left}px`,
              transform: 'translateY(-100%)'
            }}
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
                      type="button"
                      className="w-full flex items-center gap-2 p-2 hover:bg-accent rounded-md text-left"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        insertMention(user);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
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

        {mentionedUsers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t bg-muted/30">
            <span className="text-xs text-muted-foreground">Mentioned:</span>
            {mentionedUsers.map((user) => (
              <Badge
                key={user.id}
                variant="secondary"
                className="flex items-center gap-1 pr-1"
              >
                <Avatar className="w-4 h-4">
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {getUserInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs">{getUserName(user)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-destructive/20"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeMention(user.id);
                  }}
                  data-testid={`button-remove-mention-${user.id}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ))}
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
              ref={mentionButtonRef}
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleMentionClick}
              data-testid="button-mention"
              className={`w-8 h-8 flex items-center justify-center hover:bg-accent hover:text-foreground transition-colors ${showMentions ? "bg-accent text-foreground" : "text-muted-foreground"}`}
              title="Mention members"
            >
              <AtSign className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              data-testid="button-attach-file"
              className="w-8 h-8"
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
});
