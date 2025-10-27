# Next.js Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Database
DATABASE_URL=mysql://username:password@host:3306/database_name

# Access Control
ACCESS_CODE=your_access_code_here

# AI Services
GEMINI_API_KEY=your_gemini_api_key_here

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here

# Replit OAuth (if using)
REPLIT_CLIENT_ID=your_replit_client_id
REPLIT_CLIENT_SECRET=your_replit_client_secret

# Environment
NODE_ENV=development
SKIP_AI_ANALYSIS=false
PORT=3000
SESSION_SECRET=your_session_secret_here
```

## Required Environment Variables for Vercel:

1. `DATABASE_URL` - Your MySQL database connection string
2. `ACCESS_CODE` - Access code for the application
3. `GEMINI_API_KEY` - Google Gemini AI API key
4. `NEXTAUTH_URL` - Your Vercel deployment URL
5. `NEXTAUTH_SECRET` - Random secret for NextAuth
6. `REPLIT_CLIENT_ID` - Replit OAuth client ID (if using Replit auth)
7. `REPLIT_CLIENT_SECRET` - Replit OAuth client secret (if using Replit auth)

