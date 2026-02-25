import { Pool } from 'pg';
import { config } from '../config/index.js';

export const pool = new Pool({
  connectionString: config.db.connectionString,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = <T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> => {
  return pool.query(text, params);
};

export const getClient = () => pool.connect();
