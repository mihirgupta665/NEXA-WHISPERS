import authService from '../services/authService.js';

class AuthController {
  async register(req, res, next) {
    try {
      const data = await authService.register(req.body);
      res.status(201).json({
        success: true,
        data,
        message: 'Registration successful. OTP verification required.'
      });
    } catch (err) {
      next(err);
    }
  }

  async verifyOtp(req, res, next) {
    try {
      const { token, user } = await authService.verifyOtp(req.body);

      // Set cookie configuration parameters
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.status(200).json({
        success: true,
        data: { user, token },
        message: 'OTP verification and login successful.'
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { phone } = await authService.login(req.body);
      res.status(200).json({
        success: true,
        data: { phone }
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      });
      res.status(200).json({
        success: true,
        message: 'Logged out successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  async me(req, res, next) {
    try {
      const token = req.cookies?.token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
      res.status(200).json({
        success: true,
        data: { user: req.user, token }
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new AuthController();
