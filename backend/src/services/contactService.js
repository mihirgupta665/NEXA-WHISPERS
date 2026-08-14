import db from '../database/connection.js';
import { ConflictError, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

class ContactService {
  async getContacts(userId) {
    return db.all(
      `SELECT u.id, u.username, u.phone, u.display_name, u.avatar_url, u.is_online, u.last_seen 
       FROM contacts c
       JOIN users u ON c.contact_user_id = u.id
       WHERE c.user_id = ?
       ORDER BY u.display_name ASC`,
      [userId]
    );
  }

  async addContact(userId, contactUsername) {
    const sanitizedUsername = contactUsername.toLowerCase().trim();

    // Find contact user
    const contactUser = await db.get('SELECT id, username FROM users WHERE username = ?', [sanitizedUsername]);
    if (!contactUser) {
      throw new NotFoundError('User with this username does not exist.');
    }

    if (contactUser.id === userId) {
      throw new ValidationError('You cannot add yourself as a contact.');
    }

    // Check if relationship already exists
    const existing = await db.get(
      'SELECT id FROM contacts WHERE user_id = ? AND contact_user_id = ?',
      [userId, contactUser.id]
    );
    if (existing) {
      throw new ConflictError('This user is already in your contact list.');
    }

    const now = Date.now();
    await db.run('BEGIN TRANSACTION');
    try {
      await db.run('INSERT INTO contacts (user_id, contact_user_id, created_at) VALUES (?, ?, ?)', [userId, contactUser.id, now]);
      await db.run('INSERT OR IGNORE INTO contacts (user_id, contact_user_id, created_at) VALUES (?, ?, ?)', [contactUser.id, userId, now]);
      await db.run('COMMIT');
    } catch (err) {
      try {
        await db.run('ROLLBACK');
      } catch (rbErr) {}
      throw err;
    }

    return contactUser;
  }

  async removeContact(userId, contactUserId) {
    await db.run('BEGIN TRANSACTION');
    try {
      await db.run('DELETE FROM contacts WHERE user_id = ? AND contact_user_id = ?', [userId, contactUserId]);
      await db.run('DELETE FROM contacts WHERE user_id = ? AND contact_user_id = ?', [contactUserId, userId]);
      await db.run('COMMIT');
      return { success: true };
    } catch (err) {
      try {
        await db.run('ROLLBACK');
      } catch (rbErr) {}
      throw err;
    }
  }
}

export default new ContactService();
