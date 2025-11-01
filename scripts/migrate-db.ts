#!/usr/bin/env tsx

import 'dotenv/config';
import mysql from 'mysql2/promise';

// Parse DATABASE_URL with error handling
let url: URL;
try {
  url = new URL(process.env.DATABASE_URL || '');
} catch (error) {
  throw new Error(
    `Invalid DATABASE_URL format: ${process.env.DATABASE_URL}. Expected format: mysql://username:password@host:port/database`
  );
}

// Database connection configuration
const config = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1), // Remove leading slash
  multipleStatements: true,
  charset: 'utf8mb4',
  connectTimeout: 30000,
  acquireTimeout: 30000,
  idleTimeout: 300000,
  keepAliveInitialDelay: 0,
  enableKeepAlive: true,
  timezone: 'Z',
  dateStrings: false,
  supportBigNumbers: true,
  bigNumberStrings: true,
  reconnect: true,
  debug: process.env.NODE_ENV === 'development' ? ['ComProtocol'] : false,
  protocol41: true,
};

// Complete table definitions based on schema.ts
const tableDefinitions = {
  sessions: `
    CREATE TABLE IF NOT EXISTS sessions (
      sid VARCHAR(191) PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMP NOT NULL,
      INDEX IDX_session_expire (expire)
    )
  `,
  
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
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
  `,

  channels: `
    CREATE TABLE IF NOT EXISTS channels (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_private BOOLEAN DEFAULT FALSE NOT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `,

  messages: `
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      content TEXT NOT NULL,
      channel_id INT,
      user_id INT NOT NULL,
      reply_to_id INT,
      attachment_url TEXT,
      attachment_type VARCHAR(100),
      attachment_name VARCHAR(255),
      thread_parent_id INT,
      mentions JSON DEFAULT (JSON_ARRAY()),
      edited_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (channel_id) REFERENCES channels(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `,

  drawings: `
    CREATE TABLE IF NOT EXISTS drawings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      data JSON NOT NULL,
      discipline_id INT,
      floor_id INT,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (discipline_id) REFERENCES disciplines(id),
      FOREIGN KEY (floor_id) REFERENCES floors(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `,

  tickets: `
    CREATE TABLE IF NOT EXISTS tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      type VARCHAR(50) DEFAULT 'issue' NOT NULL,
      status VARCHAR(50) DEFAULT 'open' NOT NULL,
      priority VARCHAR(50) DEFAULT 'medium' NOT NULL,
      drawing_id INT,
      discipline_id INT,
      pin_id INT,
      layer_id INT,
      assigned_to INT,
      created_by INT NOT NULL,
      reporter INT,
      channel_id INT,
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
  `,

  directMessages: `
    CREATE TABLE IF NOT EXISTS direct_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      content TEXT NOT NULL,
      from_user_id INT NOT NULL,
      to_user_id INT NOT NULL,
      reply_to_id INT,
      attachment_url TEXT,
      attachment_type VARCHAR(100),
      attachment_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id)
    )
  `,

  channelMembers: `
    CREATE TABLE IF NOT EXISTS channel_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      channel_id INT NOT NULL,
      user_id INT NOT NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (channel_id) REFERENCES channels(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `,

  reactions: `
    CREATE TABLE IF NOT EXISTS reactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      message_id INT NOT NULL,
      user_id INT NOT NULL,
      icon VARCHAR(10) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES messages(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `,

  notifications: `
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(50) NOT NULL,
      message_id INT,
      channel_id INT,
      from_user_id INT,
      content TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (message_id) REFERENCES messages(id),
      FOREIGN KEY (channel_id) REFERENCES channels(id),
      FOREIGN KEY (from_user_id) REFERENCES users(id)
    )
  `,

  starredMessages: `
    CREATE TABLE IF NOT EXISTS starred_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      message_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_message_user (message_id, user_id),
      FOREIGN KEY (message_id) REFERENCES messages(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `,

  attachments: `
    CREATE TABLE IF NOT EXISTS attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      size VARCHAR(20) NOT NULL,
      url TEXT NOT NULL,
      message_id INT,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES messages(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `,

  disciplines: `
    CREATE TABLE IF NOT EXISTS disciplines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      code VARCHAR(20),
      color VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,

  projects: `
    CREATE TABLE IF NOT EXISTS projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) DEFAULT 'active',
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `,

  projectMembers: `
    CREATE TABLE IF NOT EXISTS project_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      user_id INT NOT NULL,
      role VARCHAR(50) DEFAULT 'member',
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `,

  drawingPages: `
    CREATE TABLE IF NOT EXISTS drawing_pages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      revision_id INT NOT NULL,
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
  `,

  drawingAnnotations: `
    CREATE TABLE IF NOT EXISTS drawing_annotations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      drawing_id INT NOT NULL,
      page_id INT,
      type VARCHAR(50) NOT NULL,
      data JSON NOT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (drawing_id) REFERENCES drawings(id),
      FOREIGN KEY (page_id) REFERENCES drawing_pages(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `,

  drawingRevisions: `
    CREATE TABLE IF NOT EXISTS drawing_revisions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      drawing_id INT NOT NULL,
      version VARCHAR(20) NOT NULL,
      changes JSON NOT NULL,
      status VARCHAR(50) DEFAULT 'draft' NOT NULL,
      file_url TEXT,
      thumbnail_url TEXT,
      file_name VARCHAR(255),
      file_type VARCHAR(100),
      file_size VARCHAR(20),
      ai_extracted_data JSON,
      uploaded_by INT,
      reviewed_by INT,
      review_notes TEXT,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMP,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (drawing_id) REFERENCES drawings(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `,

  drawingComments: `
    CREATE TABLE IF NOT EXISTS drawing_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      drawing_id INT NOT NULL,
      content TEXT NOT NULL,
      x VARCHAR(20),
      y VARCHAR(20),
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (drawing_id) REFERENCES drawings(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `,

  floors: `
    CREATE TABLE IF NOT EXISTS floors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      level VARCHAR(20) NOT NULL,
      description TEXT,
      project_id INT,
      sort_order VARCHAR(10) DEFAULT '0',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `,

  rooms: `
    CREATE TABLE IF NOT EXISTS rooms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      floor_id INT NOT NULL,
      area VARCHAR(20),
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (floor_id) REFERENCES floors(id)
    )
  `,

  layers: `
    CREATE TABLE IF NOT EXISTS layers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(50) NOT NULL,
      data JSON NOT NULL,
      drawing_id INT NOT NULL,
      visible BOOLEAN DEFAULT TRUE,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (drawing_id) REFERENCES drawings(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `,

  drawingLayers: `
    CREATE TABLE IF NOT EXISTS drawing_layers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      drawing_id INT NOT NULL,
      layer_id INT NOT NULL,
      \`order\` VARCHAR(10) NOT NULL,
      visible BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (drawing_id) REFERENCES drawings(id),
      FOREIGN KEY (layer_id) REFERENCES layers(id)
    )
  `,

  pins: `
    CREATE TABLE IF NOT EXISTS pins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      x VARCHAR(20) NOT NULL,
      y VARCHAR(20) NOT NULL,
      type VARCHAR(50) NOT NULL,
      data JSON,
      drawing_id INT NOT NULL,
      layer_id INT,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (drawing_id) REFERENCES drawings(id),
      FOREIGN KEY (layer_id) REFERENCES layers(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `,

  drawingPins: `
    CREATE TABLE IF NOT EXISTS drawing_pins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      drawing_id INT NOT NULL,
      pin_id INT NOT NULL,
      x VARCHAR(20) NOT NULL,
      y VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (drawing_id) REFERENCES drawings(id),
      FOREIGN KEY (pin_id) REFERENCES pins(id)
    )
  `,

  savedViews: `
    CREATE TABLE IF NOT EXISTS saved_views (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(50) NOT NULL,
      data JSON NOT NULL,
      user_id INT NOT NULL,
      is_shared BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `
};

// Initial data to insert
const initialData = {
  disciplines: `
    INSERT IGNORE INTO disciplines (name, description, code, color, created_at) VALUES
    ('Architecture', 'Architectural drawings', 'ARCH', '#3B82F6', NOW()),
    ('Structural', 'Structural engineering', 'STR', '#10B981', NOW()),
    ('MEP', 'Mechanical, Electrical, Plumbing', 'MEP', '#F59E0B', NOW()),
    ('Civil', 'Civil engineering', 'CIV', '#8B5CF6', NOW()),
    ('Landscape', 'Landscape architecture', 'LAND', '#06B6D4', NOW())
  `,

  floors: `
    INSERT IGNORE INTO floors (name, level, description, project_id, sort_order, created_at) VALUES
    ('Ground Floor', '0', 'Ground level', NULL, '1', NOW()),
    ('First Floor', '1', 'First level', NULL, '2', NOW()),
    ('Second Floor', '2', 'Second level', NULL, '3', NOW()),
    ('Third Floor', '3', 'Third level', NULL, '4', NOW()),
    ('Basement', '-1', 'Basement level', NULL, '0', NOW()),
    ('Roof', 'R', 'Roof level', NULL, '5', NOW())
  `
};

// Indexes to create
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id)',
  'CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_direct_messages_from_user ON direct_messages(from_user_id)',
  'CREATE INDEX IF NOT EXISTS idx_direct_messages_to_user ON direct_messages(to_user_id)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_drawing_revisions_drawing_id ON drawing_revisions(drawing_id)',
  'CREATE INDEX IF NOT EXISTS idx_drawing_pages_revision_id ON drawing_pages(revision_id)',
  'CREATE INDEX IF NOT EXISTS idx_pins_drawing_id ON pins(drawing_id)',
  'CREATE INDEX IF NOT EXISTS idx_tickets_drawing_id ON tickets(drawing_id)',
  'CREATE INDEX IF NOT EXISTS idx_tickets_reporter ON tickets(reporter)',
  'CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assigned_to)',
  'CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)',
  'CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority)',
  'CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to)',
  'CREATE INDEX IF NOT EXISTS idx_tickets_due_date ON tickets(due_date)',
  'CREATE INDEX IF NOT EXISTS idx_drawings_discipline_id ON drawings(discipline_id)',
  'CREATE INDEX IF NOT EXISTS idx_drawings_floor_id ON drawings(floor_id)',
  'CREATE INDEX IF NOT EXISTS idx_drawings_updated_at ON drawings(updated_at)',
  'CREATE INDEX IF NOT EXISTS idx_revisions_drawing_id ON drawing_revisions(drawing_id)',
  'CREATE INDEX IF NOT EXISTS idx_revisions_uploaded_at ON drawing_revisions(uploaded_at)'
];

async function createTable(connection: mysql.Connection, tableName: string, definition: string): Promise<boolean> {
  try {
    console.log(`  إنشاء جدول: ${tableName}...`);
    await connection.execute(definition);
    console.log(`  ✅ تم إنشاء جدول ${tableName}`);
    return true;
  } catch (error) {
    console.error(`  ❌ خطأ في إنشاء جدول ${tableName}:`, error);
    return false;
  }
}

async function createIndexes(connection: mysql.Connection): Promise<void> {
  console.log('\n📊 إنشاء الفهارس...');
  
  for (const indexSql of indexes) {
    try {
      await connection.execute(indexSql);
      console.log(`  ✅ تم إنشاء الفهرس`);
    } catch (error) {
      console.error(`  ❌ خطأ في إنشاء الفهرس:`, error);
    }
  }
}

async function insertInitialData(connection: mysql.Connection): Promise<void> {
  console.log('\n📝 إدراج البيانات الأولية...');
  
  try {
    await connection.execute(initialData.disciplines);
    console.log('  ✅ تم إدراج التخصصات');
  } catch (error) {
    console.error('  ❌ خطأ في إدراج التخصصات:', error);
  }
  
  try {
    await connection.execute(initialData.floors);
    console.log('  ✅ تم إدراج الطوابق');
  } catch (error) {
    console.error('  ❌ خطأ في إدراج الطوابق:', error);
  }
}

async function main() {
  console.log('🔧 بدء عملية إصلاح قاعدة البيانات MySQL...\n');

  let connection: mysql.Connection | null = null;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح\n');

    // Create tables in dependency order
    const tableOrder = [
      'sessions',
      'users', 
      'disciplines',
      'floors',
      'projects',
      'channels',
      'channelMembers',
      'messages',
      'directMessages',
      'reactions',
      'notifications',
      'starredMessages',
      'attachments',
      'drawings',
      'drawingRevisions',
      'drawingPages',
      'drawingAnnotations',
      'drawingComments',
      'rooms',
      'layers',
      'drawingLayers',
      'pins',
      'drawingPins',
      'tickets',
      'savedViews'
    ];

    console.log('📋 إنشاء الجداول...');
    let successCount = 0;
    
    for (const tableName of tableOrder) {
      const definition = tableDefinitions[tableName as keyof typeof tableDefinitions];
      if (definition) {
        const success = await createTable(connection, tableName, definition);
        if (success) successCount++;
      }
    }

    console.log(`\n📊 تم إنشاء ${successCount} من ${tableOrder.length} جدول`);

    // Create indexes
    await createIndexes(connection);

    // Insert initial data
    await insertInitialData(connection);

    console.log('\n🎉 تم إصلاح قاعدة البيانات بنجاح!');
    console.log('💡 يمكنك الآن تشغيل سكريبت التحقق: pnpm db:verify');

  } catch (error) {
    console.error('❌ خطأ في إصلاح قاعدة البيانات:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
