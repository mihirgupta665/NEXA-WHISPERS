import { ValidationError } from '../middleware/errorHandler.js';

export function validateCreateGroup(req, res, next) {
  const { name, memberIds } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Group name must be at least 2 characters long.' });
  }
  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    errors.push({ field: 'memberIds', message: 'Group must contain at least one member.' });
  }

  if (errors.length > 0) {
    return next(new ValidationError('Invalid group conversation data', errors));
  }
  next();
}

export function validateCreateDirect(req, res, next) {
  const { recipientId } = req.body;
  const errors = [];

  if (!recipientId || isNaN(recipientId)) {
    errors.push({ field: 'recipientId', message: 'Recipient ID must be a valid number.' });
  }

  if (errors.length > 0) {
    return next(new ValidationError('Invalid direct conversation data', errors));
  }
  next();
}
