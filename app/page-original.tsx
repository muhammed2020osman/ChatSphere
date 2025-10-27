import { Button } from "@/components/ui/button";
import { MessageSquare, Users, Search, Lock } from "lucide-react";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

// Force dynamic rendering to prevent build-time authentication issues
export const dynamic = 'force-dynamic';

export default async function Landing() {
  try {
    // Check if user is authenticated
    const user = await getAuthenticatedUser();
    
    // If user is authenticated, redirect to home
    if (user) {
      redirect('/home');
    }
  } catch (error) {
    // If authentication fails, continue to show landing page
    console.log('Authentication check failed, showing landing page:', error);
  }
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold">Workspace</span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-5xl font-bold tracking-tight">
            Where work happens
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Connect with your team in real-time. Organize conversations in channels, 
            send direct messages, and keep everyone on the same page.
          </p>
          <div className="pt-4">
            <Button size="lg" asChild data-testid="button-get-started">
              <a href="/api/login" className="text-lg px-8">
                Get Started
              </a>
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 pt-12">
            <div className="p-6 rounded-md bg-card border border-card-border space-y-2">
              <MessageSquare className="w-10 h-10 text-primary mx-auto" />
              <h3 className="font-semibold">Channels</h3>
              <p className="text-sm text-muted-foreground">
                Organize conversations by topic, project, or team
              </p>
            </div>
            <div className="p-6 rounded-md bg-card border border-card-border space-y-2">
              <Users className="w-10 h-10 text-primary mx-auto" />
              <h3 className="font-semibold">Direct Messages</h3>
              <p className="text-sm text-muted-foreground">
                Have private conversations with anyone in your workspace
              </p>
            </div>
            <div className="p-6 rounded-md bg-card border border-card-border space-y-2">
              <Search className="w-10 h-10 text-primary mx-auto" />
              <h3 className="font-semibold">Search</h3>
              <p className="text-sm text-muted-foreground">
                Find messages, files, and people across your workspace
              </p>
            </div>
            <div className="p-6 rounded-md bg-card border border-card-border space-y-2">
              <Lock className="w-10 h-10 text-primary mx-auto" />
              <h3 className="font-semibold">Private Channels</h3>
              <p className="text-sm text-muted-foreground">
                Create invite-only channels for sensitive discussions
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          Built with modern web technologies
        </div>
      </footer>
    </div>
  );
}
