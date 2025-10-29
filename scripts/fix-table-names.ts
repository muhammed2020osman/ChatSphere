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

async function fixTableNames() {
  console.log('🔧 بدء إصلاح أسماء الجداول...');
  
  let connection: mysql.Connection | null = null;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');

    // قائمة الجداول التي تحتاج إلى إعادة تسمية
    const tableRenames = [
      { from: 'channel_members', to: 'channelMembers' },
      { from: 'direct_messages', to: 'directMessages' },
      { from: 'drawing_annotations', to: 'drawingAnnotations' },
      { from: 'drawing_comments', to: 'drawingComments' },
      { from: 'drawing_layers', to: 'drawingLayers' },
      { from: 'drawing_pages', to: 'drawingPages' },
      { from: 'drawing_pins', to: 'drawingPins' },
      { from: 'drawing_revisions', to: 'drawingRevisions' },
      { from: 'project_members', to: 'projectMembers' },
      { from: 'saved_views', to: 'savedViews' },
      { from: 'starred_messages', to: 'starredMessages' }
    ];

    // التحقق من الجداول الموجودة
    const [tables] = await connection.execute("SHOW TABLES");
    const existingTables = (tables as any[]).map((row: any) => Object.values(row)[0]);
    console.log('الجداول الموجودة:', existingTables);

    // إعادة تسمية الجداول
    for (const rename of tableRenames) {
      if (existingTables.includes(rename.from) && !existingTables.includes(rename.to)) {
        try {
          console.log(`🔄 إعادة تسمية ${rename.from} إلى ${rename.to}`);
          await connection.execute(`RENAME TABLE \`${rename.from}\` TO \`${rename.to}\``);
          console.log(`✅ تم إعادة تسمية ${rename.from} إلى ${rename.to} بنجاح`);
        } catch (error: any) {
          console.error(`❌ خطأ في إعادة تسمية ${rename.from}:`, error.message);
        }
      } else if (existingTables.includes(rename.to)) {
        console.log(`⚠️  الجدول ${rename.to} موجود بالفعل`);
      } else {
        console.log(`⚠️  الجدول ${rename.from} غير موجود`);
      }
    }

    // إنشاء الجداول الناقصة
    const missingTables = [
      {
        name: 'drawingLayers',
        sql: `
          CREATE TABLE IF NOT EXISTS drawingLayers (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            drawing_id VARCHAR(191) NOT NULL,
            layer_id VARCHAR(191) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE,
            FOREIGN KEY (layer_id) REFERENCES layers(id) ON DELETE CASCADE,
            UNIQUE KEY unique_drawing_layer (drawing_id, layer_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      },
      {
        name: 'drawingPins',
        sql: `
          CREATE TABLE IF NOT EXISTS drawingPins (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            drawing_id VARCHAR(191) NOT NULL,
            pin_id VARCHAR(191) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE,
            FOREIGN KEY (pin_id) REFERENCES pins(id) ON DELETE CASCADE,
            UNIQUE KEY unique_drawing_pin (drawing_id, pin_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      },
      {
        name: 'savedViews',
        sql: `
          CREATE TABLE IF NOT EXISTS savedViews (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            user_id VARCHAR(191) NOT NULL,
            name VARCHAR(255) NOT NULL,
            view_data JSON NOT NULL,
            is_public BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_id (user_id),
            INDEX idx_public (is_public)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      }
    ];

    // التحقق من الجداول المحدثة
    const [updatedTables] = await connection.execute("SHOW TABLES");
    const updatedTableNames = (updatedTables as any[]).map((row: any) => Object.values(row)[0]);

    for (const table of missingTables) {
      if (!updatedTableNames.includes(table.name)) {
        try {
          console.log(`🔧 إنشاء جدول: ${table.name}`);
          await connection.execute(table.sql);
          console.log(`✅ تم إنشاء جدول ${table.name} بنجاح`);
        } catch (error: any) {
          console.error(`❌ خطأ في إنشاء جدول ${table.name}:`, error.message);
        }
      }
    }

    console.log('\n🎉 تم إصلاح أسماء الجداول بنجاح!');
    
    // التحقق من النتيجة النهائية
    console.log('\n📊 التحقق من النتيجة النهائية:');
    const [finalTables] = await connection.execute("SHOW TABLES");
    const finalTableNames = (finalTables as any[]).map((row: any) => Object.values(row)[0]);
    console.log(`إجمالي الجداول: ${finalTableNames.length}`);
    console.log('الجداول الموجودة:', finalTableNames.sort());

  } catch (error) {
    console.error('❌ خطأ في إصلاح أسماء الجداول:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// تشغيل الدالة
if (import.meta.url === `file://${process.argv[1]}`) {
  fixTableNames().catch(console.error);
}

export { fixTableNames };
