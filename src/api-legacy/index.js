// Vercel API Handler
// This file handles API requests for Vercel deployment

import express from 'express';

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Register all API routes
(async () => {
  try {
    const { registerRoutes } = await import('../server/routes.ts');
    await registerRoutes(app);
  } catch (error) {
    console.error('Failed to register routes:', error);
  }
})();

// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  
  console.error('API error:', err);
  res.status(status).json({ message });
});

// Export the Express app for Vercel
export default app;
