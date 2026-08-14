import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fallback to local file relative to backend folder if not absolute
const dbPathConfig = process.env.DATABASE_PATH || 'database/database.db';
const dbPath = path.isAbsolute(dbPathConfig)
  ? dbPathConfig
  : path.resolve(__dirname, '../../', dbPathConfig);

// Ensure the target database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`[Database] Connecting to SQLite DB at: ${dbPath}`);

// Open the promise-wrapped database connection
const rawDb = await open({
  filename: dbPath,
  driver: sqlite3.Database
});

// Enforce foreign key constraints and set busy_timeout
await rawDb.run('PRAGMA foreign_keys = ON');
await rawDb.run('PRAGMA busy_timeout = 5000');
console.log('[Database] SQLite foreign key constraints and busy timeout (5000ms) enabled.');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const executeWithRetry = async (fn, args, retries = 3, delayMs = 100) => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn.apply(rawDb, args);
    } catch (err) {
      attempt++;
      const isLockError = err.code === 'SQLITE_BUSY' || err.message?.includes('locked') || err.message?.includes('busy');
      if (isLockError && attempt < retries) {
        console.warn(`[Database Retry] SQLITE_BUSY detected. Retrying attempt ${attempt}/${retries} after ${delayMs}ms...`);
        await delay(delayMs * Math.pow(2, attempt));
      } else {
        throw err;
      }
    }
  }
};

const db = {
  run: (...args) => executeWithRetry(rawDb.run, args),
  get: (...args) => executeWithRetry(rawDb.get, args),
  all: (...args) => executeWithRetry(rawDb.all, args),
  exec: (...args) => executeWithRetry(rawDb.exec, args),
  prepare: (...args) => rawDb.prepare(...args),
  close: () => rawDb.close()
};

export default db;
