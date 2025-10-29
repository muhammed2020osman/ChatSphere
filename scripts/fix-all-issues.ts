#!/usr/bin/env tsx

import mysql from 'mysql2/promise';
import { config } from 'dotenv';

// Load environment variables
config();

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
const dbConfig = {
  host: url.hostname,
  port: parseInt(url.port || '3306'),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1), // Remove leading slash
  multipleStatements: true,
  charset: 'utf8mb4',
};

async function fixAllIssues() {
  console.log('🔧 بدء إصلاح جميع المشاكل...');
  
  let connection: mysql.Connection | null = null;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');

    // Fix all type issues
    const fixes = [
      // Fix JSON columns
      "ALTER TABLE drawingAnnotations MODIFY COLUMN data JSON;",
      "ALTER TABLE drawingRevisions MODIFY COLUMN data JSON;",
      "ALTER TABLE drawingComments MODIFY COLUMN data JSON;",
      "ALTER TABLE drawingLayers MODIFY COLUMN data JSON;",
      "ALTER TABLE drawingPins MODIFY COLUMN data JSON;",
      "ALTER TABLE savedViews MODIFY COLUMN data JSON;",
      
      // Fix VARCHAR lengths
      "ALTER TABLE users MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE users MODIFY COLUMN email VARCHAR(255);",
      "ALTER TABLE users MODIFY COLUMN first_name VARCHAR(100);",
      "ALTER TABLE users MODIFY COLUMN last_name VARCHAR(100);",
      "ALTER TABLE users MODIFY COLUMN profile_image_url TEXT;",
      "ALTER TABLE users MODIFY COLUMN status VARCHAR(50);",
      "ALTER TABLE users MODIFY COLUMN role VARCHAR(20);",
      
      "ALTER TABLE channels MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE channels MODIFY COLUMN name VARCHAR(100);",
      "ALTER TABLE channels MODIFY COLUMN description TEXT;",
      "ALTER TABLE channels MODIFY COLUMN created_by VARCHAR(191);",
      
      "ALTER TABLE messages MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE messages MODIFY COLUMN channel_id VARCHAR(191);",
      "ALTER TABLE messages MODIFY COLUMN user_id VARCHAR(191);",
      "ALTER TABLE messages MODIFY COLUMN content TEXT;",
      
      "ALTER TABLE directMessages MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE directMessages MODIFY COLUMN sender_id VARCHAR(191);",
      "ALTER TABLE directMessages MODIFY COLUMN receiver_id VARCHAR(191);",
      "ALTER TABLE directMessages MODIFY COLUMN content TEXT;",
      
      "ALTER TABLE channelMembers MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE channelMembers MODIFY COLUMN channel_id VARCHAR(191);",
      "ALTER TABLE channelMembers MODIFY COLUMN user_id VARCHAR(191);",
      
      "ALTER TABLE reactions MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE reactions MODIFY COLUMN message_id VARCHAR(191);",
      "ALTER TABLE reactions MODIFY COLUMN user_id VARCHAR(191);",
      "ALTER TABLE reactions MODIFY COLUMN emoji VARCHAR(10);",
      
      "ALTER TABLE notifications MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE notifications MODIFY COLUMN user_id VARCHAR(191);",
      "ALTER TABLE notifications MODIFY COLUMN message_id VARCHAR(191);",
      "ALTER TABLE notifications MODIFY COLUMN type VARCHAR(50);",
      "ALTER TABLE notifications MODIFY COLUMN content TEXT;",
      
      "ALTER TABLE starredMessages MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE starredMessages MODIFY COLUMN user_id VARCHAR(191);",
      "ALTER TABLE starredMessages MODIFY COLUMN message_id VARCHAR(191);",
      
      "ALTER TABLE attachments MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE attachments MODIFY COLUMN message_id VARCHAR(191);",
      "ALTER TABLE attachments MODIFY COLUMN filename VARCHAR(255);",
      "ALTER TABLE attachments MODIFY COLUMN file_path TEXT;",
      "ALTER TABLE attachments MODIFY COLUMN file_type VARCHAR(100);",
      
      "ALTER TABLE disciplines MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE disciplines MODIFY COLUMN name VARCHAR(100);",
      "ALTER TABLE disciplines MODIFY COLUMN description TEXT;",
      
      "ALTER TABLE projects MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE projects MODIFY COLUMN name VARCHAR(100);",
      "ALTER TABLE projects MODIFY COLUMN description TEXT;",
      "ALTER TABLE projects MODIFY COLUMN discipline_id VARCHAR(191);",
      "ALTER TABLE projects MODIFY COLUMN created_by VARCHAR(191);",
      
      "ALTER TABLE projectMembers MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE projectMembers MODIFY COLUMN project_id VARCHAR(191);",
      "ALTER TABLE projectMembers MODIFY COLUMN user_id VARCHAR(191);",
      "ALTER TABLE projectMembers MODIFY COLUMN role VARCHAR(50);",
      
      "ALTER TABLE drawingPages MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE drawingPages MODIFY COLUMN project_id VARCHAR(191);",
      "ALTER TABLE drawingPages MODIFY COLUMN name VARCHAR(100);",
      "ALTER TABLE drawingPages MODIFY COLUMN description TEXT;",
      "ALTER TABLE drawingPages MODIFY COLUMN created_by VARCHAR(191);",
      
      "ALTER TABLE drawingAnnotations MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE drawingAnnotations MODIFY COLUMN page_id VARCHAR(191);",
      "ALTER TABLE drawingAnnotations MODIFY COLUMN user_id VARCHAR(191);",
      "ALTER TABLE drawingAnnotations MODIFY COLUMN type VARCHAR(50);",
      
      "ALTER TABLE drawingRevisions MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE drawingRevisions MODIFY COLUMN page_id VARCHAR(191);",
      "ALTER TABLE drawingRevisions MODIFY COLUMN user_id VARCHAR(191);",
      "ALTER TABLE drawingRevisions MODIFY COLUMN title VARCHAR(100);",
      "ALTER TABLE drawingRevisions MODIFY COLUMN description TEXT;",
      
      "ALTER TABLE drawingComments MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE drawingComments MODIFY COLUMN revision_id VARCHAR(191);",
      "ALTER TABLE drawingComments MODIFY COLUMN user_id VARCHAR(191);",
      "ALTER TABLE drawingComments MODIFY COLUMN content TEXT;",
      
      "ALTER TABLE floors MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE floors MODIFY COLUMN project_id VARCHAR(191);",
      "ALTER TABLE floors MODIFY COLUMN name VARCHAR(100);",
      "ALTER TABLE floors MODIFY COLUMN description TEXT;",
      
      "ALTER TABLE rooms MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE rooms MODIFY COLUMN floor_id VARCHAR(191);",
      "ALTER TABLE rooms MODIFY COLUMN name VARCHAR(100);",
      "ALTER TABLE rooms MODIFY COLUMN description TEXT;",
      
      "ALTER TABLE layers MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE layers MODIFY COLUMN project_id VARCHAR(191);",
      "ALTER TABLE layers MODIFY COLUMN name VARCHAR(100);",
      "ALTER TABLE layers MODIFY COLUMN description TEXT;",
      
      "ALTER TABLE drawingLayers MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE drawingLayers MODIFY COLUMN page_id VARCHAR(191);",
      "ALTER TABLE drawingLayers MODIFY COLUMN layer_id VARCHAR(191);",
      
      "ALTER TABLE pins MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE pins MODIFY COLUMN room_id VARCHAR(191);",
      "ALTER TABLE pins MODIFY COLUMN name VARCHAR(100);",
      "ALTER TABLE pins MODIFY COLUMN description TEXT;",
      
      "ALTER TABLE drawingPins MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE drawingPins MODIFY COLUMN drawing_id VARCHAR(191);",
      "ALTER TABLE drawingPins MODIFY COLUMN pin_id VARCHAR(191);",
      
      "ALTER TABLE tickets MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE tickets MODIFY COLUMN project_id VARCHAR(191);",
      "ALTER TABLE tickets MODIFY COLUMN created_by VARCHAR(191);",
      "ALTER TABLE tickets MODIFY COLUMN assigned_to VARCHAR(191);",
      "ALTER TABLE tickets MODIFY COLUMN title VARCHAR(100);",
      "ALTER TABLE tickets MODIFY COLUMN description TEXT;",
      "ALTER TABLE tickets MODIFY COLUMN status VARCHAR(50);",
      "ALTER TABLE tickets MODIFY COLUMN priority VARCHAR(20);",
      
      "ALTER TABLE savedViews MODIFY COLUMN id VARCHAR(191);",
      "ALTER TABLE savedViews MODIFY COLUMN user_id VARCHAR(191);",
      "ALTER TABLE savedViews MODIFY COLUMN name VARCHAR(100);",
      "ALTER TABLE savedViews MODIFY COLUMN type VARCHAR(50);",
    ];

    console.log(`🔧 تطبيق ${fixes.length} إصلاح...`);
    
    for (let i = 0; i < fixes.length; i++) {
      try {
        await connection.execute(fixes[i]);
        console.log(`✅ إصلاح ${i + 1}/${fixes.length}: ${fixes[i].split(' ')[2]}`);
      } catch (error) {
        console.log(`⚠️  تحذير في إصلاح ${i + 1}: ${error}`);
      }
    }

    console.log('✅ تم إصلاح جميع المشاكل بنجاح!');
    
  } catch (error) {
    console.error('❌ فشل في إصلاح المشاكل:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 تم إغلاق الاتصال بقاعدة البيانات');
    }
  }
}

// Run the function
if (import.meta.url === `file://${process.argv[1]}`) {
  fixAllIssues();
}
