#!/usr/bin/env node

/**
 * Direct test script to create a notification in the database
 */

import 'dotenv/config';
import { storage } from './server/storage';

async function testCreateNotification() {
  try {
    console.log('🧪 Testing notification creation directly...\n');
    
    const notificationData = {
      userId: 2, // Mentioned user ID
      companyId: 1,
      type: 'mention',
      messageId: 73, // Latest message ID
      channelId: 4,
      fromUserId: 1, // Sender user ID
      content: 'Test notification - direct creation',
      isRead: false,
    };
    
    console.log('Creating notification with data:', notificationData);
    
    const result = await storage.createNotification(notificationData);
    
    console.log('\n✅ Notification created successfully!');
    console.log('Result:', result);
    
    // Verify it was created
    const notifications = await storage.getUserNotifications('auth:2');
    const latestNotification = notifications[0];
    
    console.log('\n📋 Latest notification for user 2:');
    console.log(JSON.stringify(latestNotification, null, 2));
    
  } catch (error: any) {
    console.error('\n❌ Error creating notification:');
    console.error('Message:', error?.message);
    console.error('Code:', error?.code);
    console.error('SQL State:', error?.sqlState);
    console.error('SQL Message:', error?.sqlMessage);
    console.error('Stack:', error?.stack);
    process.exit(1);
  }
}

testCreateNotification()
  .then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

