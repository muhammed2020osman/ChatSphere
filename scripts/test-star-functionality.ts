import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chatsphere',
  port: parseInt(process.env.DB_PORT || '3306'),
};

async function testStarFunctionality() {
  console.log('🧪 اختبار وظيفة النجمة...');
  
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ تم الاتصال بقاعدة البيانات');

    const testMessageId = 'test-message-' + Date.now();
    const testUserId = 'test-user-' + Date.now();

    console.log(`📝 اختبار مع Message ID: ${testMessageId}`);
    console.log(`👤 اختبار مع User ID: ${testUserId}`);

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

testStarFunctionality()
  .then(() => {
    console.log('✅ تم الانتهاء من اختبار وظيفة النجمة');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 فشل في اختبار وظيفة النجمة:', error);
    process.exit(1);
  });
