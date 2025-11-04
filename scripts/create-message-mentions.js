const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chatsphere',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

async function createMessageMentionsTable() {
  let connection = null;
  
  try {
    console.log('🔗 Connecting to database...');
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
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'message_mentions'
    `, [config.database]);
    
    if (tables.length > 0) {
      console.log('✅ Verification: Table exists in database');
    } else {
      console.log('⚠️  Warning: Table not found after creation');
    }
    
  } catch (error) {
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

