#!/usr/bin/env node

/**
 * Script to check notifications in database
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { notifications, messageMentions, messages } from './shared/schema.ts';
import { eq, desc, and } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL2;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

async function checkNotifications() {
  let connection;
  try {
    console.log('🔍 Checking notifications in database...\n');
    
    // Create connection
    connection = await mysql.createConnection(DATABASE_URL);
    const db = drizzle(connection);

    // Check recent notifications
    console.log('📋 Recent notifications (last 10):');
    const recentNotifications = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(10);
    
    console.log(`Found ${recentNotifications.length} notifications`);
    if (recentNotifications.length > 0) {
      recentNotifications.forEach((n, i) => {
        console.log(`\n${i + 1}. Notification ID: ${n.id}`);
        console.log(`   Type: ${n.type}`);
        console.log(`   User ID: ${n.userId}`);
        console.log(`   Company ID: ${n.companyId}`);
        console.log(`   Message ID: ${n.messageId}`);
        console.log(`   Channel ID: ${n.channelId}`);
        console.log(`   From User ID: ${n.fromUserId}`);
        console.log(`   Content: ${n.content?.substring(0, 50)}...`);
        console.log(`   Created: ${n.createdAt}`);
      });
    } else {
      console.log('   ⚠️  No notifications found in database');
    }

    // Check mention notifications specifically
    console.log('\n\n📋 Mention notifications (last 10):');
    const mentionNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.type, 'mention'))
      .orderBy(desc(notifications.createdAt))
      .limit(10);
    
    console.log(`Found ${mentionNotifications.length} mention notifications`);
    if (mentionNotifications.length > 0) {
      mentionNotifications.forEach((n, i) => {
        console.log(`\n${i + 1}. Notification ID: ${n.id}`);
        console.log(`   User ID: ${n.userId}`);
        console.log(`   Message ID: ${n.messageId}`);
        console.log(`   Created: ${n.createdAt}`);
      });
    } else {
      console.log('   ⚠️  No mention notifications found');
    }

    // Check message mentions
    console.log('\n\n📋 Message mentions (last 10):');
    const messageMentionsList = await db
      .select()
      .from(messageMentions)
      .orderBy(desc(messageMentions.createdAt))
      .limit(10);
    
    console.log(`Found ${messageMentionsList.length} message mentions`);
    if (messageMentionsList.length > 0) {
      messageMentionsList.forEach((m, i) => {
        console.log(`\n${i + 1}. Message Mention ID: ${m.id}`);
        console.log(`   Message ID: ${m.messageId}`);
        console.log(`   User ID: ${m.userId}`);
        console.log(`   Company ID: ${m.companyId}`);
        console.log(`   Created: ${m.createdAt}`);
      });
    } else {
      console.log('   ⚠️  No message mentions found');
    }

    // Check recent messages
    console.log('\n\n📋 Recent messages (last 5):');
    const recentMessages = await db
      .select()
      .from(messages)
      .orderBy(desc(messages.createdAt))
      .limit(5);
    
    console.log(`Found ${recentMessages.length} recent messages`);
    recentMessages.forEach((m, i) => {
      console.log(`\n${i + 1}. Message ID: ${m.id}`);
      console.log(`   Content: ${m.content?.substring(0, 50)}...`);
      console.log(`   User ID: ${m.userId}`);
      console.log(`   Channel ID: ${m.channelId}`);
      console.log(`   Created: ${m.createdAt}`);
    });

    console.log('\n✅ Check completed!\n');

  } catch (error) {
    console.error('❌ Error checking notifications:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkNotifications();

