#!/usr/bin/env tsx

import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function main() {
  let url: URL;
  try {
    url = new URL(process.env.DATABASE_URL || '');
  } catch (e) {
    throw new Error(`Invalid DATABASE_URL format: ${process.env.DATABASE_URL}`);
  }

  const conn = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port || '3306'),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    charset: 'utf8mb4',
    multipleStatements: true,
    connectTimeout: 30000,
  });

  try {
    console.log('🔄 Backfilling users table (name, password_hash) ...');

    // Ensure columns exist to prevent errors on older schemas
    await conn.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) NULL`);
    await conn.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL`);

    // Delete rows with NULL email (per user decision 1-a rejection)
    const [delRes] = await conn.execute(`DELETE FROM users WHERE email IS NULL`);
    console.log('🗑️ Deleted rows with NULL email:', (delRes as any)?.affectedRows ?? 0);

    // Backfill name = email where name is NULL or empty
    const [nameRes] = await conn.execute(
      `UPDATE users SET name = email WHERE (name IS NULL OR TRIM(name) = '') AND email IS NOT NULL`
    );
    console.log('✏️ Backfilled name from email:', (nameRes as any)?.affectedRows ?? 0);

    // Backfill password_hash for NULL values with a random hash
    const [nullPwRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT id FROM users WHERE password_hash IS NULL`
    );

    if ((nullPwRows as any[]).length > 0) {
      console.log('🔐 Backfilling password_hash for users without one:', (nullPwRows as any[]).length);
      // Generate and update in small batches
      for (const row of nullPwRows as any[]) {
        const random = `${row.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const hash = await bcrypt.hash(random, 12);
        await conn.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, row.id]);
      }
    }

    console.log('✅ Backfill complete.');
  } finally {
    await conn.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  });
}
