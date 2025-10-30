import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from "@shared/schema";

// Use MySQL for production
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Parse DATABASE_URL with error handling
let url: URL;
try {
  url = new URL(process.env.DATABASE_URL);
} catch (error) {
  throw new Error(
    `Invalid DATABASE_URL format: ${process.env.DATABASE_URL}. Expected format: mysql://username:password@host:port/database`
  );
}

const config = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1), // Remove leading slash
  // Connection pool settings for external database
  connectionLimit: 10, // Increased for better performance
  // Additional settings for external connections
  multipleStatements: false,
  charset: 'utf8mb4',
  // SSL configuration - disable for development
  // ssl: false, // Remove invalid ssl option
  // Add connection timeout
  connectTimeout: 30000,
  // Add idle timeout
  idleTimeout: 300000, // 5 minutes
  // Enable keep-alive
  keepAliveInitialDelay: 0,
  enableKeepAlive: true,
  // Additional MySQL-specific settings
  timezone: 'Z',
  dateStrings: false,
  supportBigNumbers: true,
  bigNumberStrings: true,
  // Debug mode for troubleshooting
  debug: process.env.NODE_ENV === 'development' ? ['ComProtocol'] : false,
  // Additional connection options that might help with permissions
  authPlugins: {
    mysql_native_password: () => () => Buffer.from(url.password)
  },
  // Additional authentication options
  authSwitchHandler: (data: any, cb: any) => {
    if (data.pluginName === 'mysql_native_password') {
      const password = Buffer.from(url.password);
      const token = Buffer.from(data.authPluginData.slice(0, 20));
      const hash = require('crypto').createHash('sha1');
      hash.update(password);
      hash.update(token);
      cb(null, hash.digest());
    }
  }
};

// Create connection pool with error handling
export const pool = mysql.createPool(config);

// Test connection on startup
pool.getConnection()
  .then((connection) => {
    console.log('✅ MySQL database connected successfully');
    connection.release();
  })
  .catch((error) => {
    console.error('❌ Failed to connect to MySQL database:', error.message);
    console.error('Error code:', error.code);
    console.error('Please check your DATABASE_URL and MySQL server settings');
    console.error('Application will fail to serve data until database connection is established');
    // Don't exit - let the app continue and show proper error messages
  });

export const db = drizzle(pool, { schema, mode: "default" });

// Function to initialize database tables and data
export async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database tables and data...');
    
    // Test connection first
    const connection = await pool.getConnection();
    console.log('✅ Database connection established');
    
    // Create tables if they don't exist using raw SQL
    console.log('📋 Creating tables if they don\'t exist...');
    
    // Create sessions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR(191) PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP NOT NULL,
        INDEX IDX_session_expire (expire)
      )
    `);
    
    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        profile_image_url TEXT,
        status VARCHAR(50),
        is_online BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP,
        role VARCHAR(20) DEFAULT 'member' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_users_email (email)
      )
    `);
    
    // Create disciplines table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS disciplines (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        code VARCHAR(20),
        color VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create floors table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS floors (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(100) NOT NULL,
        level VARCHAR(20) NOT NULL,
        description TEXT,
        project_id VARCHAR(191),
        sort_order VARCHAR(10) DEFAULT '0',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create projects table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_by VARCHAR(191) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    
    // Create channels table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS channels (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_private BOOLEAN DEFAULT FALSE NOT NULL,
        created_by VARCHAR(191) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    
    // Create channel_members table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS channel_members (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        channel_id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_id) REFERENCES channels(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    
    // Create messages table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        content TEXT NOT NULL,
        channel_id VARCHAR(191),
        user_id VARCHAR(191) NOT NULL,
        reply_to_id VARCHAR(191),
        attachment_url TEXT,
        attachment_type VARCHAR(100),
        attachment_name VARCHAR(255),
        thread_parent_id VARCHAR(191),
        mentions JSON DEFAULT (JSON_ARRAY()),
        edited_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_id) REFERENCES channels(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    
    // Create direct_messages table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        content TEXT NOT NULL,
        from_user_id VARCHAR(191) NOT NULL,
        to_user_id VARCHAR(191) NOT NULL,
        reply_to_id VARCHAR(191),
        attachment_url TEXT,
        attachment_type VARCHAR(100),
        attachment_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users(id),
        FOREIGN KEY (to_user_id) REFERENCES users(id)
      )
    `);
    
    // Create reactions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS reactions (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        message_id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        icon VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    
    // Create notifications table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        user_id VARCHAR(191) NOT NULL,
        type VARCHAR(50) NOT NULL,
        message_id VARCHAR(191),
        channel_id VARCHAR(191),
        from_user_id VARCHAR(191),
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (message_id) REFERENCES messages(id),
        FOREIGN KEY (channel_id) REFERENCES channels(id),
        FOREIGN KEY (from_user_id) REFERENCES users(id)
      )
    `);
    
    // Create starred_messages table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS starred_messages (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        message_id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE KEY unique_message_user (message_id, user_id)
      )
    `);
    
    // Create attachments table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS attachments (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size VARCHAR(20) NOT NULL,
        url TEXT NOT NULL,
        message_id VARCHAR(191),
        created_by VARCHAR(191) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    
    // Create drawings table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS drawings (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        data JSON NOT NULL,
        discipline_id VARCHAR(191),
        floor_id VARCHAR(191),
        created_by VARCHAR(191) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (discipline_id) REFERENCES disciplines(id),
        FOREIGN KEY (floor_id) REFERENCES floors(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    
    // Create drawing_revisions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS drawing_revisions (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        drawing_id VARCHAR(191) NOT NULL,
        version VARCHAR(20) NOT NULL,
        changes JSON NOT NULL,
        status VARCHAR(50) DEFAULT 'draft' NOT NULL,
        file_url TEXT,
        thumbnail_url TEXT,
        file_name VARCHAR(255),
        file_type VARCHAR(100),
        file_size VARCHAR(20),
        ai_extracted_data JSON,
        uploaded_by VARCHAR(191),
        reviewed_by VARCHAR(191),
        review_notes TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        created_by VARCHAR(191) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (drawing_id) REFERENCES drawings(id),
        FOREIGN KEY (uploaded_by) REFERENCES users(id),
        FOREIGN KEY (reviewed_by) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    
    // Create drawing_pages table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS drawing_pages (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        revision_id VARCHAR(191) NOT NULL,
        page_number VARCHAR(10) NOT NULL,
        image_url TEXT NOT NULL,
        thumbnail_url TEXT,
        extracted_text TEXT,
        extracted_metadata JSON,
        ai_extracted_data JSON,
        width VARCHAR(20),
        height VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (revision_id) REFERENCES drawing_revisions(id)
      )
    `);
    
    // Create drawing_annotations table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS drawing_annotations (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        drawing_id VARCHAR(191) NOT NULL,
        page_id VARCHAR(191),
        type VARCHAR(50) NOT NULL,
        data JSON NOT NULL,
        created_by VARCHAR(191) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (drawing_id) REFERENCES drawings(id),
        FOREIGN KEY (page_id) REFERENCES drawing_pages(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    
    // Create drawing_comments table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS drawing_comments (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        drawing_id VARCHAR(191) NOT NULL,
        content TEXT NOT NULL,
        x VARCHAR(20),
        y VARCHAR(20),
        created_by VARCHAR(191) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (drawing_id) REFERENCES drawings(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    
    // Create rooms table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(100) NOT NULL,
        floor_id VARCHAR(191) NOT NULL,
        area VARCHAR(20),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (floor_id) REFERENCES floors(id)
      )
    `);
    
    // Create layers table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS layers (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        data JSON NOT NULL,
        drawing_id VARCHAR(191) NOT NULL,
        visible BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(191) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (drawing_id) REFERENCES drawings(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    
    // Create drawing_layers table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS drawing_layers (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        drawing_id VARCHAR(191) NOT NULL,
        layer_id VARCHAR(191) NOT NULL,
        \`order\` VARCHAR(10) NOT NULL,
        visible BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (drawing_id) REFERENCES drawings(id),
        FOREIGN KEY (layer_id) REFERENCES layers(id)
      )
    `);
    
    // Create pins table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS pins (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(100) NOT NULL,
        x VARCHAR(20) NOT NULL,
        y VARCHAR(20) NOT NULL,
        type VARCHAR(50) NOT NULL,
        data JSON,
        drawing_id VARCHAR(191) NOT NULL,
        layer_id VARCHAR(191),
        created_by VARCHAR(191) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (drawing_id) REFERENCES drawings(id),
        FOREIGN KEY (layer_id) REFERENCES layers(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    
    // Create drawing_pins table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS drawing_pins (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        drawing_id VARCHAR(191) NOT NULL,
        pin_id VARCHAR(191) NOT NULL,
        x VARCHAR(20) NOT NULL,
        y VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (drawing_id) REFERENCES drawings(id),
        FOREIGN KEY (pin_id) REFERENCES pins(id)
      )
    `);
    
    // Create tickets table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tickets (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) DEFAULT 'issue' NOT NULL,
        status VARCHAR(50) DEFAULT 'open' NOT NULL,
        priority VARCHAR(50) DEFAULT 'medium' NOT NULL,
        drawing_id VARCHAR(191),
        discipline_id VARCHAR(191),
        pin_id VARCHAR(191),
        layer_id VARCHAR(191),
        assigned_to VARCHAR(191),
        created_by VARCHAR(191) NOT NULL,
        reporter VARCHAR(191),
        channel_id VARCHAR(191),
        sla_hours VARCHAR(10),
        due_date TIMESTAMP,
        tags JSON DEFAULT (JSON_ARRAY()),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (drawing_id) REFERENCES drawings(id),
        FOREIGN KEY (discipline_id) REFERENCES disciplines(id),
        FOREIGN KEY (pin_id) REFERENCES pins(id),
        FOREIGN KEY (layer_id) REFERENCES layers(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (reporter) REFERENCES users(id),
        FOREIGN KEY (channel_id) REFERENCES channels(id)
      )
    `);
    
    // Create saved_views table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS saved_views (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        data JSON NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        is_shared BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    
    // Create project_members table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS project_members (
        id VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
        project_id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    
    console.log('✅ Tables created successfully');
    
    // Add initial disciplines if they don't exist
    try {
      const [disciplines] = await connection.execute('SELECT COUNT(*) as count FROM disciplines');
      const count = (disciplines as any)[0]?.count || 0;
      
      if (count === 0) {
        console.log('📝 Adding initial disciplines...');
        await connection.execute(`
          INSERT INTO disciplines (id, name, description, code, color, created_at) VALUES
          ('disc-1', 'Architecture', 'Architectural drawings', 'ARCH', '#3B82F6', NOW()),
          ('disc-2', 'Structural', 'Structural engineering', 'STR', '#10B981', NOW()),
          ('disc-3', 'MEP', 'Mechanical, Electrical, Plumbing', 'MEP', '#F59E0B', NOW()),
          ('disc-4', 'Civil', 'Civil engineering', 'CIV', '#8B5CF6', NOW()),
          ('disc-5', 'Landscape', 'Landscape architecture', 'LAND', '#06B6D4', NOW())
        `);
        console.log('✅ Initial disciplines added');
      } else {
        console.log(`✅ Disciplines already exist (${count} records)`);
      }
    } catch (error) {
      console.log('⚠️ Error adding disciplines:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Add initial floors if they don't exist
    try {
      const [floors] = await connection.execute('SELECT COUNT(*) as count FROM floors');
      const count = (floors as any)[0]?.count || 0;
      
      if (count === 0) {
        console.log('📝 Adding initial floors...');
        await connection.execute(`
          INSERT INTO floors (id, name, level, description, project_id, sort_order, created_at) VALUES
          ('floor-1', 'Ground Floor', '0', 'Ground level', NULL, '1', NOW()),
          ('floor-2', 'First Floor', '1', 'First level', NULL, '2', NOW()),
          ('floor-3', 'Second Floor', '2', 'Second level', NULL, '3', NOW()),
          ('floor-4', 'Third Floor', '3', 'Third level', NULL, '4', NOW()),
          ('floor-5', 'Basement', '-1', 'Basement level', NULL, '0', NOW()),
          ('floor-6', 'Roof', 'R', 'Roof level', NULL, '5', NOW())
        `);
        console.log('✅ Initial floors added');
      } else {
        console.log(`✅ Floors already exist (${count} records)`);
      }
    } catch (error) {
      console.log('⚠️ Error adding floors:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    connection.release();
    console.log('✅ Database initialization completed');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}
