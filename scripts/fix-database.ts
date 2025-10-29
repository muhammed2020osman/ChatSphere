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

async function fixDatabase() {
  console.log('🔧 بدء إصلاح قاعدة البيانات...');
  
  let connection: mysql.Connection | null = null;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');

    // قائمة الجداول الناقصة والمشاكل
    const fixes = [
      // 1. إصلاح جدول layers - إضافة الحقول الناقصة
      {
        table: 'layers',
        action: 'fix_columns',
        sql: `
          ALTER TABLE layers 
          ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'layer',
          ADD COLUMN IF NOT EXISTS data JSON,
          DROP COLUMN IF EXISTS description,
          DROP COLUMN IF EXISTS color
        `
      },
      
      // 2. إصلاح جدول pins - تغيير نوع data من text إلى json
      {
        table: 'pins',
        action: 'fix_data_type',
        sql: `
          ALTER TABLE pins 
          MODIFY COLUMN data JSON
        `
      },
      
      // 3. إنشاء جدول drawingLayers
      {
        table: 'drawingLayers',
        action: 'create_table',
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
      
      // 4. إنشاء جدول drawingPins
      {
        table: 'drawingPins',
        action: 'create_table',
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
      
      // 5. إنشاء جدول savedViews
      {
        table: 'savedViews',
        action: 'create_table',
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
      },
      
      // 6. إنشاء جدول drawings (إذا لم يكن موجود)
      {
        table: 'drawings',
        action: 'create_table',
        sql: `
          CREATE TABLE IF NOT EXISTS drawings (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            project_id VARCHAR(191),
            created_by VARCHAR(191) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_project_id (project_id),
            INDEX idx_created_by (created_by)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      },
      
      // 7. إنشاء جدول tickets (إذا لم يكن موجود)
      {
        table: 'tickets',
        action: 'create_table',
        sql: `
          CREATE TABLE IF NOT EXISTS tickets (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            title VARCHAR(255) NOT NULL,
            description TEXT,
            status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
            priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
            assigned_to VARCHAR(191),
            created_by VARCHAR(191) NOT NULL,
            project_id VARCHAR(191),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
            INDEX idx_status (status),
            INDEX idx_priority (priority),
            INDEX idx_assigned_to (assigned_to),
            INDEX idx_project_id (project_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      },
      
      // 8. إنشاء جدول directMessages (إذا لم يكن موجود)
      {
        table: 'directMessages',
        action: 'create_table',
        sql: `
          CREATE TABLE IF NOT EXISTS directMessages (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            sender_id VARCHAR(191) NOT NULL,
            recipient_id VARCHAR(191) NOT NULL,
            content TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_sender_id (sender_id),
            INDEX idx_recipient_id (recipient_id),
            INDEX idx_created_at (created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      },
      
      // 9. إنشاء جدول channelMembers (إذا لم يكن موجود)
      {
        table: 'channelMembers',
        action: 'create_table',
        sql: `
          CREATE TABLE IF NOT EXISTS channelMembers (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            channel_id VARCHAR(191) NOT NULL,
            user_id VARCHAR(191) NOT NULL,
            role ENUM('admin', 'moderator', 'member') DEFAULT 'member',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_channel_user (channel_id, user_id),
            INDEX idx_channel_id (channel_id),
            INDEX idx_user_id (user_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      },
      
      // 10. إنشاء جدول reactions (إذا لم يكن موجود)
      {
        table: 'reactions',
        action: 'create_table',
        sql: `
          CREATE TABLE IF NOT EXISTS reactions (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            message_id VARCHAR(191) NOT NULL,
            user_id VARCHAR(191) NOT NULL,
            emoji VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_message_user_emoji (message_id, user_id, emoji),
            INDEX idx_message_id (message_id),
            INDEX idx_user_id (user_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      },
      
      // 11. إنشاء جدول notifications (إذا لم يكن موجود)
      {
        table: 'notifications',
        action: 'create_table',
        sql: `
          CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            user_id VARCHAR(191) NOT NULL,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT,
            data JSON,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_id (user_id),
            INDEX idx_is_read (is_read),
            INDEX idx_created_at (created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      },
      
      // 12. إنشاء جدول starredMessages (إذا لم يكن موجود)
      {
        table: 'starredMessages',
        action: 'create_table',
        sql: `
          CREATE TABLE IF NOT EXISTS starredMessages (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            message_id VARCHAR(191) NOT NULL,
            user_id VARCHAR(191) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_message_user (message_id, user_id),
            INDEX idx_user_id (user_id),
            INDEX idx_created_at (created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      },
      
      // 13. إنشاء جدول attachments (إذا لم يكن موجود)
      {
        table: 'attachments',
        action: 'create_table',
        sql: `
          CREATE TABLE IF NOT EXISTS attachments (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            message_id VARCHAR(191) NOT NULL,
            filename VARCHAR(255) NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            size BIGINT NOT NULL,
            url TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            INDEX idx_message_id (message_id),
            INDEX idx_created_at (created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      },
      
      // 14. إنشاء جدول projectMembers (إذا لم يكن موجود)
      {
        table: 'projectMembers',
        action: 'create_table',
        sql: `
          CREATE TABLE IF NOT EXISTS projectMembers (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            project_id VARCHAR(191) NOT NULL,
            user_id VARCHAR(191) NOT NULL,
            role ENUM('owner', 'admin', 'member', 'viewer') DEFAULT 'member',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_project_user (project_id, user_id),
            INDEX idx_project_id (project_id),
            INDEX idx_user_id (user_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      },
      
      // 15. إنشاء جدول drawingPages (إذا لم يكن موجود)
      {
        table: 'drawingPages',
        action: 'create_table',
        sql: `
          CREATE TABLE IF NOT EXISTS drawingPages (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            drawing_id VARCHAR(191) NOT NULL,
            page_number INT NOT NULL,
            title VARCHAR(255),
            content JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE,
            UNIQUE KEY unique_drawing_page (drawing_id, page_number),
            INDEX idx_drawing_id (drawing_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      },
      
      // 16. إنشاء جدول drawingAnnotations (إذا لم يكن موجود)
      {
        table: 'drawingAnnotations',
        action: 'create_table',
        sql: `
          CREATE TABLE IF NOT EXISTS drawingAnnotations (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            drawing_id VARCHAR(191) NOT NULL,
            page_id VARCHAR(191),
            user_id VARCHAR(191) NOT NULL,
            type VARCHAR(50) NOT NULL,
            data JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE,
            FOREIGN KEY (page_id) REFERENCES drawingPages(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_drawing_id (drawing_id),
            INDEX idx_page_id (page_id),
            INDEX idx_user_id (user_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      },
      
      // 17. إنشاء جدول drawingRevisions (إذا لم يكن موجود)
      {
        table: 'drawingRevisions',
        action: 'create_table',
        sql: `
          CREATE TABLE IF NOT EXISTS drawingRevisions (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            drawing_id VARCHAR(191) NOT NULL,
            revision_number INT NOT NULL,
            changes JSON NOT NULL,
            created_by VARCHAR(191) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_drawing_revision (drawing_id, revision_number),
            INDEX idx_drawing_id (drawing_id),
            INDEX idx_created_by (created_by)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      },
      
      // 18. إنشاء جدول drawingComments (إذا لم يكن موجود)
      {
        table: 'drawingComments',
        action: 'create_table',
        sql: `
          CREATE TABLE IF NOT EXISTS drawingComments (
            id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
            drawing_id VARCHAR(191) NOT NULL,
            user_id VARCHAR(191) NOT NULL,
            content TEXT NOT NULL,
            x_coordinate DECIMAL(10,2),
            y_coordinate DECIMAL(10,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_drawing_id (drawing_id),
            INDEX idx_user_id (user_id),
            INDEX idx_created_at (created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `
      }
    ];

    // تنفيذ الإصلاحات
    for (const fix of fixes) {
      try {
        console.log(`🔧 ${fix.action === 'create_table' ? 'إنشاء' : 'إصلاح'} جدول: ${fix.table}`);
        await connection.execute(fix.sql);
        console.log(`✅ تم ${fix.action === 'create_table' ? 'إنشاء' : 'إصلاح'} جدول ${fix.table} بنجاح`);
      } catch (error: any) {
        if (error.code === 'ER_TABLE_EXISTS' || error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠️  جدول ${fix.table} موجود بالفعل أو الحقل موجود`);
        } else {
          console.error(`❌ خطأ في ${fix.action === 'create_table' ? 'إنشاء' : 'إصلاح'} جدول ${fix.table}:`, error.message);
        }
      }
    }

    console.log('\n🎉 تم إصلاح قاعدة البيانات بنجاح!');
    
    // التحقق من النتيجة
    console.log('\n📊 التحقق من النتيجة:');
    const [tables] = await connection.execute("SHOW TABLES");
    const tableNames = (tables as any[]).map((row: any) => Object.values(row)[0]);
    console.log(`إجمالي الجداول: ${tableNames.length}`);
    console.log('الجداول الموجودة:', tableNames.sort());

  } catch (error) {
    console.error('❌ خطأ في إصلاح قاعدة البيانات:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// تشغيل الدالة
if (import.meta.url === `file://${process.argv[1]}`) {
  fixDatabase().catch(console.error);
}

export { fixDatabase };
