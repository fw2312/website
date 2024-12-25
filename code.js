// 定义常量
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时的缓存时间（毫秒）
const APP_VERSION = '1.0.0';

// 音频文件配置
// 我们预先加载所有音频文件，这样可以确保在用户请求时能立即播放
const audioFiles = {
    meditation: new Audio('./sounds/meditation.mp3'),
    beach: new Audio('./sounds/beach.mp3'),
    forest: new Audio('./sounds/forest.mp3')
};

// 为所有音频文件设置循环播放
// 这确保了背景音乐可以持续播放，直到用户选择停止
Object.values(audioFiles).forEach(audio => {
    audio.loop = true;
});

// 翻译数据
// 这个对象包含了应用中所有文本的中英文版本
// 这种结构使得添加新的语言支持变得非常简单
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

// 状态管理
// 这个模块使用了立即调用函数表达式（IIFE）来创建一个封闭的作用域
// 这样可以创建私有变量和方法，只暴露我们希望公开的接口
const StateManager = (function() {
    // 私有变量，存储应用的状态
    let state = {
        currentLanguage: 'zh', // 默认语言为中文
        currentSituation: '', // 当前选择的情境
        currentTipId: null, // 当前显示的提示ID
        isAudioPlaying: false, // 音频是否正在播放
        currentAudioType: 'meditation', // 当前选择的音频类型
        tips: {} // 存储所有的提示数据
    };

    // 存储所有的状态变化监听器
    const listeners = [];

    // 更新状态的方法
    function setState(newState) {
        state = { ...state, ...newState };
        notifyListeners();
    }

    // 获取当前状态的方法
    function getState() {
        return { ...state };
    }

    // 添加状态变化监听器的方法
    function subscribe(listener) {
        listeners.push(listener);
        // 返回一个取消订阅的函数
        return () => {
            listeners = listeners.filter(l => l !== listener);
        };
    }

    // 通知所有监听器状态已经改变
    function notifyListeners() {
        listeners.forEach(listener => listener(state));
    }

    // 只暴露我们希望公开的方法
    return {
        setState,
        getState,
        subscribe
    };
})();

// 音频管理
// 这个模块封装了所有与音频相关的操作
const AudioManager = (function() {
    // 播放指定类型的音频
    function play(type) {
        const { isAudioPlaying, currentAudioType } = StateManager.getState();

        // 如果当前有音频在播放，先停止它
        if (isAudioPlaying) {
            audioFiles[currentAudioType].pause();
        }

        const audio = audioFiles[type];
        audio.currentTime = 0; // 从头开始播放
        
        try {
            // 尝试播放音频
            audio.play().then(() => {
                // 播放成功后更新状态
                StateManager.setState({ 
                    isAudioPlaying: true, 
                    currentAudioType: type 
                });
                UIManager.updateAudioButton();
            }).catch(error => {
                // 播放失败时记录错误并显示给用户
                console.error('播放音频失败:', error);
                ErrorTracker.showErrorToUser("播放音频失败，请检查浏览器设置");
            });
        } catch (error) {
            // 捕获其他可能的错误
            console.error('音频播放出错:', error);
            ErrorTracker.showErrorToUser("播放音频时出现问题。请稍后再试。");
        }
    }

    // 停止当前正在播放的音频
    function stop() {
        const { currentAudioType } = StateManager.getState();
        audioFiles[currentAudioType].pause();
        StateManager.setState({ isAudioPlaying: false });
        UIManager.updateAudioButton();
    }

    // 切换音频的播放状态
    function toggle() {
        const { isAudioPlaying, currentAudioType } = StateManager.getState();
        if (isAudioPlaying) {
            stop();
        } else {
            play(currentAudioType);
        }
    }

    // 只暴露我们希望公开的方法
    return {
        play,
        stop,
        toggle
    };
})();

// UI管理
// 这个模块负责所有与用户界面相关的操作
const UIManager = (function() {
    // 更新UI的语言
    function updateUILanguage() {
        const { currentLanguage } = StateManager.getState();
        // 更新主标题
        document.getElementById('main-title').textContent = translations[currentLanguage].title;
        // 更新介绍文本
        document.getElementById('intro-text').textContent = translations[currentLanguage].intro;
        // 更新"下一条提示"按钮文本
        document.getElementById('next-tip').textContent = translations[currentLanguage].nextTip;
        // 更新语言切换按钮文本
        document.querySelector('#language-switch button').textContent = translations[currentLanguage].switchLang;
        // 更新"喜欢"按钮文本
        document.getElementById('like-button').textContent = translations[currentLanguage].like;

        // 更新所有情境按钮的文本
        const buttons = document.querySelectorAll('#situation-buttons button');
        buttons.forEach(button => {
            const situation = button.dataset.situation;
            button.textContent = translations[currentLanguage][situation];
        });

        // 更新音频控制按钮
        updateAudioButton();
    }

    // 显示指定情境的提示
    function showTip(situation) {
        const { currentLanguage, tips } = StateManager.getState();
        
        // 检查是否有该情境的提示
        if (!tips[situation] || !tips[situation][currentLanguage]) {
            console.error('No tips found for situation/language combination', { situation, language: currentLanguage });
            return;
        }

        // 随机选择一条提示
        const situationTips = tips[situation][currentLanguage];
        const randomIndex = Math.floor(Math.random() * situationTips.length);
        const selectedTip = situationTips[randomIndex];
        
        // 更新状态
        StateManager.setState({ currentTipId: selectedTip.id, currentSituation: situation });
        
        // 更新UI
        const tipElement = document.getElementById('spiritual-tip');
        tipElement.textContent = selectedTip.content;
        document.getElementById('next-tip').style.display = 'block';
        
        // 重置"喜欢"按钮状态
        const likeButton = document.getElementById('like-button');
        likeButton.disabled = false;
        likeButton.textContent = translations[currentLanguage].like;
        likeButton.dataset.situation = situation;
    }

    // 更新音频控制按钮的状态
    function updateAudioButton() {
        const { isAudioPlaying, currentLanguage } = StateManager.getState();
        const audioButton = document.getElementById('audio-toggle');
        const audioText = audioButton.querySelector('.button-text');
        const audioIcon = audioButton.querySelector('.button-icon');
        
        if (isAudioPlaying) {
            audioText.textContent = translations[currentLanguage].stopMusic;
            audioIcon.textContent = '🔈';
        } else {
            audioText.textContent = translations[currentLanguage].playMusic;
            audioIcon.textContent = '🔊';
        }
    }

    // 显示"喜欢"确认
    function showLikeConfirmation() {
        const { currentLanguage } = StateManager.getState();
        const likeButton = document.getElementById('like-button');
        likeButton.textContent = translations[currentLanguage].liked;
        likeButton.disabled = true;
        // 2秒后重置按钮状态
        setTimeout(() => {
            likeButton.textContent = translations[currentLanguage].like;
            likeButton.disabled = false;
        }, 2000);
    }

    // 只暴露我们希望公开的方法
    return {
        updateUILanguage,
        showTip,
        updateAudioButton,
        showLikeConfirmation
    };
})();

// 错误跟踪
// 这个模块帮助我们管理应用中可能出现的错误
const ErrorTracker = (function() {
    // 记录错误
    function logError(error, context) {
        console.error('错误:', error, '上下文:', context);
        // 这里可以添加将错误发送到服务器的逻辑
    }

    // 向用户显示错误消息
    function showErrorToUser(message) {
        const errorDiv = document.createElement('div');
        errorDiv.textContent = message;
        errorDiv.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background-color: #f44336; color: white; padding: 15px; border-radius: 5px; z-index: 1000;';
        document.body.appendChild(errorDiv);
        // 5秒后移除错误消息
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // 只暴露我们希望公开的方法
    return {
        logError,
        showErrorToUser
    };
})();

// 缓存管理
// 这个模块处理提示数据的本地存储和检索，以提高应用性能
const CacheManager = (function() {
    // 保存提示到本地存储
    function saveTipsToCache(tips) {
        try {
            localStorage.setItem('cachedTips', JSON.stringify(tips));
            localStorage.setItem('tipsCacheTimestamp', Date.now().toString());
        } catch (error) {
            console.error('Failed to save tips to cache', error);
        }
    }

    // 从本地存储加载提示
    function loadTipsFromCache() {
        try {
            const cachedTips = localStorage.getItem('cachedTips');
            const cacheTimestamp = localStorage.getItem('tipsCacheTimestamp');
            
            if (cachedTips && cacheTimestamp) {
                // 检查缓存是否过期
                if (Date.now() - parseInt(cacheTimestamp) < CACHE_DURATION) {
                    return JSON.parse(cachedTips);
                }
            }
            return null;
        } catch (error) {
            console.error('Error loading tips from cache', error);
            return null;
        }
    }

    // 只暴露我们希望公开的方法
    return {
        saveTipsToCache,
        loadTipsFromCache
    };
})();

// 数据加载
// 这个函数负责加载提示数据
async function loadTips() {
    // 首先尝试从缓存加载数据
    const cachedTips = CacheManager.loadTipsFromCache();
    if (cachedTips) {
        StateManager.setState({ tips: cachedTips });
        return;
    }

    try {
        // 这里应该是从服务器加载数据的逻辑
        // 为了演示，我们使用模拟数据
        const mockTips = {
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

        // 更新应用状态，保存加载的提示
        StateManager.setState({ tips: mockTips });
        // 将提示保存到缓存中，以便下次快速加载
        CacheManager.saveTipsToCache(mockTips);
    } catch (error) {
        // 如果加载过程中出现错误，记录错误并通知用户
        ErrorTracker.logError(error, 'loadTips');
        ErrorTracker.showErrorToUser("加载提示失败。请稍后再试。");
    }
}

// 初始化应用
// 这个函数是应用的入口点，负责设置所有必要的事件监听器，加载初始数据
function initializeApp() {
    // 加载提示数据
    loadTips();
    // 初始化UI语言
    UIManager.updateUILanguage();

    // 设置音频控制按钮的事件监听器
    document.getElementById('audio-toggle').addEventListener('click', AudioManager.toggle);

    // 设置语言切换按钮的事件监听器
    document.getElementById('language-switch').addEventListener('click', function() {
        const currentLang = StateManager.getState().currentLanguage;
        // 切换语言
        StateManager.setState({ currentLanguage: currentLang === 'zh' ? 'en' : 'zh' });
        // 更新UI以反映新的语言
        UIManager.updateUILanguage();
    });

    // 为情境按钮设置事件委托
    document.getElementById('situation-buttons').addEventListener('click', function(event) {
        if (event.target.matches('button')) {
            // 当点击情境按钮时，显示相应的提示
            UIManager.showTip(event.target.dataset.situation);
        }
    });

    // 设置"下一条提示"按钮的事件监听器
    document.getElementById('next-tip').addEventListener('click', function() {
        const { currentSituation } = StateManager.getState();
        // 显示当前情境的下一条提示
        UIManager.showTip(currentSituation);
    });

    // 设置"喜欢"按钮的事件监听器
    document.getElementById('like-button').addEventListener('click', function() {
        // 这里应该有点赞的逻辑，比如发送到服务器
        // 由于我们没有实际的后端，这里只显示一个确认消息
        UIManager.showLikeConfirmation();
    });

    // 添加可访问性属性
    enhanceAccessibility();
}

// 增强应用的可访问性
function enhanceAccessibility() {
    // 为音频控制按钮添加aria属性
    const audioToggle = document.getElementById('audio-toggle');
    audioToggle.setAttribute('aria-label', '播放或暂停背景音乐');
    audioToggle.setAttribute('aria-pressed', 'false');

    // 为情境按钮添加aria-label属性
    const situationButtons = document.querySelectorAll('#situation-buttons button');
    situationButtons.forEach(button => {
        button.setAttribute('aria-label', `选择${button.textContent}情境`);
    });

    // 为提示显示区域添加aria-live属性，使得屏幕阅读器能够读出更新的提示
    const tipSection = document.getElementById('spiritual-tip');
    tipSection.setAttribute('aria-live', 'polite');
}

// 当DOM内容加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initializeApp);

// 简单的测试函数
// 这个函数包含了一些基本的单元测试，用于验证应用的核心功能
function runTests() {
    function assertEqual(actual, expected, message) {
        if (actual !== expected) {
            console.error(`测试失败: ${message}. 期望 ${expected}, 实际得到 ${actual}`);
        } else {
            console.log(`测试通过: ${message}`);
        }
    }

    // 测试 StateManager
    const initialState = StateManager.getState();
    assertEqual(initialState.currentLanguage, 'zh', '初始语言应该是中文');

    StateManager.setState({ currentLanguage: 'en' });
    const updatedState = StateManager.getState();
    assertEqual(updatedState.currentLanguage, 'en', '语言应该更新为英语');

    // 测试 AudioManager
    assertEqual(StateManager.getState().isAudioPlaying, false, '初始状态下音频不应该在播放');

    // 可以添加更多测试...

    console.log('所有测试完成');
}

// 在开发环境中运行测试
// 这确保了测试只在开发环境中运行，不会影响生产环境的性能
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    runTests();
}

// 添加开发工具（仅在开发环境中启用）
// 这个函数添加了一个用于清除缓存和重新加载页面的按钮，方便开发和测试
function addDevTools() {
    const devButton = document.createElement('button');
    devButton.textContent = '清除缓存并重新加载';
    devButton.style.cssText = 'position: fixed; bottom: 20px; right: 20px; padding: 10px; background: #ff4444; color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 1000;';
    devButton.onclick = () => {
        localStorage.clear();
        window.location.reload(true);
    };
    document.body.appendChild(devButton);
}

// 在开发环境中添加开发工具
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    addDevTools();
}