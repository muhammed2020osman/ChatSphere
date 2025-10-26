// Vercel Express App Entry Point
// This file serves the frontend and handles client-side routing

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static files from dist/public (built frontend)
app.use(express.static(path.join(__dirname, 'dist', 'public')));

// Catch-all handler: send back React's index.html file for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'public', 'index.html'));
});

// Export the Express app for Vercel
export default app;
