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
  // Add acquire timeout
  acquireTimeout: 30000,
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
  // Try to reconnect
  reconnect: true,
  // Debug mode for troubleshooting
  debug: process.env.NODE_ENV === 'development' ? ['ComProtocol'] : false,
  // Additional connection options that might help with permissions
  authPlugins: {
    mysql_native_password: () => () => Buffer.from(url.password)
  },
  // Force protocol 41 (MySQL 4.1+)
  protocol41: true,
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
    
    // Create disciplines table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS disciplines (
        id VARCHAR(191) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        code VARCHAR(50),
        color VARCHAR(7),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Create floors table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS floors (
        id VARCHAR(191) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        level VARCHAR(50),
        description TEXT,
        projectId VARCHAR(191),
        sortOrder INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(191) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        profileImageUrl TEXT,
        role VARCHAR(50) DEFAULT 'user',
        isOnline BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Create channels table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS channels (
        id VARCHAR(191) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Create messages table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(191) PRIMARY KEY,
        content TEXT NOT NULL,
        userId VARCHAR(191) NOT NULL,
        channelId VARCHAR(191) NOT NULL,
        replyToId VARCHAR(191),
        threadParentId VARCHAR(191),
        attachmentUrl TEXT,
        attachmentType VARCHAR(100),
        attachmentName VARCHAR(255),
        mentions TEXT,
        editedAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (channelId) REFERENCES channels(id)
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
          INSERT INTO disciplines (id, name, description, code, color, createdAt) VALUES
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
          INSERT INTO floors (id, name, level, description, projectId, sortOrder, createdAt) VALUES
          ('floor-1', 'Ground Floor', '0', 'Ground level', NULL, 1, NOW()),
          ('floor-2', 'First Floor', '1', 'First level', NULL, 2, NOW()),
          ('floor-3', 'Second Floor', '2', 'Second level', NULL, 3, NOW()),
          ('floor-4', 'Third Floor', '3', 'Third level', NULL, 4, NOW()),
          ('floor-5', 'Basement', '-1', 'Basement level', NULL, 0, NOW())
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
