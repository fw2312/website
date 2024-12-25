/**
 * code.js
 * 这是心灵加油站应用的主要JavaScript文件。
 * 该应用程序使用模块化设计，包含状态管理、UI交互、数据持久化等功能。
 * 作者：[您的名字]
 * 版本：1.0.0
 * 最后更新：2024-12-25
 */

// 导入数据库管理模块
import DatabaseManager from './DatabaseManager.js';

// ===================================
// 常量定义
// ===================================

// 定义应用程序的关键常量
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 缓存持续24小时（毫秒）
const APP_VERSION = '1.0.0';                 // 当前应用版本

// ===================================
// 音频系统
// ===================================

// 预加载所有音频文件以确保即时播放
const audioFiles = {
    meditation: new Audio('./sounds/meditation.mp3'),
    beach: new Audio('./sounds/beach.mp3'),
    forest: new Audio('./sounds/forest.mp3')
};

// 设置所有音频文件为循环播放模式
Object.values(audioFiles).forEach(audio => {
    audio.loop = true;
});

// ===================================
// 多语言系统
// ===================================

// 定义应用程序的多语言内容
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
        like: "喜欢",
        playMusic: "播放音乐",
        stopMusic: "停止音乐"
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
        like: "Like",
        playMusic: "Play Music",
        stopMusic: "Stop Music"
    }
};

// ===================================
// 状态管理系统
// ===================================

/**
 * StateManager 模块负责管理整个应用的状态。
 * 使用观察者模式实现状态变化的通知机制。
 */
const StateManager = (function() {
    // 应用的初始状态
    let state = {
        currentLanguage: 'zh',         // 当前语言
        currentSituation: '',          // 当前情境
        currentTipId: null,            // 当前提示ID
        isAudioPlaying: false,         // 音频播放状态
        currentAudioType: 'meditation', // 当前音频类型
        tips: {}                       // 提示数据
    };

    // 状态变化的监听器数组
    let listeners = [];

    // 更新状态
    function setState(newState) {
        state = { ...state, ...newState };
        notifyListeners();
    }

    // 获取当前状态
    function getState() {
        return { ...state };
    }

    // 添加状态监听器
    function subscribe(listener) {
        listeners.push(listener);
        // 返回取消订阅函数
        return () => {
            listeners = listeners.filter(l => l !== listener);
        };
    }

    // 通知所有监听器状态已改变
    function notifyListeners() {
        listeners.forEach(listener => listener(state));
    }

    return {
        setState,
        getState,
        subscribe
    };
})();

// ===================================
// 音频管理系统
// ===================================

/**
 * AudioManager 模块负责处理所有音频相关的操作。
 * 包括播放、暂停、切换等功能。
 */
const AudioManager = (function() {
    // 播放指定类型的音频
    async function play(type) {
        const { isAudioPlaying, currentAudioType } = StateManager.getState();

        if (isAudioPlaying) {
            audioFiles[currentAudioType].pause();
        }

        const audio = audioFiles[type];
        audio.currentTime = 0;
        
        try {
            await audio.play();
            StateManager.setState({ 
                isAudioPlaying: true, 
                currentAudioType: type 
            });
            UIManager.updateAudioButton();
        } catch (error) {
            ErrorTracker.logError(error, 'AudioManager.play');
            ErrorTracker.showErrorToUser("播放音频失败，请检查浏览器设置");
        }
    }

    // 停止当前播放的音频
    function stop() {
        const { currentAudioType } = StateManager.getState();
        audioFiles[currentAudioType].pause();
        StateManager.setState({ isAudioPlaying: false });
        UIManager.updateAudioButton();
    }

    // 切换音频播放状态
    function toggle() {
        const { isAudioPlaying, currentAudioType } = StateManager.getState();
        if (isAudioPlaying) {
            stop();
        } else {
            play(currentAudioType);
        }
    }

    return {
        play,
        stop,
        toggle
    };
})();

// ===================================
// UI管理系统
// ===================================

/**
 * UIManager 模块负责处理所有用户界面相关的操作。
 * 包括更新显示、处理交互等功能。
 */
const UIManager = (function() {
    // 更新界面语言
    function updateUILanguage() {
        const { currentLanguage } = StateManager.getState();
        
        // 更新所有需要翻译的UI元素
        document.getElementById('main-title').textContent = translations[currentLanguage].title;
        document.getElementById('intro-text').textContent = translations[currentLanguage].intro;
        document.getElementById('next-tip').textContent = translations[currentLanguage].nextTip;
        document.querySelector('#language-switch button').textContent = translations[currentLanguage].switchLang;
        document.getElementById('like-button').textContent = translations[currentLanguage].like;

        // 更新情境按钮文本
        const buttons = document.querySelectorAll('#situation-buttons button');
        buttons.forEach(button => {
            const situation = button.dataset.situation;
            button.textContent = translations[currentLanguage][situation];
        });

        updateAudioButton();
    }

    // 显示指定情境的提示
    async function showTip(situation) {
        const { currentLanguage, tips } = StateManager.getState();
        
        if (!tips[situation] || !tips[situation][currentLanguage]) {
            ErrorTracker.logError(
                new Error('找不到提示'),
                { situation, language: currentLanguage }
            );
            return;
        }

        const situationTips = tips[situation][currentLanguage];
        const randomIndex = Math.floor(Math.random() * situationTips.length);
        const selectedTip = situationTips[randomIndex];
        
        StateManager.setState({ 
            currentTipId: selectedTip.id, 
            currentSituation: situation 
        });
        
        const tipElement = document.getElementById('spiritual-tip');
        tipElement.textContent = selectedTip.content;
        document.getElementById('next-tip').style.display = 'block';
        
        const likeButton = document.getElementById('like-button');
        likeButton.disabled = false;
        likeButton.textContent = translations[currentLanguage].like;

        try {
            const likeCount = await DatabaseManager.getLikeCount(selectedTip.id);
            if (likeCount > 0) {
                likeButton.textContent = `${translations[currentLanguage].like} (${likeCount})`;
            }
        } catch (error) {
            ErrorTracker.logError(error, 'UIManager.showTip');
        }
    }

    // 更新音频控制按钮状态
    function updateAudioButton() {
        const { isAudioPlaying, currentLanguage } = StateManager.getState();
        const audioButton = document.getElementById('audio-toggle');
        const audioText = audioButton.querySelector('.button-text');
        const audioIcon = audioButton.querySelector('.button-icon');
        
        audioText.textContent = translations[currentLanguage][isAudioPlaying ? 'stopMusic' : 'playMusic'];
        audioIcon.textContent = isAudioPlaying ? '🔈' : '🔊';
    }

    // 显示点赞确认
    async function showLikeConfirmation(likeCount, options = {}) {
        const defaultOptions = {
            animationDuration: 2000,
            showAnimation: true
        };
        const finalOptions = { ...defaultOptions, ...options };

        const { currentLanguage, currentTipId } = StateManager.getState();
        const likeButton = document.getElementById('like-button');
        const likeCountElement = document.querySelector('.like-count');
        
        try {
            likeButton.textContent = `${translations[currentLanguage].liked} (${likeCount})`;
            likeButton.disabled = true;
            
            if (finalOptions.showAnimation) {
                likeButton.classList.add('liked-animation');
                if (likeCountElement) {
                    likeCountElement.textContent = likeCount.toString();
                    likeCountElement.classList.add('update-animation');
                }
            }
            
            // 记录点赞状态到本地存储
            try {
                const likedTips = JSON.parse(localStorage.getItem('likedTips') || '[]');
                if (!likedTips.includes(currentTipId)) {
                    likedTips.push(currentTipId);
                    localStorage.setItem('likedTips', JSON.stringify(likedTips));
                }
            } catch (storageError) {
                console.warn('保存点赞状态到本地存储失败:', storageError);
            }
            
            // 发送状态更新事件
            document.dispatchEvent(new CustomEvent('likeUpdated', {
                detail: {
                    tipId: currentTipId,
                    count: likeCount,
                    timestamp: Date.now()
                }
            }));
            
            // 还原按钮状态
            await new Promise(resolve => {
                setTimeout(() => {
                    likeButton.textContent = `${translations[currentLanguage].like} (${likeCount})`;
                    likeButton.disabled = false;
                    
                    if (finalOptions.showAnimation) {
                        likeButton.classList.remove('liked-animation');
                        if (likeCountElement) {
                            likeCountElement.classList.remove('update-animation');
                        }
                    }
                    
                    resolve();
                }, finalOptions.animationDuration);
            });
        } catch (error) {
            ErrorTracker.logError(error, {
                context: 'showLikeConfirmation',
                tipId: currentTipId,
                likeCount: likeCount
            });
            
            ErrorTracker.showErrorToUser("更新点赞显示失败，请稍后重试。");
            
            likeButton.disabled = false;
            likeButton.textContent = translations[currentLanguage].like;
            likeButton.classList.remove('liked-animation');
            if (likeCountElement) {
                likeCountElement.classList.remove('update-animation');
            }
        }
    }

    return {
        updateUILanguage,
        showTip,
        updateAudioButton,
        showLikeConfirmation
    };
})();

// ===================================
// 错误追踪系统
// ===================================

/**
 * ErrorTracker 模块负责处理错误日志和用户提示。
 */
const ErrorTracker = (function() {
    function logError(error, context) {
        console.error('错误:', error, '上下文:', context);
    }

    function showErrorToUser(message) {
        const errorDiv = document.createElement('div');
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #f44336;
            color: white;
            padding: 15px;
            border-radius: 5px;
            z-index: 1000;
        `;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }

    return {
        logError,
        showErrorToUser
    };
})();

// ===================================
// 缓存管理系统
// ===================================

/**
 * CacheManager 模块负责处理数据的本地缓存。
 */
const CacheManager = (function() {
    function saveTipsToCache(tips) {
        try {
            localStorage.setItem('cachedTips', JSON.stringify(tips));
            localStorage.setItem('tipsCacheTimestamp', Date.now().toString());
        } catch (error) {
            console.error('保存数据到缓存失败', error);
        }
    }

    function loadTipsFromCache() {
        try {
            const cachedTips = localStorage.getItem('cachedTips');
            const cacheTimestamp = localStorage.getItem('tipsCacheTimestamp');
            
            if (cachedTips && cacheTimestamp) {
                if (Date.now() - parseInt(cacheTimestamp) < CACHE_DURATION) {
                    return JSON.parse(cachedTips);
                }
            }
            return null;
        } catch (error) {
            console.error('从缓存加载数据失败', error);
            return null;
        }
    }

    return {
        saveTipsToCache,
        loadTipsFromCache
    };
})();

// ===================================
// 数据加载系统
// ===================================

/**
 * 加载提示数据的主要函数。
 * 优先从缓存加载，如果缓存不可用则从数据库加载。
 * 如果数据库中没有数据，则使用默认数据。
 */
async function loadTips() {
    try {
        const cachedTips = CacheManager.loadTipsFromCache();
        if (cachedTips) {
            StateManager.setState({ tips: cachedTips });
            return;
        }

        const tips = await DatabaseManager.loadTipsFromDatabase();
        
        if (!tips || Object.keys(tips).length === 0) {
            // 默认的提示数据
            const defaultTips = {
                morning: {
                    zh: [
                        { id: 'morning_zh_1', content: '深呼吸，感受清晨的空气。' },
                        { id: 'morning_zh_2', content: '花一分钟时间，感恩你所拥有的一切。' }
                    ],
                    en: [
                        { id: 'morning_en_1', content: 'Take a deep breath, feel the morning air.' },
                        { id: 'morning_en_2', content: 'Take a moment to be grateful for what you have.' }
                    ]
                },
                work: {
                    zh: [
                        { id: 'work_zh_1', content: '闭上眼睛，专注于你的呼吸，持续30秒。' },
                        { id: 'work_zh_2', content: '站起来，做一些简单的伸展运动。' }
                    ],
                    en: [
                        { id: 'work_en_1', content: 'Close your eyes, focus on your breath for 30 seconds.' },
                        { id: 'work_en_2', content: 'Stand up and do some simple stretches.' }
                    ]
                },
                break: {
                    zh: [
                        { id: 'break_zh_1', content: '找一个安静的地方，闭上眼睛休息一下。' },
                        { id: 'break_zh_2', content: '听一首你喜欢的歌曲，放松心情。' }
                    ],
                    en: [
                        { id: 'break_en_1', content: 'Find a quiet place and close your eyes to rest.' },
                        { id: 'break_en_2', content: 'Listen to a song you like to relax your mind.' }
                    ]
                },
                evening: {
                    zh: [
                        { id: 'evening_zh_1', content: '写下今天让你感到快乐的三件事。' },
                        { id: 'evening_zh_2', content: '与家人或朋友聊聊天，分享你的感受。' }
                    ],
                    en: [
                        { id: 'evening_en_1', content: 'Write down three things that made you happy today.' },
                        { id: 'evening_en_2', content: 'Chat with family or friends, share your feelings.' }
                    ]
                },
                sleep: {
                    zh: [
                        { id: 'sleep_zh_1', content: '进行几次深呼吸，放松全身。' },
                        { id: 'sleep_zh_2', content: '想象一个宁静的场景，帮助入睡。' }
                    ],
                    en: [
                        { id: 'sleep_en_1', content: 'Take a few deep breaths, relax your body.' },
                        { id: 'sleep_en_2', content: 'Imagine a peaceful scene to help you fall asleep.' }
                    ]
                }
            };
            
            StateManager.setState({ tips: defaultTips });
            CacheManager.saveTipsToCache(defaultTips);
        } else {
            StateManager.setState({ tips: tips });
            CacheManager.saveTipsToCache(tips);
        }
    } catch (error) {
        ErrorTracker.logError(error, 'loadTips');
        ErrorTracker.showErrorToUser("加载提示失败。请稍后再试。");
    }
}

// ===================================
// 事件处理系统
// ===================================

/**
 * 处理语言切换的事件处理函数
 */
function handleLanguageSwitch() {
    const currentLang = StateManager.getState().currentLanguage;
    StateManager.setState({ 
        currentLanguage: currentLang === 'zh' ? 'en' : 'zh' 
    });
    UIManager.updateUILanguage();
}

/**
 * 处理情境选择的事件处理函数
 */
function handleSituationClick(event) {
    if (event.target.matches('button')) {
        UIManager.showTip(event.target.dataset.situation);
    }
}

/**
 * 处理下一条提示请求的事件处理函数
 */
function handleNextTip() {
    const { currentSituation } = StateManager.getState();
    UIManager.showTip(currentSituation);
}

/**
 * 处理点赞操作的事件处理函数
 */
async function handleLikeClick() {
    try {
        const { currentTipId } = StateManager.getState();
        if (!currentTipId) return;
        
        await DatabaseManager.recordLike(currentTipId);
        const likeCount = await DatabaseManager.getLikeCount(currentTipId);
        await UIManager.showLikeConfirmation(likeCount);
    } catch (error) {
        ErrorTracker.logError(error, 'handleLikeClick');
        ErrorTracker.showErrorToUser("点赞失败，请稍后重试。");
    }
}

/**
 * 设置所有事件监听器
 */
function setupEventListeners() {
    // 音频控制
    document.getElementById('audio-toggle')
        .addEventListener('click', AudioManager.toggle);

    // 语言切换
    document.getElementById('language-switch')
        .addEventListener('click', handleLanguageSwitch);

    // 情境选择
    document.getElementById('situation-buttons')
        .addEventListener('click', handleSituationClick);

    // 下一条提示
    document.getElementById('next-tip')
        .addEventListener('click', handleNextTip);

    // 点赞按钮
    document.getElementById('like-button')
        .addEventListener('click', handleLikeClick);
}

// ===================================
// 可访问性增强系统
// ===================================

/**
 * 增强应用程序的可访问性
 * 添加ARIA属性和其他可访问性相关的功能
 */
function enhanceAccessibility() {
    // 音频控制按钮可访问性
    const audioToggle = document.getElementById('audio-toggle');
    audioToggle.setAttribute('aria-label', '播放或暂停背景音乐');
    audioToggle.setAttribute('aria-pressed', 'false');

    // 情境按钮可访问性
    const situationButtons = document.querySelectorAll('#situation-buttons button');
    situationButtons.forEach(button => {
        button.setAttribute('aria-label', `选择${button.textContent}情境`);
    });

    // 提示区域可访问性
    const tipSection = document.getElementById('spiritual-tip');
    tipSection.setAttribute('aria-live', 'polite');
}

// ===================================
// 应用程序初始化
// ===================================

/**
 * 初始化整个应用程序
 * 包括数据库初始化、加载数据、设置事件监听器等
 */
async function initializeApp() {
    try {
        // 初始化数据库
        await DatabaseManager.initializeDatabase();
        
        // 加载提示数据
        await loadTips();
        
        // 初始化UI语言
        UIManager.updateUILanguage();

        // 设置事件监听器
        setupEventListeners();
        
        // 增强可访问性
        enhanceAccessibility();
        
        console.log('应用初始化完成:', APP_VERSION);
    } catch (error) {
        ErrorTracker.logError(error, 'initializeApp');
        ErrorTracker.showErrorToUser("初始化应用失败。请刷新页面重试。");
    }
}

// ===================================
// 开发工具和测试系统
// ===================================

/**
 * 运行基本的单元测试
 */
function runTests() {
    function assertEqual(actual, expected, message) {
        if (actual !== expected) {
            console.error(`测试失败: ${message}. 期望 ${expected}, 实际得到 ${actual}`);
        } else {
            console.log(`测试通过: ${message}`);
        }
    }

    // 测试状态管理
    const initialState = StateManager.getState();
    assertEqual(initialState.currentLanguage, 'zh', '初始语言应该是中文');

    StateManager.setState({ currentLanguage: 'en' });
    const updatedState = StateManager.getState();
    assertEqual(updatedState.currentLanguage, 'en', '语言应该更新为英语');

    // 测试音频管理
    assertEqual(StateManager.getState().isAudioPlaying, false, '初始状态下音频不应该在播放');

    console.log('所有测试完成');
}

/**
 * 添加开发环境工具
 */
function addDevTools() {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        const devButton = document.createElement('button');
        devButton.textContent = '清除缓存并重新加载';
        devButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px;
            background: #ff4444;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            z-index: 1000;
        `;
        devButton.onclick = () => {
            localStorage.clear();
            window.location.reload(true);
        };
        document.body.appendChild(devButton);
        
        // 在开发环境中运行测试
        runTests();
    }
}

// ===================================
// 应用程序启动
// ===================================

// 当DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    addDevTools();
});

// 监听在线状态变化
window.addEventListener('online', () => {
    ErrorTracker.showErrorToUser("网络已恢复连接");
});

window.addEventListener('offline', () => {
    ErrorTracker.showErrorToUser("网络连接已断开，部分功能可能无法使用");
});

// 导出需要暴露的模块
export {
    StateManager,
    AudioManager,
    UIManager,
    ErrorTracker,
    CacheManager
};