import db from '../database/connection.js';

// Global registry of online users: Map<userId, Set<socketId>>
export const onlineUsers = new Map();

export async function handlePresence(io, socket) {
  const userId = socket.userId;

  // Add socket to registry
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);

  // If this is the user's first connection, mark online in SQLite and broadcast status
  if (onlineUsers.get(userId).size === 1) {
    const now = Date.now();
    await db.run('UPDATE users SET is_online = 1, last_seen = ? WHERE id = ?', [now, userId]);

    // Retrieve user contacts
    const contacts = await db.all('SELECT contact_user_id FROM contacts WHERE user_id = ?', [userId]);

    // Sync only to online contacts
    for (const c of contacts) {
      if (onlineUsers.has(c.contact_user_id)) {
        const targetSockets = onlineUsers.get(c.contact_user_id);
        for (const sId of targetSockets) {
          io.to(sId).emit('user:online', { userId, last_seen: now });
        }
      }
    }
  }

  // Monitor disconnect lifecycle
  socket.on('disconnect', async () => {
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      // Clean up when all sessions for user disconnect
      if (sockets.size === 0) {
        onlineUsers.delete(userId);
        const now = Date.now();
        await db.run('UPDATE users SET is_online = 0, last_seen = ? WHERE id = ?', [now, userId]);

        const contacts = await db.all('SELECT contact_user_id FROM contacts WHERE user_id = ?', [userId]);
        for (const c of contacts) {
          if (onlineUsers.has(c.contact_user_id)) {
            const targetSockets = onlineUsers.get(c.contact_user_id);
            for (const sId of targetSockets) {
              io.to(sId).emit('user:offline', { userId, last_seen: now });
            }
          }
        }
      }
    }
  });
}
