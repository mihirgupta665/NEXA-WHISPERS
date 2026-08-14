import db from './connection.js';

export async function initSchema() {
  console.log('[Database] Initializing database schema...');

  try {
    await db.run('BEGIN TRANSACTION');

    // 1. Users Table
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        is_online INTEGER DEFAULT 0,
        last_seen INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // 2. Contacts Table
    await db.run(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        contact_user_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (contact_user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, contact_user_id)
      )
    `);

    // 3. Conversations Table
    await db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT CHECK(type IN ('direct', 'group')) NOT NULL,
        name TEXT,
        avatar_url TEXT,
        created_by INTEGER,
        disappearing_timer INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // 4. Conversation Members Table
    await db.run(`
      CREATE TABLE IF NOT EXISTS conversation_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT CHECK(role IN ('member', 'admin')) DEFAULT 'member',
        joined_at INTEGER NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(conversation_id, user_id)
      )
    `);

    // 5. Messages Table
    await db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT CHECK(message_type IN ('text', 'attachment')) DEFAULT 'text',
        status TEXT CHECK(status IN ('sending', 'sent', 'delivered', 'read')) DEFAULT 'sent',
        reply_to_message_id INTEGER,
        expires_at INTEGER,
        client_msg_id TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE SET NULL
      )
    `);

    // 6. Message Receipts Table
    await db.run(`
      CREATE TABLE IF NOT EXISTS message_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT CHECK(status IN ('sent', 'delivered', 'read')) DEFAULT 'sent',
        delivered_at INTEGER,
        read_at INTEGER,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(message_id, user_id)
      )
    `);

    // 7. Reactions Table
    await db.run(`
      CREATE TABLE IF NOT EXISTS reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        emoji TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(message_id, user_id)
      )
    `);

    // 8. Attachments Table
    await db.run(`
      CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      )
    `);

    // 9. Optimization Indexes
    await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
    await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);`);
    await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_user_contact ON contacts(user_id, contact_user_id);`);
    await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_members_conv_user ON conversation_members(conversation_id, user_id);`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at);`);
    await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_id ON messages(client_msg_id);`);
    await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_msg_user ON message_receipts(message_id, user_id);`);
    await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_msg_user ON reactions(message_id, user_id);`);

    await db.run('COMMIT');
    
    // Migration helper for pre-existing databases
    try {
      await db.run('ALTER TABLE conversations ADD COLUMN disappearing_timer INTEGER DEFAULT 0');
      console.log('[Database] Migration: Added disappearing_timer column to conversations table.');
    } catch (e) {
      // Column might already exist
    }
    console.log('[Database] Database schema initialized successfully.');
  } catch (err) {
    try {
      await db.run('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[Database] Rollback error:', rollbackErr);
    }
    console.error('[Database] Schema transaction failed, rolled back.', err);
    throw err;
  }
}

// Run schema initialization if script is called directly
const isDirectRun = process.argv[1] && (process.argv[1].endsWith('schema.js') || process.argv[1].endsWith('schema'));
if (isDirectRun) {
  initSchema()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Database] Failed to initialize schema:', err);
      process.exit(1);
    });
}
