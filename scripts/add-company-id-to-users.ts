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
  debug: false,
  protocol41: true,
};

async function addCompanyIdToUsers() {
  console.log('🔧 إضافة company_id إلى جدول users...\n');
  
  let connection: mysql.Connection | null = null;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح\n');

    // 1. التحقق من وجود جدول users
    console.log('🔍 التحقق من وجود جدول users...');
    const [tables] = await connection.execute<any[]>(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = ? AND table_name = 'users'`,
      [config.database]
    );
    
    if (tables[0].count === 0) {
      console.log('⚠️  جدول users غير موجود. سيتم إنشاؤه في initializeDatabase.');
      return;
    }
    console.log('✅ جدول users موجود\n');

    // 2. التحقق من وجود جدول companies
    console.log('🔍 التحقق من وجود جدول companies...');
    const [companiesTables] = await connection.execute<any[]>(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = ? AND table_name = 'companies'`,
      [config.database]
    );
    
    if (companiesTables[0].count === 0) {
      console.log('⚠️  جدول companies غير موجود. يجب إنشاؤه أولاً.');
      return;
    }
    console.log('✅ جدول companies موجود\n');

    // 3. الحصول على أول company_id (أو إنشاء company افتراضي)
    console.log('🔍 الحصول على company_id افتراضي...');
    const [companies] = await connection.execute<any[]>(
      'SELECT id FROM companies LIMIT 1'
    );
    
    let defaultCompanyId = 1;
    if (companies.length > 0) {
      defaultCompanyId = companies[0].id;
      console.log(`✅ تم العثور على company_id: ${defaultCompanyId}\n`);
    } else {
      console.log('⚠️  لا توجد companies. سيتم استخدام company_id = 1 كافتراضي\n');
    }

    // 4. التحقق من وجود عمود company_id
    console.log('🔍 التحقق من وجود عمود company_id...');
    const [columns] = await connection.execute<any[]>(
      `SELECT COUNT(*) as count FROM information_schema.columns 
       WHERE table_schema = ? AND table_name = 'users' AND column_name = 'company_id'`,
      [config.database]
    );
    
    if (columns[0].count > 0) {
      console.log('✅ عمود company_id موجود بالفعل. لا حاجة لإضافته.\n');
      
      // التحقق من وجود foreign key
      const [fks] = await connection.execute<any[]>(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints 
         WHERE table_schema = ? AND table_name = 'users' 
         AND constraint_name = 'users_company_id_companies_id_fk' 
         AND constraint_type = 'FOREIGN KEY'`,
        [config.database]
      );
      
      if (fks[0].count === 0) {
        console.log('➕ إضافة foreign key constraint...');
        await connection.execute(`
          ALTER TABLE users 
          ADD CONSTRAINT users_company_id_companies_id_fk 
          FOREIGN KEY (company_id) REFERENCES companies(id)
        `);
        console.log('✅ تم إضافة foreign key constraint\n');
      } else {
        console.log('✅ foreign key constraint موجود بالفعل\n');
      }
      
      return;
    }
    console.log('⚠️  عمود company_id غير موجود. سيتم إضافته...\n');

    // 5. إضافة عمود company_id
    console.log('➕ إضافة عمود company_id...');
    await connection.execute(`
      ALTER TABLE users 
      ADD COLUMN company_id INT NOT NULL DEFAULT ${defaultCompanyId}
      AFTER id
    `);
    console.log('✅ تم إضافة عمود company_id\n');

    // 6. تحديث البيانات الموجودة
    console.log('🔄 تحديث البيانات الموجودة...');
    const [updateResult] = await connection.execute<any[]>(
      `UPDATE users SET company_id = ? WHERE company_id IS NULL OR company_id = 0`,
      [defaultCompanyId]
    );
    console.log(`✅ تم تحديث ${(updateResult as any).affectedRows || 0} سجل\n`);

    // 7. إضافة foreign key constraint
    console.log('➕ إضافة foreign key constraint...');
    try {
      await connection.execute(`
        ALTER TABLE users 
        ADD CONSTRAINT users_company_id_companies_id_fk 
        FOREIGN KEY (company_id) REFERENCES companies(id)
      `);
      console.log('✅ تم إضافة foreign key constraint\n');
    } catch (error: any) {
      if (error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  foreign key constraint موجود بالفعل\n');
      } else {
        throw error;
      }
    }

    // 8. إضافة index
    console.log('➕ إضافة index على company_id...');
    try {
      await connection.execute(`
        CREATE INDEX idx_users_company ON users (company_id)
      `);
      console.log('✅ تم إضافة index\n');
    } catch (error: any) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  index موجود بالفعل\n');
      } else {
        throw error;
      }
    }

    // 9. تحديث unique index على email ليشمل company_id
    console.log('🔄 تحديث unique index على email...');
    try {
      // حذف index القديم إذا كان موجوداً
      await connection.execute(`
        ALTER TABLE users DROP INDEX idx_users_email
      `).catch(() => {}); // تجاهل الخطأ إذا لم يكن موجوداً
      
      // إضافة unique index جديد على email و company_id
      await connection.execute(`
        CREATE UNIQUE INDEX idx_users_email_company ON users (email, company_id)
      `);
      console.log('✅ تم تحديث unique index\n');
    } catch (error: any) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  unique index موجود بالفعل\n');
      } else {
        console.log(`⚠️  خطأ في تحديث unique index: ${error.message}\n`);
      }
    }

    console.log('✅ تم إكمال migration بنجاح!\n');
    
  } catch (error: any) {
    console.error('❌ خطأ في migration:', error.message);
    console.error('Error code:', error.code);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ تم إغلاق الاتصال بقاعدة البيانات\n');
    }
  }
}

// Run migration
addCompanyIdToUsers()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

