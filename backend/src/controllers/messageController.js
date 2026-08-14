import messageService from '../services/messageService.js';

class MessageController {
  async sendMessage(req, res, next) {
    try {
      const conversationId = parseInt(req.params.id);
      const { content, clientMsgId, reply_to_message_id, expires_at } = req.body;

      let msgType = 'text';
      let expiresAt = expires_at ? parseInt(expires_at) : null;
      let replyToId = reply_to_message_id ? parseInt(reply_to_message_id) : null;

      // Detect attachments loaded via multer
      if (req.file) {
        msgType = 'attachment';
      }

      // Save core message meta
      const message = await messageService.sendMessage(req.user.id, conversationId, {
        content: req.file ? req.file.originalname : content,
        clientMsgId,
        message_type: msgType,
        expires_at: expiresAt,
        reply_to_message_id: replyToId
      });

      // Save attachment payload details if file is present
      if (req.file) {
        const fileData = req.file.buffer || Buffer.alloc(0);
        const fileUrl = `data:${req.file.mimetype};base64,${fileData.toString('base64')}`;

        await messageService.addAttachment(message.id, {
          file_name: req.file.originalname,
          file_url: fileUrl,
          file_data: fileData,
          file_type: req.file.mimetype,
          file_size: req.file.size
        });

        // Re-load enriched message structure containing the attachment attributes
        const updatedMsg = await messageService.getMessageById(message.id, req.user.id);

        const io = req.app.get('io');
        io.to(`conversation_${conversationId}`).emit('message:new', updatedMsg);

        return res.status(201).json({
          success: true,
          data: updatedMsg
        });
      }

      const io = req.app.get('io');
      io.to(`conversation_${conversationId}`).emit('message:new', message);

      res.status(201).json({
        success: true,
        data: message
      });
    } catch (err) {
      next(err);
    }
  }

  async addReaction(req, res, next) {
    try {
      const messageId = parseInt(req.params.id);
      const { emoji } = req.body;
      const data = await messageService.addReaction(messageId, req.user.id, emoji);

      const io = req.app.get('io');
      io.to(`conversation_${data.conversation_id}`).emit('message:reaction', {
        messageId,
        conversationId: data.conversation_id,
        reactions: data.reactions
      });

      res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async removeReaction(req, res, next) {
    try {
      const messageId = parseInt(req.params.id);
      const data = await messageService.removeReaction(messageId, req.user.id);

      const io = req.app.get('io');
      io.to(`conversation_${data.conversation_id}`).emit('message:reaction', {
        messageId,
        conversationId: data.conversation_id,
        reactions: data.reactions
      });

      res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async searchMessages(req, res, next) {
    try {
      const queryStr = req.query.q || '';
      const data = await messageService.searchMessages(req.user.id, queryStr);
      res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new MessageController();
