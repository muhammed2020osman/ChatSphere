import mysql from 'mysql2/promise';
import { pool } from '../db';

export async function ensureAuthUsersTable(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } finally {
    connection.release();
  }
}

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  password_hash?: string;
};

export async function findAuthUserByEmail(email: string): Promise<AuthUser | null> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id, email, name, password_hash FROM auth_users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] ? (rows[0] as unknown as AuthUser) : null;
}

export async function createAuthUser(params: { email: string; passwordHash: string; name: string; }): Promise<AuthUser> {
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO auth_users (email, password_hash, name) VALUES (?, ?, ?)',
    [params.email, params.passwordHash, params.name]
  );
  return { id: result.insertId, email: params.email, name: params.name };
}

export async function findAuthUserById(id: number): Promise<AuthUser | null> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id, email, name FROM auth_users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] ? (rows[0] as unknown as AuthUser) : null;
}


