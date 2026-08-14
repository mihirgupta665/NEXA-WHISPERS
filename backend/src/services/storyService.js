import db from '../database/connection.js';

class StoryService {
  async checkAndSeedStories() {
    const now = Date.now();
    try {
      // 1. Delete expired stories
      await db.run('DELETE FROM stories WHERE expires_at < ?', [now]);

      // 2. Check if any active stories exist
      const activeCount = await db.get('SELECT COUNT(*) as count FROM stories WHERE expires_at > ?', [now]);
      
      if (!activeCount || activeCount.count === 0) {
        console.log('[Stories] No active stories found in database. Auto-seeding fresh stories...');
        
        // Define default stories with 24 hours lifespan
        const storiesToInsert = [
          { user_id: 1, content: 'Chilling out at the dev desk 🚀', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
          { user_id: 2, content: 'Vibe check! Signal aesthetics are amazing.', gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)' },
          { user_id: 3, content: 'Beautiful day outside today! ☀️', gradient: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)' },
          { user_id: 4, content: 'Coding all night, sleeping all day.', gradient: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)' },
          { user_id: 5, content: 'Just baked some fresh chocolate chip cookies!', gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' }
        ];

        await db.run('BEGIN TRANSACTION');
        for (const s of storiesToInsert) {
          // Check if the user exists before seeding to prevent foreign key constraint issues
          const userExists = await db.get('SELECT id FROM users WHERE id = ?', [s.user_id]);
          if (userExists) {
            await db.run(
              `INSERT INTO stories (user_id, content, gradient, expires_at, created_at)
               VALUES (?, ?, ?, ?, ?)`,
              [s.user_id, s.content, s.gradient, now + 24 * 60 * 60 * 1000, now]
            );
          }
        }
        await db.run('COMMIT');
        console.log('[Stories] Fresh stories auto-seeded successfully.');
      } else {
        console.log(`[Stories] Found ${activeCount.count} active stories in database. Skipping seed.`);
      }
    } catch (err) {
      console.error('[Stories] Failed check and auto-seed database transaction:', err);
      try {
        await db.run('ROLLBACK');
      } catch (rollbackErr) {
        // Safe to ignore if no transaction active
      }
    }
  }

  async getActiveStories() {
    const now = Date.now();
    // Fetch active stories with associated user details
    return await db.all(`
      SELECT s.id, s.user_id, s.content, s.gradient, s.created_at, s.expires_at,
             u.display_name as name, u.avatar_url as avatar
      FROM stories s
      JOIN users u ON s.user_id = u.id
      WHERE s.expires_at > ?
      ORDER BY s.created_at ASC
    `, [now]);
  }
}

export default new StoryService();
