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

async function addCompanyIdToReactions() {
  console.log('🔧 إضافة company_id إلى جدول reactions...\n');
  
  let connection: mysql.Connection | null = null;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح\n');

    // 1. التحقق من وجود جدول reactions
    console.log('🔍 التحقق من وجود جدول reactions...');
    const [tables] = await connection.execute<any[]>(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = ? AND table_name = 'reactions'`,
      [config.database]
    );
    
    if (tables[0].count === 0) {
      console.log('⚠️  جدول reactions غير موجود. سيتم إنشاؤه في migration script الأساسي.');
      return;
    }
    console.log('✅ جدول reactions موجود\n');

    // 2. التحقق من وجود عمود company_id
    console.log('🔍 التحقق من وجود عمود company_id...');
    const [columns] = await connection.execute<any[]>(
      `SELECT COUNT(*) as count FROM information_schema.columns 
       WHERE table_schema = ? AND table_name = 'reactions' AND column_name = 'company_id'`,
      [config.database]
    );
    
    if (columns[0].count > 0) {
      console.log('✅ عمود company_id موجود بالفعل. لا حاجة لإضافته.\n');
      return;
    }
    console.log('⚠️  عمود company_id غير موجود. سيتم إضافته...\n');

    // 3. إضافة عمود company_id
    console.log('➕ إضافة عمود company_id...');
    await connection.execute(`
      ALTER TABLE reactions 
      ADD COLUMN company_id INT NOT NULL DEFAULT 1
      AFTER id
    `);
    console.log('✅ تم إضافة عمود company_id\n');

    // 4. تحديث البيانات الموجودة (استخراج company_id من messages)
    console.log('🔄 تحديث البيانات الموجودة...');
    const [updateResult] = await connection.execute(`
      UPDATE reactions r
      INNER JOIN messages m ON r.message_id = m.id
      SET r.company_id = m.company_id
      WHERE r.company_id = 1 OR r.company_id IS NULL
    `);
    console.log(`✅ تم تحديث ${(updateResult as any).affectedRows || 0} سجلاً\n`);

    // 5. إضافة FOREIGN KEY constraint
    console.log('🔗 إضافة FOREIGN KEY constraint...');
    try {
      await connection.execute(`
        ALTER TABLE reactions
        ADD CONSTRAINT fk_reactions_company
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE
      `);
      console.log('✅ تم إضافة FOREIGN KEY constraint\n');
    } catch (error: any) {
      if (error.code === 'ER_DUP_KEYNAME' || error.code === '42000') {
        console.log('⚠️  FOREIGN KEY constraint موجود بالفعل أو حدث خطأ (سيتم تجاوزه)\n');
      } else {
        throw error;
      }
    }

    // 6. إضافة INDEX على company_id
    console.log('📊 إضافة INDEX على company_id...');
    try {
      await connection.execute(`
        ALTER TABLE reactions
        ADD INDEX idx_reactions_company (company_id)
      `);
      console.log('✅ تم إضافة INDEX\n');
    } catch (error: any) {
      if (error.code === 'ER_DUP_KEYNAME' || error.code === '42000') {
        console.log('⚠️  INDEX موجود بالفعل (سيتم تجاوزه)\n');
      } else {
        throw error;
      }
    }

    // 7. إزالة DEFAULT value (لأنه لم يعد مطلوباً بعد تحديث البيانات)
    console.log('🔧 تحديث DEFAULT value...');
    await connection.execute(`
      ALTER TABLE reactions
      MODIFY COLUMN company_id INT NOT NULL
    `);
    console.log('✅ تم تحديث DEFAULT value\n');

    console.log('✅ تم إضافة company_id إلى جدول reactions بنجاح!\n');
    
  } catch (error: any) {
    console.error('❌ خطأ أثناء إضافة company_id:', error);
    if (error.sqlMessage) {
      console.error('   SQL Error:', error.sqlMessage);
    }
    if (error.sql) {
      console.error('   SQL Query:', error.sql);
    }
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ تم إغلاق الاتصال بقاعدة البيانات\n');
    }
  }
}

// Run the migration
addCompanyIdToReactions()
  .then(() => {
    console.log('✅ اكتملت العملية بنجاح!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ فشلت العملية:', error);
    process.exit(1);
  });

