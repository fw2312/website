// 常量和状态变量
const APP_VERSION = '1.0.0';
let currentTipId = null;
let currentTime = null;
let tips = {};

// 时刻配置
const timeConfig = {
    morning: {
        icon: '🌅',
        text: '早晨起床'
    },
    work: {
        icon: '💼',
        text: '工作时间'
    },
    break: {
        icon: '☕',
        text: '休息时刻'
    },
    evening: {
        icon: '🌙',
        text: '晚间放松'
    },
    sleep: {
        icon: '🌟',
        text: '入睡前'
    }
};

// 工具函数
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// 缓存函数
function saveTipToCache(tip, time) {
    try {
        localStorage.setItem('lastTip', JSON.stringify({ tip, time }));
    } catch (error) {
        console.error('Failed to save tip to cache', error);
    }
}

function loadTipFromCache() {
    try {
        const cached = localStorage.getItem('lastTip');
        return cached ? JSON.parse(cached) : null;
    } catch (error) {
        console.error('Error loading tip from cache', error);
        return null;
    }
}

// 统计函数
async function updateStats(env) {
    try {
        const stmt = env.DB.prepare(`
            SELECT 
                COUNT(*) as totalTips,
                SUM(likes) as totalLikes 
            FROM Tips
        `);
        const { results } = await stmt.bind().all();
        
        if (results && results[0]) {
            document.getElementById('total-tips').textContent = results[0].totalTips || 0;
            document.getElementById('total-likes').textContent = results[0].totalLikes || 0;
        }
    } catch (error) {
        console.error('Failed to load stats', error);
    }
}

// 核心函数
async function loadTips(env) {
    if (!env || !env.DB) {
        showError("系统配置错误，请稍后再试");
        return;
    }
    
    try {
        // 加载缓存的提示
        const cached = loadTipFromCache();
        if (cached) {
            showTip(cached.tip);
            setCurrentTime(cached.time);
        }

        // 从数据库加载提示
        const stmt = env.DB.prepare('SELECT * FROM Tips WHERE language = "zh"');
        const { results } = await stmt.bind().all();
        
        if (!results || results.length === 0) {
            throw new Error('没有找到提示');
        }

        // 按时段组织提示
        tips = results.reduce((acc, tip) => {
            if (!acc[tip.time]) {
                acc[tip.time] = [];
            }
            acc[tip.time].push(tip);
            return acc;
        }, {});

        // 更新统计信息
        await updateStats(env);
        
    } catch (error) {
        console.error('加载提示失败', error);
        showError("加载提示失败，请稍后再试");
    }
}

function setCurrentTime(time) {
    if (!timeConfig[time]) return;
    
    currentTime = time;
    
    // 更新按钮状态
    document.querySelectorAll('.time-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.time === time);
    });
    
    // 更新当前时段显示
    const currentTimeEl = document.getElementById('current-time');
    currentTimeEl.innerHTML = `
        <span class="time-icon">${timeConfig[time].icon}</span>
        <span class="time-text">${timeConfig[time].text}</span>
    `;
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
    if (!currentTime || !tips[currentTime] || !tips[currentTime].length) {
        showError('请先选择一个时段');
        return;
    }
    
    const timeTips = tips[currentTime];
    const randomIndex = Math.floor(Math.random() * timeTips.length);
    const selectedTip = timeTips[randomIndex];
    
    showTip(selectedTip);
    saveTipToCache(selectedTip, currentTime);
}

async function likeTip(env) {
    if (!env || !env.DB || !currentTipId) return;
    
    try {
        const stmt = env.DB.prepare('UPDATE Tips SET likes = likes + 1 WHERE id = ?');
        await stmt.bind(currentTipId).run();
        
        const likeButton = document.getElementById('like-button');
        likeButton.textContent = '已喜欢';
        likeButton.disabled = true;
        
        // 更新统计信息
        await updateStats(env);
        
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
    // 时段选择事件
    document.querySelectorAll('.time-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const time = e.target.closest('.time-button').dataset.time;
            setCurrentTime(time);
            showRandomTip();
        });
    });

    // 其他事件监听
    document.getElementById('next-tip').addEventListener('click', showRandomTip);
    document.getElementById('like-button').addEventListener('click', () => likeTip(env));

    // 初始加载
    loadTips(env);
});