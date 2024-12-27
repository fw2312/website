console.log('D1: Defining DatabaseManager class');
export class DatabaseManager {
  constructor(db) {
    console.log('D2: Constructing DatabaseManager');
    if (!db) throw new Error('数据库实例未提供');
    this.db = db;
  }
 
  async testConnection() {
    console.log('D3: Testing database connection');
    try {
      const result = await this.db.prepare('SELECT 1 as test').first();
      console.log('D4: Connection test result', result);
      return result?.test === 1;
    } catch (error) {
      console.error('D5: Database connection test failed:', error);
      return false;
    }
  }
 
  async loadTips() {
    console.log('D6: Loading tips');
    try {
      const result = await this.db.prepare(`
        SELECT * FROM tips 
        WHERE is_active = 1 AND language = 'zh'
        ORDER BY situation
      `).all();
      
      console.log('D7: Tips query result', result);
      if (!result?.results) {
        console.error('D8: Database query result is empty');
        return {};
      }
      
      console.log('D9: Formatting tips data');
      return this.formatTipsData(result.results);
    } catch (error) {
      console.error('D10: Failed to load tips data:', error);
      return {};
    }
  }
 
  formatTipsData(results) {
    console.log('D11: Formatting tips data');
    const tips = {};
    for (const tip of results) {
      if (!tips[tip.situation]) {
        tips[tip.situation] = [];
      }
      tips[tip.situation].push(tip);
    }
    console.log('D12: Formatted tips data', tips);
    return tips;
  }
 
  async updateLikeCount(tipId) {
    console.log('D13: Updating like count for tip', tipId);
    try {
      await this.db.prepare(`
        INSERT INTO interactions (tip_id, type)
        VALUES (?, 'like')
      `).bind(tipId).run();
      console.log('D14: Like count updated successfully');
      return true;
    } catch (error) {
      console.error('D15: Failed to update like count:', error);
      return false;
    }
  }
 
  async getLikeCount(tipId) {
    console.log('D16: Getting like count for tip', tipId);
    try {
      const result = await this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM interactions 
        WHERE tip_id = ? AND type = 'like'
      `).bind(tipId).first();
      console.log('D17: Like count result', result);
      return result?.count || 0;
    } catch (error) {
      console.error('D18: Failed to get like count:', error);
      return 0;
    }
  }
}