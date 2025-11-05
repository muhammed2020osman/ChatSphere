import { useState } from "react";
import { useLocation } from "wouter";
import { WifiOff, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflinePage() {
  const [, setLocation] = useLocation();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = () => {
    setIsRetrying(true);
    // Check if we're back online
    if (navigator.onLine) {
      window.location.reload();
    } else {
      // Try again after a short delay
      setTimeout(() => {
        setIsRetrying(false);
        if (navigator.onLine) {
          window.location.reload();
        }
      }, 2000);
    }
  };

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <WifiOff className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">You're Offline</CardTitle>
          <CardDescription>
            It looks like you've lost your internet connection. Please check your network settings and try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Check your internet connection</p>
            <p>• Try refreshing the page</p>
            <p>• Some features may be available offline</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex-1"
              variant="default"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </>
              )}
            </Button>
            <Button
              onClick={handleGoHome}
              variant="outline"
              className="flex-1"
            >
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </div>
          {navigator.onLine && (
            <div className="text-center text-sm text-green-600 dark:text-green-400">
              Connection restored! Refreshing...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

