import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chatsphere',
  port: parseInt(process.env.DB_PORT || '3306'),
};

async function fixStarredMessages() {
  console.log('🔧 إصلاح جدول starred_messages...');
  
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ تم الاتصال بقاعدة البيانات');

    // 1. إزالة السجلات المكررة
    console.log('🧹 إزالة السجلات المكررة...');
    await connection.execute(`
      DELETE sm1 FROM starred_messages sm1
      INNER JOIN starred_messages sm2 
      WHERE sm1.id > sm2.id 
      AND sm1.message_id = sm2.message_id 
      AND sm1.user_id = sm2.user_id
    `);
    console.log('✅ تم إزالة السجلات المكررة');

    // 2. إضافة constraint فريد إذا لم يكن موجود
    console.log('🔒 إضافة constraint فريد...');
    try {
      await connection.execute(`
        ALTER TABLE starred_messages 
        ADD UNIQUE KEY unique_message_user (message_id, user_id)
      `);
      console.log('✅ تم إضافة constraint فريد');
    } catch (error: any) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️ constraint فريد موجود بالفعل');
      } else {
        throw error;
      }
    }

    // 3. إضافة فهارس لتحسين الأداء
    console.log('📊 إضافة فهارس...');
    try {
      await connection.execute(`
        ALTER TABLE starred_messages 
        ADD INDEX idx_user_id (user_id)
      `);
      console.log('✅ تم إضافة فهرس user_id');
    } catch (error: any) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️ فهرس user_id موجود بالفعل');
      } else {
        throw error;
      }
    }

    try {
      await connection.execute(`
        ALTER TABLE starred_messages 
        ADD INDEX idx_created_at (created_at)
      `);
      console.log('✅ تم إضافة فهرس created_at');
    } catch (error: any) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️ فهرس created_at موجود بالفعل');
      } else {
        throw error;
      }
    }

    // 4. عرض إحصائيات الجدول
    const [rows] = await connection.execute(`
      SELECT 
        COUNT(*) as total_stars,
        COUNT(DISTINCT message_id) as unique_messages,
        COUNT(DISTINCT user_id) as unique_users
      FROM starred_messages
    `);
    
    console.log('📈 إحصائيات الجدول:');
    console.log(`   - إجمالي النجوم: ${(rows as any)[0].total_stars}`);
    console.log(`   - الرسائل المميزة: ${(rows as any)[0].unique_messages}`);
    console.log(`   - المستخدمين: ${(rows as any)[0].unique_users}`);

    console.log('✅ تم إصلاح جدول starred_messages بنجاح!');

  } catch (error) {
    console.error('❌ خطأ في إصلاح الجدول:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// تشغيل السكريبت
fixStarredMessages()
  .then(() => {
    console.log('🎉 تم الانتهاء من إصلاح الجدول');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 فشل في إصلاح الجدول:', error);
    process.exit(1);
  });

export { fixStarredMessages };
