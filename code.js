// 基础配置
const CONFIG = {
    AUDIO_BASE_PATH: '/sounds',
    CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
};

// 必需资源列表
const REQUIRED_ASSETS = [
    'sounds/meditation.mp3',
    'sounds/beach.mp3',
    'sounds/forest.mp3'
];

// Event Listeners and main setup
addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/') {
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

// 音频控制相关的状态
let currentAudio = null;
let currentAudioType = 'meditation';
let isAudioPlaying = false;

// 音频文件配置
const audioFiles = {
    meditation: new Audio(`${CONFIG.AUDIO_BASE_PATH}/meditation.mp3`),
    beach: new Audio(`${CONFIG.AUDIO_BASE_PATH}/beach.mp3`),
    forest: new Audio(`${CONFIG.AUDIO_BASE_PATH}/forest.mp3`)
};

// 为所有音频文件设置循环播放
Object.values(audioFiles).forEach(audio => {
    audio.loop = true;
});

// UI 工具函数
function toggleLoading(show) {
    const loader = document.getElementById('loader');
    if (show) {
        if (loader) return;
        const newLoader = document.createElement('div');
        newLoader.id = 'loader';
        newLoader.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 5px solid #f3f3f3; border-top: 5px solid #3498db; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite;';
        document.body.appendChild(newLoader);
    } else {
        loader?.remove();
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.textContent = message;
    errorDiv.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background-color: #f44336; color: white; padding: 15px; border-radius: 5px; z-index: 1000;';
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// 资源检查函数
async function checkRequiredAssets() {
    for (const asset of REQUIRED_ASSETS) {
        try {
            const response = await fetch(asset, { method: 'HEAD' });
            if (!response.ok) {
                throw new Error(`Failed to load asset: ${asset}`);
            }
        } catch (error) {
            showError('Some required resources failed to load. Please refresh the page.');
            return false;
        }
    }
    return true;
}

// 音频控制函数
function playBackgroundSound(type) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    
    currentAudio = audioFiles[type];
    currentAudioType = type;
    
    try {
        currentAudio.play().then(() => {
            isAudioPlaying = true;
            updateAudioButton();
        }).catch(() => {
            showError(currentLanguage === 'zh' ? 
                "播放音频失败，请检查浏览器设置" : 
                "Failed to play audio, please check browser settings"
            );
        });
    } catch (error) {
        console.error('Error playing audio:', error);
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
    const audioToggle = document.getElementById('audio-toggle');
    const soundSelect = document.getElementById('sound-select');

    audioToggle.addEventListener('click', toggleAudio);
    
    soundSelect.addEventListener('change', (e) => {
        if (isAudioPlaying) {
            playBackgroundSound(e.target.value);
        }
        currentAudioType = e.target.value;
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isAudioPlaying && currentAudio) {
            currentAudio.pause();
            isAudioPlaying = false;
            updateAudioButton();
        }
    });
    
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
    try {
        localStorage.setItem('cachedTips', JSON.stringify(tips));
        localStorage.setItem('tipsCacheTimestamp', Date.now());
    } catch (error) {
        console.error('Failed to save tips to cache:', error);
    }
}

function loadTipsFromCache() {
    try {
        const cachedTips = localStorage.getItem('cachedTips');
        const cacheTimestamp = localStorage.getItem('tipsCacheTimestamp');
        
        if (cachedTips && cacheTimestamp) {
            if (Date.now() - parseInt(cacheTimestamp) < CONFIG.CACHE_DURATION) {
                return JSON.parse(cachedTips);
            }
        }
        return null;
    } catch (error) {
        console.error('Error loading tips from cache:', error);
        return null;
    }
}

// 核心功能函数
async function loadTips(env) {
    if (!env?.DB) {
        showError("System configuration error. Please try again later.");
        return;
    }
    
    toggleLoading(true);
    
    try {
        const cachedTips = loadTipsFromCache();
        if (cachedTips) {
            tips = cachedTips;
            updateUI();
            return;
        }

        const stmt = env.DB.prepare(`
            SELECT * FROM Tips 
            ORDER BY situation, language
        `);
        
        const { results } = await stmt.bind().all();
        
        if (!results?.length) {
            throw new Error('No tips found in database');
        }

        tips = {};
        for (const row of results) {
            if (!row.situation || !row.language || !row.content) continue;

            if (!tips[row.situation]) {
                tips[row.situation] = {};
            }
            if (!tips[row.situation][row.language]) {
                tips[row.situation][row.language] = [];
            }

            tips[row.situation][row.language].push(row);
        }

        if (Object.keys(tips).length === 0) {
            throw new Error('No valid tips were processed');
        }

        saveTipsToCache(tips);
        updateUI();
        
    } catch (error) {
        console.error('Failed to load tips:', error);
        showError("Failed to load tips. Please try again later.");
        tips = {};
    } finally {
        toggleLoading(false);
    }
}

function updateUI() {
    updateUILanguage();
    if (currentSituation) {
        showTip(currentSituation);
    }
}

function updateUILanguage() {
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
    currentSituation = situation;
    
    if (!tips[situation]?.[currentLanguage]) return;

    const situationTips = tips[situation][currentLanguage];
    const randomIndex = Math.floor(Math.random() * situationTips.length);
    const selectedTip = situationTips[randomIndex];
    
    currentTipId = selectedTip.id;
    
    const tipElement = document.getElementById('spiritual-tip');
    if (!tipElement) return;
    
    tipElement.textContent = selectedTip.content;
    document.getElementById('next-tip').style.display = 'block';
    
    const likeButton = document.getElementById('like-button');
    likeButton.disabled = false;
    likeButton.textContent = translations[currentLanguage].like;
    likeButton.dataset.situation = situation;
}

function showLikeConfirmation() {
    const likeButton = document.getElementById('like-button');
    likeButton.textContent = translations[currentLanguage].liked;
    likeButton.disabled = true;
    setTimeout(() => {
        likeButton.textContent = translations[currentLanguage].like;
        likeButton.disabled = false;
    }, 2000);
}

async function likeTip(env) {
    if (!env?.DB || !currentTipId) return;
    
    try {
        const stmt = env.DB.prepare('UPDATE Tips SET likes = likes + 1 WHERE id = ?');
        await stmt.bind(currentTipId).run();
        
        if (tips[currentSituation]?.[currentLanguage]) {
            const tip = tips[currentSituation][currentLanguage].find(t => t.id === currentTipId);
            if (tip) {
                tip.likes++;
            }
        }
        
        showLikeConfirmation();
    } catch (error) {
        console.error('Failed to like tip:', error);
        showError("Failed to like tip. Please try again later.");
    }
}

function showNextTip() {
    if (currentSituation) {
        showTip(currentSituation);
    }
}

function switchLanguage() {
    currentLanguage = currentLanguage === 'zh' ? 'en' : 'zh';
    updateUILanguage();
    if (currentSituation) {
        showTip(currentSituation);
    }
}

function initializeApp(env) {
    document.querySelector('#language-switch button').addEventListener('click', switchLanguage);
    
    document.querySelectorAll('#situation-buttons button').forEach(button => {
        button.addEventListener('click', (e) => showTip(e.target.dataset.situation));
    });

    document.getElementById('next-tip')?.addEventListener('click', showNextTip);
    document.getElementById('like-button')?.addEventListener('click', () => likeTip(env));

    initAudioControls();

    document.getElementById('start-practice')?.addEventListener('click', () => {
        if (!isAudioPlaying) {
            playBackgroundSound(currentAudioType);
        }
    });

    loadTips(env);
}

// DOM 内容加载完成后初始化应用
document.addEventListener("DOMContentLoaded", async () => {
    const assetsLoaded = await checkRequiredAssets();
    if (!assetsLoaded) return;
    
    const env = {
        DB: {
            prepare: (sql) => ({
                bind: (...params) => ({
                    all: async () => ({ results: [] }),
                    run: async () => ({ success: true })
                })
            })
        }
    };
    
    initializeApp(env);
});