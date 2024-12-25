// DatabaseManager.js
// 这个模块提供了智能的数据库管理功能，包括按需创建表、数据更新和删除操作
// 它首先会检查数据库状态，只在必要时执行创建表操作

const DatabaseManager = (function() {
    // 数据库错误类型定义
    const DB_ERROR_TYPES = {
        QUERY: 'query_error',
        NOT_FOUND: 'not_found',
        VALIDATION: 'validation_error'
    };

    /**
     * 检查数据库表是否存在
     * @param {string} tableName - 要检查的表名
     * @returns {Promise<boolean>} 表是否存在
     */
    async function checkTableExists(tableName) {
        try {
            const result = await DB.prepare(`
                SELECT name 
                FROM sqlite_master 
                WHERE type='table' AND name=?
            `).bind(tableName).first();
            
            return !!result;
        } catch (error) {
            console.error(`检查表 ${tableName} 是否存在时出错:`, error);
            return false;
        }
    }

    /**
     * 智能初始化数据库
     * 只在必要时创建表，并支持数据更新
     */
    async function initializeDatabaseIfNeeded() {
        try {
            // 检查tips表是否存在
            const tipsExists = await checkTableExists('tips');
            if (!tipsExists) {
                console.log('创建 tips 表...');
                await DB.prepare(`
                    CREATE TABLE tips (
                        id TEXT PRIMARY KEY,
                        situation TEXT NOT NULL,
                        language TEXT NOT NULL,
                        content TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        display_count INTEGER DEFAULT 0,
                        is_active BOOLEAN DEFAULT TRUE,
                        CHECK (situation IN ('morning', 'work', 'break', 'evening', 'sleep')),
                        CHECK (language IN ('zh', 'en'))
                    )
                `).run();
            }

            // 检查interactions表是否存在
            const interactionsExists = await checkTableExists('interactions');
            if (!interactionsExists) {
                console.log('创建 interactions 表...');
                await DB.prepare(`
                    CREATE TABLE interactions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        tip_id TEXT NOT NULL,
                        interaction_type TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(tip_id) REFERENCES tips(id)
                    )
                `).run();
            }

            // 如果表已存在，检查是否需要更新表结构
            if (tipsExists) {
                await updateTableStructureIfNeeded();
            }

            console.log('数据库初始化检查完成');
            return true;
        } catch (error) {
            console.error('数据库初始化失败:', error);
            throw error;
        }
    }

    /**
     * 更新表结构（如果需要）
     * 这个函数可以用来添加新列或修改现有列
     */
    async function updateTableStructureIfNeeded() {
        try {
            // 获取tips表的列信息
            const columns = await DB.prepare(`PRAGMA table_info(tips)`).all();
            const columnNames = columns.results.map(col => col.name);

            // 检查并添加可能缺少的列
            if (!columnNames.includes('display_count')) {
                await DB.prepare(`
                    ALTER TABLE tips 
                    ADD COLUMN display_count INTEGER DEFAULT 0
                `).run();
            }

            if (!columnNames.includes('is_active')) {
                await DB.prepare(`
                    ALTER TABLE tips 
                    ADD COLUMN is_active BOOLEAN DEFAULT TRUE
                `).run();
            }
        } catch (error) {
            console.error('更新表结构失败:', error);
            throw error;
        }
    }

    /**
     * 加载指定情境和语言的提示
     * @param {string} situation - 情境类型
     * @param {string} language - 语言代码
     * @returns {Promise<Array>} 提示数组
     */
    async function loadTipsForSituation(situation, language) {
        try {
            const query = `
                SELECT id, content, display_count
                FROM tips
                WHERE situation = ?
                AND language = ?
                AND is_active = TRUE
                ORDER BY RANDOM()
            `;
            
            const result = await DB.prepare(query)
                .bind(situation, language)
                .all();

            return result.results.map(row => ({
                id: row.id,
                content: row.content,
                displayCount: row.display_count || 0
            }));
        } catch (error) {
            console.error('加载情境提示失败:', error);
            throw {
                type: DB_ERROR_TYPES.QUERY,
                message: '加载提示失败',
                originalError: error
            };
        }
    }

    /**
     * 更新提示内容
     * @param {string} tipId - 提示ID
     * @param {Object} updateData - 要更新的数据
     */
    async function updateTip(tipId, updateData) {
        try {
            const allowedFields = ['content', 'is_active', 'situation', 'language'];
            const updates = Object.entries(updateData)
                .filter(([key]) => allowedFields.includes(key))
                .map(([key]) => `${key} = ?`);

            if (updates.length === 0) {
                throw {
                    type: DB_ERROR_TYPES.VALIDATION,
                    message: '没有可更新的有效字段'
                };
            }

            const query = `
                UPDATE tips
                SET ${updates.join(', ')},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            const values = [
                ...Object.entries(updateData)
                    .filter(([key]) => allowedFields.includes(key))
                    .map(([_, value]) => value),
                tipId
            ];

            await DB.prepare(query).bind(...values).run();
            return await getTipDetails(tipId);
        } catch (error) {
            console.error('更新提示失败:', error);
            throw {
                type: DB_ERROR_TYPES.QUERY,
                message: '更新提示失败',
                originalError: error
            };
        }
    }

    /**
     * 软删除提示（将is_active设置为false）
     * @param {string} tipId - 提示ID
     */
    async function softDeleteTip(tipId) {
        try {
            await DB.prepare(`
                UPDATE tips
                SET is_active = FALSE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(tipId).run();
            
            return true;
        } catch (error) {
            console.error('软删除提示失败:', error);
            throw {
                type: DB_ERROR_TYPES.QUERY,
                message: '删除提示失败',
                originalError: error
            };
        }
    }

    /**
     * 物理删除提示（从数据库中完全删除）
     * @param {string} tipId - 提示ID
     */
    async function hardDeleteTip(tipId) {
        try {
            // 首先删除相关的互动记录
            await DB.prepare(`
                DELETE FROM interactions
                WHERE tip_id = ?
            `).bind(tipId).run();

            // 然后删除提示本身
            await DB.prepare(`
                DELETE FROM tips
                WHERE id = ?
            `).bind(tipId).run();

            return true;
        } catch (error) {
            console.error('物理删除提示失败:', error);
            throw {
                type: DB_ERROR_TYPES.QUERY,
                message: '删除提示失败',
                originalError: error
            };
        }
    }

    /**
     * 获取提示详细信息
     * @param {string} tipId - 提示ID
     */
    async function getTipDetails(tipId) {
        try {
            const result = await DB.prepare(`
                SELECT t.*, COUNT(i.id) as like_count
                FROM tips t
                LEFT JOIN interactions i ON t.id = i.tip_id 
                    AND i.interaction_type = 'like'
                WHERE t.id = ?
                GROUP BY t.id
            `).bind(tipId).first();

            if (!result) {
                throw {
                    type: DB_ERROR_TYPES.NOT_FOUND,
                    message: '找不到指定的提示'
                };
            }

            return {
                id: result.id,
                situation: result.situation,
                language: result.language,
                content: result.content,
                displayCount: result.display_count || 0,
                likeCount: result.like_count || 0,
                createdAt: result.created_at,
                updatedAt: result.updated_at,
                isActive: result.is_active
            };
        } catch (error) {
            console.error('获取提示详情失败:', error);
            throw {
                type: DB_ERROR_TYPES.QUERY,
                message: '获取提示详情失败',
                originalError: error
            };
        }
    }

    // 其他现有的方法（incrementDisplayCount, recordLike, getLikeCount）保持不变...

    // 导出公共接口
    return {
        initializeDatabaseIfNeeded,
        loadTipsForSituation,
        updateTip,
        softDeleteTip,
        hardDeleteTip,
        getTipDetails,
        incrementDisplayCount,
        recordLike,
        getLikeCount
    };
})();

export default DatabaseManager;