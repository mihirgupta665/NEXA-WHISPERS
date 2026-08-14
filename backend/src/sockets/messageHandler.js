import db from '../database/connection.js';
import messageService from '../services/messageService.js';

export function handleMessageEvents(io, socket) {
  const userId = socket.userId;
  const username = socket.username;

  // 1. Typing indicators
  socket.on('typing:start', ({ conversationId }) => {
    socket.to(`conversation_${conversationId}`).emit('typing:start', {
      conversationId,
      userId,
      username
    });
  });

  socket.on('typing:stop', ({ conversationId }) => {
    socket.to(`conversation_${conversationId}`).emit('typing:stop', {
      conversationId,
      userId
    });
  });

  // 2. Real-time message delivery confirmation (Triggered when client renders new message)
  socket.on('message:delivered', async ({ messageId, conversationId }) => {
    try {
      const now = Date.now();
      // Update receipt record in SQLite
      await db.run(
        `UPDATE message_receipts 
         SET status = 'delivered', delivered_at = ? 
         WHERE message_id = ? AND user_id = ? AND status = 'sent'`,
        [now, messageId, userId]
      );

      // Notify the sender and other members of the conversation
      io.to(`conversation_${conversationId}`).emit('message:status', {
        messageId,
        userId,
        status: 'delivered',
        delivered_at: now
      });
    } catch (err) {
      console.error('[Socket Message Handler] Error writing delivery receipt:', err);
    }
  });

  // 3. Real-time message read confirmation (Triggered when user opens/focuses chat)
  socket.on('message:read', async ({ conversationId }) => {
    try {
      const now = Date.now();
      const readMsgIds = await messageService.markAsRead(conversationId, userId);

      if (readMsgIds.length > 0) {
        // Sync receipts status across conversation room members
        io.to(`conversation_${conversationId}`).emit('message:read_sync', {
          conversationId,
          userId,
          messageIds: readMsgIds,
          status: 'read',
          read_at: now
        });
      }
    } catch (err) {
      console.error('[Socket Message Handler] Error writing read receipts:', err);
    }
  });
}
