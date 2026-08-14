import { Router } from 'express';
import conversationController from '../controllers/conversationController.js';
import messageController from '../controllers/messageController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import { validateCreateDirect, validateCreateGroup } from '../validators/conversationValidator.js';
import { validateSendMessage } from '../validators/messageValidator.js';

const router = Router();

router.use(authMiddleware);

router.get('/', conversationController.getConversations);
router.post('/direct', validateCreateDirect, conversationController.createDirect);
router.post('/group', validateCreateGroup, conversationController.createGroup);
router.get('/:id', conversationController.getConversationDetails);
router.get('/:id/messages', conversationController.getConversationMessages);
router.put('/:id/disappearing-timer', conversationController.updateDisappearingTimer);

// Send message with optional file upload integration
router.post('/:id/messages', upload.single('file'), validateSendMessage, messageController.sendMessage);

// Group member administration
router.post('/:id/members', conversationController.addMember);
router.delete('/:id/members/:userId', conversationController.removeMember);

export default router;
