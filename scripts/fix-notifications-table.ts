import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

async function fixNotificationsTable() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'chatsphere',
    });

    console.log('🔧 Checking notifications table structure...');

    // Check if company_id column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'notifications' 
      AND COLUMN_NAME = 'company_id'
    `);

    if ((columns as any[]).length === 0) {
      console.log('⚠️  company_id column not found. Adding it...');
      
      // Add company_id column
      await connection.execute(`
        ALTER TABLE notifications 
        ADD COLUMN company_id INT NOT NULL AFTER id
      `);
      
      console.log('✅ company_id column added');
      
      // Set default value for existing rows (you may need to adjust this)
      // For now, we'll set it to 1 as a default
      await connection.execute(`
        UPDATE notifications 
        SET company_id = 1 
        WHERE company_id IS NULL OR company_id = 0
      `);
      
      console.log('✅ Set default company_id for existing rows');
    } else {
      console.log('✅ company_id column already exists');
    }

    // Check if foreign key exists
    const [constraints] = await connection.execute(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'notifications' 
      AND CONSTRAINT_NAME = 'fk_notifications_company'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    `);

    if ((constraints as any[]).length === 0) {
      console.log('⚠️  Foreign key not found. Adding it...');
      
      try {
        await connection.execute(`
          ALTER TABLE notifications 
          ADD CONSTRAINT fk_notifications_company 
          FOREIGN KEY (company_id) REFERENCES companies(id)
        `);
        console.log('✅ Foreign key added');
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME' || error.message?.includes('Duplicate key name')) {
          console.log('⚠️  Foreign key already exists (different name)');
        } else {
          throw error;
        }
      }
    } else {
      console.log('✅ Foreign key already exists');
    }

    // Check if index exists
    const [indexes] = await connection.execute(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'notifications' 
      AND INDEX_NAME = 'idx_notifications_company'
    `);

    if ((indexes as any[]).length === 0) {
      console.log('⚠️  Index not found. Adding it...');
      
      await connection.execute(`
        CREATE INDEX idx_notifications_company ON notifications (company_id)
      `);
      console.log('✅ Index added');
    } else {
      console.log('✅ Index already exists');
    }

    // Show table structure
    const [tableStructure] = await connection.execute('DESCRIBE notifications');
    console.log('\n📋 Current notifications table structure:');
    console.table(tableStructure);

    console.log('\n✅ Notifications table fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing notifications table:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
fixNotificationsTable()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });

