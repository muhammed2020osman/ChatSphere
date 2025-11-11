#!/bin/bash

# Script to check server logs for notification-related messages
# This assumes server logs are in stdout/stderr or a log file

echo "🔍 Checking for notification-related logs..."
echo ""

# Check if there's a log file
if [ -f "server.log" ]; then
  echo "📋 Recent notification logs from server.log:"
  grep -i "notification\|mention" server.log | tail -50
elif [ -f "logs/server.log" ]; then
  echo "📋 Recent notification logs from logs/server.log:"
  grep -i "notification\|mention" logs/server.log | tail -50
else
  echo "⚠️  No log file found. Please check server console output."
  echo ""
  echo "Look for these log messages:"
  echo "  - [POST /api/messages] ===== CRITICAL CHECK BEFORE CONDITION ====="
  echo "  - [POST /api/messages] ===== MENTIONS FOUND - CREATING NOTIFICATIONS ====="
  echo "  - [Storage] ===== NOTIFICATION INSERTED SUCCESSFULLY ====="
  echo "  - [Storage] ===== ERROR INSERTING NOTIFICATION ====="
fi

echo ""
echo "💡 Tip: Run the test again and watch the server console for detailed logs"

