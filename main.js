// Constants
const CACHE_DURATION = window.config.cacheExpiration; // 24 hours

// Initialize Firebase
const app = window.initializeApp(window.firebaseConfig);
const auth = window.getAuth(app);
const database = window.getDatabase(app);

let currentLanguage = window.config.defaultLanguage;
let currentSituation = '';
let currentTipId = null;
let currentUserId = null;

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
    localStorage.setItem('cachedTips', JSON.stringify(tips));
    localStorage.setItem('tipsCacheTimestamp', Date.now());
}

function loadTipsFromCache() {
    const cachedTips = localStorage.getItem('cachedTips');
    const cacheTimestamp = localStorage.getItem('tipsCacheTimestamp');
    
    if (cachedTips && cacheTimestamp) {
        if (Date.now() - parseInt(cacheTimestamp) < CACHE_DURATION) {
            return JSON.parse(cachedTips);
        }
    }
    return null;
}

function canWrite() {
    return window.databaseAccessLevel === 'write' || window.databaseAccessLevel === 'full';
}

function canRead() {
    return window.databaseAccessLevel === 'read' || window.databaseAccessLevel === 'full';
}

function authenticateAnonymously() {
    window.signInAnonymously(auth)
        .then((userCredential) => {
            currentUserId = userCredential.user.uid;
            console.log("Authenticated anonymously with user ID:", currentUserId);
            loadTips();
        })
        .catch((error) => {
            console.error("Authentication error:", error);
            showError("Authentication failed. Please try again later.");
        });
}

function loadTips() {
    showLoading();
    const cachedTips = loadTipsFromCache();
    if (cachedTips) {
        console.log("Loading tips from cache");
        tips = cachedTips;
        updateUI();
        hideLoading();
        return;
    }

    if (!canRead()) {
        console.log("Reading from database is not allowed in this environment");
        hideLoading();
        return;
    }

    const tipsRef = window.ref(database, 'tips');
    window.get(tipsRef).then((snapshot) => {
        const dbTips = snapshot.val();
        if (dbTips && Object.keys(dbTips).length > 0) {
            tips = dbTips;
            saveTipsToCache(tips);
            updateUI();
        } else {
            showError("No tips available. Please try again later.");
        }
    }).catch((error) => {
        console.error("Error loading tips:", error);
        showError("Failed to load tips. Please try again later.");
    }).finally(() => {
        hideLoading();
    });
}

function likeTip() {
    if (!canWrite()) {
        console.log("Writing to database is not allowed in this environment");
        return;
    }
    if (!currentTipId || !currentUserId) return;

    const userLikeRef = window.ref(database, `user_likes/${currentUserId}/${currentTipId}`);
    const tipRef = window.ref(database, `tips/${currentSituation}/${currentLanguage}/${currentTipId}`);

    window.get(userLikeRef).then((snapshot) => {
        if (!snapshot.exists()) {
            window.set(userLikeRef, true);
            window.runTransaction(tipRef, (tip) => {
                if (tip) {
                    tip.likes = (tip.likes || 0) + 1;
                    tip.weight = (tip.weight || 1) * 1.1;
                }
                return tip;
            });
            console.log("Tip liked!");
            showLikeConfirmation();
        } else {
            console.log("You've already liked this tip.");
        }
    });
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

function switchLanguage() {
    const newLanguage = currentLanguage === 'zh' ? 'en' : 'zh';
    if (newLanguage === currentLanguage) return;
    currentLanguage = newLanguage;
    updateUILanguage();
    if (currentSituation) {
        showTip(currentSituation);
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
        const situation = button.onclick.toString().match(/'(\w+)'/)[1];
        button.textContent = translations[currentLanguage][situation];
    });
}

function showTip(situation) {
    currentSituation = situation;
    if (!tips[situation]) return;

    const situationTips = tips[situation][currentLanguage];
    const randomIndex = Math.floor(Math.random() * situationTips.length);
    const selectedTip = situationTips[randomIndex];

    currentTipId = `${situation}_${randomIndex}`;
    const tipElement = document.getElementById('spiritual-tip');
    tipElement.textContent = selectedTip;
    document.getElementById('next-tip').style.display = 'block';
    document.getElementById('like-button').disabled = false;
    document.getElementById('like-button').textContent = translations[currentLanguage].like;
}

function showNextTip() {
    showTip(currentSituation);
}

function showLoading() {
    const loader = document.createElement('div');
    loader.id = 'loader';
    loader.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 5px solid #f3f3f3; border-top: 5px solid #3498db; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite;';
    document.body.appendChild(loader);
}

function hideLoading() {
    const loader = document.getElementById('loader');
    if (loader) loader.remove();
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.textContent = message;
    errorDiv.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background-color: #f44336; color: white; padding: 15px; border-radius: 5px; z-index: 1000;';
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

function clearTipsCache() {
    localStorage.removeItem('cachedTips');
    localStorage.removeItem('tipsCacheTimestamp');
}

// 页面加载时初始化
window.onload = function() {
    authenticateAnonymously();
};

// 将函数导出到全局作用域，以便 HTML 元素可以访问
window.switchLanguage = switchLanguage;
window.showTip = showTip;
window.showNextTip = showNextTip;
window.likeTip = likeTip;
window.clearTipsCache = clearTipsCache;