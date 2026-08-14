import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database/connection.js';
import { ConflictError, UnauthorizedError, ValidationError } from '../middleware/errorHandler.js';

class AuthService {
  async register({ username, phone, password, display_name }) {
    const sanitizedUsername = username.toLowerCase().trim();
    const sanitizedPhone = phone.trim();

    // Check if username already exists
    const existingUsername = await db.get('SELECT id FROM users WHERE username = ?', [sanitizedUsername]);
    if (existingUsername) {
      throw new ConflictError('Username is already taken.');
    }

    // Check if phone number already exists
    const existingPhone = await db.get('SELECT id FROM users WHERE phone = ?', [sanitizedPhone]);
    if (existingPhone) {
      throw new ConflictError('Phone number is already registered.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = Date.now();

    // Insert user (default unverified state can be completed by onboarding / OTP flow)
    const result = await db.run(
      `INSERT INTO users (username, phone, password_hash, display_name, avatar_url, is_online, last_seen, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitizedUsername,
        sanitizedPhone,
        passwordHash,
        display_name,
        `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(display_name)}`,
        0,
        now,
        now,
        now
      ]
    );

    return {
      id: result.lastID,
      username: sanitizedUsername,
      phone: sanitizedPhone,
      display_name
    };
  }

  async verifyOtp({ phone, code }) {
    if (code !== '123456') {
      throw new ValidationError('Invalid verification code. Use development OTP: 123456');
    }

    const user = await db.get('SELECT * FROM users WHERE phone = ?', [phone.trim()]);
    if (!user) {
      throw new ValidationError('No user found registered with this phone number.');
    }

    // Generate JWT token so user is automatically signed in
    const secret = process.env.JWT_SECRET || 'nexa_whispers_development_secret_key_13579';
    const token = jwt.sign({ id: user.id, username: user.username }, secret, { expiresIn: '7d' });

    // Update last_seen
    await db.run('UPDATE users SET last_seen = ? WHERE id = ?', [Date.now(), user.id]);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        is_online: user.is_online,
        last_seen: user.last_seen
      }
    };
  }

  async login({ username, password }) {
    const query = username.includes('+') || /^[0-9\s-]{8,15}$/.test(username)
      ? 'SELECT * FROM users WHERE phone = ?'
      : 'SELECT * FROM users WHERE username = ?';

    const user = await db.get(query, [username.toLowerCase().trim()]);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials.');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials.');
    }

    // Generate JWT
    const secret = process.env.JWT_SECRET || 'nexa_whispers_development_secret_key_13579';
    const token = jwt.sign({ id: user.id, username: user.username }, secret, { expiresIn: '7d' });

    // Update last_seen
    await db.run('UPDATE users SET last_seen = ? WHERE id = ?', [Date.now(), user.id]);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        is_online: user.is_online,
        last_seen: user.last_seen
      }
    };
  }
}

export default new AuthService();
