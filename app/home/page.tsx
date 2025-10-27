"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ChannelView } from "@/components/channel-view";
import { DirectMessageView } from "@/components/direct-message-view";
import { CreateChannelModal } from "@/components/create-channel-modal";
import { SearchOverlay } from "@/components/search-overlay";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/NotificationBell";
import Settings from "@/app/settings/page";
import Members from "@/app/members/page";
import Mentions from "@/app/mentions/page";
import Threads from "@/app/threads/page";
import Starred from "@/app/starred/page";
import Drawings from "@/app/drawings/page";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const { isConnected } = useWebSocket(); // WebSocket for real-time updates
  const { toast } = useToast();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as CSSProperties;

  // Determine which view to show based on pathname
  const renderContent = () => {
    if (pathname === "/mentions") {
      return <Mentions />;
    }
    if (pathname === "/threads") {
      return <Threads />;
    }
    if (pathname === "/starred") {
      return <Starred />;
    }
    if (pathname === "/drawings") {
      return <Drawings />;
    }
    if (pathname === "/settings") {
      return <Settings />;
    }
    if (pathname === "/members") {
      return <Members />;
    }
    if (pathname.startsWith("/channel/")) {
      const channelId = pathname.split("/channel/")[1];
      return <ChannelView channelId={channelId} />;
    }
    if (pathname.startsWith("/dm/")) {
      const userId = pathname.split("/dm/")[1];
      return <DirectMessageView userId={userId} />;
    }
    
    // Default welcome view
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Welcome to Workspace</h2>
          <p className="text-muted-foreground">
            Select a channel or start a direct message to begin
          </p>
        </div>
      </div>
    );
  };

  return (
    <SidebarProvider style={style}>
      <div className="flex h-screen w-full">
        <AppSidebar onCreateChannel={() => setCreateChannelOpen(true)} />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(true)}
                data-testid="button-search"
              >
                <Search className="w-5 h-5" />
              </Button>
              <NotificationBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-hidden">
            {renderContent()}
          </main>
        </div>
      </div>
      <CreateChannelModal open={createChannelOpen} onOpenChange={setCreateChannelOpen} />
      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </SidebarProvider>
  );
}