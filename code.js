// 主题配置
const zenThemes = {
    mountain: {
        name: '山幽',
        sound: 'sounds/mountain-wind.mp3',
        breathText: ['深入山林', '感受微风', '放空思绪'],
        bgColor: '#E8F5E9'
    },
    water: {
        name: '水韵',
        sound: 'sounds/gentle-stream.mp3',
        breathText: ['如水轻柔', '随波漂流', '心随流动'],
        bgColor: '#E3F2FD'
    },
    cloud: {
        name: '云淡',
        sound: 'sounds/soft-rain.mp3',
        breathText: ['轻如薄云', '随风飘逸', '空灵自在'],
        bgColor: '#ECEFF1'
    }
};

// 状态管理
let currentMode = 'tips';
let currentTheme = null;
let currentAudio = null;
let zenTimer = null;
let breathIndex = 0;

// 工具函数
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #ef5350;
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
}

// 模式切换
function initModeSwitch() {
    const tipsMode = document.getElementById('tips-mode');
    const zenMode = document.getElementById('zen-mode');
    const tipsContent = document.getElementById('tips-content');
    const zenContent = document.getElementById('zen-content');

    tipsMode.addEventListener('click', () => {
        currentMode = 'tips';
        tipsMode.classList.add('active');
        zenMode.classList.remove('active');
        tipsContent.classList.remove('hidden');
        zenContent.classList.add('hidden');
        stopZenMode();
    });

    zenMode.addEventListener('click', () => {
        currentMode = 'zen';
        zenMode.classList.add('active');
        tipsMode.classList.remove('active');
        zenContent.classList.remove('hidden');
        tipsContent.classList.add('hidden');
    });
}

// 禅定模式
function initZenThemes() {
    document.querySelectorAll('.zen-theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            startZenMode(theme);
        });
    });

    document.getElementById('exit-zen')?.addEventListener('click', stopZenMode);
}

function startZenMode(theme) {
    if (currentTheme === theme) return;
    
    const themeConfig = zenThemes[theme];
    
    // 停止当前音频
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    // 设置新主题
    document.body.style.backgroundColor = themeConfig.bgColor;
    currentTheme = theme;

    // 播放音频
    currentAudio = new Audio(themeConfig.sound);
    currentAudio.loop = true;
    
    try {
        currentAudio.play();
        document.querySelector('.zen-controls').classList.remove('hidden');
        startBreathingGuide(theme);
        startZenTimer();
    } catch (error) {
        console.error('音频播放失败:', error);
        showError("音频加载失败，请重试");
    }

    // 高亮当前主题按钮
    document.querySelectorAll('.zen-theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

function stopZenMode() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    
    if (zenTimer) {
        clearInterval(zenTimer);
    }

    document.body.style.backgroundColor = '';
    document.querySelector('.zen-controls')?.classList.add('hidden');
    currentTheme = null;
    
    document.querySelectorAll('.zen-theme-btn').forEach(btn => {
        btn.classList.remove('active');
    });
}

// 呼吸引导
function startBreathingGuide(theme) {
    const breathingText = document.querySelector('.breathing-text');
    const breathingCircle = document.querySelector('.breathing-circle');
    breathIndex = 0;

    function updateBreathText() {
        const texts = zenThemes[theme].breathText;
        breathingText.textContent = texts[breathIndex];
        breathIndex = (breathIndex + 1) % texts.length;
    }

    updateBreathText();
    setInterval(updateBreathText, 4000); // 4秒一次呼吸循环
}

// 计时器
function startZenTimer() {
    const timerElement = document.getElementById('zen-timer');
    let timeLeft = 5 * 60; // 5分钟

    function updateTimer() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft === 0) {
            clearInterval(zenTimer);
            showCompletion();
            stopZenMode();
        } else {
            timeLeft--;
        }
    }

    updateTimer();
    zenTimer = setInterval(updateTimer, 1000);
}

// 完成提示
function showCompletion() {
    const message = document.createElement('div');
    message.className = 'completion-message';
    message.innerHTML = `
        <div class="completion-content">
            <span>✨</span>
            <h3>静心时刻</h3>
            <p>愿您找到内心的平静</p>
        </div>
    `;
    
    document.body.appendChild(message);
    setTimeout(() => message.remove(), 3000);
}

// 心语模式功能
async function loadTips() {
    // 这里可以添加从服务器加载提示的逻辑
    const tips = {
        morning: [
            "清晨的第一缕阳光，带来新的希望",
            "深呼吸，感受晨间的清新空气",
            "今天也要充满活力地开始"
        ],
        work: [
            "专注当下，保持平和的心态",
            "每个挑战都是成长的机会",
            "合理安排时间，保持节奏"
        ],
        break: [
            "闭上眼睛，让思绪短暂放空",
            "享受片刻的宁静时光",
            "给自己一个小小的奖励"
        ],
        evening: [
            "回顾今天的收获与感动",
            "放下白天的忙碌与疲惫",
            "准备迎接平静的夜晚"
        ],
        sleep: [
            "放空思绪，让身心慢慢放松",
            "感恩今天遇到的一切",
            "美好的梦境在等待"
        ]
    };
    return tips;
}

// 初始化应用
async function initializeApp() {
    initModeSwitch();
    initZenThemes();

    const tips = await loadTips();
    
    // 情境按钮点击事件
    document.querySelectorAll('#situation-buttons button').forEach(button => {
        button.addEventListener('click', () => {
            const situation = button.dataset.situation;
            const situationTips = tips[situation];
            if (situationTips) {
                const randomTip = situationTips[Math.floor(Math.random() * situationTips.length)];
                document.getElementById('spiritual-tip').textContent = randomTip;
            }
        });
    });

    // 下一条按钮点击事件
    document.getElementById('next-tip')?.addEventListener('click', () => {
        const currentSituation = document.querySelector('#situation-buttons button.active')?.dataset.situation;
        if (currentSituation) {
            const situationTips = tips[currentSituation];
            const randomTip = situationTips[Math.floor(Math.random() * situationTips.length)];
            document.getElementById('spiritual-tip').textContent = randomTip;
        }
    });

    // 记住按钮点击事件
    document.getElementById('like-button')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        btn.textContent = '已记住';
        btn.disabled = true;
        setTimeout(() => {
            btn.textContent = '记住';
            btn.disabled = false;
        }, 2000);
    });
}

// 启动应用
document.addEventListener('DOMContentLoaded', initializeApp);

// 页面可见性变化处理
document.addEventListener('visibilitychange', () => {
    if (document.hidden && currentAudio) {
        currentAudio.pause();
    } else if (!document.hidden && currentAudio && currentTheme) {
        currentAudio.play().catch(() => {});
    }
});