#!/bin/bash
set -e

echo "🚀 Starting production server..."

# Check if symlink exists and is valid
if [ ! -L "server/public" ] || [ ! -e "server/public" ]; then
  echo "⚠️  Symlink missing or broken. Creating symlink..."
  rm -f server/public 2>/dev/null || true
  ln -sfn ../dist/public server/public
  echo "✅ Symlink created: server/public -> $(readlink server/public)"
else
  echo "✅ Symlink already exists: server/public -> $(readlink server/public)"
fi

# Verify dist/public exists
if [ ! -d "dist/public" ]; then
  echo "❌ ERROR: dist/public directory not found!"
  echo "Please run 'npm run build' first."
  exit 1
fi

# Start the server
echo "🎯 Starting Node.js server..."
NODE_ENV=production node dist/index.js
