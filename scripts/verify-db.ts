#!/usr/bin/env tsx

import 'dotenv/config';
import mysql from 'mysql2/promise';
import * as schema from '../shared/schema';

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

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  key: string;
  default: string | null;
  extra: string;
}

interface IndexInfo {
  name: string;
  column: string;
  unique: boolean;
}

interface VerificationResult {
  tableExists: boolean;
  missingColumns: string[];
  extraColumns: string[];
  typeMismatches: { column: string; expected: string; actual: string }[];
  missingIndexes: string[];
}

// Expected table definitions from schema.ts
const expectedTables = {
  sessions: {
    columns: [
      { name: 'sid', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'sess', type: 'json', nullable: false, key: '' },
      { name: 'expire', type: 'timestamp', nullable: false, key: 'MUL' },
    ],
    indexes: ['IDX_session_expire']
  },
  users: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'email', type: 'varchar(255)', nullable: true, key: 'UNI' },
      { name: 'name', type: 'varchar(255)', nullable: true, key: '' },
      { name: 'password_hash', type: 'varchar(255)', nullable: true, key: '' },
      { name: 'profile_image_url', type: 'text', nullable: true, key: '' },
      { name: 'status', type: 'varchar(50)', nullable: true, key: '' },
      { name: 'is_online', type: 'tinyint(1)', nullable: true, key: '' },
      { name: 'last_seen', type: 'timestamp', nullable: true, key: '' },
      { name: 'role', type: 'varchar(20)', nullable: false, key: '' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
      { name: 'updated_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  channels: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'name', type: 'varchar(100)', nullable: false, key: '' },
      { name: 'description', type: 'text', nullable: true, key: '' },
      { name: 'is_private', type: 'tinyint(1)', nullable: false, key: '' },
      { name: 'created_by', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  messages: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'content', type: 'text', nullable: false, key: '' },
      { name: 'channel_id', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'user_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'reply_to_id', type: 'varchar(191)', nullable: true, key: '' },
      { name: 'attachment_url', type: 'text', nullable: true, key: '' },
      { name: 'attachment_type', type: 'varchar(100)', nullable: true, key: '' },
      { name: 'attachment_name', type: 'varchar(255)', nullable: true, key: '' },
      { name: 'thread_parent_id', type: 'varchar(191)', nullable: true, key: '' },
      { name: 'mentions', type: 'json', nullable: true, key: '' },
      { name: 'edited_at', type: 'timestamp', nullable: true, key: '' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
      { name: 'updated_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  drawings: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'name', type: 'varchar(255)', nullable: false, key: '' },
      { name: 'description', type: 'text', nullable: true, key: '' },
      { name: 'data', type: 'json', nullable: false, key: '' },
      { name: 'discipline_id', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'floor_id', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'created_by', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
      { name: 'updated_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  tickets: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'title', type: 'varchar(255)', nullable: false, key: '' },
      { name: 'description', type: 'text', nullable: true, key: '' },
      { name: 'type', type: 'varchar(50)', nullable: false, key: '' },
      { name: 'status', type: 'varchar(50)', nullable: false, key: '' },
      { name: 'priority', type: 'varchar(50)', nullable: false, key: '' },
      { name: 'drawing_id', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'discipline_id', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'pin_id', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'layer_id', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'assigned_to', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'created_by', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'reporter', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'channel_id', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'sla_hours', type: 'varchar(10)', nullable: true, key: '' },
      { name: 'due_date', type: 'timestamp', nullable: true, key: '' },
      { name: 'tags', type: 'json', nullable: true, key: '' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
      { name: 'updated_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  directMessages: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'content', type: 'text', nullable: false, key: '' },
      { name: 'from_user_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'to_user_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'reply_to_id', type: 'varchar(191)', nullable: true, key: '' },
      { name: 'attachment_url', type: 'text', nullable: true, key: '' },
      { name: 'attachment_type', type: 'varchar(100)', nullable: true, key: '' },
      { name: 'attachment_name', type: 'varchar(255)', nullable: true, key: '' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
      { name: 'updated_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  channelMembers: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'channel_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'user_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'joined_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  reactions: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'message_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'user_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'icon', type: 'varchar(10)', nullable: false, key: '' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  notifications: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'user_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'type', type: 'varchar(50)', nullable: false, key: '' },
      { name: 'message_id', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'channel_id', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'from_user_id', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'content', type: 'text', nullable: false, key: '' },
      { name: 'is_read', type: 'tinyint(1)', nullable: true, key: '' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  starredMessages: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'message_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'user_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  attachments: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'filename', type: 'varchar(255)', nullable: false, key: '' },
      { name: 'original_name', type: 'varchar(255)', nullable: false, key: '' },
      { name: 'mime_type', type: 'varchar(100)', nullable: false, key: '' },
      { name: 'size', type: 'varchar(20)', nullable: false, key: '' },
      { name: 'url', type: 'text', nullable: false, key: '' },
      { name: 'message_id', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'created_by', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  disciplines: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'name', type: 'varchar(100)', nullable: false, key: '' },
      { name: 'description', type: 'text', nullable: true, key: '' },
      { name: 'code', type: 'varchar(20)', nullable: true, key: '' },
      { name: 'color', type: 'varchar(20)', nullable: true, key: '' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  projects: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'name', type: 'varchar(255)', nullable: false, key: '' },
      { name: 'description', type: 'text', nullable: true, key: '' },
      { name: 'status', type: 'varchar(50)', nullable: true, key: '' },
      { name: 'created_by', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
      { name: 'updated_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  projectMembers: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'project_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'user_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'role', type: 'varchar(50)', nullable: true, key: '' },
      { name: 'joined_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  drawingPages: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'revision_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'page_number', type: 'varchar(10)', nullable: false, key: '' },
      { name: 'image_url', type: 'text', nullable: false, key: '' },
      { name: 'thumbnail_url', type: 'text', nullable: true, key: '' },
      { name: 'extracted_text', type: 'text', nullable: true, key: '' },
      { name: 'extracted_metadata', type: 'json', nullable: true, key: '' },
      { name: 'ai_extracted_data', type: 'json', nullable: true, key: '' },
      { name: 'width', type: 'varchar(20)', nullable: true, key: '' },
      { name: 'height', type: 'varchar(20)', nullable: true, key: '' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  drawingAnnotations: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'drawing_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'page_id', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'type', type: 'varchar(50)', nullable: false, key: '' },
      { name: 'data', type: 'json', nullable: false, key: '' },
      { name: 'created_by', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  drawingRevisions: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'drawing_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'version', type: 'varchar(20)', nullable: false, key: '' },
      { name: 'changes', type: 'json', nullable: false, key: '' },
      { name: 'status', type: 'varchar(50)', nullable: false, key: '' },
      { name: 'file_url', type: 'text', nullable: true, key: '' },
      { name: 'thumbnail_url', type: 'text', nullable: true, key: '' },
      { name: 'file_name', type: 'varchar(255)', nullable: true, key: '' },
      { name: 'file_type', type: 'varchar(100)', nullable: true, key: '' },
      { name: 'file_size', type: 'varchar(20)', nullable: true, key: '' },
      { name: 'ai_extracted_data', type: 'json', nullable: true, key: '' },
      { name: 'uploaded_by', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'reviewed_by', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'review_notes', type: 'text', nullable: true, key: '' },
      { name: 'uploaded_at', type: 'timestamp', nullable: true, key: '' },
      { name: 'reviewed_at', type: 'timestamp', nullable: true, key: '' },
      { name: 'created_by', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  drawingComments: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'drawing_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'content', type: 'text', nullable: false, key: '' },
      { name: 'x', type: 'varchar(20)', nullable: true, key: '' },
      { name: 'y', type: 'varchar(20)', nullable: true, key: '' },
      { name: 'created_by', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  floors: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'name', type: 'varchar(100)', nullable: false, key: '' },
      { name: 'level', type: 'varchar(20)', nullable: false, key: '' },
      { name: 'description', type: 'text', nullable: true, key: '' },
      { name: 'project_id', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'sort_order', type: 'varchar(10)', nullable: true, key: '' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  rooms: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'name', type: 'varchar(100)', nullable: false, key: '' },
      { name: 'floor_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'area', type: 'varchar(20)', nullable: true, key: '' },
      { name: 'description', type: 'text', nullable: true, key: '' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  layers: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'name', type: 'varchar(100)', nullable: false, key: '' },
      { name: 'type', type: 'varchar(50)', nullable: false, key: '' },
      { name: 'data', type: 'json', nullable: false, key: '' },
      { name: 'drawing_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'visible', type: 'tinyint(1)', nullable: true, key: '' },
      { name: 'created_by', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  drawingLayers: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'drawing_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'layer_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'order', type: 'varchar(10)', nullable: false, key: '' },
      { name: 'visible', type: 'tinyint(1)', nullable: true, key: '' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  pins: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'name', type: 'varchar(100)', nullable: false, key: '' },
      { name: 'x', type: 'varchar(20)', nullable: false, key: '' },
      { name: 'y', type: 'varchar(20)', nullable: false, key: '' },
      { name: 'type', type: 'varchar(50)', nullable: false, key: '' },
      { name: 'data', type: 'json', nullable: true, key: '' },
      { name: 'drawing_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'layer_id', type: 'varchar(191)', nullable: true, key: 'MUL' },
      { name: 'created_by', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  drawingPins: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'drawing_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'pin_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'x', type: 'varchar(20)', nullable: false, key: '' },
      { name: 'y', type: 'varchar(20)', nullable: false, key: '' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  },
  savedViews: {
    columns: [
      { name: 'id', type: 'varchar(191)', nullable: false, key: 'PRI' },
      { name: 'name', type: 'varchar(100)', nullable: false, key: '' },
      { name: 'type', type: 'varchar(50)', nullable: false, key: '' },
      { name: 'data', type: 'json', nullable: false, key: '' },
      { name: 'user_id', type: 'varchar(191)', nullable: false, key: 'MUL' },
      { name: 'is_shared', type: 'tinyint(1)', nullable: true, key: '' },
      { name: 'created_at', type: 'timestamp', nullable: true, key: '' },
      { name: 'updated_at', type: 'timestamp', nullable: true, key: '' },
    ],
    indexes: []
  }
};

async function getTableInfo(connection: mysql.Connection, tableName: string): Promise<TableInfo | null> {
  try {
    // Check if table exists
    const [tables] = await connection.execute(
      'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
      [config.database, tableName]
    );
    
    if ((tables as any[]).length === 0) {
      return null;
    }

    // Get column information
    const [columns] = await connection.execute(`
      SELECT 
        COLUMN_NAME as name,
        DATA_TYPE as type,
        IS_NULLABLE as nullable,
        COLUMN_KEY as \`key\`,
        COLUMN_DEFAULT as default_value,
        EXTRA as extra
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [config.database, tableName]);

    // Get index information
    const [indexes] = await connection.execute(`
      SELECT 
        INDEX_NAME as name,
        COLUMN_NAME as column_name,
        NON_UNIQUE as non_unique
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `, [config.database, tableName]);

    return {
      name: tableName,
      columns: columns as ColumnInfo[],
      indexes: (indexes as any[]).map(idx => ({
        name: idx.name,
        column: idx.column_name,
        unique: !idx.non_unique
      }))
    };
  } catch (error) {
    console.error(`Error getting table info for ${tableName}:`, error);
    return null;
  }
}

function normalizeType(type: string): string {
  // Normalize MySQL types to match expected types
  const typeMap: { [key: string]: string } = {
    'varchar': 'varchar',
    'char': 'varchar',
    'text': 'text',
    'longtext': 'text',
    'mediumtext': 'text',
    'tinytext': 'text',
    'json': 'json',
    'longblob': 'json',
    'timestamp': 'timestamp',
    'datetime': 'timestamp',
    'tinyint': 'tinyint',
    'int': 'int',
    'bigint': 'bigint',
    'decimal': 'decimal',
    'float': 'float',
    'double': 'double'
  };

  const baseType = type.toLowerCase().split('(')[0];
  return typeMap[baseType] || baseType;
}

function verifyTable(expectedTable: any, actualTable: TableInfo | null): VerificationResult {
  const result: VerificationResult = {
    tableExists: actualTable !== null,
    missingColumns: [],
    extraColumns: [],
    typeMismatches: [],
    missingIndexes: []
  };

  if (!actualTable) {
    return result;
  }

  // Check columns
  const expectedColumns = new Map(expectedTable.columns.map((col: any) => [col.name, col]));
  const actualColumns = new Map(actualTable.columns.map(col => [col.name, col]));

  // Find missing columns
  for (const [name, expectedCol] of expectedColumns) {
    if (!actualColumns.has(name)) {
      result.missingColumns.push(name);
    } else {
      const actualCol = actualColumns.get(name)!;
      const expectedType = normalizeType(expectedCol.type);
      const actualType = normalizeType(actualCol.type);
      
      if (expectedType !== actualType) {
        result.typeMismatches.push({
          column: name,
          expected: expectedType,
          actual: actualType
        });
      }
    }
  }

  // Find extra columns
  for (const [name] of actualColumns) {
    if (!expectedColumns.has(name)) {
      result.extraColumns.push(name);
    }
  }

  // Check indexes
  const expectedIndexes = new Set(expectedTable.indexes || []);
  const actualIndexNames = new Set(actualTable.indexes.map(idx => idx.name));
  
  for (const indexName of expectedIndexes) {
    if (!actualIndexNames.has(indexName)) {
      result.missingIndexes.push(indexName);
    }
  }

  return result;
}

async function main() {
  console.log('🔍 فحص قاعدة البيانات MySQL...\n');

  let connection: mysql.Connection | null = null;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح\n');

    const results: { [tableName: string]: VerificationResult } = {};
    let totalIssues = 0;

    // Verify each expected table
    for (const [tableName, expectedTable] of Object.entries(expectedTables)) {
      console.log(`فحص جدول: ${tableName}...`);
      
      const actualTable = await getTableInfo(connection, tableName);
      const result = verifyTable(expectedTable, actualTable);
      results[tableName] = result;

      if (!result.tableExists) {
        console.log(`  ❌ الجدول غير موجود`);
        totalIssues++;
      } else {
        let tableIssues = 0;
        
        if (result.missingColumns.length > 0) {
          console.log(`  ⚠️  الحقول الناقصة: ${result.missingColumns.join(', ')}`);
          tableIssues += result.missingColumns.length;
        }
        
        if (result.extraColumns.length > 0) {
          console.log(`  ⚠️  الحقول الإضافية: ${result.extraColumns.join(', ')}`);
          tableIssues += result.extraColumns.length;
        }
        
        if (result.typeMismatches.length > 0) {
          console.log(`  ⚠️  اختلافات في الأنواع:`);
          result.typeMismatches.forEach(mismatch => {
            console.log(`    - ${mismatch.column}: متوقع ${mismatch.expected}, موجود ${mismatch.actual}`);
          });
          tableIssues += result.typeMismatches.length;
        }
        
        if (result.missingIndexes.length > 0) {
          console.log(`  ⚠️  الفهارس الناقصة: ${result.missingIndexes.join(', ')}`);
          tableIssues += result.missingIndexes.length;
        }

        if (tableIssues === 0) {
          console.log(`  ✅ الجدول صحيح`);
        } else {
          totalIssues += tableIssues;
        }
      }
      console.log('');
    }

    // Summary
    console.log('📊 ملخص النتائج:');
    console.log('================');
    
    const existingTables = Object.values(results).filter(r => r.tableExists).length;
    const missingTables = Object.values(results).filter(r => !r.tableExists).length;
    
    console.log(`إجمالي الجداول المطلوبة: ${Object.keys(expectedTables).length}`);
    console.log(`الجداول الموجودة: ${existingTables}`);
    console.log(`الجداول الناقصة: ${missingTables}`);
    console.log(`إجمالي المشاكل: ${totalIssues}`);

    if (totalIssues === 0) {
      console.log('\n🎉 جميع الجداول والحقول صحيحة ومتطابقة مع schema.ts!');
    } else {
      console.log('\n⚠️  تم العثور على مشاكل في قاعدة البيانات. استخدم سكريبت migrate-db.ts لإصلاحها.');
    }

  } catch (error) {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', error);
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
