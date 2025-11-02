#!/bin/bash
# Script to restart PM2 after build

cd /www/wwwroot/souglink.com

echo "Waiting for Express to be ready..."
sleep 3

# Restart PM2 to use new build
pm2 restart souglink --update-env

echo "Waiting for Express to start..."
sleep 5

# Check if Express is responding
for i in {1..10}; do
    if curl -s -o /dev/null -w '%{http_code}' http://localhost:5000 | grep -q '200'; then
        echo "✓ Express is running on port 5000"
        exit 0
    fi
    echo "Waiting for Express... (attempt $i/10)"
    sleep 2
done

echo "✗ Express failed to start"
pm2 logs souglink --lines 20
exit 1
