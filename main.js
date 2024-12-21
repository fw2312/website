// 初始化 Firebase
const app = window.initializeApp(window.firebaseConfig);
const auth = window.getAuth(app);
const database = window.getDatabase(app);

let currentLanguage = 'zh';
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
        nextTip: "换一个贴士",
        customTitle: "添加自定义情境",
        customPlaceholder: "输入自定义情境",
        addCustom: "添加",
        switchLang: "English"
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
        customTitle: "Add Custom Situation",
        customPlaceholder: "Enter custom situation",
        addCustom: "Add",
        switchLang: "中文"
    }
};

const tips = {
    morning: {
        zh: [
            "深呼吸三次，感受新的一天的活力。",
            "用微笑开始这一天，对自己说声'早安'。",
            "站起来伸个懒腰，感受身体的每个部分都在苏醒。",
            "想象阳光温暖地照在你的脸上，唤醒你的感官。",
            "列出今天三件你期待的事情。",
            "用感恩的心态开始新的一天，想一个你感激的人或事。",
            "轻轻按摩你的太阳穴，帮助你清醒头脑。"
        ],
        en: [
            "Take three deep breaths, feel the energy of the new day.",
            "Start the day with a smile, say 'Good morning' to yourself.",
            "Stand up and stretch, feel every part of your body awakening.",
            "Imagine warm sunlight on your face, awakening your senses.",
            "List three things you're looking forward to today.",
            "Start the day with gratitude, think of someone or something you're thankful for.",
            "Gently massage your temples to help clear your mind."
        ]
    },
    // 添加其他情境的提示...
};

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
            if (canRead()) {
                loadTips();
            } else {
                console.log("Reading from database is not allowed in this environment");
            }
        })
        .catch((error) => {
            console.error("Authentication error:", error);
        });
}

function loadTips() {
    if (!canRead()) {
        console.log("Reading from database is not allowed in this environment");
        return;
    }
    const tipsRef = window.ref(database, 'tips');
    window.get(tipsRef).then((snapshot) => {
        const dbTips = snapshot.val();
        if (dbTips) {
            Object.assign(tips, dbTips);
        }
        updateUI();
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
        } else {
            console.log("You've already liked this tip.");
        }
    });
}

function switchLanguage() {
    currentLanguage = currentLanguage === 'zh' ? 'en' : 'zh';
    updateUI();
}

function updateUI() {
    document.getElementById('main-title').textContent = translations[currentLanguage].title;
    document.getElementById('intro-text').textContent = translations[currentLanguage].intro;
    document.getElementById('next-tip').textContent = translations[currentLanguage].nextTip;
    document.getElementById('custom-title').textContent = translations[currentLanguage].customTitle;
    document.getElementById('custom-situation-input').placeholder = translations[currentLanguage].customPlaceholder;
    document.getElementById('add-custom-btn').textContent = translations[currentLanguage].addCustom;
    document.querySelector('#language-switch button').textContent = translations[currentLanguage].switchLang;

    const buttons = document.querySelectorAll('#situation-buttons button');
    buttons.forEach(button => {
        const situation = button.onclick.toString().match(/'(\w+)'/)[1];
        button.textContent = translations[currentLanguage][situation];
    });

    if (currentSituation) {
        showTip(currentSituation);
    }
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
}

function showNextTip() {
    showTip(currentSituation);
}

function addCustomSituation() {
    if (!canWrite()) {
        console.log("Writing to database is not allowed in this environment");
        return;
    }
    const customSituationInput = document.getElementById('custom-situation-input');
    const customSituation = customSituationInput.value.trim();
    if (customSituation && !tips[customSituation]) {
        tips[customSituation] = {
            zh: [
                "这是您的自定义情境。深呼吸，感受当下。",
                "在这个情境中，尝试找到一件让您感恩的事物。",
                "闭上眼睛，想象您正处于最理想的状态。",
                "用一个词形容您此刻的感受，然后深呼吸。",
                "想象您正在向一位朋友描述这个情境，会说些什么？",
                "在这个时刻，轻轻地对自己说：'我很好'。",
                "观察周围，寻找一个能带给您平静的物体或景象。"
            ],
            en: [
                "This is your custom situation. Take a deep breath and feel the present moment.",
                "In this situation, try to find one thing you're grateful for.",
                "Close your eyes and imagine yourself in an ideal state.",
                "Describe your current feeling with one word, then take a deep breath.",
                "Imagine you're describing this situation to a friend. What would you say?",
                "At this moment, gently tell yourself: 'I am okay'.",
                "Observe your surroundings, find an object or scene that brings you peace."
            ]
        };
        const button = document.createElement('button');
        button.textContent = customSituation;
        button.onclick = () => showTip(customSituation);
        document.getElementById('situation-buttons').appendChild(button);
        customSituationInput.value = '';

        // 将新的自定义情境保存到数据库
        window.set(window.ref(database, `tips/${customSituation}`), tips[customSituation]);
    }
}

// 页面加载时初始化
window.onload = function() {
    authenticateAnonymously();
};

// 将函数导出到全局作用域，以便 HTML 元素可以访问
window.switchLanguage = switchLanguage;
window.showTip = showTip;
window.showNextTip = showNextTip;
window.addCustomSituation = addCustomSituation;
window.likeTip = likeTip;