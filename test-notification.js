#!/usr/bin/env node

/**
 * Test script to send a message with mention and verify notification creation
 * Usage: node test-notification.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Test credentials - UPDATE THESE WITH YOUR ACTUAL CREDENTIALS
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@gmail.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password123';
const TEST_CHANNEL_ID = process.env.TEST_CHANNEL_ID || '4'; // Update with actual channel ID
const MENTIONED_USER_ID = process.env.MENTIONED_USER_ID || '2'; // Update with actual user ID to mention

async function testNotification() {
  try {
    console.log('🧪 Starting notification test...\n');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Test Email: ${TEST_EMAIL}`);
    console.log(`Channel ID: ${TEST_CHANNEL_ID}`);
    console.log(`Mentioned User ID: ${MENTIONED_USER_ID}\n`);

    // Step 1: Login to get token
    console.log('📝 Step 1: Logging in...');
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      throw new Error(`Login failed: ${loginResponse.status} - ${errorText}`);
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    const companyId = loginData.companyId;

    if (!token) {
      throw new Error('No token received from login');
    }

    console.log('✅ Login successful');
    console.log(`   User ID: ${loginData.id}`);
    console.log(`   Company ID: ${companyId}`);
    console.log(`   Token: ${token.substring(0, 20)}...\n`);

    // Step 2: Send message with mention
    console.log('📤 Step 2: Sending message with mention...');
    const messagePayload = {
      channelId: parseInt(TEST_CHANNEL_ID),
      content: `Test message with mention @user${MENTIONED_USER_ID} - ${new Date().toISOString()}`,
      mentionedUserIds: [parseInt(MENTIONED_USER_ID)], // Array of user IDs
    };

    console.log('   Payload:', JSON.stringify(messagePayload, null, 2));

    const messageResponse = await fetch(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-company-id': String(companyId),
      },
      body: JSON.stringify(messagePayload),
    });

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      throw new Error(`Message send failed: ${messageResponse.status} - ${errorText}`);
    }

    const messageData = await messageResponse.json();
    console.log('✅ Message sent successfully');
    console.log(`   Message ID: ${messageData.id}`);
    console.log(`   Content: ${messageData.content}\n`);

    // Step 3: Check notifications for mentioned user
    console.log('🔔 Step 3: Checking notifications for mentioned user...');
    const notificationsResponse = await fetch(`${BASE_URL}/api/notifications`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-company-id': String(companyId),
      },
    });

    if (!notificationsResponse.ok) {
      const errorText = await notificationsResponse.text();
      console.warn(`⚠️  Failed to fetch notifications: ${notificationsResponse.status} - ${errorText}`);
    } else {
      const notifications = await notificationsResponse.json();
      const mentionNotifications = notifications.filter(n => 
        n.type === 'mention' && 
        n.messageId === messageData.id &&
        n.userId === parseInt(MENTIONED_USER_ID)
      );

      console.log(`   Total notifications: ${notifications.length}`);
      console.log(`   Mention notifications for user ${MENTIONED_USER_ID}: ${mentionNotifications.length}`);

      if (mentionNotifications.length > 0) {
        console.log('✅ Notification created successfully!');
        console.log('   Notification:', JSON.stringify(mentionNotifications[0], null, 2));
      } else {
        console.log('❌ No notification found for mentioned user');
        console.log('   Check server logs for details');
      }
    }

    console.log('\n✅ Test completed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Check server logs for detailed trace');
    console.log('   2. Check database: SELECT * FROM notifications WHERE type = "mention" ORDER BY created_at DESC LIMIT 5;');
    console.log('   3. Verify message_mentions table: SELECT * FROM message_mentions ORDER BY created_at DESC LIMIT 5;');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

testNotification();

