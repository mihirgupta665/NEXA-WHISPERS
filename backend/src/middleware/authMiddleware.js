import jwt from 'jsonwebtoken';
import db from '../database/connection.js';
import { UnauthorizedError } from './errorHandler.js';

export default async function authMiddleware(req, res, next) {
  try {
    let token = req.cookies?.token;

    // Fallback check in headers for Postman/client flexibility
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new UnauthorizedError('Authentication token is missing. Please log in.');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'nexa_whispers_development_secret_key_13579');
    } catch (err) {
      throw new UnauthorizedError('Authentication token is invalid or expired.');
    }

    // Load active user metadata from the database
    const user = await db.get(
      'SELECT id, username, phone, display_name, avatar_url, is_online, last_seen FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user) {
      throw new UnauthorizedError('Authenticated user does not exist.');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
