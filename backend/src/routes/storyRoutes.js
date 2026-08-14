import { Router } from 'express';
import storyController from '../controllers/storyController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

// Retrieve active unexpired stories (requires active session)
router.get('/', authMiddleware, storyController.getActiveStories);

export default router;
