import { Pool } from 'pg';
import { config } from '../config/index';

export const pool = new Pool({
  connectionString: config.db.connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
  console.log('📦 Connected to PostgreSQL');
});

export const query = async <T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> => {
  try {
    const result = await pool.query(text, params);
    return { rows: result.rows, rowCount: result.rowCount || 0 };
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export const getClient = () => pool.connect();

export const testConnection = async (): Promise<boolean> => {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
};
