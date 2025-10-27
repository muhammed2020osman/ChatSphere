import { initializeDatabase } from './index';

// Initialize database on module load for development
if (process.env.NODE_ENV === 'development') {
  initializeDatabase().catch((error) => {
    console.error('Failed to initialize database:', error);
  });
}
