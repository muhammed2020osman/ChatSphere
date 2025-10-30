import { ReactNode } from "react";

export default function AuthLayout({
  title,
  subtitle,
  children,
  illustration,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  illustration?: ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-6xl bg-card rounded-xl shadow border overflow-hidden grid grid-cols-1 md:grid-cols-2">
        <div className="p-8 md:p-12">
          <div className="mb-8">
            <div className="h-2 w-6 rounded bg-primary mb-4" />
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="max-w-sm">{children}</div>
        </div>
        <div className="hidden md:block relative">
          <div className="absolute inset-0 p-6">
            <div className="w-full h-full rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-purple-500 flex items-center justify-center">
              {illustration ?? (
                <div className="text-white text-center px-6">
                  <div className="mx-auto w-40 h-40 rounded-2xl bg-white/15 backdrop-blur-sm mb-6" />
                  <p className="text-lg font-semibold">Secure Access</p>
                  <p className="text-sm opacity-80">Welcome back to your workspace</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


