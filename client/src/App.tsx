import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AccessCodeGate } from "@/components/access-code-gate";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import IngestPlansPage from "@/pages/ingest-plans";
import PlansManagement from "@/pages/plans-management";
import SheetViewer from "@/pages/sheet-viewer";
import TicketsHub from "@/pages/tickets-hub";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Public routes (only need access code) */}
      <Route path="/sheets/:id" component={SheetViewer} />
      <Route path="/sheet-viewer/:id" component={SheetViewer} />
      <Route path="/plans" component={PlansManagement} />
      <Route path="/ingest-plans" component={IngestPlansPage} />
      <Route path="/tickets" component={TicketsHub} />
      
      {/* Authenticated routes (need OIDC login) */}
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/mentions" component={Home} />
          <Route path="/threads" component={Home} />
          <Route path="/starred" component={Home} />
          <Route path="/drawings" component={Home} />
          <Route path="/channel/:id" component={Home} />
          <Route path="/dm/:userId" component={Home} />
          <Route path="/settings" component={Home} />
          <Route path="/members" component={Home} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <AccessCodeGate>
              <Router />
              <Toaster />
            </AccessCodeGate>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
