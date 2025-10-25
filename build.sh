#!/bin/bash
set -e

echo "Building application..."
npm run build

echo "Creating symlink for production assets..."
ln -sfn ../dist/public server/public

echo "Build completed successfully!"
echo "server/public -> $(readlink server/public)"
