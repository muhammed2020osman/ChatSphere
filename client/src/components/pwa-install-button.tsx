import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { canInstallPWA, promptInstallPWA, isPWAInstalled } from "@/lib/pwa";
import {
  Toast,
  ToastAction,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

import { onInstallPromptAvailable } from "@/lib/pwa";

export function PWAInstallButton() {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if PWA is already installed
    if (isPWAInstalled()) {
      setShowInstallPrompt(false);
      return;
    }

    // Check if user previously dismissed
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed === "true") {
      setShowInstallPrompt(false);
      return;
    }

    // Subscribe to install prompt availability
    const unsubscribe = onInstallPromptAvailable(() => {
      if (!isPWAInstalled() && canInstallPWA()) {
        setShowInstallPrompt(true);
      }
    });

    // Initial check
    if (canInstallPWA()) {
      setShowInstallPrompt(true);
    }

    return unsubscribe;
  }, []);

  const handleInstall = async () => {
    try {
      const accepted = await promptInstallPWA();
      if (accepted) {
        setShowInstallPrompt(false);
        toast({
          title: "App installed successfully!",
          description: "You can now use ChatSphere as a standalone app.",
        });
      } else {
        toast({
          title: "Install cancelled",
          description: "You can install the app later from your browser menu.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error installing PWA:", error);
      toast({
        title: "Installation failed",
        description: "There was an error installing the app. Please try again later.",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Store dismissal in localStorage to avoid showing it again for this session
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  // Don't show if already installed or dismissed
  if (!showInstallPrompt || isPWAInstalled()) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 flex items-center gap-4 max-w-md">
        <div className="flex-1">
          <h3 className="font-semibold text-sm">Install ChatSphere</h3>
          <p className="text-xs text-muted-foreground">
            Install our app for a better experience with offline support.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleInstall}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Install
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="p-1 h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

