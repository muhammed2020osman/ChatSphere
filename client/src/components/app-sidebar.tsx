import { Hash, Lock, Plus, ChevronDown, MessageSquare, Settings, AtSign, Star, MessagesSquare, FileText, Upload, Layers, CheckSquare } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import type { Channel, User } from "@shared/schema";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthContext } from "@/contexts/AuthContext";
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
  const { logout } = useAuthContext();
  const [location] = useLocation();

  const { data: channels, isLoading: channelsLoading } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
  });

  const { data: dmUsers, isLoading: dmUsersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch company data
  const { data: companyData } = useQuery<{ id: number; name: string; domain: string | null; planType: string }>({
    queryKey: [`/api/companies/${user?.companyId}`],
    enabled: !!user?.companyId,
  });

  // Fetch counts for sidebar badges
  const { data: mentionsCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/mentions/count"],
    enabled: !!user,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const { data: threadsCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/threads/count"],
    enabled: !!user,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const { data: starredCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/starred/count"],
    enabled: !!user,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const mentionsCount = mentionsCountData?.count || 0;
  const threadsCount = threadsCountData?.count || 0;
  const starredCount = starredCountData?.count || 0;

  const getUserInitials = (u: User | undefined) => {
    if (!u) return "?";
    if (u.name ) {
      return `${u.name[0]}`.toUpperCase();
    }
    return u.email?.[0]?.toUpperCase() || "?";
  };

  const getUserName = (u: User | undefined) => {
    if (!u) return "Unknown";
    if (u.name) {
      return `${u.name}`;
    }
    return u.email || "Unknown";
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (_e) {
      // ignore
    } finally {
      window.location.href = '/login';
    }
  };

  const displayUser = (user ?? undefined) as User | undefined;
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
            {companyData && (
              <div className="px-2 py-1.5 text-sm border-b border-border">
                <p className="font-semibold">{companyData.name}</p>
                <p className="text-xs text-muted-foreground">code: {companyData.id}</p>
              </div>
            )}
            {user?.role === 'admin' && (
              <DropdownMenuItem asChild>
                <Link href="/settings" data-testid="link-settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Workspace Settings
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <button onClick={handleLogout} data-testid="link-logout" className="w-full text-left">
                Sign out
              </button>
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
                  <Link href="/mentions" className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <AtSign className="w-4 h-4" />
                      <span>Mentions & reactions</span>
                    </div>
                    {mentionsCount > 0 && (
                      <Badge 
                        variant="secondary" 
                        className="h-5 min-w-5 flex items-center justify-center px-1.5 text-xs font-semibold ml-auto"
                      >
                        {mentionsCount > 99 ? '99+' : mentionsCount}
                      </Badge>
                    )}
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
                  <Link href="/threads" className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <MessagesSquare className="w-4 h-4" />
                      <span>Threads</span>
                    </div>
                    {threadsCount > 0 && (
                      <Badge 
                        variant="secondary" 
                        className="h-5 min-w-5 flex items-center justify-center px-1.5 text-xs font-semibold ml-auto"
                      >
                        {threadsCount > 99 ? '99+' : threadsCount}
                      </Badge>
                    )}
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
                  <Link href="/starred" className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4" />
                      <span>Starred</span>
                    </div>
                    {starredCount > 0 && (
                      <Badge 
                        variant="secondary" 
                        className="h-5 min-w-5 flex items-center justify-center px-1.5 text-xs font-semibold ml-auto"
                      >
                        {starredCount > 99 ? '99+' : starredCount}
                      </Badge>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === '/plans'}
                  data-testid="link-plans"
                  tooltip="Construction Plans"
                >
                  <Link href="/plans">
                    <Layers className="w-4 h-4" />
                    <span>Plans</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === '/tickets'}
                  data-testid="link-tickets"
                  tooltip="Tickets Hub"
                >
                  <Link href="/tickets">
                    <CheckSquare className="w-4 h-4" />
                    <span>Tickets</span>
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
              <AvatarImage src={displayUser?.profileImageUrl || undefined} />
              <AvatarFallback className="text-sm">
                {getUserInitials(displayUser)}
              </AvatarFallback>
            </Avatar>
            {displayUser?.isOnline && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-status-online rounded-full border-2 border-sidebar" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" data-testid="text-user-name">
              {getUserName(displayUser)}
            </p>
            {displayUser?.status && (
              <p className="text-xs text-muted-foreground truncate">
                {displayUser.status}
              </p>
            )}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
