// 常量和工具函数定义
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// 基础工具函数
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

// UI 工具函数
function toggleLoading(show) {
    log('info', 'Toggling loading state', { show });
    const loader = document.getElementById('loader');
    if (show) {
        if (loader) {
            log('debug', 'Loader already exists');
            return;
        }
        const newLoader = document.createElement('div');
        newLoader.id = 'loader';
        newLoader.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 5px solid #f3f3f3; border-top: 5px solid #3498db; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite;';
        document.body.appendChild(newLoader);
        log('debug', 'Created new loader');
    } else {
        if (loader) {
            loader.remove();
            log('debug', 'Removed loader');
        }
    }
}

function showError(message) {
    log('error', 'Showing error message', { message });
    const errorDiv = document.createElement('div');
    errorDiv.textContent = message;
    errorDiv.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background-color: #f44336; color: white; padding: 15px; border-radius: 5px; z-index: 1000;';
    document.body.appendChild(errorDiv);
    setTimeout(() => {
        errorDiv.remove();
        log('debug', 'Removed error message');
    }, 5000);
}

// 状态变量
let currentLanguage = 'zh';
let currentSituation = '';
let currentTipId = null;
let tips = {};

// 翻译数据
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

// 缓存相关函数
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

// 核心功能函数
async function loadTips(env) {
    if (!env || !env.DB) {
        log('error', 'Invalid environment configuration');
        showError("System configuration error. Please try again later.");
        return;
    }
    const queryId = Date.now().toString();
    log('info', 'Starting to load tips', { queryId });
    toggleLoading(true);
    
    try {
        // 测试连接
        log('debug', 'Testing database connection', { queryId });
        try {
            const testStmt = env.DB.prepare("SELECT 1");
            await testStmt.all();
            log('success', 'Database connection test successful', { queryId });
        } catch (dbError) {
             log('error', 'Database connection test failed', { queryId, dbError });
            throw new Error(`Database connection test failed: ${dbError.message}`)
        }
        // 先检查缓存
        const cachedTips = loadTipsFromCache();
        if (cachedTips) {
            log('info', 'Using cached tips', { queryId });
            tips = cachedTips;
            updateUI();
            return;
        }

        // 从数据库加载数据
        log('debug', 'Preparing database query', { queryId });
        const stmt = env.DB.prepare("SELECT * FROM Tips");
        log('debug', 'Executing query', { queryId, sql: stmt.sql });
        const response = await stmt.all();
         
        if (!response) {
            log('error', 'Database response is null', { queryId });
            throw new Error('Invalid database response format: response is null');
        }

          if (!response.results) {
            log('error', 'Database response.results is null', { queryId });
               throw new Error('Invalid database response format: response.results is null');
         }

        const { results } = response;
           if (results.length === 0) {
             log('warn', 'Database query returned no results', { queryId });
            throw new Error('No valid tips were processed')
        }
        log('success', 'Database query completed', {
            queryId,
            rowCount: results.length,
           
        });
            // 添加日志输出所有数据
           log('debug','Database data:', {queryId, results: results})

        // 重构数据
        tips = {};
        let processedCount = 0;
        
        for (const row of results) {
            // 验证数据完整性
            if (!row || !row.situation || !row.language || !row.content) {
               log('warn', 'Skipping invalid row', { row });
                continue;
            }

            // 初始化数据结构
            if (!tips[row.situation]) {
                tips[row.situation] = {};
            }
            if (!tips[row.situation][row.language]) {
                tips[row.situation][row.language] = [];
            }

            // 添加数据
           tips[row.situation][row.language].push(row);
            processedCount++;
        }

        // 验证处理结果
        if (processedCount === 0) {
             log('error','No valid tips were processed',{queryId});
            throw new Error('No valid tips were processed');
        }

         log('info', 'Tips processing completed', {
            queryId,
            processedCount,
            situations: Object.keys(tips),
            sampleTip: tips[Object.keys(tips)[0]]?.[Object.keys(tips[Object.keys(tips)[0]])[0]]?.[0]
        });

        // 保存到缓存
        saveTipsToCache(tips);
        
        // 更新UI
        updateUI();
        
    } catch (error) {
        log('error', 'Failed to load tips', { 
            queryId, 
            error: error.message,
            errorStack: error.stack 
        });
        showError("Failed to load tips. Please try again later.");
        // 确保tips对象至少是空对象
        tips = {};
    } finally {
        toggleLoading(false);
    }
}

function updateUI() {
    log('info', 'Updating UI');
    updateUILanguage();
    
        // 设置初始提示
        const buttons = document.querySelectorAll('#situation-buttons button');
        buttons.forEach(button => {
             const situation = button.dataset.situation;
             if(tips[situation] && tips[situation][currentLanguage] && tips[situation][currentLanguage].length > 0 ){
                 showTip(situation)
             }
         });
}

function updateUILanguage() {
    log('info', 'Updating UI language', { language: currentLanguage });
    document.getElementById('main-title').textContent = translations[currentLanguage].title;
    document.getElementById('intro-text').textContent = translations[currentLanguage].intro;
    document.getElementById('next-tip').textContent = translations[currentLanguage].nextTip;
    document.querySelector('#language-switch button').textContent = translations[currentLanguage].switchLang;
    document.getElementById('like-button').textContent = translations[currentLanguage].like;

    const buttons = document.querySelectorAll('#situation-buttons button');
    buttons.forEach(button => {
        const situation = button.dataset.situation;
        button.textContent = translations[currentLanguage][situation];
    });
}

function showTip(situation) {
    log('info', 'Showing tip for situation', { situation, language: currentLanguage });
    currentSituation = situation;
    
    if (!tips[situation] || !tips[situation][currentLanguage]) {
        log('error', 'No tips found for situation/language combination', { situation, language: currentLanguage });
        return;
    }

    const situationTips = tips[situation][currentLanguage];
    const randomIndex = Math.floor(Math.random() * situationTips.length);
    const selectedTip = situationTips[randomIndex];
    
    currentTipId = selectedTip.id;
    
    const tipElement = document.getElementById('spiritual-tip');
    if (!tipElement) {
        log('error', 'Tip element not found in DOM');
        return;
    }
    
    tipElement.textContent = selectedTip.content;
    document.getElementById('next-tip').style.display = 'block';
    
    const likeButton = document.getElementById('like-button');
    likeButton.disabled = false;
    likeButton.textContent = translations[currentLanguage].like;
    likeButton.dataset.situation = situation;
    
    log('success', 'Tip displayed successfully', { tipId: currentTipId });
}

function showLikeConfirmation() {
    log('info', 'Showing like confirmation');
    const likeButton = document.getElementById('like-button');
    likeButton.textContent = translations[currentLanguage].liked;
    likeButton.disabled = true;
    setTimeout(() => {
        likeButton.textContent = translations[currentLanguage].like;
        likeButton.disabled = false;
        log('debug', 'Reset like button state');
    }, 2000);
}

async function likeTip(env) {
    if (!env || !env.DB) {
        log('error', 'Invalid environment configuration');
        showError("System configuration error. Please try again later.");
        return;
    }
    const operationId = Date.now().toString();
    
    if (!currentTipId) {
        log('warn', 'Like attempted without current tip', { operationId });
        return;
    }
    
    log('info', 'Starting like operation', { operationId, tipId: currentTipId });
    
    try {
        const stmt = env.DB.prepare("UPDATE Tips SET likes = likes + 1 WHERE id = ?");
        log('debug','Executing like query', {operationId, tipId:currentTipId, sql: stmt.sql})
        await stmt.run(currentTipId);
        
        log('success', 'Tip liked successfully', { operationId, tipId: currentTipId });
        showLikeConfirmation();
    } catch (error) {
        log('error', 'Failed to like tip', { 
            operationId,
            error: error.message,
            tipId: currentTipId 
        });
        showError("Failed to like tip. Please try again later.");
    }
}

function showNextTip() {
    log('info', 'Showing next tip', { currentSituation });
    if (!currentSituation) {
        log('warn', 'No current situation selected');
        return;
    }
    showTip(currentSituation);
}

// 语言切换
function switchLanguage() {
    log('info', 'Switching language', { from: currentLanguage });
    currentLanguage = currentLanguage === 'zh' ? 'en' : 'zh';
    log('info', 'Language switched', { to: currentLanguage });
    updateUILanguage();
    
      // 设置初始提示
    const buttons = document.querySelectorAll('#situation-buttons button');
    buttons.forEach(button => {
        const situation = button.dataset.situation;
        if(tips[situation] && tips[situation][currentLanguage] && tips[situation][currentLanguage].length > 0 ){
            showTip(situation)
        }
    });
}

// 初始化
function initializeApp(env) {
    log('info', 'Initializing application');
    try {
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

        loadTips(env);
        
        log('success', 'Application initialized successfully');
    } catch (error) {
        log('error', 'Failed to initialize application', { error: error.message });
    }
}

// Event Listeners
addEventListener("DOMContentLoaded", () => {
    log('info', 'DOM Content Loaded');
     const env = {
         DB: {
             prepare: (sql) => ({
                 all: async () => {
                    // 这里什么都不做，直接从数据库中读取
                    return null;
                 },
                 run: async (params) => {
                    // 这里什么都不做，直接从数据库中更新
                      log('info', 'Executing UPDATE query', { params });
                    return;
                 }
             })
         }
     }
   initializeApp(env);
});//111