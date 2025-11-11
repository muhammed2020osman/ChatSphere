#!/bin/bash

# Direct test script - UPDATE THESE VALUES BEFORE RUNNING
# This script sends a direct HTTP request to test notification creation

BASE_URL="${BASE_URL:-http://localhost:5000}"

# IMPORTANT: Update these values with your actual credentials and IDs
# You can find these from your browser's localStorage or database
TOKEN="${TOKEN:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIiwiZW1haWwiOiJhZG1pbkBnbWFpbC5jb20iLCJpZCI6MSwiY29tcGFueUlkIjoxLCJpYXQiOjE3NjI3OTcwNTMsImV4cCI6MTc2MzQwMTg1M30.OnYZij9PS5b7ssKuLuWzIkTwY1iWBNReOixZm2lizQA}"
COMPANY_ID="${COMPANY_ID:-1}"
CHANNEL_ID="${CHANNEL_ID:-4}"
MENTIONED_USER_ID="${MENTIONED_USER_ID:-2}"

echo "🧪 Testing notification creation (direct request)..."
echo "Base URL: $BASE_URL"
echo "Company ID: $COMPANY_ID"
echo "Channel ID: $CHANNEL_ID"
echo "Mentioned User ID: $MENTIONED_USER_ID"
echo ""

if [ "$TOKEN" = "YOUR_TOKEN_HERE" ]; then
  echo "⚠️  WARNING: Please set TOKEN environment variable or update script"
  echo ""
  echo "To get a token, first login:"
  echo "  curl -X POST $BASE_URL/api/auth/login \\"
  echo "    -H 'Content-Type: application/json' \\"
  echo "    -d '{\"email\":\"YOUR_EMAIL\",\"password\":\"YOUR_PASSWORD\"}'"
  echo ""
  echo "Then set TOKEN=... and run this script again"
  echo ""
  exit 1
fi

# Create message payload with mention
MESSAGE_PAYLOAD=$(cat <<EOF
{
  "channelId": $CHANNEL_ID,
  "content": "Test mention notification - $(date '+%Y-%m-%d %H:%M:%S')",
  "mentionedUserIds": [$MENTIONED_USER_ID]
}
EOF
)

echo "📤 Sending POST request to /api/messages..."
echo "Payload:"
echo "$MESSAGE_PAYLOAD" | jq '.' 2>/dev/null || echo "$MESSAGE_PAYLOAD"
echo ""

# Send the request
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/api/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-company-id: $COMPANY_ID" \
  -d "$MESSAGE_PAYLOAD")

# Extract HTTP status and body
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "Response Status: $HTTP_STATUS"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
  echo "✅ Message sent successfully!"
  echo ""
  echo "📋 Check server logs for detailed trace of notification creation"
  echo "📋 Check database: SELECT * FROM notifications WHERE type = 'mention' ORDER BY created_at DESC LIMIT 5;"
else
  echo "❌ Request failed with status $HTTP_STATUS"
  echo "Check the response above for error details"
fi

