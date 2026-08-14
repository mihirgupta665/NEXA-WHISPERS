import { Router } from 'express';
import authController from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validateRegister, validateVerifyOtp, validateLogin } from '../validators/authValidator.js';

const router = Router();

router.post('/register', validateRegister, authController.register);
router.post('/verify-otp', validateVerifyOtp, authController.verifyOtp);
router.post('/login', validateLogin, authController.login);
router.post('/logout', authController.logout);
router.get('/me', authMiddleware, authController.me);

export default router;
