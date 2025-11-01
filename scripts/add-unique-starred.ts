#!/usr/bin/env tsx

import 'dotenv/config';
import mysql from 'mysql2/promise';

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
const config = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1), // Remove leading slash
  multipleStatements: true,
  charset: 'utf8mb4',
  connectTimeout: 30000,
  acquireTimeout: 30000,
  idleTimeout: 300000,
  keepAliveInitialDelay: 0,
  enableKeepAlive: true,
  timezone: 'Z',
  dateStrings: false,
  supportBigNumbers: true,
  bigNumberStrings: true,
  reconnect: true,
};

async function addUniqueConstraint() {
  console.log('🔧 إضافة UNIQUE constraint لجدول starred_messages...\n');
  
  let connection: mysql.Connection | null = null;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح\n');

    // 1. إزالة السجلات المكررة أولاً
    console.log('🧹 إزالة السجلات المكررة...');
    try {
      await connection.execute(`
        DELETE sm1 FROM starred_messages sm1
        INNER JOIN starred_messages sm2 
        WHERE sm1.id > sm2.id 
        AND sm1.message_id = sm2.message_id 
        AND sm1.user_id = sm2.user_id
      `);
      console.log('✅ تم إزالة السجلات المكررة (إن وجدت)\n');
    } catch (error: any) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log('ℹ️ جدول starred_messages غير موجود، سيتم إنشاؤه مع constraint\n');
      } else {
        console.log('⚠️ خطأ في إزالة السجلات المكررة:', error.message, '\n');
      }
    }

    // 2. إضافة UNIQUE constraint
    console.log('🔒 إضافة UNIQUE constraint...');
    try {
      await connection.execute(`
        ALTER TABLE starred_messages 
        ADD UNIQUE KEY unique_message_user (message_id, user_id)
      `);
      console.log('✅ تم إضافة UNIQUE constraint بنجاح!\n');
    } catch (error: any) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️ UNIQUE constraint موجود بالفعل\n');
      } else if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log('⚠️ جدول starred_messages غير موجود، سيحتاج إلى إنشاؤه أولاً\n');
      } else {
        throw error;
      }
    }

    // 3. التحقق من وجود constraint
    console.log('🔍 التحقق من constraint...');
    const [constraints] = await connection.execute(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'starred_messages' 
      AND CONSTRAINT_TYPE = 'UNIQUE'
      AND CONSTRAINT_NAME = 'unique_message_user'
    `, [config.database]) as any[];

    if (constraints.length > 0) {
      console.log('✅ UNIQUE constraint موجود ويعمل بشكل صحيح\n');
    } else {
      console.log('⚠️ UNIQUE constraint غير موجود\n');
    }

    // 4. عرض إحصائيات الجدول (إن كان موجوداً)
    try {
      const [stats] = await connection.execute(`
        SELECT 
          COUNT(*) as total_stars,
          COUNT(DISTINCT message_id) as unique_messages,
          COUNT(DISTINCT user_id) as unique_users
        FROM starred_messages
      `) as any[];

      if (stats.length > 0) {
        console.log('📈 إحصائيات الجدول:');
        console.log(`   - إجمالي النجوم: ${stats[0].total_stars}`);
        console.log(`   - الرسائل المميزة: ${stats[0].unique_messages}`);
        console.log(`   - المستخدمين: ${stats[0].unique_users}\n`);
      }
    } catch (error: any) {
      if (error.code !== 'ER_NO_SUCH_TABLE') {
        console.log('⚠️ خطأ في جلب الإحصائيات:', error.message);
      }
    }

    console.log('🎉 تمت العملية بنجاح!');

  } catch (error) {
    console.error('❌ خطأ في إضافة constraint:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// تشغيل السكريبت
if (import.meta.url === `file://${process.argv[1]}`) {
  addUniqueConstraint()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ فشل السكريبت:', error);
      process.exit(1);
    });
}

