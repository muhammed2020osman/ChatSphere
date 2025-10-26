# ChatSphere - Full-Stack Vercel Deployment

## 🚀 Express Full-Stack Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/ChatSphere)

## 📋 Prerequisites

Before deploying to Vercel, you need:

1. **Database**: Cloud MySQL service (PlanetScale, Railway, or AWS RDS)
2. **API Keys**: Google Gemini API key
3. **Environment Variables**: See configuration below

## ⚙️ Environment Variables

Add these variables in your Vercel project settings:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@host:3306/db` |
| `ACCESS_CODE` | Access code for the app | `your-secret-code` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIza...` |
| `NODE_ENV` | Environment | `production` |
| `SESSION_SECRET` | Session secret | `random-32-char-string` |

## 🗄️ Database Setup

### Option 1: PlanetScale (Recommended)
```bash
# 1. Sign up at https://planetscale.com
# 2. Create a new database
# 3. Copy the connection string
# 4. Add to Vercel as DATABASE_URL
```

### Option 2: Railway
```bash
# 1. Sign up at https://railway.app
# 2. Create MySQL service
# 3. Copy the connection string
# 4. Add to Vercel as DATABASE_URL
```

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp env.example .env.local

# Fill in your environment variables
# Start development server
npm run dev
```

## 📁 Project Structure

```
ChatSphere/
├── app.js                 # Main Express app entry point
├── vercel.json           # Vercel configuration
├── client/               # Frontend React app
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── hooks/        # Custom hooks
│   │   └── lib/         # Utilities
├── server/               # Backend Express server
├── shared/               # Shared schemas
└── package.json          # Dependencies
```

## 🛠️ Build Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production (full-stack)
- `npm run build:vercel` - Build frontend only
- `npm run start` - Start production server

## 🎯 Vercel Express Benefits

- **Full-Stack**: Deploy both frontend and backend
- **Fluid Compute**: Automatic scaling based on traffic
- **Serverless**: No server management required
- **Global CDN**: Fast static asset delivery
- **Preview Deployments**: Test changes safely
- **Instant Rollback**: Quick recovery from issues

## 📝 Important Notes

- **Express App**: Runs as Vercel Functions with Fluid Compute
- **Database Required**: You need a cloud MySQL database
- **Static Assets**: Place files in `public/` directory
- **Environment Variables**: Must be set in Vercel dashboard

## 🔗 Useful Links

- [Vercel Express Documentation](https://vercel.com/docs/frameworks/backend/express)
- [PlanetScale](https://planetscale.com)
- [Railway](https://railway.app)
- [Google Gemini API](https://makersuite.google.com/app/apikey)

## 📞 Support

If you encounter issues:
1. Check environment variables
2. Verify database connection
3. Check Vercel build logs
4. Review the deployment guide in `VERCEL_DEPLOYMENT.md`
