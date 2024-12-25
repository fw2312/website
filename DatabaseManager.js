// DatabaseManager.js
// 这个模块负责处理所有与数据库相关的操作

const DatabaseManager = (function() {
    // 初始化数据库表
    async function initializeDatabase() {
        try {
            // 创建提示表
            await DB.prepare(`
                CREATE TABLE IF NOT EXISTS tips (
                    id TEXT PRIMARY KEY,
                    situation TEXT NOT NULL,
                    language TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `).run();

            // 创建用户交互表（用于存储点赞等信息）
            await DB.prepare(`
                CREATE TABLE IF NOT EXISTS interactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tip_id TEXT NOT NULL,
                    interaction_type TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(tip_id) REFERENCES tips(id)
                )
            `).run();

            console.log('数据库表初始化成功');
        } catch (error) {
            console.error('初始化数据库失败:', error);
            throw error;
        }
    }

    // 从数据库加载提示
    async function loadTipsFromDatabase() {
        try {
            const result = await DB.prepare(`
                SELECT * FROM tips
            `).all();

            // 将数据库结果转换为应用所需的格式
            const formattedTips = formatTipsData(result);
            return formattedTips;
        } catch (error) {
            console.error('从数据库加载提示失败:', error);
            throw error;
        }
    }

    // 将数据库结果格式化为应用所需的结构
    function formatTipsData(dbResults) {
        const formattedTips = {};
        
        dbResults.forEach(tip => {
            if (!formattedTips[tip.situation]) {
                formattedTips[tip.situation] = {
                    zh: [],
                    en: []
                };
            }
            
            formattedTips[tip.situation][tip.language].push({
                id: tip.id,
                content: tip.content
            });
        });

        return formattedTips;
    }

    // 记录用户的点赞
    async function recordLike(tipId) {
        try {
            await DB.prepare(`
                INSERT INTO interactions (tip_id, interaction_type)
                VALUES (?, 'like')
            `).bind(tipId).run();
            
            return true;
        } catch (error) {
            console.error('记录点赞失败:', error);
            throw error;
        }
    }

    // 获取提示的点赞数
    async function getLikeCount(tipId) {
        try {
            const result = await DB.prepare(`
                SELECT COUNT(*) as count 
                FROM interactions 
                WHERE tip_id = ? AND interaction_type = 'like'
            `).bind(tipId).first();
            
            return result.count;
        } catch (error) {
            console.error('获取点赞数失败:', error);
            throw error;
        }
    }

    // 暴露公共接口
    return {
        initializeDatabase,
        loadTipsFromDatabase,
        recordLike,
        getLikeCount
    };
})();

export default DatabaseManager;