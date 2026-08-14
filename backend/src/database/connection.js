import { connect } from '@tursodatabase/serverless';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { AsyncLocalStorage } from 'async_hooks';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine if we should connect to Turso Cloud Database
const isTurso = !!process.env.TURSO_DATABASE_URL;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const transactionStorage = new AsyncLocalStorage();

const isNonRetryableError = (err) => {
  if (!err) return false;
  if (err.code && (err.code.startsWith('SQLITE_CONSTRAINT') || err.code === 'SQLITE_ERROR')) return true;
  
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('constraint failed') || msg.includes('syntax error') || msg.includes('no such table') || msg.includes('no such column')) return true;
  
  return false;
};

const executeWithRetry = async (fn, context, args, retries = 5, delayMs = 1000) => {
  let attempt = 0;
  while (true) {
    try {
      return await fn.apply(context, args);
    } catch (err) {
      attempt++;
      const canRetry = !isNonRetryableError(err);
      if (canRetry && attempt <= retries) {
        console.warn(`[Database Retry] Attempt ${attempt}/${retries} failed: ${err.message || err}. Retrying in ${delayMs}ms...`);
        await delay(delayMs);
      } else {
        throw err;
      }
    }
  }
};

let db;

if (isTurso) {
  console.log('[Database] Connecting to Turso Cloud Database...');
  const client = connect({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  db = {
    run: async (sql, ...args) => {
      const sqlUpper = sql.trim().toUpperCase();
      if (sqlUpper.startsWith('BEGIN')) {
        const tx = await client.transaction();
        transactionStorage.enterWith(tx);
        return { lastID: undefined, changes: 0 };
      }
      if (sqlUpper.startsWith('COMMIT')) {
        const tx = transactionStorage.getStore();
        if (tx) {
          await tx.commit();
          transactionStorage.enterWith(undefined);
        }
        return { lastID: undefined, changes: 0 };
      }
      if (sqlUpper.startsWith('ROLLBACK')) {
        const tx = transactionStorage.getStore();
        if (tx) {
          try {
            await tx.rollback();
          } catch (e) {
            // Already rolled back or failed
          }
          transactionStorage.enterWith(undefined);
        }
        return { lastID: undefined, changes: 0 };
      }

      const tx = transactionStorage.getStore();
      const executor = tx || client;
      
      const res = await executeWithRetry(executor.run, executor, [sql, ...args]);
      return {
        lastID: res.lastInsertRowid !== undefined ? Number(res.lastInsertRowid) : undefined,
        changes: res.changes
      };
    },
    get: async (sql, ...args) => {
      const tx = transactionStorage.getStore();
      const executor = tx || client;
      return await executeWithRetry(executor.get, executor, [sql, ...args]);
    },
    all: async (sql, ...args) => {
      const tx = transactionStorage.getStore();
      const executor = tx || client;
      return await executeWithRetry(executor.all, executor, [sql, ...args]);
    },
    exec: async (sql) => {
      const tx = transactionStorage.getStore();
      const executor = tx || client;
      return await executeWithRetry(executor.exec, executor, [sql]);
    },
    prepare: () => {
      throw new Error('db.prepare is not supported on Turso Cloud Database.');
    },
    close: async () => {
      client.close();
    }
  };
} else {
  const sqlite3Module = await import('sqlite3');
  const sqlite3 = sqlite3Module.default || sqlite3Module;
  const { open } = await import('sqlite');

  const candidatePaths = [];

  if (process.env.DATABASE_PATH) {
    candidatePaths.push(process.env.DATABASE_PATH);
  }

  candidatePaths.push(
    path.resolve(__dirname, '../../database/database.db'),
    path.resolve(process.cwd(), 'database/database.db'),
    '/tmp/nexa-whispers/database.db'
  );

  let dbPath;
  for (const candidate of candidatePaths) {
    const resolved = path.isAbsolute(candidate)
      ? candidate
      : path.resolve(__dirname, '../../', candidate);

    const dir = path.dirname(resolved);

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.accessSync(dir, fs.constants.W_OK);
      dbPath = resolved;
      break;
    } catch (err) {
      console.warn(`[Database] Skipping unwritable path: ${resolved}`);
    }
  }

  if (!dbPath) {
    throw new Error('No writable SQLite directory available. Please set DATABASE_PATH to a writable folder.');
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

  db = {
    run: (...args) => executeWithRetry(rawDb.run, rawDb, args),
    get: (...args) => executeWithRetry(rawDb.get, rawDb, args),
    all: (...args) => executeWithRetry(rawDb.all, rawDb, args),
    exec: (...args) => executeWithRetry(rawDb.exec, rawDb, args),
    prepare: (...args) => rawDb.prepare(...args),
    close: () => rawDb.close()
  };
}

export default db;
