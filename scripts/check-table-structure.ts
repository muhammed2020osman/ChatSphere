import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chatsphere',
  port: parseInt(process.env.DB_PORT || '3306'),
};

async function checkTableStructure() {
  console.log('🔍 فحص هيكل الجداول...');
  
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ تم الاتصال بقاعدة البيانات');

    // فحص جدول المستخدمين
    console.log('\n👤 جدول المستخدمين (users):');
    const [usersStructure] = await connection.execute('DESCRIBE users');
    (usersStructure as any[]).forEach(row => {
      console.log(`   ${row.Field}: ${row.Type} ${row.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${row.Key ? `(${row.Key})` : ''}`);
    });

    // فحص جدول القنوات
    console.log('\n📺 جدول القنوات (channels):');
    const [channelsStructure] = await connection.execute('DESCRIBE channels');
    (channelsStructure as any[]).forEach(row => {
      console.log(`   ${row.Field}: ${row.Type} ${row.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${row.Key ? `(${row.Key})` : ''}`);
    });

    // فحص جدول الرسائل
    console.log('\n💬 جدول الرسائل (messages):');
    const [messagesStructure] = await connection.execute('DESCRIBE messages');
    (messagesStructure as any[]).forEach(row => {
      console.log(`   ${row.Field}: ${row.Type} ${row.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${row.Key ? `(${row.Key})` : ''}`);
    });

    // فحص جدول النجوم
    console.log('\n⭐ جدول النجوم (starred_messages):');
    const [starredStructure] = await connection.execute('DESCRIBE starred_messages');
    (starredStructure as any[]).forEach(row => {
      console.log(`   ${row.Field}: ${row.Type} ${row.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${row.Key ? `(${row.Key})` : ''}`);
    });

  } catch (error) {
    console.error('❌ خطأ في فحص الجداول:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkTableStructure()
  .then(() => {
    console.log('\n🎉 تم الانتهاء من فحص الجداول');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 فشل في فحص الجداول:', error);
    process.exit(1);
  });
