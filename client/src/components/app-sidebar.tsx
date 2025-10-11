import { Hash, Lock, Plus, ChevronDown, MessageSquare, Settings, AtSign, Star, MessagesSquare, FileText } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import type { Channel, User } from "@shared/schema";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppSidebarProps {
  onCreateChannel: () => void;
}

export function AppSidebar({ onCreateChannel }: AppSidebarProps) {
  const { user } = useAuth();
  const [location] = useLocation();

  const { data: channels, isLoading: channelsLoading } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
  });

  const { data: dmUsers, isLoading: dmUsersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const getUserInitials = (u: User | undefined) => {
    if (!u) return "?";
    if (u.firstName && u.lastName) {
      return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
    }
    return u.email?.[0]?.toUpperCase() || "?";
  };

  const getUserName = (u: User | undefined) => {
    if (!u) return "Unknown";
    if (u.firstName && u.lastName) {
      return `${u.firstName} ${u.lastName}`;
    }
    return u.email || "Unknown";
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between px-2 font-semibold text-lg hover-elevate"
              data-testid="button-workspace-menu"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                <span>Workspace</span>
              </div>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {user?.role === 'admin' && (
              <DropdownMenuItem asChild>
                <Link href="/settings" data-testid="link-settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Workspace Settings
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <a href="/api/logout" data-testid="link-logout">
                Sign out
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {/* Main Features Section */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === '/mentions'}
                  data-testid="link-mentions"
                  tooltip="Mentions & reactions"
                >
                  <Link href="/mentions">
                    <AtSign className="w-4 h-4" />
                    <span>Mentions & reactions</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === '/threads'}
                  data-testid="link-threads"
                  tooltip="Threads"
                >
                  <Link href="/threads">
                    <MessagesSquare className="w-4 h-4" />
                    <span>Threads</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === '/starred'}
                  data-testid="link-starred"
                  tooltip="Starred"
                >
                  <Link href="/starred">
                    <Star className="w-4 h-4" />
                    <span>Starred</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === '/drawings'}
                  data-testid="link-drawings"
                  tooltip="Engineering Drawings"
                >
                  <Link href="/drawings">
                    <FileText className="w-4 h-4" />
                    <span>Engineering Drawings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Channels Section */}
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Channels
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {channelsLoading ? (
                <>
                  <Skeleton className="h-8 mx-2 mb-1" />
                  <Skeleton className="h-8 mx-2 mb-1" />
                </>
              ) : channels && channels.length > 0 ? (
                channels.map((channel) => (
                  <SidebarMenuItem key={channel.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === `/channel/${channel.id}`}
                      data-testid={`link-channel-${channel.id}`}
                      tooltip={channel.name}
                    >
                      <Link href={`/channel/${channel.id}`}>
                        {channel.isPrivate ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          <Hash className="w-4 h-4" />
                        )}
                        <span className="truncate">{channel.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <p className="px-4 py-2 text-sm text-muted-foreground">
                  No channels yet
                </p>
              )}
              <SidebarMenuItem>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start px-2 text-muted-foreground hover-elevate"
                  onClick={onCreateChannel}
                  data-testid="button-add-channel"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add channel</span>
                </Button>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Direct Messages
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dmUsersLoading ? (
                <>
                  <Skeleton className="h-8 mx-2 mb-1" />
                  <Skeleton className="h-8 mx-2 mb-1" />
                </>
              ) : dmUsers && dmUsers.length > 0 ? (
                dmUsers
                  .filter((u) => u.id !== user?.id)
                  .map((dmUser) => (
                    <SidebarMenuItem key={dmUser.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === `/dm/${dmUser.id}`}
                        data-testid={`link-dm-${dmUser.id}`}
                        tooltip={getUserName(dmUser)}
                      >
                        <Link href={`/dm/${dmUser.id}`}>
                          <div className="relative">
                            <Avatar className="w-5 h-5">
                              <AvatarImage src={dmUser.profileImageUrl || undefined} />
                              <AvatarFallback className="text-xs">
                                {getUserInitials(dmUser)}
                              </AvatarFallback>
                            </Avatar>
                            {dmUser.isOnline && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-status-online rounded-full border-2 border-sidebar" />
                            )}
                          </div>
                          <span className="truncate">{getUserName(dmUser)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
              ) : (
                <p className="px-4 py-2 text-sm text-muted-foreground">
                  No users yet
                </p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="text-sm">
                {getUserInitials(user)}
              </AvatarFallback>
            </Avatar>
            {user?.isOnline && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-status-online rounded-full border-2 border-sidebar" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" data-testid="text-user-name">
              {getUserName(user)}
            </p>
            {user?.status && (
              <p className="text-xs text-muted-foreground truncate">
                {user.status}
              </p>
            )}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
