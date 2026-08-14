import userService from '../services/userService.js';
import db from '../database/connection.js';

class UserController {
  async updateProfile(req, res, next) {
    try {
      const { display_name, username, phone, avatar_url, about } = req.body;
      const updatedUser = await userService.updateProfile(req.user.id, {
        display_name,
        username,
        phone,
        avatar_url,
        about
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
      const currentUserId = req.user.id;
      const targetUserId = parseInt(req.params.id) || currentUserId;
      const user = await userService.getUserById(targetUserId);

      let mutualGroups = [];
      let isBlocked = false;
      let blockedByTarget = false;

      if (targetUserId !== currentUserId) {
        // Query mutual group conversations between current user and target user
        mutualGroups = await db.all(
          `SELECT c.id, c.name, c.avatar_url
           FROM conversations c
           JOIN conversation_members cm1 ON c.id = cm1.conversation_id
           JOIN conversation_members cm2 ON c.id = cm2.conversation_id
           WHERE c.type = 'group'
             AND cm1.user_id = ?
             AND cm2.user_id = ?`,
          [currentUserId, targetUserId]
        );

        // Check if there is an active block
        const block = await db.get(
          'SELECT blocker_id FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
          [currentUserId, targetUserId, targetUserId, currentUserId]
        );
        if (block) {
          if (block.blocker_id === currentUserId) {
            isBlocked = true;
          } else {
            blockedByTarget = true;
          }
        }
      }

      res.status(200).json({
        success: true,
        data: {
          user,
          mutualGroups,
          isBlocked,
          blockedByTarget
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async blockUser(req, res, next) {
    try {
      const { blocked_id } = req.body;
      await userService.blockUser(req.user.id, parseInt(blocked_id));
      res.status(200).json({
        success: true,
        message: 'User blocked successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  async unblockUser(req, res, next) {
    try {
      const { blocked_id } = req.body;
      await userService.unblockUser(req.user.id, parseInt(blocked_id));
      res.status(200).json({
        success: true,
        message: 'User unblocked successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  async reportUser(req, res, next) {
    try {
      const { reported_id, reason } = req.body;
      await userService.reportUser(req.user.id, parseInt(reported_id), reason);
      res.status(200).json({
        success: true,
        message: 'User reported successfully.'
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new UserController();
