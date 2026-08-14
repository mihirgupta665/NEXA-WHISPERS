import { ValidationError } from '../middleware/errorHandler.js';

export function validateSendMessage(req, res, next) {
  const { content, clientMsgId } = req.body;
  const errors = [];

  // Content is required unless there is an uploaded file
  if (!req.file && (!content || typeof content !== 'string' || content.trim().length === 0)) {
    errors.push({ field: 'content', message: 'Message content cannot be empty.' });
  }
  if (!clientMsgId || typeof clientMsgId !== 'string' || clientMsgId.trim().length === 0) {
    errors.push({ field: 'clientMsgId', message: 'A unique client message ID is required for idempotency.' });
  }

  if (errors.length > 0) {
    return next(new ValidationError('Invalid message data', errors));
  }
  next();
}

export function validateAddReaction(req, res, next) {
  const { emoji } = req.body;
  const errors = [];

  if (!emoji || typeof emoji !== 'string' || emoji.trim().length === 0) {
    errors.push({ field: 'emoji', message: 'Emoji character is required.' });
  }

  if (errors.length > 0) {
    return next(new ValidationError('Invalid reaction data', errors));
  }
  next();
}
