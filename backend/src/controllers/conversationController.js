import conversationService from '../services/conversationService.js';
import messageService from '../services/messageService.js';
import { onlineUsers } from '../sockets/presenceHandler.js';

class ConversationController {
  async getConversations(req, res, next) {
    try {
      const data = await conversationService.getConversations(req.user.id);
      res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async createDirect(req, res, next) {
    try {
      const { recipientId } = req.body;
      const data = await conversationService.createDirect(req.user.id, parseInt(recipientId));
      
      const io = req.app.get('io');
      if (io) {
        const memberIds = data.members.map(m => m.id);
        for (const uId of memberIds) {
          const socketIds = onlineUsers.get(uId);
          if (socketIds) {
            for (const sId of socketIds) {
              const socketInstance = io.sockets.sockets.get(sId);
              if (socketInstance) {
                socketInstance.join(`conversation_${data.id}`);
              }
            }
          }
        }
        io.to(`conversation_${data.id}`).emit('conversation:created', data);
      }

      res.status(201).json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async createGroup(req, res, next) {
    try {
      const { name, avatar_url, memberIds } = req.body;
      const data = await conversationService.createGroup(req.user.id, {
        name,
        avatar_url,
        memberIds: memberIds.map(id => parseInt(id))
      });

      const io = req.app.get('io');
      if (io) {
        const memberIdsList = data.members.map(m => m.id);
        for (const uId of memberIdsList) {
          const socketIds = onlineUsers.get(uId);
          if (socketIds) {
            for (const sId of socketIds) {
              const socketInstance = io.sockets.sockets.get(sId);
              if (socketInstance) {
                socketInstance.join(`conversation_${data.id}`);
              }
            }
          }
        }
        io.to(`conversation_${data.id}`).emit('conversation:created', data);
      }

      res.status(201).json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async getConversationDetails(req, res, next) {
    try {
      const conversationId = parseInt(req.params.id);
      const data = await conversationService.getConversationById(conversationId, req.user.id);
      res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async getConversationMessages(req, res, next) {
    try {
      const conversationId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      const data = await messageService.getMessages(conversationId, req.user.id, limit, offset);

      // Proactively mark conversation as read when retrieved by user
      await messageService.markAsRead(conversationId, req.user.id);

      res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async addMember(req, res, next) {
    try {
      const conversationId = parseInt(req.params.id);
      const { targetUserId } = req.body;
      const data = await conversationService.addMember(conversationId, req.user.id, parseInt(targetUserId));
      
      const io = req.app.get('io');
      if (io) {
        const socketIds = onlineUsers.get(parseInt(targetUserId));
        if (socketIds) {
          for (const sId of socketIds) {
            const socketInstance = io.sockets.sockets.get(sId);
            if (socketInstance) {
              socketInstance.join(`conversation_${conversationId}`);
            }
          }
        }
        io.to(`conversation_${conversationId}`).emit('group:member-added', { conversation: data, targetUserId: parseInt(targetUserId) });
      }

      res.status(200).json({
        success: true,
        data,
        message: 'Member added to group successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  async removeMember(req, res, next) {
    try {
      const conversationId = parseInt(req.params.id);
      const targetUserId = parseInt(req.params.userId);
      await conversationService.removeMember(conversationId, req.user.id, targetUserId);
      
      const io = req.app.get('io');
      if (io) {
        io.to(`conversation_${conversationId}`).emit('group:member-removed', { conversationId, targetUserId });
        const socketIds = onlineUsers.get(targetUserId);
        if (socketIds) {
          for (const sId of socketIds) {
            const socketInstance = io.sockets.sockets.get(sId);
            if (socketInstance) {
              socketInstance.leave(`conversation_${conversationId}`);
            }
          }
        }
      }

      res.status(200).json({
        success: true,
        message: 'Member removed or left group successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  async updateDisappearingTimer(req, res, next) {
    try {
      const conversationId = parseInt(req.params.id);
      const { timer } = req.body;
      const data = await conversationService.updateDisappearingTimer(conversationId, req.user.id, parseInt(timer));
      
      const io = req.app.get('io');
      if (io) {
        io.to(`conversation_${conversationId}`).emit('conversation:disappearing-timer', {
          conversationId,
          disappearing_timer: parseInt(timer),
          updatedBy: req.user.id,
          username: req.user.username
        });
      }

      res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new ConversationController();
