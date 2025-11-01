import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // CRITICAL: vite.middlewares contains its own catch-all route that returns HTML
  // We MUST wrap it to prevent API routes from being processed
  const originalMiddleware = vite.middlewares;
  
  // Create a wrapped version that checks the path BEFORE passing to Vite
  const wrappedViteMiddleware: express.RequestHandler = (req, res, next) => {
    // CRITICAL: Check path BEFORE passing to vite.middlewares
    // vite.middlewares has its own catch-all that will return HTML for any unmatched route
    if (req.path && req.path.startsWith('/api/')) {
      console.log(`[Vite Wrapper] BLOCKING Vite for API route: ${req.method} ${req.path}`);
      // Don't call vite.middlewares at all for API routes
      return next();
    }
    
    console.log(`[Vite Wrapper] Allowing Vite for: ${req.method} ${req.path}`);
    // For non-API routes, call the original vite.middlewares
    return originalMiddleware(req, res, next);
  };
  
  app.use(wrappedViteMiddleware);
  
  app.use("*", async (req, res, next) => {
    // Double check - API routes should never reach here
    if (req.path.startsWith('/api/')) {
      console.error(`[ERROR] API route reached Vite catch-all: ${req.method} ${req.path}`);
      // Return 404 JSON for API routes that somehow reached here
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
