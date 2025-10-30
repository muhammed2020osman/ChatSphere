import mysql from 'mysql2/promise';
import { pool } from '../db';

// Ensure unified users table has password_hash column for local email/password auth
export async function ensureUsersAuthColumns(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.execute(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL;
    `);
    await connection.execute(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) NULL;
    `);
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
      'SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1',
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
    await pool.execute<mysql.ResultSetHeader>(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, "member")',
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


