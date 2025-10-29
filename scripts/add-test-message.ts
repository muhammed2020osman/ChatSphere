#!/usr/bin/env tsx

import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';

// Load environment variables
config();

// Parse DATABASE_URL with error handling
let url: URL;
try {
  url = new URL(process.env.DATABASE_URL || '');
} catch (error) {
  throw new Error(
    `Invalid DATABASE_URL format: ${process.env.DATABASE_URL}. Expected format: mysql://username:password@host:port/database`
  );
}

// Database connection configuration
const dbConfig = {
  host: url.hostname,
  port: parseInt(url.port || '3306'),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1), // Remove leading slash
  multipleStatements: true,
  charset: 'utf8mb4',
};

async function addTestMessage() {
  console.log('📝 إضافة رسالة تجريبية...');
  
  let connection: mysql.Connection | null = null;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');

    const channelId = 'bf640c9c-b1ca-11f0-b929-6814011177f5';
    const userId = 'dev-user-123';
    const messageId = randomUUID();
    const content = `رسالة تجريبية من السكريبت - ${new Date().toLocaleString('ar-SA')}`;

    // Insert test message
    await connection.execute(`
      INSERT INTO messages (id, content, channel_id, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `, [messageId, content, channelId, userId]);

    console.log('✅ تم إضافة الرسالة التجريبية بنجاح');
    console.log(`📨 الرسالة: ${content}`);

    // Verify the message was added
    const [messages] = await connection.execute(`
      SELECT 
        m.id,
        m.content,
        m.created_at,
        u.first_name,
        u.last_name,
        u.email,
        c.name as channel_name
      FROM messages m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN channels c ON m.channel_id = c.id
      WHERE m.id = ?
    `, [messageId]);

    if ((messages as any[]).length > 0) {
      const msg = (messages as any[])[0];
      console.log('\n✅ تم التحقق من الرسالة:');
      console.log(`   - القناة: ${msg.channel_name}`);
      console.log(`   - المستخدم: ${msg.first_name || msg.email}`);
      console.log(`   - المحتوى: ${msg.content}`);
      console.log(`   - الوقت: ${msg.created_at}`);
    }

  } catch (error) {
    console.error('❌ فشل في إضافة الرسالة التجريبية:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 تم إغلاق الاتصال بقاعدة البيانات');
    }
  }
}

// Run the function
if (import.meta.url === `file://${process.argv[1]}`) {
  addTestMessage();
}
