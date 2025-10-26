// Vercel Express App Entry Point
// This file exports the Express app for Vercel deployment

import express from 'express';
import { registerRoutes } from './server/routes.js';
import { initializeDatabase } from './server/db.js';

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

// Initialize database and routes
(async () => {
  try {
    await initializeDatabase();
    await registerRoutes(app);
  } catch (error) {
    console.error('Failed to initialize:', error);
  }
})();

// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  
  res.status(status).json({ message });
});

// Export the Express app for Vercel
export default app;
