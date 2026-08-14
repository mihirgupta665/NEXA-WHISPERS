import { ValidationError } from '../middleware/errorHandler.js';

export function validateAddContact(req, res, next) {
  const { contactUsername } = req.body;
  const errors = [];

  if (!contactUsername || typeof contactUsername !== 'string' || contactUsername.trim().length < 3) {
    errors.push({ field: 'contactUsername', message: 'Valid contact username is required.' });
  }

  if (errors.length > 0) {
    return next(new ValidationError('Invalid contact input data', errors));
  }
  next();
}
