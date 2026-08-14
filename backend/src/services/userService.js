import db from '../database/connection.js';
import { ConflictError, NotFoundError } from '../middleware/errorHandler.js';

class UserService {
  async getUserById(id) {
    const user = await db.get(
      'SELECT id, username, phone, display_name, avatar_url, is_online, last_seen, created_at FROM users WHERE id = ?',
      [id]
    );
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    return user;
  }

  async updateProfile(id, { display_name, username, phone, avatar_url }) {
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
}

export default new UserService();
