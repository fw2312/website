// Event Listeners and main setup
addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/') {
        // 返回主页
        const response = await fetch(request);
        return new Response(response.body, {
            ...response,
            headers: {
                ...response.headers,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    }
    
    return fetch(request);
}

// 常量和工具函数定义
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const APP_VERSION = '1.0.0';

// 音频控制相关的状态
let currentAudio = null;
let currentAudioType = 'meditation';
let isAudioPlaying = false;

// 音频文件配置
const audioFiles = {
    meditation: new Audio('./sounds/meditation.mp3'),
    beach: new Audio('./sounds/beach.mp3'),
    forest: new Audio('./sounds/forest.mp3')
};

// 为所有音频文件设置循环播放
Object.values(audioFiles).forEach(audio => {
    audio.loop = true;
});

// 基础工具函数
function log(type, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = {
        timestamp,
        type,
        message,
        data,
        version: APP_VERSION
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

// 音频控制函数
function playBackgroundSound(type) {
    // 如果当前有音频在播放，先停止
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    
    // 设置新的音频
    currentAudio = audioFiles[type];
    currentAudioType = type;
    
    try {
        currentAudio.play().then(() => {
            isAudioPlaying = true;
            updateAudioButton();
        }).catch(error => {
            log('error', 'Failed to play audio', { error: error.message });
            showError(currentLanguage === 'zh' ? 
                "播放音频失败，请检查浏览器设置" : 
                "Failed to play audio, please check browser settings"
            );
        });
    } catch (error) {
        log('error', 'Error playing audio', { error: error.message });
    }
}

function toggleAudio() {
    if (!currentAudio) {
        currentAudio = audioFiles[currentAudioType];
    }
    
    if (isAudioPlaying) {
        currentAudio.pause();
        isAudioPlaying = false;
    } else {
        playBackgroundSound(currentAudioType);
    }
    
    updateAudioButton();
}

function updateAudioButton() {
    const audioButton = document.getElementById('audio-toggle');
    const audioText = audioButton.querySelector('.button-text');
    const audioIcon = audioButton.querySelector('.button-icon');
    
    if (isAudioPlaying) {
        audioText.textContent = currentLanguage === 'zh' ? '关闭音乐' : 'Stop Music';
        audioIcon.textContent = '🔈';
    } else {
        audioText.textContent = currentLanguage === 'zh' ? '播放音乐' : 'Play Music';
        audioIcon.textContent = '🔊';
    }
}

function initAudioControls() {
    // 音频切换按钮事件
    document.getElementById('audio-toggle').addEventListener('click', toggleAudio);
    
    // 音效选择事件
    document.getElementById('sound-select').addEventListener('change', (e) => {
        if (isAudioPlaying) {
            playBackgroundSound(e.target.value);
        }
        currentAudioType = e.target.value;
    });

    // 页面隐藏时暂停音频
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isAudioPlaying && currentAudio) {
            currentAudio.pause();
            isAudioPlaying = false;
            updateAudioButton();
        }
    });
    
    // 初始化音频按钮状态
    updateAudioButton();
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
        // 先检查缓存
        const cachedTips = loadTipsFromCache();
        if (cachedTips) {
            log('info', 'Using cached tips', { queryId });
            tips = cachedTips;
            updateUI();
            return;
        }

        // 从数据库加载数据
        const stmt = env.DB.prepare(`
            SELECT * FROM Tips 
            ORDER BY situation, language
        `);
        log('debug', 'Executing main query', { queryId, sql: stmt.sql });
        
        const { results } = await stmt.bind().all();
        
        if (!results || results.length === 0) {
            throw new Error('No tips found in database');
        }

        log('success', 'Database query completed', {
            queryId,
            rowCount: results.length,
            sampleData: results[0]
        });

        // 处理结果
        tips = {};
        let processedCount = 0;
        
        for (const row of results) {
            if (!row.situation || !row.language || !row.content) {
                log('warn', 'Skipping invalid row', { row });
                continue;
            }

            if (!tips[row.situation]) {
                tips[row.situation] = {};
            }
            if (!tips[row.situation][row.language]) {
                tips[row.situation][row.language] = [];
            }

            tips[row.situation][row.language].push(row);
            processedCount++;
        }

        if (processedCount === 0) {
            throw new Error('No valid tips were processed');
        }

        saveTipsToCache(tips);
        updateUI();
        
    } catch (error) {
        log('error', 'Failed to load tips', { 
            queryId, 
            error: error.message,
            errorStack: error.stack 
        });
        showError("Failed to load tips. Please try again later.");
        tips = {};
    } finally {
        toggleLoading(false);
    }
}

function updateUI() {
    log('info', 'Updating UI');
    updateUILanguage();
    if (currentSituation) {
        showTip(currentSituation);
    }
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
        const stmt = env.DB.prepare(`
            UPDATE Tips 
            SET likes = likes + 1 
            WHERE id = ?
        `);
        
        log('debug', 'Executing like query', {
            operationId,
            tipId: currentTipId,
            sql: stmt.sql
        });
        
        await stmt.bind(currentTipId).run();
        
        // 更新本地数据
        if (tips[currentSituation]?.[currentLanguage]) {
            const tip = tips[currentSituation][currentLanguage].find(t => t.id === currentTipId);
            if (tip) {
                tip.likes++;
                log('debug', 'Updated local tip likes count', {
                    operationId,
                    tipId: currentTipId,
                    newLikes: tip.likes
                });
            }
        }
        
        log('success', 'Tip liked successfully', {
            operationId,
            tipId: currentTipId
        });
        
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

function switchLanguage() {
    log('info', 'Switching language', { from: currentLanguage });
    currentLanguage = currentLanguage === 'zh' ? 'en' : 'zh';
    log('info', 'Language switched', { to: currentLanguage });
    updateUILanguage();
    if (currentSituation) {
        showTip(currentSituation);
    }
}

function initializeApp(env) {
    // 现有的初始化代码
    document.querySelector('#language-switch button').addEventListener('click', switchLanguage);
    
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

    // 添加音频控制相关的初始化
    document.getElementById('audio-toggle').addEventListener('click', toggleAudio);
    
    document.getElementById('sound-select').addEventListener('change', (e) => {
        if (isAudioPlaying) {
            playBackgroundSound(e.target.value);
        }
        currentAudioType = e.target.value;
    });

    // 页面隐藏时暂停音频
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isAudioPlaying && currentAudio) {
            currentAudio.pause();
            isAudioPlaying = false;
            updateAudioButton();
        }
    });
    
    // 初始化音频按钮状态
    updateAudioButton();

    // 在开始冥想时自动播放音乐
    document.getElementById('start-practice').addEventListener('click', () => {
        if (!isAudioPlaying) {
            playBackgroundSound(currentAudioType);
        }
    });

    loadTips(env);
}

// 开发工具（仅在开发环境中启用）
function addDevTools() {
    const devButton = document.createElement('button');
    devButton.textContent = 'Clear Cache & Reload';
    devButton.style.cssText = 'position: fixed; bottom: 20px; right: 20px; padding: 10px; background: #ff4444; color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 1000;';
    devButton.onclick = () => {
        localStorage.clear();
        window.location.reload(true);
    };
    document.body.appendChild(devButton);
}

// DOM 内容加载完成后初始化应用
document.addEventListener("DOMContentLoaded", () => {
    log('info', 'DOM Content Loaded');
    const env = {
        DB: {
            prepare: (sql) => ({
                bind: (...params) => ({
                    all: async () => {
                        log('info', 'Executing SELECT query', { sql, params });
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
                        return { results: [] };
                    },
                    run: async () => {
                        log('info', 'Executing UPDATE query', { sql, params });
                        return { success: true };
                    },
                    first: async () => {
                        log('info', 'Executing SELECT FIRST query', { sql, params });
                        return null;
                    }
                })
            })
        }
    };
    
    // 在开发环境中添加开发工具
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        addDevTools();
    }
    
    initializeApp(env);
});