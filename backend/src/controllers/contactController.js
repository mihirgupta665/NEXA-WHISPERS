import contactService from '../services/contactService.js';
import userService from '../services/userService.js';

class ContactController {
  async getContacts(req, res, next) {
    try {
      const data = await contactService.getContacts(req.user.id);
      res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async addContact(req, res, next) {
    try {
      const { contactUsername } = req.body;
      const contactUser = await contactService.addContact(req.user.id, contactUsername);
      res.status(201).json({
        success: true,
        data: contactUser,
        message: 'Contact added successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  async removeContact(req, res, next) {
    try {
      const contactUserId = parseInt(req.params.id);
      await contactService.removeContact(req.user.id, contactUserId);
      res.status(200).json({
        success: true,
        message: 'Contact removed successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  async searchUsers(req, res, next) {
    try {
      const queryStr = req.query.q || '';
      const data = await userService.searchUsers(queryStr, req.user.id);
      res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new ContactController();
