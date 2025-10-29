import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chatsphere',
  port: parseInt(process.env.DB_PORT || '3306'),
};

async function testStarWithRealMessage() {
  console.log('🧪 اختبار وظيفة النجمة مع رسالة حقيقية...');
  
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ تم الاتصال بقاعدة البيانات');

    // إنشاء رسالة تجريبية
    const testMessageId = 'test-message-' + Date.now();
    const testUserId = 'test-user-' + Date.now();
    const testChannelId = 'test-channel-' + Date.now();

    console.log(`📝 إنشاء رسالة تجريبية...`);
    console.log(`   Message ID: ${testMessageId}`);
    console.log(`   User ID: ${testUserId}`);
    console.log(`   Channel ID: ${testChannelId}`);

    // إنشاء مستخدم تجريبي أولاً
    await connection.execute(`
      INSERT INTO users (id, email, first_name, last_name, profile_image_url, status, is_online, last_seen, role, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())
    `, [testUserId, 'test@example.com', 'Test', 'User', null, 'active', 1, 'user']);

    // إنشاء قناة تجريبية
    await connection.execute(`
      INSERT INTO channels (id, name, description, is_private, created_by) 
      VALUES (?, ?, ?, ?, ?)
    `, [testChannelId, 'Test Channel', 'Test channel for star testing', false, testUserId]);

    // إنشاء رسالة تجريبية
    await connection.execute(`
      INSERT INTO messages (id, content, channel_id, user_id, created_at) 
      VALUES (?, ?, ?, ?, NOW())
    `, [testMessageId, 'Test message for star testing', testChannelId, testUserId]);

    console.log('✅ تم إنشاء البيانات التجريبية');

    // 1. اختبار إضافة نجمة أولى
    console.log('\n1️⃣ إضافة نجمة أولى...');
    try {
      await connection.execute(`
        INSERT INTO starred_messages (message_id, user_id) 
        VALUES (?, ?)
      `, [testMessageId, testUserId]);
      console.log('✅ تم إضافة النجمة الأولى بنجاح');
    } catch (error: any) {
      console.log('❌ خطأ في إضافة النجمة الأولى:', error.message);
    }

    // 2. محاولة إضافة نفس النجمة مرة أخرى
    console.log('\n2️⃣ محاولة إضافة نفس النجمة مرة أخرى...');
    try {
      await connection.execute(`
        INSERT INTO starred_messages (message_id, user_id) 
        VALUES (?, ?)
      `, [testMessageId, testUserId]);
      console.log('❌ تم إضافة نجمة مكررة! هذا خطأ!');
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.log('✅ تم منع الإضافة المكررة بنجاح (ER_DUP_ENTRY)');
      } else {
        console.log('❌ خطأ غير متوقع:', error.message);
      }
    }

    // 3. فحص السجلات
    console.log('\n3️⃣ فحص السجلات...');
    const [records] = await connection.execute(`
      SELECT * FROM starred_messages 
      WHERE message_id = ? AND user_id = ?
    `, [testMessageId, testUserId]);
    
    console.log(`📊 عدد السجلات: ${(records as any[]).length}`);
    if ((records as any[]).length > 1) {
      console.log('❌ يوجد سجلات مكررة!');
      (records as any[]).forEach((record, index) => {
        console.log(`   ${index + 1}. ID: ${record.id}, Created: ${record.created_at}`);
      });
    } else {
      console.log('✅ لا توجد سجلات مكررة');
    }

    // 4. اختبار حذف النجمة
    console.log('\n4️⃣ حذف النجمة...');
    await connection.execute(`
      DELETE FROM starred_messages 
      WHERE message_id = ? AND user_id = ?
    `, [testMessageId, testUserId]);
    console.log('✅ تم حذف النجمة بنجاح');

    // 5. فحص السجلات بعد الحذف
    console.log('\n5️⃣ فحص السجلات بعد الحذف...');
    const [recordsAfterDelete] = await connection.execute(`
      SELECT * FROM starred_messages 
      WHERE message_id = ? AND user_id = ?
    `, [testMessageId, testUserId]);
    
    console.log(`📊 عدد السجلات بعد الحذف: ${(recordsAfterDelete as any[]).length}`);
    if ((recordsAfterDelete as any[]).length === 0) {
      console.log('✅ تم حذف جميع السجلات بنجاح');
    } else {
      console.log('❌ لم يتم حذف جميع السجلات');
    }

    // تنظيف البيانات التجريبية
    console.log('\n🧹 تنظيف البيانات التجريبية...');
    await connection.execute(`DELETE FROM starred_messages WHERE message_id = ?`, [testMessageId]);
    await connection.execute(`DELETE FROM messages WHERE id = ?`, [testMessageId]);
    await connection.execute(`DELETE FROM channels WHERE id = ?`, [testChannelId]);
    await connection.execute(`DELETE FROM users WHERE id = ?`, [testUserId]);
    console.log('✅ تم تنظيف البيانات التجريبية');

    console.log('\n🎉 تم الانتهاء من الاختبار');

  } catch (error) {
    console.error('❌ خطأ في الاختبار:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testStarWithRealMessage()
  .then(() => {
    console.log('✅ تم الانتهاء من اختبار وظيفة النجمة');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 فشل في اختبار وظيفة النجمة:', error);
    process.exit(1);
  });
