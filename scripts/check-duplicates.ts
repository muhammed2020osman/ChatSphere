import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chatsphere',
  port: parseInt(process.env.DB_PORT || '3306'),
};

async function checkDuplicates() {
  console.log('🔍 فحص السجلات المكررة في starred_messages...');
  
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ تم الاتصال بقاعدة البيانات');

    // فحص السجلات المكررة
    const [duplicates] = await connection.execute(`
      SELECT message_id, user_id, COUNT(*) as count 
      FROM starred_messages 
      GROUP BY message_id, user_id 
      HAVING count > 1
    `);
    
    if ((duplicates as any[]).length > 0) {
      console.log('❌ تم العثور على سجلات مكررة:');
      (duplicates as any[]).forEach((dup, index) => {
        console.log(`   ${index + 1}. Message: ${dup.message_id}, User: ${dup.user_id}, Count: ${dup.count}`);
      });
    } else {
      console.log('✅ لا توجد سجلات مكررة');
    }

    // عرض إجمالي السجلات
    const [total] = await connection.execute(`
      SELECT COUNT(*) as total FROM starred_messages
    `);
    console.log(`📊 إجمالي السجلات: ${(total as any)[0].total}`);

    // عرض آخر 10 سجلات
    const [recent] = await connection.execute(`
      SELECT message_id, user_id, created_at 
      FROM starred_messages 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('📋 آخر 10 سجلات:');
    (recent as any[]).forEach((record, index) => {
      console.log(`   ${index + 1}. Message: ${record.message_id}, User: ${record.user_id}, Time: ${record.created_at}`);
    });

  } catch (error) {
    console.error('❌ خطأ في فحص السجلات:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkDuplicates()
  .then(() => {
    console.log('🎉 تم الانتهاء من الفحص');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 فشل في الفحص:', error);
    process.exit(1);
  });
