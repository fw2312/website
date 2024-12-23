// 基础配置
const CONFIG = {
    AUDIO_BASE_PATH: '/sounds',
    CACHE_DURATION: 24 * 60 * 60 * 1000 // 24 hours
};

// 音乐播放器配置
const musicTracks = [
    { title: "冥想音乐", file: "sounds/meditation.mp3" },
    { title: "海浪声", file: "sounds/beach.mp3" },
    { title: "森林声", file: "sounds/forest.mp3" }
];

// 状态变量
let currentTipId = null;
let tips = {};
let currentSituation = '';

// 音乐播放器状态
let currentTrackIndex = 0;
let isPlaying = false;
let audioPlayer = null;

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

// 音乐播放器功能
function initMusicPlayer() {
    audioPlayer = new Audio();
    audioPlayer.loop = true;
    
    loadTrack(currentTrackIndex);
    updateNowPlaying();
    
    document.getElementById('toggle-music').addEventListener('click', toggleMusic);
    document.getElementById('prev-track').addEventListener('click', playPreviousTrack);
    document.getElementById('next-track').addEventListener('click', playNextTrack);
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

function loadTrack(index) {
    const track = musicTracks[index];
    audioPlayer.src = track.file;
    updateNowPlaying();
}

function updateNowPlaying() {
    const track = musicTracks[currentTrackIndex];
    document.getElementById('now-playing').textContent = isPlaying ? `正在播放: ${track.title}` : track.title;
    document.getElementById('toggle-music').textContent = isPlaying ? '🔊' : '🔈';
}

function toggleMusic() {
    if (isPlaying) {
        audioPlayer.pause();
    } else {
        audioPlayer.play().catch(error => {
            console.error('播放失败:', error);
            showError("播放音频失败，请检查浏览器设置");
        });
    }
    isPlaying = !isPlaying;
    updateNowPlaying();
}

function playNextTrack() {
    currentTrackIndex = (currentTrackIndex + 1) % musicTracks.length;
    const wasPlaying = isPlaying;
    if (isPlaying) {
        audioPlayer.pause();
    }
    loadTrack(currentTrackIndex);
    if (wasPlaying) {
        audioPlayer.play();
    }
    updateNowPlaying();
}

function playPreviousTrack() {
    currentTrackIndex = (currentTrackIndex - 1 + musicTracks.length) % musicTracks.length;
    const wasPlaying = isPlaying;
    if (isPlaying) {
        audioPlayer.pause();
    }
    loadTrack(currentTrackIndex);
    if (wasPlaying) {
        audioPlayer.play();
    }
    updateNowPlaying();
}

function handleVisibilityChange() {
    if (document.hidden && isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        updateNowPlaying();
    }
}

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

// 提示内容管理
async function loadTips(env) {
    if (!env?.DB) {
        showError("系统配置错误，请稍后重试。");
        return;
    }
    
    toggleLoading(true);
    
    try {
        const cachedTips = loadTipsFromCache();
        if (cachedTips) {
            tips = cachedTips;
            return;
        }

        const stmt = env.DB.prepare('SELECT * FROM Tips WHERE language = "zh" ORDER BY situation');
        const { results } = await stmt.bind().all();
        
        if (!results?.length) {
            throw new Error('没有找到提示内容');
        }

        tips = {};
        for (const row of results) {
            if (!row.situation || !row.content) continue;
            if (!tips[row.situation]) {
                tips[row.situation] = [];
            }
            tips[row.situation].push(row);
        }

        saveTipsToCache(tips);
        
    } catch (error) {
        console.error('加载提示失败:', error);
        showError("加载提示失败，请稍后重试。");
        tips = {};
    } finally {
        toggleLoading(false);
    }
}

function showTip(situation) {
    currentSituation = situation;
    
    if (!tips[situation]?.length) return;

    const situationTips = tips[situation];
    const randomIndex = Math.floor(Math.random() * situationTips.length);
    const selectedTip = situationTips[randomIndex];
    
    currentTipId = selectedTip.id;
    
    const tipElement = document.getElementById('spiritual-tip');
    if (!tipElement) return;
    
    tipElement.textContent = selectedTip.content;
    document.getElementById('next-tip').style.display = 'block';
    
    const likeButton = document.getElementById('like-button');
    likeButton.disabled = false;
    likeButton.textContent = "喜欢";
    likeButton.dataset.situation = situation;
}

function showLikeConfirmation() {
    const likeButton = document.getElementById('like-button');
    likeButton.textContent = "已喜欢";
    likeButton.disabled = true;
    setTimeout(() => {
        likeButton.textContent = "喜欢";
        likeButton.disabled = false;
    }, 2000);
}

async function likeTip(env) {
    if (!env?.DB || !currentTipId) return;
    
    try {
        const stmt = env.DB.prepare('UPDATE Tips SET likes = likes + 1 WHERE id = ?');
        await stmt.bind(currentTipId).run();
        
        if (tips[currentSituation]) {
            const tip = tips[currentSituation].find(t => t.id === currentTipId);
            if (tip) {
                tip.likes++;
            }
        }
        
        showLikeConfirmation();
    } catch (error) {
        console.error('点赞失败:', error);
        showError("点赞失败，请稍后重试");
    }
}

function showNextTip() {
    if (currentSituation) {
        showTip(currentSituation);
    }
}

// 初始化应用
function initializeApp(env) {
    document.querySelectorAll('#situation-buttons button').forEach(button => {
        button.addEventListener('click', (e) => showTip(e.target.dataset.situation));
    });

    document.getElementById('next-tip')?.addEventListener('click', showNextTip);
    document.getElementById('like-button')?.addEventListener('click', () => likeTip(env));

    loadTips(env);
    initMusicPlayer();
}

// 启动应用
document.addEventListener("DOMContentLoaded", () => {
    const env = {
        DB: {
            prepare: (sql) => ({
                bind: (...params) => ({
                    all: async () => ({
                        results: [
                            { id: 'morning_0', situation: 'morning', content: '深呼吸，感受清晨的空气。', likes: 0 },
                            { id: 'morning_1', situation: 'morning', content: '花一分钟时间，感恩你所拥有的一切。', likes: 0 },
                            { id: 'work_0', situation: 'work', content: '闭上眼睛，专注于你的呼吸，持续30秒。', likes: 0 },
                            { id: 'work_1', situation: 'work', content: '站起来，做一些简单的伸展运动。', likes: 0 },
                            { id: 'break_0', situation: 'break', content: '找一个安静的地方，闭上眼睛休息一下。', likes: 0 },
                            { id: 'break_1', situation: 'break', content: '听一首你喜欢的歌曲，放松心情。', likes: 0 },
                            { id: 'evening_0', situation: 'evening', content: '写下今天让你感到快乐的三件事。', likes: 0 },
                            { id: 'evening_1', situation: 'evening', content: '与家人或朋友聊聊天，分享你的感受。', likes: 0 },
                            { id: 'sleep_0', situation: 'sleep', content: '进行几次深呼吸，放松全身。', likes: 0 },
                            { id: 'sleep_1', situation: 'sleep', content: '想象一个宁静的场景，帮助入睡。', likes: 0 }
                        ]
                    }),
                    run: async () => ({ success: true })
                })
            })
        }
    };
    
    initializeApp(env);
});