import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AccessCodeGate } from "@/components/access-code-gate";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import { AuthProvider } from "@/contexts/AuthContext";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import IngestPlansPage from "@/pages/ingest-plans";
import PlansManagement from "@/pages/plans-management";
import SheetViewer from "@/pages/sheet-viewer";
import TicketsHub from "@/pages/tickets-hub";
import { PWAInstallButton } from "@/components/pwa-install-button";

// Component to handle service worker messages (navigation from notifications and badge updates)
function ServiceWorkerMessageHandler() {
  const [, navigate] = useLocation();
  
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = async (event: MessageEvent) => {
        if (event.data && event.data.type === 'navigate') {
          navigate(event.data.url);
        } else if (event.data && event.data.type === 'UPDATE_BADGE') {
          // Update badge from service worker message
          const { setAppBadge } = await import('@/lib/pwa');
          await setAppBadge(event.data.count);
        }
      };
      
      navigator.serviceWorker.addEventListener('message', handleMessage);
      
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, [navigate]);
  
  return null;
}

function Router() {
  // Keep auth state available for components, but don't gate route definitions
  const { isAuthenticated, isLoading } = useAuth();

  function Protected({ component: Comp }: { component: React.ComponentType<any> }) {
    const [, navigate] = useLocation();
    useEffect(() => {
      if (!isLoading && !isAuthenticated) navigate("/login");
    }, [isLoading, isAuthenticated, navigate]);
    if (isLoading) return null;
    if (!isAuthenticated) return null;
    return <Comp />;
  }

  function GuestOnly({ component: Comp }: { component: React.ComponentType<any> }) {
    const [, navigate] = useLocation();
    useEffect(() => {
      if (!isLoading && isAuthenticated) navigate("/");
    }, [isLoading, isAuthenticated, navigate]);
    if (isLoading) return null;
    if (isAuthenticated) return null;
    return <Comp />;
  }

  return (
    <Switch>
      {/* Public routes (only need access code) */}
      <Route path="/sheets/:id" component={SheetViewer} />
      <Route path="/sheet-viewer/:id" component={SheetViewer} />
      <Route path="/plans" component={PlansManagement} />
      <Route path="/ingest-plans" component={IngestPlansPage} />
      <Route path="/tickets" component={TicketsHub} />
      
      {/* Login route */}
      <Route path="/login" component={() => <GuestOnly component={LoginPage} />} />
      <Route path="/register" component={() => <GuestOnly component={RegisterPage} />} />

      {/* Protected app routes */}
      <Route path="/" component={() => <Protected component={Home} />} />
      <Route path="/mentions" component={() => <Protected component={Home} />} />
      <Route path="/threads" component={() => <Protected component={Home} />} />
      <Route path="/starred" component={() => <Protected component={Home} />} />
      <Route path="/drawings" component={() => <Protected component={Home} />} />
      <Route path="/channel/:id/settings" component={() => <Protected component={Home} />} />
      <Route path="/channel/:id" component={() => <Protected component={Home} />} />
      <Route path="/dm/:userId" component={() => <Protected component={Home} />} />
      <Route path="/settings" component={() => <Protected component={Home} />} />
      <Route path="/members" component={Home} />

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider defaultTheme="dark">
            <TooltipProvider>
              <AccessCodeGate>
                <ServiceWorkerMessageHandler />
                <Router />
                <Toaster />
                <PWAInstallButton />
              </AccessCodeGate>
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
