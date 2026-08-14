import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import db from '../database/connection.js';
import { handlePresence } from './presenceHandler.js';
import { handleMessageEvents } from './messageHandler.js';

const parseCookies = (cookieString) => {
  if (!cookieString) return {};
  return cookieString.split(';').reduce((acc, pair) => {
    const parts = pair.split('=');
    const key = parts[0]?.trim();
    const val = parts.slice(1).join('=')?.trim();
    if (key && val) acc[key] = decodeURIComponent(val);
    return acc;
  }, {});
};

export function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        if (!origin || origin === clientUrl || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true
    }
  });

  // Secure middleware for validating Socket.IO handshake sessions
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      let token = cookies.token;

      // Fallback query parameters for non-browser/debugging clients
      if (!token && socket.handshake.auth?.token) {
        token = socket.handshake.auth.token;
      }
      if (!token && socket.handshake.query?.token) {
        token = socket.handshake.query.token;
      }

      if (!token) {
        return next(new Error('Connection unauthorized: Session token is missing.'));
      }

      const secret = process.env.JWT_SECRET || 'nexa_whispers_development_secret_key_13579';
      const decoded = jwt.verify(token, secret);

      const user = await db.get('SELECT id, username, display_name FROM users WHERE id = ?', [decoded.id]);
      if (!user) {
        return next(new Error('Connection unauthorized: User account not found.'));
      }

      socket.userId = user.id;
      socket.username = user.username;
      socket.displayName = user.display_name;
      next();
    } catch (err) {
      console.error('[Socket IO Auth] Handshake validation failed:', err.message);
      next(new Error('Connection unauthorized: Authentication failed.'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`[Socket IO] Secure socket connected: ${socket.username} (Socket: ${socket.id})`);

    try {
      // Find all conversations of which the user is a member, and join corresponding rooms
      const userConvs = await db.all('SELECT conversation_id FROM conversation_members WHERE user_id = ?', [userId]);
      for (const conv of userConvs) {
        socket.join(`conversation_${conv.conversation_id}`);
      }

      // Delegate triggers to modular presence and messaging managers
      await handlePresence(io, socket);
      handleMessageEvents(io, socket);
    } catch (err) {
      console.error('[Socket IO] Error configuring websocket sub-handlers:', err);
    }
  });

  return io;
}
