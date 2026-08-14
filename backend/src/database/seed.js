import bcrypt from 'bcryptjs';
import db from './connection.js';
import { initSchema } from './schema.js';

export async function seedDatabase() {
  console.log('[Database] Seeding database...');

  // Ensure schema exists first
  await initSchema();

  try {
    // Safety check: Prevent seeding if database already has users, unless forced
    const force = process.argv.includes('--force');
    const existingUsers = await db.get('SELECT COUNT(*) as count FROM users');
    if (existingUsers && existingUsers.count > 0 && !force) {
      console.log('[Database] Seeding aborted: Users table already contains data. Use "npm run db:seed -- --force" to override and force seeding.');
      return;
    }

    await db.run('BEGIN TRANSACTION');

    // Clean up existing data to ensure idempotent seeding
    await db.run('DELETE FROM attachments');
    await db.run('DELETE FROM reactions');
    await db.run('DELETE FROM message_receipts');
    await db.run('DELETE FROM messages');
    await db.run('DELETE FROM conversation_members');
    await db.run('DELETE FROM conversations');
    await db.run('DELETE FROM contacts');
    await db.run('DELETE FROM users');

    const now = Date.now();
    const passwordHash = bcrypt.hashSync('password123', 10);

    // 1. Insert Users
    const users = [
      { id: 1, username: 'mihir', phone: '+919999999999', display_name: 'Mihir', avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Mihir' },
      { id: 2, username: 'rahul', phone: '+918888888888', display_name: 'Rahul', avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Rahul' },
      { id: 3, username: 'ananya', phone: '+917777777777', display_name: 'Ananya', avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Ananya' },
      { id: 4, username: 'arjun', phone: '+916666666666', display_name: 'Arjun', avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Arjun' },
      { id: 5, username: 'priya', phone: '+915555555555', display_name: 'Priya', avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Priya' },
      { id: 6, username: 'neha', phone: '+914444444444', display_name: 'Neha', avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Neha' },
      { id: 7, username: '+919876543210', phone: '+919876543210', display_name: '+919876543210', avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=%2B919876543210' }
    ];

    for (const u of users) {
      await db.run(
        `INSERT INTO users (id, username, phone, password_hash, display_name, avatar_url, is_online, last_seen, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.id, u.username, u.phone, passwordHash, u.display_name, u.avatar_url, 0, now - 600000, now, now]
      );
    }

    // 2. Insert Contacts
    // Mihir <=> all
    for (let targetId = 2; targetId <= 7; targetId++) {
      await db.run(`INSERT INTO contacts (user_id, contact_user_id, created_at) VALUES (?, ?, ?)`, [1, targetId, now]);
      await db.run(`INSERT INTO contacts (user_id, contact_user_id, created_at) VALUES (?, ?, ?)`, [targetId, 1, now]);
    }
    // Rahul <=> Ananya, Arjun, Priya
    for (let targetId = 3; targetId <= 5; targetId++) {
      await db.run(`INSERT INTO contacts (user_id, contact_user_id, created_at) VALUES (?, ?, ?)`, [2, targetId, now]);
      await db.run(`INSERT INTO contacts (user_id, contact_user_id, created_at) VALUES (?, ?, ?)`, [targetId, 2, now]);
    }

    // 3. Create Direct Conversation between Mihir (1) and Rahul (2)
    const directConvId = 1;
    await db.run(
      `INSERT INTO conversations (id, type, name, avatar_url, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [directConvId, 'direct', null, null, 1, now - 3600000, now]
    );

    await db.run(`INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`, [directConvId, 1, 'admin', now - 3600000]);
    await db.run(`INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`, [directConvId, 2, 'member', now - 3600000]);

    // 4. Create Group Conversation "Core Team"
    const groupConvId = 2;
    await db.run(
      `INSERT INTO conversations (id, type, name, avatar_url, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [groupConvId, 'group', 'Core Team', 'https://api.dicebear.com/7.x/identicon/svg?seed=CoreTeam', 1, now - 7200000, now]
    );

    await db.run(`INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`, [groupConvId, 1, 'admin', now - 7200000]);
    await db.run(`INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`, [groupConvId, 2, 'member', now - 7200000]);
    await db.run(`INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`, [groupConvId, 3, 'member', now - 7200000]);
    await db.run(`INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`, [groupConvId, 4, 'member', now - 7200000]);

    // 5. Seed Messages & Receipts for Direct Conversation
    const msg1Id = 1;
    await db.run(
      `INSERT INTO messages (id, conversation_id, sender_id, content, message_type, status, reply_to_message_id, expires_at, client_msg_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [msg1Id, directConvId, 1, 'Hey Rahul, is the draft ready?', 'text', 'read', null, null, 'client-msg-1', now - 1800000, now - 1800000]
    );
    await db.run(`INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at) VALUES (?, ?, ?, ?, ?)`, [msg1Id, 2, 'read', now - 1790000, now - 1750000]);

    const msg2Id = 2;
    await db.run(
      `INSERT INTO messages (id, conversation_id, sender_id, content, message_type, status, reply_to_message_id, expires_at, client_msg_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [msg2Id, directConvId, 2, "Yes, I just sent it over to your email.", 'text', 'read', null, null, 'client-msg-2', now - 1600000, now - 1600000]
    );
    await db.run(`INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at) VALUES (?, ?, ?, ?, ?)`, [msg2Id, 1, 'read', now - 1590000, now - 1550000]);

    const msg3Id = 3;
    await db.run(
      `INSERT INTO messages (id, conversation_id, sender_id, content, message_type, status, reply_to_message_id, expires_at, client_msg_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [msg3Id, directConvId, 1, 'Perfect! Let me review it.', 'text', 'delivered', null, null, 'client-msg-3', now - 1000000, now - 1000000]
    );
    await db.run(`INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at) VALUES (?, ?, ?, ?, ?)`, [msg3Id, 2, 'delivered', now - 990000, null]);

    // Add reaction to msg 3
    await db.run(`INSERT INTO reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)`, [msg3Id, 2, '👍', now - 980000]);

    // 6. Seed Messages & Receipts for Group Conversation
    const msg4Id = 4;
    await db.run(
      `INSERT INTO messages (id, conversation_id, sender_id, content, message_type, status, reply_to_message_id, expires_at, client_msg_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [msg4Id, groupConvId, 1, 'Welcome to Nexa Whispers group chat!', 'text', 'read', null, null, 'client-msg-4', now - 5000000, now - 5000000]
    );
    await db.run(`INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at) VALUES (?, ?, ?, ?, ?)`, [msg4Id, 2, 'read', now - 4990000, now - 4950000]);
    await db.run(`INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at) VALUES (?, ?, ?, ?, ?)`, [msg4Id, 3, 'read', now - 4980000, now - 4940000]);
    await db.run(`INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at) VALUES (?, ?, ?, ?, ?)`, [msg4Id, 4, 'delivered', now - 4970000, null]);

    const msg5Id = 5;
    await db.run(
      `INSERT INTO messages (id, conversation_id, sender_id, content, message_type, status, reply_to_message_id, expires_at, client_msg_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [msg5Id, groupConvId, 3, 'Great to be here! The interface looks clean.', 'text', 'read', null, null, 'client-msg-5', now - 4000000, now - 4000000]
    );
    await db.run(`INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at) VALUES (?, ?, ?, ?, ?)`, [msg5Id, 1, 'read', now - 3990000, now - 3950000]);
    await db.run(`INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at) VALUES (?, ?, ?, ?, ?)`, [msg5Id, 2, 'read', now - 3980000, now - 3940000]);
    await db.run(`INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at) VALUES (?, ?, ?, ?, ?)`, [msg5Id, 4, 'delivered', now - 3970000, null]);

    const msg6Id = 6;
    await db.run(
      `INSERT INTO messages (id, conversation_id, sender_id, content, message_type, status, reply_to_message_id, expires_at, client_msg_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [msg6Id, groupConvId, 4, 'Agreed, the animations are smooth.', 'text', 'read', null, null, 'client-msg-6', now - 3000000, now - 3000000]
    );
    await db.run(`INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at) VALUES (?, ?, ?, ?, ?)`, [msg6Id, 1, 'read', now - 2990000, now - 2950000]);
    await db.run(`INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at) VALUES (?, ?, ?, ?, ?)`, [msg6Id, 2, 'read', now - 2980000, now - 2940000]);
    await db.run(`INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at) VALUES (?, ?, ?, ?, ?)`, [msg6Id, 3, 'read', now - 2970000, now - 2930000]);

    // 7. Seed Messages & Receipts for Dummy Conversation
    const dummyConvId = 3;
    await db.run(
      `INSERT INTO conversations (id, type, name, avatar_url, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dummyConvId, 'direct', null, null, 1, now - 1800000, now]
    );

    await db.run(`INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`, [dummyConvId, 1, 'admin', now - 1800000]);
    await db.run(`INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`, [dummyConvId, 7, 'member', now - 1800000]);

    const msg7Id = 7;
    await db.run(
      `INSERT INTO messages (id, conversation_id, sender_id, content, message_type, status, reply_to_message_id, expires_at, client_msg_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [msg7Id, dummyConvId, 7, 'Hey there! How is Nexa Whispers going?', 'text', 'read', null, null, 'client-msg-7', now - 1200000, now - 1200000]
    );
    await db.run(`INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at) VALUES (?, ?, ?, ?, ?)`, [msg7Id, 1, 'read', now - 1190000, now - 1150000]);

    const msg8Id = 8;
    await db.run(
      `INSERT INTO messages (id, conversation_id, sender_id, content, message_type, status, reply_to_message_id, expires_at, client_msg_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [msg8Id, dummyConvId, 1, 'Working fine! The encryption check works great.', 'text', 'read', null, null, 'client-msg-8', now - 600000, now - 600000]
    );
    await db.run(`INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at) VALUES (?, ?, ?, ?, ?)`, [msg8Id, 7, 'read', now - 590000, now - 550000]);

    const msg9Id = 9;
    await db.run(
      `INSERT INTO messages (id, conversation_id, sender_id, content, message_type, status, reply_to_message_id, expires_at, client_msg_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [msg9Id, dummyConvId, 7, 'Perfect, check the phone number header!', 'text', 'delivered', null, null, 'client-msg-9', now - 300000, now - 300000]
    );
    await db.run(`INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at) VALUES (?, ?, ?, ?, ?)`, [msg9Id, 1, 'delivered', now - 290000, null]);

    await db.run('COMMIT');
    console.log('[Database] Database seeded successfully.');
  } catch (err) {
    try {
      await db.run('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[Database] Rollback error:', rollbackErr);
    }
    console.error('[Database] Seeding transaction failed, rolled back.', err);
    throw err;
  }
}

const isDirectRun = process.argv[1] && (process.argv[1].endsWith('seed.js') || process.argv[1].endsWith('seed'));
if (isDirectRun) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Database] Failed to seed database:', err);
      process.exit(1);
    });
}
