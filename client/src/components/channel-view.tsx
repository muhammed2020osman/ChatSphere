import React, { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import type { Channel, MessageWithUser, User } from "@shared/schema";
import { MessageItem } from "./message-item";
import { MessageComposer, type MessageComposerRef } from "./message-composer";
import { Hash, Lock, Users, X, Settings, AtSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { getUserInitials, getUserName } from "@/lib/utils";

export function ChannelView() {
  const { id } = useParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const membersPopoverRef = useRef<HTMLDivElement>(null);
  const membersButtonRef = useRef<HTMLButtonElement>(null);
  const messageComposerRef = useRef<MessageComposerRef>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showMembersPopover, setShowMembersPopover] = useState(false);
  const [membersSearch, setMembersSearch] = useState("");
  const { user } = useAuth();

  // Get messageId from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const targetMessageId = urlParams.get("messageId");

  const { data: channel, isLoading: channelLoading } = useQuery<Channel>({
    queryKey: ["/api/channels", id],
    enabled: !!id,
  });

  const { data: currentUser, isLoading: currentUserLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const isCompanyManager = currentUser?.role === 'company_manager';
  
  // Debug: Log user role
  console.log('ChannelView - Current user:', currentUser);
  console.log('ChannelView - User role:', currentUser?.role);
  console.log('ChannelView - Is company manager:', isCompanyManager);

  const isChannelRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/channel/');
  const { data: messages, isLoading: messagesLoading } = useQuery<MessageWithUser[]>({
    queryKey: [`/api/channels/${id}/messages`],
    enabled: !!id && isChannelRoute,
    refetchInterval: isChannelRoute ? 3000 : false,
  });

  // Fetch channel members for mentions
  const { data: channelMembersData } = useQuery<Array<{ user: User }>>({
    queryKey: [`/api/channels/${id}/members`],
    enabled: !!id,
  });

  // Extract users from channel members
  const members: User[] = useMemo(() => {
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
  }, [channelMembersData]);

  // Filter members based on search
  const filteredMembers = useMemo(() => {
    if (!members || members.length === 0) {
      return [];
    }
    return members
      .filter(user => {
        if (!user || !user.id) return false;
        if (!membersSearch.trim()) return true;
        const search = membersSearch.toLowerCase();
        const name = (user.name || user.email || "").toLowerCase();
        const email = (user.email || "").toLowerCase();
        return name.includes(search) || email.includes(search);
      })
      .slice(0, 8);
  }, [members, membersSearch]);

  // Scroll to bottom on new messages (only if no target message)
  useEffect(() => {
    if (scrollRef.current && messages && !targetMessageId) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, targetMessageId]);

  // Scroll to target message when it's loaded
  useEffect(() => {
    if (targetMessageId && messages && messages.length > 0) {
      // Check if message exists in the messages array
      const messageExists = messages.some(m => String(m.id) === targetMessageId);
      if (messageExists) {
        // Wait for refs to be set
        const timeoutId = setTimeout(() => {
          const messageElement = messageRefs.current.get(targetMessageId);
          if (messageElement && scrollRef.current) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Remove messageId from URL after scrolling
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('messageId');
            window.history.replaceState({}, '', newUrl.toString());
          }
        }, 300);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [targetMessageId, messages]);

  const activeThread = activeThreadId ? messages?.find(m => String(m.id) === activeThreadId) : null;
  const threadReplies = messages?.filter(m => m.threadParentId && String(m.threadParentId) === activeThreadId) || [];

  // Handle mention click from header
  const handleMembersClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('ChannelView - handleMembersClick called, current state:', showMembersPopover);
    console.log('ChannelView - members data:', channelMembersData);
    console.log('ChannelView - members count:', members.length);
    setShowMembersPopover((prev) => !prev);
    setMembersSearch("");
  };

  // Handle member selection
  const handleMemberSelect = (user: User) => {
    messageComposerRef.current?.insertMention(user);
    setShowMembersPopover(false);
    setMembersSearch("");
  };

  // Close members popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      if (
        showMembersPopover &&
        membersPopoverRef.current &&
        !membersPopoverRef.current.contains(target) &&
        membersButtonRef.current &&
        !membersButtonRef.current.contains(target)
      ) {
        setShowMembersPopover(false);
        setMembersSearch("");
      }
    };

    if (showMembersPopover) {
      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showMembersPopover]);

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
    <div className="flex h-full">
      {/* Main channel view */}
      <div className="flex flex-col flex-1">
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
            <div className="flex items-center gap-2 ml-auto">
              {!currentUserLoading && currentUser && currentUser.role === 'company_manager' && (
                <Link href={`/channel/${id}/settings`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8"
                    title="Channel Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </Link>
              )}
            </div>
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
                .map((message) => {
                  const replies = messages.filter(m => m.threadParentId === message.id);
                  const isTargetMessage = targetMessageId === String(message.id);
                  return (
                    <div
                      key={message.id}
                      ref={(el) => {
                        if (el) {
                          messageRefs.current.set(String(message.id), el);
                        } else {
                          messageRefs.current.delete(String(message.id));
                        }
                      }}
                      className={isTargetMessage ? "ring-2 ring-yellow-400 rounded-lg p-1 -m-1" : ""}
                    >
                      <MessageItem 
                        message={{ ...message, threadReplies: replies } as any} 
                        onReply={(id) => setActiveThreadId(String(id))}
                        channelId={id}
                      />
                    </div>
                  );
                })
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

        <div className="relative">
          <MessageComposer ref={messageComposerRef} channelId={id} placeholder={`Message #${channel.name}`} />
          
          {/* Mention Members Button and Popover */}
          <div className="absolute bottom-2 right-2">
            <Button
              ref={membersButtonRef}
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              title="Mention members"
              onClick={handleMembersClick}
              data-testid="button-mention-members"
            >
              <AtSign className="w-4 h-4 text-muted-foreground" />
            </Button>
            
            {/* Members Popover */}
            {showMembersPopover && (
              <div 
                ref={membersPopoverRef}
                className="absolute bottom-full right-0 mb-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-hidden z-[100] w-64" 
                data-testid="members-popover"
                style={{ position: 'absolute' }}
              >
                <div className="p-2 border-b">
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={membersSearch}
                    onChange={(e) => setMembersSearch(e.target.value)}
                    className="w-full px-2 py-1 text-sm bg-background border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="overflow-y-auto max-h-48">
                  {filteredMembers.length > 0 ? (
                    <div className="p-1">
                      {filteredMembers.map((user) => (
                        <button
                          key={user.id}
                          className="w-full flex items-center gap-2 p-2 hover:bg-accent rounded-md text-left"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleMemberSelect(user);
                          }}
                          data-testid={`mention-member-${user.id}`}
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
                      {channelMembersData === undefined ? "Loading..." : members.length === 0 ? "No members in channel" : "No members found"}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Thread panel */}
      {activeThreadId && activeThread && (
        <div className="w-96 border-l border-border flex flex-col">
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold" data-testid="text-thread-title">Thread</h3>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={() => setActiveThreadId(null)}
              data-testid="button-close-thread"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="py-4">
              <MessageItem message={activeThread} channelId={id} />
              <div className="px-4 py-2">
                <div className="border-l-2 border-border pl-4">
                  <p className="text-sm font-semibold mb-2" data-testid="text-thread-replies-count">
                    {threadReplies.length} {threadReplies.length === 1 ? 'reply' : 'replies'}
                  </p>
                  {threadReplies.map((reply) => (
                    <MessageItem key={reply.id} message={reply} channelId={id} />
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          <MessageComposer 
            channelId={id} 
            threadParentId={activeThreadId}
            placeholder="Reply to thread..." 
          />
        </div>
      )}
    </div>
  );
}
