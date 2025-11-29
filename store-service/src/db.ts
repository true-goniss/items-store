import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// пул БД
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err: Error) => {
  console.error('[DB] Unexpected error on idle client:', err);
  // ! ! !
});

console.log('[DB] PostgreSQL Pool initialized.');