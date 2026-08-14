import { Router } from 'express';
import userController from '../controllers/userController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.put('/profile', userController.updateProfile);
router.get('/profile/:id?', userController.getProfile);

export default router;
