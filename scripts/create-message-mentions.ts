import mysql from 'mysql2/promise';
import 'dotenv/config';

// Parse DATABASE_URL or use individual config
function getDbConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    // Parse mysql://user:password@host:port/database
    const match = databaseUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (match) {
      return {
        host: match[3],
        port: parseInt(match[4]),
        user: match[1],
        password: match[2],
        database: match[5],
      };
    }
  }
  
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'chatsphere',
  };
}

async function createMessageMentionsTable() {
  let connection: mysql.Connection | null = null;
  
  try {
    const config = getDbConfig();
    console.log('🔗 Connecting to database...');
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   Database: ${config.database}`);
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to database');
    
    console.log('📋 Creating message_mentions table...');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS message_mentions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        company_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (company_id) REFERENCES companies(id),
        INDEX idx_message_mentions_message (message_id),
        INDEX idx_message_mentions_user (user_id),
        INDEX idx_message_mentions_company (company_id)
      )
    `);
    
    console.log('✅ Table message_mentions created successfully!');
    
    // Verify table exists
    const dbName = config.database;
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'message_mentions'
    `, [dbName]) as any;
    
    if (tables.length > 0) {
      console.log('✅ Verification: Table exists in database');
      
      // Show table structure
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'message_mentions'
        ORDER BY ORDINAL_POSITION
      `, [dbName]) as any;
      
      console.log('\n📊 Table structure:');
      console.table(columns);
    } else {
      console.log('⚠️  Warning: Table not found after creation');
    }
    
  } catch (error: any) {
    console.error('❌ Error creating table:', error.message);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('💡 Hint: Make sure tables "messages", "users", and "companies" exist first');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createMessageMentionsTable();

