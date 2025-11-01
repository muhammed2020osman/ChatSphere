import 'dotenv/config';
import mysql from 'mysql2/promise';

// Parse DATABASE_URL
let url: URL;
try {
  url = new URL(process.env.DATABASE_URL || '');
} catch (error) {
  throw new Error(`Invalid DATABASE_URL format: ${process.env.DATABASE_URL}`);
}

const config = {
  host: url.hostname,
  port: parseInt(url.port || '3306'),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  multipleStatements: true,
  charset: 'utf8mb4',
};

async function addInvitationCodeColumn() {
  console.log('🔄 Adding invitation_code column to companies table...\n');
  
  let connection: mysql.Connection | null = null;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ Database connection established\n');
    
    // Check if column exists
    const [columns] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'invitation_code'`,
      [config.database]
    );
    
    if (columns.length > 0) {
      console.log('✅ Column invitation_code already exists');
    } else {
      // Add column
      await connection.execute(`
        ALTER TABLE companies 
        ADD COLUMN invitation_code VARCHAR(50) NULL
      `);
      console.log('✅ Added invitation_code column');
    }
    
    // Check if index exists
    const [indexes] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'companies' AND INDEX_NAME = 'idx_companies_invitation_code'`,
      [config.database]
    );
    
    if (indexes.length > 0) {
      console.log('✅ Index idx_companies_invitation_code already exists');
    } else {
      // Add index
      await connection.execute(`
        CREATE INDEX idx_companies_invitation_code ON companies(invitation_code)
      `);
      console.log('✅ Added index idx_companies_invitation_code');
    }
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addInvitationCodeColumn();
}

