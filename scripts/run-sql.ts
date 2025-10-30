#!/usr/bin/env tsx

import 'dotenv/config';
import fs from 'fs/promises';
import mysql from 'mysql2/promise';

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: run-sql.ts <path-to-sql-file>');
    process.exit(1);
  }
  let url: URL;
  try {
    url = new URL(process.env.DATABASE_URL || '');
  } catch (e) {
    throw new Error(`Invalid DATABASE_URL format: ${process.env.DATABASE_URL}`);
  }
  const sql = await fs.readFile(file, 'utf8');
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port || '3306'),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    multipleStatements: true,
    charset: 'utf8mb4',
    connectTimeout: 30000,
  });
  try {
    await conn.query(sql);
    console.log('✅ Executed SQL file:', file);
  } finally {
    await conn.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('❌ SQL execution failed:', e);
    process.exit(1);
  });
}
