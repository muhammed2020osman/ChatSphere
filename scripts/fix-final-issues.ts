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

async function fixFinalIssues() {
  console.log('🔧 بدء إصلاح المشاكل النهائية...');
  
  let connection: mysql.Connection | null = null;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');

    // قائمة الإصلاحات النهائية
    const fixes = [
      // إصلاح نوع data في جدول pins
      {
        table: 'pins',
        action: 'fix_data_type',
        sql: `ALTER TABLE pins MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول drawingPins
      {
        table: 'drawingPins',
        action: 'fix_data_type',
        sql: `ALTER TABLE drawingPins MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول savedViews
      {
        table: 'savedViews',
        action: 'fix_data_type',
        sql: `ALTER TABLE savedViews MODIFY COLUMN view_data JSON`
      },
      
      // إصلاح نوع data في جدول drawingPages
      {
        table: 'drawingPages',
        action: 'fix_data_type',
        sql: `ALTER TABLE drawingPages MODIFY COLUMN content JSON`
      },
      
      // إصلاح نوع data في جدول drawingAnnotations
      {
        table: 'drawingAnnotations',
        action: 'fix_data_type',
        sql: `ALTER TABLE drawingAnnotations MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول drawingRevisions
      {
        table: 'drawingRevisions',
        action: 'fix_data_type',
        sql: `ALTER TABLE drawingRevisions MODIFY COLUMN changes JSON`
      },
      
      // إصلاح نوع data في جدول notifications
      {
        table: 'notifications',
        action: 'fix_data_type',
        sql: `ALTER TABLE notifications MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول layers
      {
        table: 'layers',
        action: 'fix_data_type',
        sql: `ALTER TABLE layers MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول drawingComments
      {
        table: 'drawingComments',
        action: 'fix_data_type',
        sql: `ALTER TABLE drawingComments MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول tickets
      {
        table: 'tickets',
        action: 'fix_data_type',
        sql: `ALTER TABLE tickets MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول projects
      {
        table: 'projects',
        action: 'fix_data_type',
        sql: `ALTER TABLE projects MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول drawings
      {
        table: 'drawings',
        action: 'fix_data_type',
        sql: `ALTER TABLE drawings MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول messages
      {
        table: 'messages',
        action: 'fix_data_type',
        sql: `ALTER TABLE messages MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول channels
      {
        table: 'channels',
        action: 'fix_data_type',
        sql: `ALTER TABLE channels MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول users
      {
        table: 'users',
        action: 'fix_data_type',
        sql: `ALTER TABLE users MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول sessions
      {
        table: 'sessions',
        action: 'fix_data_type',
        sql: `ALTER TABLE sessions MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول directMessages
      {
        table: 'directMessages',
        action: 'fix_data_type',
        sql: `ALTER TABLE directMessages MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول channelMembers
      {
        table: 'channelMembers',
        action: 'fix_data_type',
        sql: `ALTER TABLE channelMembers MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول reactions
      {
        table: 'reactions',
        action: 'fix_data_type',
        sql: `ALTER TABLE reactions MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول starredMessages
      {
        table: 'starredMessages',
        action: 'fix_data_type',
        sql: `ALTER TABLE starredMessages MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول attachments
      {
        table: 'attachments',
        action: 'fix_data_type',
        sql: `ALTER TABLE attachments MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول projectMembers
      {
        table: 'projectMembers',
        action: 'fix_data_type',
        sql: `ALTER TABLE projectMembers MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول drawingLayers
      {
        table: 'drawingLayers',
        action: 'fix_data_type',
        sql: `ALTER TABLE drawingLayers MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول floors
      {
        table: 'floors',
        action: 'fix_data_type',
        sql: `ALTER TABLE floors MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول rooms
      {
        table: 'rooms',
        action: 'fix_data_type',
        sql: `ALTER TABLE rooms MODIFY COLUMN data JSON`
      },
      
      // إصلاح نوع data في جدول disciplines
      {
        table: 'disciplines',
        action: 'fix_data_type',
        sql: `ALTER TABLE disciplines MODIFY COLUMN data JSON`
      }
    ];

    // تنفيذ الإصلاحات
    for (const fix of fixes) {
      try {
        console.log(`🔧 إصلاح ${fix.action} في جدول: ${fix.table}`);
        await connection.execute(fix.sql);
        console.log(`✅ تم إصلاح ${fix.action} في جدول ${fix.table} بنجاح`);
      } catch (error: any) {
        if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
          console.log(`⚠️  الحقل ${fix.table}.data غير موجود أو لا يحتاج إصلاح`);
        } else {
          console.error(`❌ خطأ في إصلاح ${fix.action} في جدول ${fix.table}:`, error.message);
        }
      }
    }

    console.log('\n🎉 تم إصلاح جميع المشاكل النهائية بنجاح!');
    
    // التحقق من النتيجة النهائية
    console.log('\n📊 التحقق من النتيجة النهائية:');
    const [tables] = await connection.execute("SHOW TABLES");
    const tableNames = (tables as any[]).map((row: any) => Object.values(row)[0]);
    console.log(`إجمالي الجداول: ${tableNames.length}`);
    console.log('الجداول الموجودة:', tableNames.sort());

  } catch (error) {
    console.error('❌ خطأ في إصلاح المشاكل النهائية:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// تشغيل الدالة
if (import.meta.url === `file://${process.argv[1]}`) {
  fixFinalIssues().catch(console.error);
}

export { fixFinalIssues };
