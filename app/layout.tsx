import './globals.css';
import { QueryClientProviderWrapper } from '@/components/query-client-provider-wrapper';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import '@/lib/db/init'; // Initialize database on startup

export const metadata = {
  title: 'Workspace',
  description: 'Where work happens',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryClientProviderWrapper>
          <ThemeProvider defaultTheme="dark" enableSystem>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </QueryClientProviderWrapper>
      </body>
    </html>
  );
}