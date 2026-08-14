import storyService from '../services/storyService.js';

class StoryController {
  async getActiveStories(req, res, next) {
    try {
      const stories = await storyService.getActiveStories();
      res.status(200).json({
        success: true,
        data: stories
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new StoryController();
