import db from '../database/connection.js';
import conversationService from './conversationService.js';
import { ForbiddenError, NotFoundError } from '../middleware/errorHandler.js';

class MessageService {
  async getMessages(conversationId, userId, limit = 100, offset = 0) {
    // 1. Authorize membership
    await conversationService.checkMembership(conversationId, userId);

    const now = Date.now();

    // Check and disable expired disappearing messages timer
    const conv = await db.get('SELECT disappearing_timer, disappearing_timer_started_at FROM conversations WHERE id = ?', [conversationId]);
    if (conv && conv.disappearing_timer > 0 && conv.disappearing_timer_started_at) {
      if (now >= conv.disappearing_timer_started_at + conv.disappearing_timer * 1000) {
        await db.run(
          'UPDATE conversations SET disappearing_timer = 0, disappearing_timer_started_at = NULL, updated_at = ? WHERE id = ?',
          [now, conversationId]
        );
      }
    }

    // 2. Perform lazy cleanup of expired disappearing messages
    await db.run('DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at < ?', [now]);

    // 3. Fetch messages (paginated)
    const messages = await db.all(
      `SELECT m.*, u.display_name as sender_name, u.avatar_url as sender_avatar
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC
       LIMIT ? OFFSET ?`,
      [conversationId, limit, offset]
    );

    if (messages.length === 0) {
      return [];
    }

    const messageIds = messages.map(m => m.id);
    const placeholders = messageIds.map(() => '?').join(',');

    // 4. Batch fetch reactions, attachments, and receipts in parallel
    const [allReactions, allAttachments, allReceipts] = await Promise.all([
      db.all(
        `SELECT r.id, r.user_id, r.emoji, r.message_id, u.display_name as username 
         FROM reactions r
         JOIN users u ON r.user_id = u.id
         WHERE r.message_id IN (${placeholders})`,
        messageIds
      ),
      db.all(
        `SELECT id, message_id, file_name, file_url, file_type, file_size, created_at FROM attachments WHERE message_id IN (${placeholders})`,
        messageIds
      ),
      db.all(
        `SELECT mr.message_id, mr.user_id, mr.status, mr.delivered_at, mr.read_at, u.display_name
         FROM message_receipts mr
         JOIN users u ON mr.user_id = u.id
         WHERE mr.message_id IN (${placeholders})`,
        messageIds
      )
    ]);

    // Map fetched relations to their corresponding messages by message_id
    const reactionsMap = {};
    const attachmentsMap = {};
    const receiptsMap = {};

    messageIds.forEach(id => {
      reactionsMap[id] = [];
      attachmentsMap[id] = null;
      receiptsMap[id] = [];
    });

    allReactions.forEach(r => {
      reactionsMap[r.message_id]?.push({
        id: r.id,
        user_id: r.user_id,
        emoji: r.emoji,
        username: r.username
      });
    });

    allAttachments.forEach(a => {
      attachmentsMap[a.message_id] = a;
    });

    allReceipts.forEach(rc => {
      receiptsMap[rc.message_id]?.push({
        user_id: rc.user_id,
        status: rc.status,
        delivered_at: rc.delivered_at,
        read_at: rc.read_at,
        display_name: rc.display_name
      });
    });

    return messages.map(msg => {
      if (msg.sender_id === 0) {
        msg.sender_name = 'System';
      }
      return {
        ...msg,
        reactions: reactionsMap[msg.id] || [],
        attachment: attachmentsMap[msg.id] || null,
        receipts: receiptsMap[msg.id] || []
      };
    });
  }

  async getMessageById(messageId, userId) {
    const msg = await db.get(
      `SELECT m.*, u.display_name as sender_name, u.avatar_url as sender_avatar
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [messageId]
    );
    if (!msg || (msg.expires_at && msg.expires_at < Date.now())) {
      throw new NotFoundError('Message not found.');
    }
    if (msg.sender_id === 0) {
      msg.sender_name = 'System';
    }

    await conversationService.checkMembership(msg.conversation_id, userId);

    const reactions = await db.all(
      `SELECT r.id, r.user_id, r.emoji, u.display_name as username 
       FROM reactions r
       JOIN users u ON r.user_id = u.id
       WHERE r.message_id = ?`,
      [msg.id]
    );

    const attachment = await db.get('SELECT id, message_id, file_name, file_url, file_type, file_size, created_at FROM attachments WHERE message_id = ?', [msg.id]);

    const receipts = await db.all(
      `SELECT mr.user_id, mr.status, mr.delivered_at, mr.read_at, u.display_name
       FROM message_receipts mr
       JOIN users u ON mr.user_id = u.id
       WHERE mr.message_id = ?`,
      [msg.id]
    );

    return {
      ...msg,
      reactions,
      attachment: attachment || null,
      receipts
    };
  }

  async sendMessage(senderId, conversationId, { content, clientMsgId, message_type = 'text', expires_at = null, reply_to_message_id = null }) {
    // 1. Authorize membership
    await conversationService.checkMembership(conversationId, senderId);

    // Block check for direct conversations
    const conversationType = await db.get('SELECT type FROM conversations WHERE id = ?', [conversationId]);
    if (conversationType && conversationType.type === 'direct') {
      const otherMember = await db.get(
        'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?',
        [conversationId, senderId]
      );
      if (otherMember) {
        const recipientId = otherMember.user_id;
        const blockExists = await db.get(
          'SELECT id, blocker_id FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
          [senderId, recipientId, recipientId, senderId]
        );
        if (blockExists) {
          if (blockExists.blocker_id === senderId) {
            throw new ForbiddenError('You have blocked this user. Unblock to send a message.');
          } else {
            throw new ForbiddenError('You cannot send messages to this user.');
          }
        }
      }
    }

    // 2. Idempotency Check: check if clientMsgId already exists
    const existing = await db.get('SELECT id FROM messages WHERE client_msg_id = ?', [clientMsgId]);
    if (existing) {
      console.log(`[Message Service] Duplicate message detected for clientMsgId: ${clientMsgId}. Reusing.`);
      return this.getMessageById(existing.id, senderId);
    }

    // 3. Get all other members of the conversation to seed receipts
    const members = await db.all('SELECT user_id FROM conversation_members WHERE conversation_id = ?', [conversationId]);
    const otherMembers = members.filter(m => m.user_id !== senderId);

    const now = Date.now();
    let messageId;

    // Check conversation-level disappearing message settings
    const conv = await db.get('SELECT disappearing_timer, disappearing_timer_started_at FROM conversations WHERE id = ?', [conversationId]);
    let timer = conv ? conv.disappearing_timer : 0;
    let startedAt = conv ? conv.disappearing_timer_started_at : null;
    let expiresAt = expires_at;

    if (timer > 0 && startedAt) {
      if (now >= startedAt + timer * 1000) {
        // Timer has finished! Turn it off in the database
        await db.run(
          'UPDATE conversations SET disappearing_timer = 0, disappearing_timer_started_at = NULL, updated_at = ? WHERE id = ?',
          [now, conversationId]
        );
        timer = 0;
        startedAt = null;
        expiresAt = null;
        // Clean up expired messages
        await db.run('DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at < ?', [now]);
      } else {
        // Timer is active: expires at the end of the one-off window
        expiresAt = startedAt + timer * 1000;
      }
    }

    await db.run('BEGIN TRANSACTION');
    try {
      // Insert message
      const result = await db.run(
        `INSERT INTO messages (conversation_id, sender_id, content, message_type, status, reply_to_message_id, expires_at, client_msg_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [conversationId, senderId, content, message_type, 'sent', reply_to_message_id, expiresAt, clientMsgId, now, now]
      );
      messageId = result.lastID;

      // Seed receipts for other members
      for (const member of otherMembers) {
        await db.run(
          `INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at)
           VALUES (?, ?, ?, ?, ?)`,
          [messageId, member.user_id, 'sent', null, null]
        );
      }

      // Update conversation timestamp
      await db.run('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, conversationId]);

      await db.run('COMMIT');
    } catch (err) {
      try {
        await db.run('ROLLBACK');
      } catch (rbErr) { }
      throw err;
    }

    return this.getMessageById(messageId, senderId);
  }

  async addAttachment(messageId, { file_name, file_url, file_data, file_type, file_size }) {
    const now = Date.now();
    const result = await db.run(
      `INSERT INTO attachments (message_id, file_name, file_url, file_data, file_type, file_size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [messageId, file_name, '', file_data || null, file_type, file_size, now]
    );
    const attachmentId = result.lastID;
    const dynamicUrl = `/api/messages/attachments/${attachmentId}`;
    await db.run(
      'UPDATE attachments SET file_url = ? WHERE id = ?',
      [dynamicUrl, attachmentId]
    );
  }

  async markAsRead(conversationId, userId) {
    const now = Date.now();

    // Find all message receipts in this conversation for this user that are not yet 'read'
    const unreadReceipts = await db.all(
      `SELECT mr.message_id
       FROM message_receipts mr
       JOIN messages m ON mr.message_id = m.id
       WHERE m.conversation_id = ? AND mr.user_id = ? AND mr.status != 'read'`,
      [conversationId, userId]
    );

    if (unreadReceipts.length === 0) {
      return [];
    }

    const messageIds = unreadReceipts.map(r => r.message_id);

    await db.run('BEGIN TRANSACTION');
    try {
      // Update receipts
      await db.run(
        `UPDATE message_receipts 
         SET status = 'read', read_at = ? 
         WHERE user_id = ? AND message_id IN (${messageIds.map(() => '?').join(',')})`,
        [now, userId, ...messageIds]
      );

      // If all recipients have read, or for direct chats, sync message overall status if needed
      // (For simple direct messaging, we update messages.status to 'read' if recipient read it)
      await db.run(
        `UPDATE messages
         SET status = 'read', updated_at = ?
         WHERE id IN (${messageIds.map(() => '?').join(',')})`,
        [now, ...messageIds]
      );

      await db.run('COMMIT');
    } catch (err) {
      try {
        await db.run('ROLLBACK');
      } catch (rbErr) { }
      throw err;
    }

    return messageIds;
  }

  async markAsDelivered(conversationId, userId) {
    const now = Date.now();

    // Find all message receipts in this conversation for this user that are 'sent'
    const undeliveredReceipts = await db.all(
      `SELECT mr.message_id
       FROM message_receipts mr
       JOIN messages m ON mr.message_id = m.id
       WHERE m.conversation_id = ? AND mr.user_id = ? AND mr.status = 'sent'`,
      [conversationId, userId]
    );

    if (undeliveredReceipts.length === 0) {
      return [];
    }

    const messageIds = undeliveredReceipts.map(r => r.message_id);

    await db.run('BEGIN TRANSACTION');
    try {
      // Update receipts
      await db.run(
        `UPDATE message_receipts 
         SET status = 'delivered', delivered_at = ? 
         WHERE user_id = ? AND message_id IN (${messageIds.map(() => '?').join(',')})`,
        [now, userId, ...messageIds]
      );

      // Sync message overall status
      await db.run(
        `UPDATE messages
         SET status = 'delivered', updated_at = ?
         WHERE id IN (${messageIds.map(() => '?').join(',')})`,
        [now, ...messageIds]
      );

      await db.run('COMMIT');
    } catch (err) {
      try {
        await db.run('ROLLBACK');
      } catch (rbErr) { }
      throw err;
    }

    return messageIds;
  }

  async addReaction(messageId, userId, emoji) {
    const msg = await db.get('SELECT conversation_id FROM messages WHERE id = ?', [messageId]);
    if (!msg) {
      throw new NotFoundError('Message not found.');
    }

    await conversationService.checkMembership(msg.conversation_id, userId);

    const now = Date.now();
    // Insert or replace reaction
    await db.run(
      `INSERT INTO reactions (message_id, user_id, emoji, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(message_id, user_id) DO UPDATE SET emoji = ?, created_at = ?`,
      [messageId, userId, emoji, now, emoji, now]
    );

    return this.getMessageById(messageId, userId);
  }

  async removeReaction(messageId, userId) {
    await db.run(
      'DELETE FROM reactions WHERE message_id = ? AND user_id = ?',
      [messageId, userId]
    );
    return this.getMessageById(messageId, userId);
  }

  async searchMessages(userId, queryStr) {
    if (!queryStr.trim()) return [];
    const term = `%${queryStr.trim()}%`;
    const now = Date.now();

    const messages = await db.all(
      `SELECT m.*, u.display_name as sender_name, u.avatar_url as sender_avatar, 
              c.type as conversation_type, c.name as conversation_name
       FROM messages m
       JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
       LEFT JOIN users u ON m.sender_id = u.id
       LEFT JOIN conversations c ON m.conversation_id = c.id
       WHERE cm.user_id = ? 
         AND m.content LIKE ? 
         AND m.message_type = 'text'
         AND (m.expires_at IS NULL OR m.expires_at > ?)
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [userId, term, now]
    );

    for (const msg of messages) {
      if (msg.sender_id === 0) {
        msg.sender_name = 'System';
      }
      if (msg.conversation_type === 'direct') {
        const otherMember = await db.get(
          `SELECT u.display_name 
           FROM conversation_members cm
           JOIN users u ON cm.user_id = u.id
           WHERE cm.conversation_id = ? AND cm.user_id != ?`,
          [msg.conversation_id, userId]
        );
        msg.conversation_name = otherMember ? otherMember.display_name : 'Direct Chat';
      }
    }

    return messages;
  }

  async deleteMessage(messageId, userId) {
    const msg = await db.get(
      `SELECT m.id, m.sender_id, m.conversation_id, a.file_data 
       FROM messages m
       LEFT JOIN attachments a ON m.id = a.message_id
       WHERE m.id = ?`,
      [messageId]
    );

    if (!msg) {
      throw new Error('Message not found.');
    }

    if (msg.sender_id !== userId) {
      throw new Error('Unauthorized to delete this message.');
    }

    // Optional: Delete from Cloudinary if it's stored there
    if (msg.file_data && typeof msg.file_data === 'string' && msg.file_data.startsWith('http')) {
      try {
        const urlParts = msg.file_data.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        if (uploadIndex !== -1 && uploadIndex < urlParts.length - 2) {
          const publicIdWithExt = urlParts[urlParts.length - 1];
          const publicId = publicIdWithExt.split('.').slice(0, -1).join('.');
          console.log(`[Cloudinary] Deleting file during message deletion: ${publicId}`);
          
          const { v2: cloudinary } = await import('cloudinary');
          if (process.env.CLOUDINARY_CLOUD_NAME) {
            cloudinary.config({
              cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
              api_key: process.env.CLOUDINARY_API_KEY,
              api_secret: process.env.CLOUDINARY_API_SECRET
            });
            await cloudinary.uploader.destroy(publicId);
            console.log('[Cloudinary] File deleted successfully.');
          }
        }
      } catch (cloudinaryErr) {
        console.error('[Cloudinary] Failed to delete file during message deletion:', cloudinaryErr);
      }
    }

    await db.run('DELETE FROM messages WHERE id = ?', [messageId]);

    return {
      messageId,
      conversationId: msg.conversation_id
    };
  }
}

export default new MessageService();
