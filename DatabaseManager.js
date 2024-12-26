export class DatabaseManager {
    constructor(db) {
      if (!db) throw new Error('数据库实例未提供');
      this.db = db;
    }
   
    async testConnection() {
      try {
        const result = await this.db.prepare('SELECT 1 as test').first();
        return result?.test === 1;
      } catch (error) {
        console.error('数据库连接测试失败:', error);
        return false;
      }
    }
   
    async loadTips() {
      try {
        const result = await this.db.prepare(`
          SELECT * FROM tips 
          WHERE is_active = 1
          ORDER BY situation, language
        `).all();
        
        if (!result?.results) {
          console.error('数据库查询结果为空');
          return {};
        }
        
        return this.formatTipsData(result.results);
      } catch (error) {
        console.error('加载提示数据失败:', error);
        return {};
      }
    }
   
    formatTipsData(results) {
      const tips = {};
      for (const tip of results) {
        if (!tips[tip.situation]) {
          tips[tip.situation] = {};
        }
        if (!tips[tip.situation][tip.language]) {
          tips[tip.situation][tip.language] = [];
        }
        tips[tip.situation][tip.language].push(tip);
      }
      return tips;
    }
   
    async updateLikeCount(tipId) {
      try {
        await this.db.prepare(`
          INSERT INTO interactions (tip_id, type)
          VALUES (?, 'like')
        `).bind(tipId).run();
        return true;
      } catch (error) {
        console.error('更新点赞失败:', error);
        return false;
      }
    }
   
    async getLikeCount(tipId) {
      try {
        const result = await this.db.prepare(`
          SELECT COUNT(*) as count 
          FROM interactions 
          WHERE tip_id = ? AND type = 'like'
        `).bind(tipId).first();
        return result?.count || 0;
      } catch (error) {
        console.error('获取点赞数失败:', error);
        return 0;
      }
    }
   }