import db from '../database/connection.js';
import { ConflictError, NotFoundError } from '../middleware/errorHandler.js';

class UserService {
  async getUserById(id) {
    const user = await db.get(
      'SELECT id, username, phone, display_name, avatar_url, is_online, last_seen, created_at, about FROM users WHERE id = ?',
      [id]
    );
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    return user;
  }

  async updateProfile(id, { display_name, username, phone, avatar_url, about }) {
    const currentUser = await this.getUserById(id);
    const updates = [];
    const params = [];

    if (display_name !== undefined) {
      updates.push('display_name = ?');
      params.push(display_name.trim());
    }

    if (username !== undefined) {
      const sanitizedUsername = username.toLowerCase().trim();
      if (sanitizedUsername !== currentUser.username) {
        const existing = await db.get('SELECT id FROM users WHERE username = ?', [sanitizedUsername]);
        if (existing) {
          throw new ConflictError('Username is already taken.');
        }
        updates.push('username = ?');
        params.push(sanitizedUsername);
      }
    }

    if (phone !== undefined) {
      const sanitizedPhone = phone.trim();
      if (sanitizedPhone !== currentUser.phone) {
        const existing = await db.get('SELECT id FROM users WHERE phone = ?', [sanitizedPhone]);
        if (existing) {
          throw new ConflictError('Phone number is already in use.');
        }
        updates.push('phone = ?');
        params.push(sanitizedPhone);
      }
    }

    if (avatar_url !== undefined) {
      updates.push('avatar_url = ?');
      params.push(avatar_url);
    }

    if (about !== undefined) {
      updates.push('about = ?');
      params.push(about.trim());
    }

    if (updates.length === 0) {
      return currentUser;
    }

    updates.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);

    await db.run(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return this.getUserById(id);
  }

  async searchUsers(queryStr, currentUserId) {
    const term = `%${queryStr.trim()}%`;
    return db.all(
      `SELECT id, username, phone, display_name, avatar_url, is_online, last_seen 
       FROM users 
       WHERE id != ? AND (username LIKE ? OR display_name LIKE ? OR phone LIKE ?)
       LIMIT 20`,
      [currentUserId, term, term, term]
    );
  }

  async blockUser(blockerId, blockedId) {
    if (blockerId === blockedId) {
      throw new ValidationError('You cannot block yourself.');
    }
    const targetUser = await db.get('SELECT id FROM users WHERE id = ?', [blockedId]);
    if (!targetUser) {
      throw new NotFoundError('User to block not found.');
    }
    await db.run(
      'INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)',
      [blockerId, blockedId, Date.now()]
    );
    return { success: true };
  }

  async unblockUser(blockerId, blockedId) {
    await db.run(
      'DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?',
      [blockerId, blockedId]
    );
    return { success: true };
  }

  async reportUser(reporterId, reportedId, reason) {
    const targetUser = await db.get('SELECT id FROM users WHERE id = ?', [reportedId]);
    if (!targetUser) {
      throw new NotFoundError('User to report not found.');
    }
    await db.run(
      'INSERT INTO reports (reporter_id, reported_id, reason, created_at) VALUES (?, ?, ?, ?)',
      [reporterId, reportedId, reason || null, Date.now()]
    );
    return { success: true };
  }
}

export default new UserService();
