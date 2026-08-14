import { ValidationError } from '../middleware/errorHandler.js';

export function validateRegister(req, res, next) {
  const { username, phone, password, display_name } = req.body;
  const errors = [];

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    errors.push({ field: 'username', message: 'Username must be at least 3 characters long.' });
  }
  if (!phone || typeof phone !== 'string' || !/^\+?[0-9\s-]{8,15}$/.test(phone)) {
    errors.push({ field: 'phone', message: 'A valid phone number is required.' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push({ field: 'password', message: 'Password must be at least 6 characters long.' });
  }
  if (!display_name || typeof display_name !== 'string' || display_name.trim().length < 1) {
    errors.push({ field: 'display_name', message: 'Display name is required.' });
  }

  if (errors.length > 0) {
    return next(new ValidationError('Invalid registration input data', errors));
  }
  next();
}

export function validateVerifyOtp(req, res, next) {
  const { phone, code } = req.body;
  const errors = [];

  if (!phone) {
    errors.push({ field: 'phone', message: 'Phone number is required.' });
  }
  if (!code || code !== '123456') {
    errors.push({ field: 'code', message: 'Invalid or missing OTP code. Use developer code 123456.' });
  }

  if (errors.length > 0) {
    return next(new ValidationError('Invalid OTP input data', errors));
  }
  next();
}

export function validateLogin(req, res, next) {
  const { username, password } = req.body;
  const errors = [];

  if (!username) {
    errors.push({ field: 'username', message: 'Username or phone is required.' });
  }
  if (!password) {
    errors.push({ field: 'password', message: 'Password is required.' });
  }

  if (errors.length > 0) {
    return next(new ValidationError('Invalid login credentials structure', errors));
  }
  next();
}
