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

async function loadTips(env) {
    log('info', 'Starting to load tips');
    toggleLoading(true);
    const cachedTips = loadTipsFromCache();
    if (cachedTips) {
        log('info', 'Using cached tips');
        tips = cachedTips;
        updateUI();
        toggleLoading(false);
        return;
    }

    try {
        log('info', 'Fetching tips from database');
        const { results } = await env.DB.prepare("SELECT * FROM Tips").all();
        log('success', 'Tips fetched successfully', { count: results.length });
        
        tips = {};
        results.forEach(row => {
            if (!tips[row.situation]) {
                tips[row.situation] = {};
            }
            if (!tips[row.situation][row.language]) {
                tips[row.situation][row.language] = [];
            }
            tips[row.situation][row.language].push(row);
        });
        
        saveTipsToCache(tips);
        updateUI();
    } catch (error) {
        log('error', 'Failed to load tips', { error: error.message });
        showError("Failed to load tips. Please try again later.");
    } finally {
        toggleLoading(false);
    }
}

async function likeTip(env) {
    if (!currentTipId) {
        log('warn', 'Like attempted without current tip');
        return;
    }
    
    log('info', 'Attempting to like tip', { tipId: currentTipId });
    
    try {
        const stmt = env.DB.prepare("UPDATE Tips SET likes = likes + 1 WHERE id = ?");
        await stmt.bind(currentTipId).run();
        
        log('success', 'Tip liked successfully', { tipId: currentTipId });
        showLikeConfirmation();
    } catch (error) {
        log('error', 'Failed to like tip', { 
            error: error.message,
            tipId: currentTipId 
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
                            return { results: [/* your mock data */] };
                        }
                    },
                    run: async () => {
                        // Mock implementation for UPDATE
                        return;
                    }
                }),
            }),
        },
    };
    
    initializeApp(env);
});