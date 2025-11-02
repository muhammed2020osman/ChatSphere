#!/bin/bash

# Deployment script for souglink.com
# Usage: 
#   ssh root@72.61.96.90 'bash -s' < deploy-souglink.sh
# Or run locally on server:
#   bash deploy-souglink.sh

set -e  # Exit on error

EXPRESS_PATH="/www/wwwroot/souglink.com"
NGINX_CONFIG="/etc/nginx/sites-available/souglink.com"
NGINX_ENABLED="/etc/nginx/sites-enabled/souglink.com"

echo "=== 🚀 Starting deployment for souglink.com ==="

# Change to Express project directory
cd "$EXPRESS_PATH" || {
    echo "❌ ERROR: Directory $EXPRESS_PATH not found!"
    exit 1
}

echo "✅ Current directory: $(pwd)"

# Update from git (if using git)
if [ -d .git ]; then
    echo "=== 📥 Updating from Git ==="
    git stash || true
    git pull origin main --rebase || echo "⚠️  Git pull failed, continuing..."
else
    echo "⚠️  Not a git repository, skipping git pull"
fi

# Install/update dependencies
echo "=== 📦 Installing dependencies ==="
if [ -f pnpm-lock.yaml ]; then
    pnpm install
elif [ -f package-lock.json ]; then
    npm install
else
    echo "⚠️  No lock file found, using npm install"
    npm install
fi

# Build the project (commented out per user preference, but kept for reference)
# echo "=== 🔨 Building project ==="
# npm run build

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
    echo "=== 🔄 Managing application with PM2 ==="
    
    # Check if chat process exists
    if pm2 list | grep -q "chat"; then
        echo "✅ Restarting existing PM2 process..."
        pm2 restart chat
    else
        echo "🆕 Starting new PM2 process..."
        # Check if built version exists
        if [ -f "dist/index.js" ]; then
            NODE_ENV=production pm2 start dist/index.js --name chat
        elif [ -f "server/index.ts" ]; then
            # Development mode with tsx
            pm2 start "npm run dev" --name chat
        else
            echo "❌ ERROR: Cannot find application entry point"
            exit 1
        fi
    fi
    
    # Wait a moment for app to start
    sleep 3
    
    # Show status
    pm2 status chat
    
    # Save PM2 configuration
    pm2 save
else
    echo "⚠️  PM2 not found. Please install with: npm install -g pm2"
    echo "Or start the server manually with: NODE_ENV=production node dist/index.js"
fi

# Setup Nginx configuration
echo "=== 🌐 Configuring Nginx ==="
if [ -f "nginx-souglink.conf" ]; then
    echo "✅ Copying nginx configuration..."
    sudo cp nginx-souglink.conf "$NGINX_CONFIG"
    
    # Create symlink
    sudo ln -sf "$NGINX_CONFIG" "$NGINX_ENABLED"
    
    # Test nginx configuration
    echo "✅ Testing nginx configuration..."
    sudo nginx -t
    
    # Reload nginx
    echo "✅ Reloading nginx..."
    sudo systemctl reload nginx || sudo systemctl restart nginx
    
    echo "✅ Nginx configured successfully"
else
    echo "⚠️  nginx-souglink.conf not found in project directory"
fi

# Test Express server
echo "=== 🧪 Testing Express server ==="
sleep 2
if curl -f -s http://localhost:5000 > /dev/null 2>&1; then
    echo "✅ Express server is responding on port 5000"
else
    echo "⚠️  WARNING: Express server might not be running or not responding"
    echo "Check with: pm2 logs chat"
fi

# Test domain (if running locally on server)
if curl -f -s https://souglink.com > /dev/null 2>&1; then
    echo "✅ Domain https://souglink.com is accessible"
elif curl -f -s http://souglink.com > /dev/null 2>&1; then
    echo "⚠️  Domain http://souglink.com is accessible (HTTPS might need setup)"
else
    echo "⚠️  Domain might not be accessible yet"
fi

echo ""
echo "=== ✅ Deployment completed! ==="
echo ""
echo "Next steps:"
echo "1. If SSL certificate is not set up, run:"
echo "   sudo certbot --nginx -d souglink.com -d www.souglink.com"
echo ""
echo "2. Check application logs:"
echo "   pm2 logs chat"
echo ""
echo "3. Check nginx logs if needed:"
echo "   sudo tail -f /var/log/nginx/error.log"
echo ""

