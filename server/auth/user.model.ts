import mysql from 'mysql2/promise';
import { pool } from '../db';

// Ensure unified users table has password_hash column for local email/password auth
export async function ensureUsersAuthColumns(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    // Add columns if they don't exist
    await connection.execute(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL;
    `);
    await connection.execute(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) NULL;
    `);
    
    // Ensure all optional fields have defaults or are nullable
    // Only name, email, and password_hash are required
    await connection.execute(`
      ALTER TABLE users MODIFY COLUMN role VARCHAR(20) DEFAULT 'member' NOT NULL;
    `).catch(() => {}); // Ignore if already set
    
    await connection.execute(`
      ALTER TABLE users MODIFY COLUMN is_online BOOLEAN DEFAULT FALSE;
    `).catch(() => {}); // Ignore if already set
    
    await connection.execute(`
      ALTER TABLE users MODIFY COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `).catch(() => {}); // Ignore if already set
    
    await connection.execute(`
      ALTER TABLE users MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
    `).catch(() => {}); // Ignore if already set
  } finally {
    connection.release();
  }
}

export type AuthUser = {
  id: string | number;
  email: string;
  name?: string;
  password_hash?: string | null;
};

export async function findAuthUserByEmail(email: string): Promise<AuthUser | null> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, email, name, password_hash FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    return rows[0] ? (rows[0] as unknown as AuthUser) : null;
  } catch (e: any) {
    (e as any).code = (e as any)?.code || 'DB_UNAVAILABLE';
    throw e;
  }
}

export async function emailExists(email: string): Promise<boolean> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT 1 FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    return !!rows[0];
  } catch (e: any) {
    (e as any).code = (e as any)?.code || 'DB_UNAVAILABLE';
    throw e;
  }
}

export async function createAuthUser(params: { email: string; passwordHash: string; name: string; }): Promise<AuthUser> {
  try {
    // Only insert the 3 required fields: email, password_hash, name
    // All other fields (id, role, is_online, created_at, updated_at) use their defaults
    await pool.execute<mysql.ResultSetHeader>(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      [params.email, params.passwordHash, params.name]
    );
    // Fetch the inserted user to get id reliably (UUID PK has no insertId)
    const inserted = await findAuthUserByEmail(params.email);
    return { id: inserted?.id!, email: params.email, name: params.name } as AuthUser;
  } catch (e: any) {
    (e as any).code = (e as any)?.code || 'DB_UNAVAILABLE';
    throw e;
  }
}

export async function findAuthUserById(id: string | number): Promise<AuthUser | null> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, email, name, password_hash FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] ? (rows[0] as unknown as AuthUser) : null;
  } catch (e: any) {
    (e as any).code = (e as any)?.code || 'DB_UNAVAILABLE';
    throw e;
  }
}


