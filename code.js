// 常量
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

let currentLanguage = 'zh';
let currentSituation = '';
let currentTipId = null;

// 添加日志功能
function log(type, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = {
        timestamp,
        type,
        message,
        data
    };
    console.log(JSON.stringify(logMessage));
}

const translations = {
    zh: {
        title: "心灵加油站",
        intro: "选择你当前的情境，获取适合的心灵小贴士。每个练习只需30秒，帮助你在忙碌的日常中找到片刻宁静。",
        morning: "早晨起床",
        work: "工作时间",
        break: "休息时刻",
        evening: "晚间放松",
        sleep: "入睡前",
        nextTip: "下一条提示",
        switchLang: "English",
        liked: "已喜欢",
        like: "喜欢"
    },
    en: {
        title: "Soul Refueling Station",
        intro: "Choose your current situation to get a suitable soul tip. Each exercise takes only 30 seconds, helping you find a moment of peace in your busy day.",
        morning: "Morning Wake Up",
        work: "Work Time",
        break: "Break Time",
        evening: "Evening Relaxation",
        sleep: "Before Sleep",
        nextTip: "Next Tip",
        switchLang: "中文",
        liked: "Liked",
        like: "Like"
    }
};

let tips = {};

function saveTipsToCache(tips) {
    log('info', 'Saving tips to cache', { tipsCount: Object.keys(tips).length });
    try {
        localStorage.setItem('cachedTips', JSON.stringify(tips));
        localStorage.setItem('tipsCacheTimestamp', Date.now());
        log('success', 'Tips saved to cache successfully');
    } catch (error) {
        log('error', 'Failed to save tips to cache', { error: error.message });
    }
}

function loadTipsFromCache() {
    log('info', 'Attempting to load tips from cache');
    try {
        const cachedTips = localStorage.getItem('cachedTips');
        const cacheTimestamp = localStorage.getItem('tipsCacheTimestamp');
        
        if (cachedTips && cacheTimestamp) {
            if (Date.now() - parseInt(cacheTimestamp) < CACHE_DURATION) {
                log('success', 'Tips loaded from cache successfully');
                return JSON.parse(cachedTips);
            }
            log('info', 'Cache expired');
        }
        log('info', 'No valid cache found');
        return null;
    } catch (error) {
        log('error', 'Error loading tips from cache', { error: error.message });
        return null;
    }
}

// Loading 状态管理
function toggleLoading(show) {
    log('info', 'Toggling loading state', { show });
    const loader = document.getElementById('loader');
    if (show) {
        if (loader) return; // 防止重复创建
        const newLoader = document.createElement('div');
        newLoader.id = 'loader';
        newLoader.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 5px solid #f3f3f3; border-top: 5px solid #3498db; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite;';
        document.body.appendChild(newLoader);
    } else {
        if (loader) loader.remove();
    }
}

async function loadTips(env) {
    const queryId = Date.now().toString(); // 生成唯一查询ID用于追踪
    log('info', 'Starting to load tips', { queryId });
    toggleLoading(true);
    
    // 检查缓存
    log('debug', 'Checking cache status', { queryId });
    const cachedTips = loadTipsFromCache();
    if (cachedTips) {
        log('info', 'Using cached tips', { 
            queryId,
            cacheSize: Object.keys(cachedTips).length,
            situations: Object.keys(cachedTips)
        });
        tips = cachedTips;
        updateUI();
        toggleLoading(false);
        return;
    }

    try {
        // 准备数据库查询
        log('debug', 'Preparing database query', { 
            queryId,
            sql: "SELECT * FROM Tips"
        });

        const statement = env.DB.prepare("SELECT * FROM Tips");
        log('debug', 'Statement prepared successfully', { queryId });

        // 执行查询
        log('info', 'Executing database query', { queryId });
        const startTime = performance.now();
        const { results } = await statement.all();
        const queryTime = performance.now() - startTime;
        
        log('success', 'Database query completed', { 
            queryId,
            executionTime: `${queryTime.toFixed(2)}ms`,
            rowCount: results.length
        });

        // 处理查询结果
        log('debug', 'Processing query results', { 
            queryId,
            resultCount: results.length
        });
        
        tips = {};
        let processedCount = 0;
        results.forEach(row => {
            if (!tips[row.situation]) {
                log('debug', 'Creating new situation category', {
                    queryId,
                    situation: row.situation
                });
                tips[row.situation] = {};
            }
            if (!tips[row.situation][row.language]) {
                log('debug', 'Creating new language category', {
                    queryId,
                    situation: row.situation,
                    language: row.language
                });
                tips[row.situation][row.language] = [];
            }
            tips[row.situation][row.language].push(row);
            processedCount++;
        });

        log('info', 'Tips processing completed', {
            queryId,
            processedCount,
            situationCount: Object.keys(tips).length,
            structureOverview: Object.keys(tips).map(situation => ({
                situation,
                languages: Object.keys(tips[situation]),
                tipsCount: Object.values(tips[situation])
                    .reduce((acc, curr) => acc + curr.length, 0)
            }))
        });
        
        // 保存到缓存
        saveTipsToCache(tips);
        updateUI();
        
        log('success', 'Tips loading process completed successfully', {
            queryId,
            totalProcessingTime: `${(performance.now() - startTime).toFixed(2)}ms`
        });

    } catch (error) {
        log('error', 'Failed to load tips', { 
            queryId,
            error: error.message,
            errorStack: error.stack,
            errorType: error.name
        });
        showError("Failed to load tips. Please try again later.");
    } finally {
        toggleLoading(false);
        log('info', 'Tips loading process finished', { queryId });
    }
}

async function likeTip(env) {
    const operationId = Date.now().toString();
    
    if (!currentTipId) {
        log('warn', 'Like attempted without current tip', { operationId });
        return;
    }
    
    log('info', 'Starting like operation', { 
        operationId,
        tipId: currentTipId,
        situation: currentSituation,
        language: currentLanguage
    });
    
    try {
        // 准备更新语句
        log('debug', 'Preparing update statement', {
            operationId,
            sql: "UPDATE Tips SET likes = likes + 1 WHERE id = ?",
            parameters: { tipId: currentTipId }
        });
        
        const stmt = env.DB.prepare("UPDATE Tips SET likes = likes + 1 WHERE id = ?");
        
        // 绑定参数
        log('debug', 'Binding parameters to statement', {
            operationId,
            tipId: currentTipId
        });
        const boundStatement = stmt.bind(currentTipId);
        
        // 执行更新
        const startTime = performance.now();
        log('info', 'Executing update query', { operationId });
        
        await boundStatement.run();
        
        const updateTime = performance.now() - startTime;
        log('success', 'Update query completed', {
            operationId,
            executionTime: `${updateTime.toFixed(2)}ms`,
            tipId: currentTipId
        });
        
        // 更新前端状态
        if (tips[currentSituation] && 
            tips[currentSituation][currentLanguage]) {
            const tipArray = tips[currentSituation][currentLanguage];
            const tipIndex = tipArray.findIndex(tip => tip.id === currentTipId);
            
            if (tipIndex !== -1) {
                log('debug', 'Updating frontend tip data', {
                    operationId,
                    tipId: currentTipId,
                    previousLikes: tipArray[tipIndex].likes
                });
                
                tipArray[tipIndex].likes++;
                
                log('info', 'Frontend tip data updated', {
                    operationId,
                    tipId: currentTipId,
                    newLikes: tipArray[tipIndex].likes
                });
            }
        }
        
        showLikeConfirmation();
        
        log('success', 'Like operation completed successfully', {
            operationId,
            totalProcessingTime: `${(performance.now() - startTime).toFixed(2)}ms`
        });
        
    } catch (error) {
        log('error', 'Failed to like tip', { 
            operationId,
            error: error.message,
            errorStack: error.stack,
            errorType: error.name,
            tipId: currentTipId,
            situation: currentSituation,
            language: currentLanguage
        });
        showError("Failed to like tip. Please try again later.");
    }
}

function showTip(situation) {
    log('info', 'Showing tip for situation', { situation, language: currentLanguage });
    
    currentSituation = situation;
    if (!tips[situation]) {
        log('error', 'No tips found for situation', { situation });
        return;
    }

    const situationTips = tips[situation][currentLanguage];
    if (!situationTips || situationTips.length === 0) {
        log('error', 'No tips found for language', { situation, language: currentLanguage });
        return;
    }

    const randomIndex = Math.floor(Math.random() * situationTips.length);
    const selectedTip = situationTips[randomIndex];
    
    currentTipId = selectedTip.id;
    
    const tipElement = document.getElementById('spiritual-tip');
    if (tipElement) {
        tipElement.textContent = selectedTip.content;
    } else {
        log('error', 'Tip element not found');
        return;
    }
    
    const nextTipButton = document.getElementById('next-tip');
    if (nextTipButton) {
        nextTipButton.style.display = 'block';
    }
    
    const likeButton = document.getElementById('like-button');
    if (likeButton) {
        likeButton.disabled = false;
        likeButton.textContent = translations[currentLanguage].like;
    }
    
    log('success', 'Tip displayed successfully', { 
        tipId: currentTipId,
        situation,
        language: currentLanguage
    });
}

// 初始化函数
function initializeApp(env) {
    log('info', 'Initializing application');
    
    try {
        // 绑定事件监听器
        document.querySelectorAll('#situation-buttons button').forEach(button => {
            button.addEventListener('click', (e) => {
                log('info', 'Situation button clicked', { situation: e.target.dataset.situation });
                showTip(e.target.dataset.situation);
            });
        });

        document.getElementById('next-tip')?.addEventListener('click', () => {
            log('info', 'Next tip button clicked');
            showNextTip();
        });

        document.getElementById('like-button')?.addEventListener('click', () => {
            log('info', 'Like button clicked');
            likeTip(env);
        });

        // 加载提示
        loadTips(env);
        
        log('success', 'Application initialized successfully');
    } catch (error) {
        log('error', 'Failed to initialize application', { error: error.message });
    }
}

// 修改页面加载事件处理
addEventListener("DOMContentLoaded", () => {
    log('info', 'DOM Content Loaded');
    const env = {
        DB: {
            prepare: (sql) => ({
                bind: (...params) => ({
                    all: async () => {
                        if (sql.includes('SELECT * FROM Tips')) {
                            return { 
                                results: [
                                    { id: 'morning_0', situation: 'morning', language: 'zh', content: '深呼吸，感受清晨的空气。', likes: 0 },
                                    { id: 'morning_1', situation: 'morning', language: 'zh', content: '花一分钟时间，感恩你所拥有的一切。', likes: 0 },
                                    { id: 'work_0', situation: 'work', language: 'zh', content: '闭上眼睛，专注于你的呼吸，持续30秒。', likes: 0 },
                                    { id: 'work_1', situation: 'work', language: 'zh', content: '站起来，做一些简单的伸展运动。', likes: 0 },
                                    { id: 'break_0', situation: 'break', language: 'zh', content: '找一个安静的地方，闭上眼睛休息一下。', likes: 0 },
                                    { id: 'break_1', situation: 'break', language: 'zh', content: '听一首你喜欢的歌曲，放松心情。', likes: 0 },
                                    { id: 'evening_0', situation: 'evening', language: 'zh', content: '写下今天让你感到快乐的三件事。', likes: 0 },
                                    { id: 'evening_1', situation: 'evening', language: 'zh', content: '与家人或朋友聊聊天，分享你的感受。', likes: 0 },
                                    { id: 'sleep_0', situation: 'sleep', language: 'zh', content: '进行几次深呼吸，放松全身。', likes: 0 },
                                    { id: 'sleep_1', situation: 'sleep', language: 'zh', content: '想象一个宁静的场景，帮助入睡。', likes: 0 },
                                    { id: 'morning_2', situation: 'morning', language: 'en', content: 'Take a deep breath, feel the morning air.', likes: 0 },
                                    { id: 'morning_3', situation: 'morning', language: 'en', content: 'Take a moment to be grateful for what you have.', likes: 0 },
                                    { id: 'work_2', situation: 'work', language: 'en', content: 'Close your eyes, focus on your breath for 30 seconds.', likes: 0 },
                                    { id: 'work_3', situation: 'work', language: 'en', content: 'Stand up and do some simple stretches.', likes: 0 },
                                    { id: 'break_2', situation: 'break', language: 'en', content: 'Find a quiet place and close your eyes to rest.', likes: 0 },
                                    { id: 'break_3', situation: 'break', language: 'en', content: 'Listen to a song you like, relax your mind.', likes: 0 },
                                    { id: 'evening_2', situation: 'evening', language: 'en', content: 'Write down three things that made you happy today.', likes: 0 },
                                    { id: 'evening_3', situation: 'evening', language: 'en', content: 'Chat with family or friends, share your feelings.', likes: 0 },
                                    { id: 'sleep_2', situation: 'sleep', language: 'en', content: 'Take a few deep breaths, relax your body.', likes: 0 },
                                    { id: 'sleep_3', situation: 'sleep', language: 'en', content: 'Imagine a peaceful scene to help you fall asleep.', likes: 0 }
                                ]
                            };
                        }
                        return null;
                    },
                    run: async () => {
                        // Mock implementation for UPDATE
                        log('info', 'Executing UPDATE query', { params });
                        return;
                    }
                }),
            }),
        },
    };
    
    initializeApp(env);
});