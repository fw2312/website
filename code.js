// 常量和状态变量
const APP_VERSION = '1.0.0';
let currentTipId = null;
let tips = [];

// 工具函数
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.textContent = message;
    errorDiv.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background-color: #f44336; color: white; padding: 15px; border-radius: 5px; z-index: 1000;';
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// 缓存函数
function saveTipToCache(tip) {
    try {
        localStorage.setItem('lastTip', JSON.stringify(tip));
    } catch (error) {
        console.error('Failed to save tip to cache', error);
    }
}

function loadTipFromCache() {
    try {
        const cachedTip = localStorage.getItem('lastTip');
        return cachedTip ? JSON.parse(cachedTip) : null;
    } catch (error) {
        console.error('Error loading tip from cache', error);
        return null;
    }
}

// 核心函数
async function loadTips(env) {
    if (!env || !env.DB) {
        showError("系统配置错误，请稍后再试");
        return;
    }
    
    try {
        // 先尝试加载缓存的提示
        const cachedTip = loadTipFromCache();
        if (cachedTip) {
            showTip(cachedTip);
        }

        // 同时从数据库加载最新数据
        const stmt = env.DB.prepare('SELECT * FROM Tips WHERE language = "zh"');
        const { results } = await stmt.bind().all();
        
        if (!results || results.length === 0) {
            throw new Error('没有找到提示');
        }

        tips = results;
        if (!cachedTip) {
            showRandomTip();
        }
        
    } catch (error) {
        console.error('加载提示失败', error);
        showError("加载提示失败，请稍后再试");
    }
}

function showTip(tip) {
    const tipElement = document.getElementById('spiritual-tip');
    if (!tipElement) return;
    
    currentTipId = tip.id;
    tipElement.textContent = tip.content;
    
    const likeButton = document.getElementById('like-button');
    likeButton.disabled = false;
    likeButton.textContent = '喜欢';
}

function showRandomTip() {
    if (!tips.length) return;
    
    const randomIndex = Math.floor(Math.random() * tips.length);
    const selectedTip = tips[randomIndex];
    
    showTip(selectedTip);
    saveTipToCache(selectedTip);
}

async function likeTip(env) {
    if (!env || !env.DB || !currentTipId) return;
    
    try {
        const stmt = env.DB.prepare('UPDATE Tips SET likes = likes + 1 WHERE id = ?');
        await stmt.bind(currentTipId).run();
        
        const likeButton = document.getElementById('like-button');
        likeButton.textContent = '已喜欢';
        likeButton.disabled = true;
        
        setTimeout(() => {
            likeButton.textContent = '喜欢';
            likeButton.disabled = false;
        }, 2000);
        
    } catch (error) {
        console.error('点赞失败', error);
        showError("点赞失败，请稍后再试");
    }
}

// 初始化应用
document.addEventListener("DOMContentLoaded", () => {
    // 事件监听
    document.getElementById('next-tip').addEventListener('click', showRandomTip);
    document.getElementById('like-button').addEventListener('click', () => likeTip(env));

    // 初始加载
    loadTips(env);
});