import { Router } from 'express';
import contactController from '../controllers/contactController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validateAddContact } from '../validators/contactValidator.js';

const router = Router();

router.use(authMiddleware);

router.get('/', contactController.getContacts);
router.post('/', validateAddContact, contactController.addContact);
router.delete('/:id', contactController.removeContact);
router.get('/search', contactController.searchUsers);

export default router;
