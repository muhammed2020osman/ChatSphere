#!/usr/bin/env tsx

import mysql from 'mysql2/promise';
import { config } from 'dotenv';

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

async function testMessages() {
  console.log('🧪 اختبار الرسائل في قاعدة البيانات...');
  
  let connection: mysql.Connection | null = null;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');

    // Check if messages table exists and has data
    const [messages] = await connection.execute('SELECT COUNT(*) as count FROM messages');
    console.log(`📊 عدد الرسائل في قاعدة البيانات: ${(messages as any[])[0].count}`);

    // Check if channels table exists and has data
    const [channels] = await connection.execute('SELECT COUNT(*) as count FROM channels');
    console.log(`📊 عدد القنوات في قاعدة البيانات: ${(channels as any[])[0].count}`);

    // Check if users table exists and has data
    const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
    console.log(`📊 عدد المستخدمين في قاعدة البيانات: ${(users as any[])[0].count}`);

    // Get recent messages with user info
    const [recentMessages] = await connection.execute(`
      SELECT 
        m.id,
        m.content,
        m.created_at,
        u.name,
        u.email,
        c.name as channel_name
      FROM messages m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN channels c ON m.channel_id = c.id
      ORDER BY m.created_at DESC
      LIMIT 10
    `);

    console.log('\n📝 آخر 10 رسائل:');
    (recentMessages as any[]).forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.channel_name}] ${msg.name || msg.email}: ${msg.content.substring(0, 50)}...`);
    });

    // Check if the specific channel exists
    const [channelCheck] = await connection.execute(
      'SELECT * FROM channels WHERE id = ?',
      ['bf640c9c-b1ca-11f0-b929-6814011177f5']
    );

    if ((channelCheck as any[]).length > 0) {
      console.log('\n✅ القناة المطلوبة موجودة:', (channelCheck as any[])[0]);
    } else {
      console.log('\n❌ القناة المطلوبة غير موجودة');
    }

    // Check messages for this specific channel
    const [channelMessages] = await connection.execute(`
      SELECT 
        m.id,
        m.content,
        m.created_at,
        u.name,
        u.email
      FROM messages m
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.channel_id = ?
      ORDER BY m.created_at DESC
      LIMIT 5
    `, ['bf640c9c-b1ca-11f0-b929-6814011177f5']);

    console.log(`\n📨 رسائل القناة المحددة (${(channelMessages as any[]).length} رسالة):`);
    (channelMessages as any[]).forEach((msg, index) => {
      console.log(`${index + 1}. ${msg.name || msg.email}: ${msg.content}`);
    });

  } catch (error) {
    console.error('❌ فشل في اختبار الرسائل:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 تم إغلاق الاتصال بقاعدة البيانات');
    }
  }
}

// Run the function
if (import.meta.url === `file://${process.argv[1]}`) {
  testMessages();
}
