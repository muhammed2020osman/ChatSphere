import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

async function addDirectMessageIdColumn() {
  let connection;
  
  try {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL not found in environment');
    }

    // Parse DATABASE_URL
    const url = new URL(DATABASE_URL);
    connection = await mysql.createConnection({
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
    });

    console.log('🔧 Checking for direct_message_id column...');

    // Check if column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'notifications' 
      AND COLUMN_NAME = 'direct_message_id'
    `);

    if ((columns as any[]).length === 0) {
      console.log('⚠️  direct_message_id column not found. Adding it...');
      
      // Add direct_message_id column
      await connection.execute(`
        ALTER TABLE notifications 
        ADD COLUMN direct_message_id INT NULL AFTER channel_id
      `);
      
      console.log('✅ direct_message_id column added');
    } else {
      console.log('✅ direct_message_id column already exists');
    }

    // Show table structure
    const [tableStructure] = await connection.execute('DESCRIBE notifications');
    console.log('\n📋 Current notifications table structure:');
    console.table(tableStructure);

    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addDirectMessageIdColumn()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

