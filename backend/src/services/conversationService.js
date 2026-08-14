import db from '../database/connection.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

class ConversationService {
  async getConversations(userId) {
    // 1. Get all conversations user belongs to
    const conversations = await db.all(
      `SELECT c.id, c.type, c.name, c.avatar_url, c.created_by, c.disappearing_timer, c.disappearing_timer_started_at, c.pinned_message_id, c.created_at, c.updated_at,
              m_pin.content as pinned_message_content, m_pin.message_type as pinned_message_type, u_pin.display_name as pinned_message_sender_name
       FROM conversations c
       JOIN conversation_members cm ON c.id = cm.conversation_id
       LEFT JOIN messages m_pin ON c.pinned_message_id = m_pin.id
       LEFT JOIN users u_pin ON m_pin.sender_id = u_pin.id
       WHERE cm.user_id = ?
       ORDER BY c.updated_at DESC`,
      [userId]
    );

    if (conversations.length === 0) {
      return [];
    }

    const now = Date.now();
    const convIds = conversations.map(c => c.id);
    const placeholders = convIds.map(() => '?').join(',');

    // 2. Fetch members for all conversations in a single batch query
    const allMembers = await db.all(
      `SELECT cm.conversation_id, u.id, u.username, u.display_name, u.avatar_url, u.is_online, u.last_seen, cm.role
       FROM conversation_members cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.conversation_id IN (${placeholders})`,
      convIds
    );

    // Map members by conversation_id
    const membersMap = {};
    convIds.forEach(id => {
      membersMap[id] = [];
    });
    allMembers.forEach(m => {
      membersMap[m.conversation_id]?.push({
        id: m.id,
        username: m.username,
        display_name: m.display_name,
        avatar_url: m.avatar_url,
        is_online: m.is_online,
        last_seen: m.last_seen,
        role: m.role
      });
    });

    // 3. Parallelize fetching latest message and unread count per conversation
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        if (conv.disappearing_timer > 0 && conv.disappearing_timer_started_at) {
          if (now >= conv.disappearing_timer_started_at + conv.disappearing_timer * 1000) {
            await db.run(
              'UPDATE conversations SET disappearing_timer = 0, disappearing_timer_started_at = NULL, updated_at = ? WHERE id = ?',
              [now, conv.id]
            );
            conv.disappearing_timer = 0;
            conv.disappearing_timer_started_at = null;
          }
        }

        const members = membersMap[conv.id] || [];

        const [latestMessage, unread] = await Promise.all([
          db.get(
            `SELECT m.id, m.content, m.message_type, m.status, m.sender_id, m.created_at, u.display_name as sender_name
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             WHERE m.conversation_id = ?
               AND (m.expires_at IS NULL OR m.expires_at > ?)
             ORDER BY m.created_at DESC, m.id DESC
             LIMIT 1`,
            [conv.id, now]
          ),
          db.get(
            `SELECT COUNT(m.id) as count
             FROM messages m
             LEFT JOIN message_receipts mr ON m.id = mr.message_id AND mr.user_id = ?
             WHERE m.conversation_id = ?
               AND m.sender_id != ?
               AND (mr.status IS NULL OR mr.status != 'read')`,
            [userId, conv.id, userId]
          )
        ]);

        // If direct, resolve name & avatar to the other participant
        let name = conv.name;
        let avatarUrl = conv.avatar_url;
        if (conv.type === 'direct') {
          const otherMember = members.find(m => m.id !== userId);
          if (otherMember) {
            name = otherMember.display_name;
            avatarUrl = otherMember.avatar_url;
          } else {
            // Self chat fallback
            const self = members.find(m => m.id === userId);
            name = self ? `${self.display_name} (You)` : 'Saved Messages';
            avatarUrl = self ? self.avatar_url : '';
          }
        }

        return {
          ...conv,
          name,
          avatar_url: avatarUrl,
          members,
          latest_message: latestMessage || null,
          unread_count: unread ? unread.count : 0
        };
      })
    );

    // Sort by latest message date (or created_at if no messages) descending
    return enrichedConversations.sort((a, b) => {
      const timeA = a.latest_message ? a.latest_message.created_at : a.updated_at;
      const timeB = b.latest_message ? b.latest_message.created_at : b.updated_at;
      return timeB - timeA;
    });
  }

  async checkMembership(conversationId, userId) {
    const member = await db.get(
      'SELECT role FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [conversationId, userId]
    );
    if (!member) {
      throw new ForbiddenError('You are not authorized to access this conversation.');
    }
    return member;
  }

  async getConversationById(conversationId, userId) {
    const conv = await db.get(
      `SELECT c.*, m_pin.content as pinned_message_content, m_pin.message_type as pinned_message_type, u_pin.display_name as pinned_message_sender_name
       FROM conversations c
       LEFT JOIN messages m_pin ON c.pinned_message_id = m_pin.id
       LEFT JOIN users u_pin ON m_pin.sender_id = u_pin.id
       WHERE c.id = ?`,
      [conversationId]
    );
    if (!conv) {
      throw new NotFoundError('Conversation not found.');
    }

    await this.checkMembership(conversationId, userId);

    const members = await db.all(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_online, u.last_seen, cm.role
       FROM conversation_members cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.conversation_id = ?`,
      [conversationId]
    );

    let name = conv.name;
    let avatarUrl = conv.avatar_url;
    if (conv.type === 'direct') {
      const otherMember = members.find(m => m.id !== userId);
      if (otherMember) {
        name = otherMember.display_name;
        avatarUrl = otherMember.avatar_url;
      } else {
        const self = members.find(m => m.id === userId);
        name = self ? `${self.display_name} (You)` : 'Saved Messages';
        avatarUrl = self ? self.avatar_url : '';
      }
    }

    return {
      ...conv,
      name,
      avatar_url: avatarUrl,
      members
    };
  }

  async createDirect(userId, recipientId) {
    if (userId === recipientId) {
      throw new ValidationError('You cannot start a direct conversation with yourself.');
    }

    // Check if recipient exists
    const recipient = await db.get('SELECT id FROM users WHERE id = ?', [recipientId]);
    if (!recipient) {
      throw new NotFoundError('Recipient user not found.');
    }

    // Check if direct conversation already exists between these two users
    const existing = await db.get(
      `SELECT c.id FROM conversations c
       JOIN conversation_members cm1 ON c.id = cm1.conversation_id
       JOIN conversation_members cm2 ON c.id = cm2.conversation_id
       WHERE c.type = 'direct'
         AND cm1.user_id = ?
         AND cm2.user_id = ?`,
      [userId, recipientId]
    );

    if (existing) {
      return this.getConversationById(existing.id, userId);
    }

    // Otherwise, create a new direct conversation transactionally
    const now = Date.now();
    let conversationId;

    await db.run('BEGIN TRANSACTION');
    try {
      const result = await db.run(
        `INSERT INTO conversations (type, name, avatar_url, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['direct', null, null, userId, now, now]
      );
      conversationId = result.lastID;

      await db.run(
        `INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
         VALUES (?, ?, ?, ?)`,
        [conversationId, userId, 'admin', now]
      );

      await db.run(
        `INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
         VALUES (?, ?, ?, ?)`,
        [conversationId, recipientId, 'member', now]
      );

      await db.run('COMMIT');
    } catch (err) {
      try {
        await db.run('ROLLBACK');
      } catch (rbErr) {}
      throw err;
    }

    return this.getConversationById(conversationId, userId);
  }

  async createGroup(userId, { name, avatar_url, memberIds }) {
    const now = Date.now();
    let conversationId;

    // Filter and sanitize member IDs
    const uniqueMembers = [...new Set([userId, ...memberIds])];

    await db.run('BEGIN TRANSACTION');
    try {
      const result = await db.run(
        `INSERT INTO conversations (type, name, avatar_url, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'group',
          name.trim(),
          avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name.trim())}`,
          userId,
          now,
          now
        ]
      );
      conversationId = result.lastID;

      // Insert creator as admin
      await db.run(
        `INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
         VALUES (?, ?, ?, ?)`,
        [conversationId, userId, 'admin', now]
      );

      // Insert other members
      for (const mId of uniqueMembers) {
        if (mId !== userId) {
          await db.run(
            `INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
             VALUES (?, ?, ?, ?)`,
            [conversationId, mId, 'member', now]
          );
        }
      }

      await db.run('COMMIT');
    } catch (err) {
      try {
        await db.run('ROLLBACK');
      } catch (rbErr) {}
      throw err;
    }

    return this.getConversationById(conversationId, userId);
  }

  async addMember(conversationId, requesterId, targetUserId) {
    // 1. requester must be admin
    const requesterMember = await this.checkMembership(conversationId, requesterId);
    if (requesterMember.role !== 'admin') {
      throw new ForbiddenError('Only group admins can add new members.');
    }

    // 2. Target must exist
    const target = await db.get('SELECT id FROM users WHERE id = ?', [targetUserId]);
    if (!target) {
      throw new NotFoundError('Target user not found.');
    }

    // 3. Target must not already be in group
    const existing = await db.get(
      'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [conversationId, targetUserId]
    );
    if (existing) {
      throw new ValidationError('User is already a member of this conversation.');
    }

    await db.run(
      `INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
       VALUES (?, ?, ?, ?)`,
      [conversationId, targetUserId, 'member', Date.now()]
    );

    // Update conversation updated_at
    await db.run('UPDATE conversations SET updated_at = ? WHERE id = ?', [Date.now(), conversationId]);

    return this.getConversationById(conversationId, requesterId);
  }

  async removeMember(conversationId, requesterId, targetUserId) {
    const requesterMember = await this.checkMembership(conversationId, requesterId);

    // If removing someone else, requester must be admin
    if (requesterId !== targetUserId && requesterMember.role !== 'admin') {
      throw new ForbiddenError('Only group admins can remove other members.');
    }

    // Remove member
    await db.run(
      'DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [conversationId, targetUserId]
    );

    // If no members left in group, optionally delete group or keep
    const memberCount = await db.get('SELECT COUNT(*) as count FROM conversation_members WHERE conversation_id = ?', [conversationId]);
    if (memberCount.count === 0) {
      await db.run('DELETE FROM conversations WHERE id = ?', [conversationId]);
    } else {
      // If the admin leaves, assign next member as admin
      if (requesterId === targetUserId && requesterMember.role === 'admin') {
        const nextMember = await db.get('SELECT user_id FROM conversation_members WHERE conversation_id = ? LIMIT 1', [conversationId]);
        if (nextMember) {
          await db.run(
            "UPDATE conversation_members SET role = 'admin' WHERE conversation_id = ? AND user_id = ?",
            [conversationId, nextMember.user_id]
          );
        }
      }
      await db.run('UPDATE conversations SET updated_at = ? WHERE id = ?', [Date.now(), conversationId]);
    }

    return { success: true };
  }

  async updateDisappearingTimer(conversationId, userId, timer) {
    // 1. Authorize membership
    await this.checkMembership(conversationId, userId);

    // 2. Validate timer value (0, 5, 10, 30, 60, 3600, 86400)
    const allowed = [0, 5, 10, 30, 60, 3600, 86400];
    if (!allowed.includes(timer)) {
      throw new Error('Invalid disappearing messages duration.');
    }

    // 3. Update database
    const now = Date.now();
    const startedAt = timer > 0 ? now : null;
    await db.run(
      'UPDATE conversations SET disappearing_timer = ?, disappearing_timer_started_at = ?, updated_at = ? WHERE id = ?',
      [timer, startedAt, now, conversationId]
    );

    // 4. Automatically write a system notification message (sender_id = 0)
    const systemMsgId = `system-${now}-${Math.round(Math.random() * 1e6)}`;
    const timerText = timer === 0 ? 'disabled disappearing messages.' : `set the disappearing message timer to ${timer} seconds.`;
    
    const sender = await db.get('SELECT display_name FROM users WHERE id = ?', [userId]);
    const senderName = sender ? sender.display_name : 'Someone';
    const messageContent = `${senderName} ${timerText}`;
    
    const result = await db.run(
      `INSERT INTO messages (conversation_id, sender_id, content, message_type, status, client_msg_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [conversationId, 0, messageContent, 'text', 'sent', systemMsgId, now, now]
    );
    const systemMessageId = result.lastID;

    const systemMsg = {
      id: systemMessageId,
      conversation_id: conversationId,
      sender_id: 0,
      sender_name: 'System',
      sender_avatar: null,
      content: messageContent,
      message_type: 'text',
      status: 'sent',
      reply_to_message_id: null,
      expires_at: null,
      client_msg_id: systemMsgId,
      created_at: now,
      updated_at: now,
      reactions: [],
      attachment: null,
      receipts: []
    };

    const conversation = await this.getConversationById(conversationId, userId);
    return { conversation, systemMessage: systemMsg };
  }

  async pinMessage(conversationId, userId, messageId) {
    await this.checkMembership(conversationId, userId);
    const msg = await db.get('SELECT id FROM messages WHERE id = ? AND conversation_id = ?', [messageId, conversationId]);
    if (!msg) {
      throw new NotFoundError('Message not found in this conversation.');
    }
    await db.run('UPDATE conversations SET pinned_message_id = ?, updated_at = ? WHERE id = ?', [messageId, Date.now(), conversationId]);
    return this.getConversationById(conversationId, userId);
  }

  async unpinMessage(conversationId, userId) {
    await this.checkMembership(conversationId, userId);
    await db.run('UPDATE conversations SET pinned_message_id = NULL, updated_at = ? WHERE id = ?', [Date.now(), conversationId]);
    return this.getConversationById(conversationId, userId);
  }
}

export default new ConversationService();
