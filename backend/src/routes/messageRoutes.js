import { Router } from 'express';
import messageController from '../controllers/messageController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validateAddReaction } from '../validators/messageValidator.js';

const router = Router();

router.use(authMiddleware);

router.get('/search', messageController.searchMessages);
router.get('/attachments/:id', messageController.getAttachment);
router.post('/:id/reactions', validateAddReaction, messageController.addReaction);
router.delete('/:id/reactions', messageController.removeReaction);
router.delete('/:id/reactions/:reactionId', messageController.removeReaction); // compatible with Section 50
router.delete('/:id', messageController.deleteMessage);

export default router;
