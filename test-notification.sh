#!/bin/bash

# Test script to send a message with mention using curl
# Usage: ./test-notification.sh

BASE_URL="${BASE_URL:-http://localhost:5000}"
TEST_EMAIL="${TEST_EMAIL:-admin@gmail.com}"
TEST_PASSWORD="${TEST_PASSWORD:-password123}"
TEST_CHANNEL_ID="${TEST_CHANNEL_ID:-4}"
MENTIONED_USER_ID="${MENTIONED_USER_ID:-2}"

echo "🧪 Testing notification creation..."
echo "Base URL: $BASE_URL"
echo "Email: $TEST_EMAIL"
echo "Channel ID: $TEST_CHANNEL_ID"
echo "Mentioned User ID: $MENTIONED_USER_ID"
echo ""

# Step 1: Login
echo "📝 Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

echo "Login response: $LOGIN_RESPONSE"

# Extract token and companyId from response
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
COMPANY_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"companyId":[0-9]*' | cut -d':' -f2)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token. Please check credentials."
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo "   Token: ${TOKEN:0:20}..."
echo "   Company ID: $COMPANY_ID"
echo ""

# Step 2: Send message with mention
echo "📤 Step 2: Sending message with mention..."
MESSAGE_PAYLOAD=$(cat <<EOF
{
  "channelId": $TEST_CHANNEL_ID,
  "content": "Test message with mention @user$MENTIONED_USER_ID - $(date -Iseconds)",
  "mentionedUserIds": [$MENTIONED_USER_ID]
}
EOF
)

echo "Payload: $MESSAGE_PAYLOAD"
echo ""

MESSAGE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-company-id: $COMPANY_ID" \
  -d "$MESSAGE_PAYLOAD")

echo "Message response: $MESSAGE_RESPONSE"
echo ""

# Extract message ID
MESSAGE_ID=$(echo "$MESSAGE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)

if [ -z "$MESSAGE_ID" ]; then
  echo "❌ Failed to send message"
  echo "Response: $MESSAGE_RESPONSE"
  exit 1
fi

echo "✅ Message sent successfully"
echo "   Message ID: $MESSAGE_ID"
echo ""

# Step 3: Check notifications
echo "🔔 Step 3: Checking notifications..."
NOTIFICATIONS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/notifications" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-company-id: $COMPANY_ID")

echo "Notifications response: $NOTIFICATIONS_RESPONSE"
echo ""

echo "✅ Test completed!"
echo ""
echo "📋 Next steps:"
echo "   1. Check server logs for detailed trace"
echo "   2. Check database: SELECT * FROM notifications WHERE type = 'mention' ORDER BY created_at DESC LIMIT 5;"
echo "   3. Verify message_mentions: SELECT * FROM message_mentions ORDER BY created_at DESC LIMIT 5;"

