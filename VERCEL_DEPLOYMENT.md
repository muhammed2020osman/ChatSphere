# Vercel Deployment Guide for ChatSphere (Full-Stack)

## 🚀 Express Full-Stack Deployment on Vercel

This setup deploys both frontend and backend using Express on Vercel's serverless functions.

## Environment Variables Required in Vercel

Add these environment variables in your Vercel project settings:

### Required Variables:
- `DATABASE_URL` - MySQL connection string (use cloud service like PlanetScale, Railway, or AWS RDS)
- `ACCESS_CODE` - Code required to access the application
- `GEMINI_API_KEY` - Google Gemini API key for drawing analysis
- `NODE_ENV` - Set to "production"
- `SESSION_SECRET` - Random string for session management (generate with: openssl rand -base64 32)

### Optional Variables:
- `SKIP_AI_ANALYSIS` - Set to "false" for production
- `PORT` - Vercel will set this automatically

## Database Setup

Since Vercel doesn't support MySQL directly, you'll need a cloud database:

### Option 1: PlanetScale (Recommended)
1. Sign up at https://planetscale.com
2. Create a new database
3. Get the connection string
4. Add it as `DATABASE_URL` in Vercel

### Option 2: Railway
1. Sign up at https://railway.app
2. Create a MySQL service
3. Get the connection string
4. Add it as `DATABASE_URL` in Vercel

### Option 3: AWS RDS
1. Create MySQL instance in AWS RDS
2. Get the connection string
3. Add it as `DATABASE_URL` in Vercel

## Deployment Steps

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set the environment variables
4. Deploy

## Project Structure for Vercel

```
ChatSphere/
├── app.js                 # Main Express app entry point
├── vercel.json           # Vercel configuration
├── client/               # Frontend React app
├── server/               # Backend Express server
├── shared/               # Shared schemas
└── package.json          # Dependencies
```

## Important Notes

- **Full-Stack Deployment**: This setup deploys both frontend and backend
- **Serverless Functions**: Express app runs as Vercel Functions
- **Static Assets**: Place static files in `public/` directory
- **Database Required**: You need a cloud MySQL database
- **Fluid Compute**: Automatic scaling based on traffic

## Benefits of This Setup

- ✅ Full-stack application on Vercel
- ✅ Automatic scaling with Fluid Compute
- ✅ Preview deployments for testing
- ✅ Instant rollback capability
- ✅ Built-in security with Vercel Firewall
- ✅ Global CDN for static assets

## Troubleshooting

If you encounter issues:
1. Check environment variables are set correctly
2. Verify database connection string
3. Check Vercel build logs
4. Ensure all dependencies are in package.json
5. Review Express app export format
