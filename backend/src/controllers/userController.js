import userService from '../services/userService.js';

class UserController {
  async updateProfile(req, res, next) {
    try {
      const { display_name, username, phone, avatar_url } = req.body;
      const updatedUser = await userService.updateProfile(req.user.id, {
        display_name,
        username,
        phone,
        avatar_url
      });
      res.status(200).json({
        success: true,
        data: { user: updatedUser },
        message: 'Profile updated successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  async getProfile(req, res, next) {
    try {
      const userId = parseInt(req.params.id) || req.user.id;
      const user = await userService.getUserById(userId);
      res.status(200).json({
        success: true,
        data: { user }
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new UserController();
