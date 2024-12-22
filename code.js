// 常量
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

let currentLanguage = 'zh';
let currentSituation = '';
let currentTipId = null;

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

async function loadTips(env) {
    toggleLoading(true);
    const cachedTips = loadTipsFromCache();
    if (cachedTips) {
        console.log("Loading tips from cache");
        tips = cachedTips;
        updateUI();
        toggleLoading(false);
        return;
    }

    try {
        const { results } = await env.DB.prepare("SELECT * FROM Tips").all();
        tips = {};
        results.forEach(row => {
            if (!tips[row.situation]) {
                tips[row.situation] = {};
            }
            if (!tips[row.situation][row.language]) {
                tips[row.situation][row.language] = [];
            }
            tips[row.situation][row.language].push(row.content);
        });
        
        saveTipsToCache(tips);
        updateUI();
    } catch (error) {
        console.error("Error loading tips:", error);
        showError("Failed to load tips. Please try again later.");
    } finally {
        toggleLoading(false);
    }
}

async function likeTip(env) {
    if (!currentTipId) return;
    const situation = event.target.dataset.situation;
    const tipIndex = parseInt(currentTipId.split('_')[1]);
    const id = `${situation}_${tipIndex}`;

    try {
        const stmt = env.DB.prepare("UPDATE Tips SET likes = likes + 1 WHERE id = ?");
        await stmt.bind(id).run();

        // 更新前端数据以保持一致性
        tips[currentSituation][currentLanguage][tipIndex].likes++;

        console.log("Tip liked!");
        showLikeConfirmation();
    } catch (error) {
        console.error("Error liking tip:", error);
        showError("Failed to like tip. Please try again later.");
        // 回滚 likes 属性以保持数据一致性 (可选)
        tips[currentSituation][currentLanguage][tipIndex].likes--;
    }
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
    currentLanguage = currentLanguage === 'zh' ? 'en' : 'zh';
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
        const situation = button.dataset.situation;
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
    const likeButton = document.getElementById('like-button');
    likeButton.disabled = false;
    likeButton.textContent = translations[currentLanguage].like;
    likeButton.dataset.situation = situation;
}

function showNextTip() {
    showTip(currentSituation);
}

function toggleLoading(show) {
    const loader = document.getElementById('loader');
    if (show) {
        if (loader) return; // 防止重复创建
        const newLoader = document.createElement('div');
        newLoader.id = 'loader';
        newLoader.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 5px solid #f3f3f3; border-top: 5px solid #3498db; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite;';
        document.body.appendChild(newLoader);
    } else {
        if (loader) loader.remove();
    }
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
addEventListener("fetch", (event) => {
    event.respondWith(handleEvent(event));
});

async function handleEvent(event) {
    const { request } = event;
    const url = new URL(request.url);
    const cache = caches.default;
    let response;

    if (url.pathname === '/') {
      response = await cache.match(request);

      if (!response) {
          response = await fetch(request);
          event.waitUntil(cache.put(request, response.clone()));
      }

      const text = await response.text();
      const newBody = text.replace(/<\/body>/, `
          <script>
              document.addEventListener('DOMContentLoaded', async () => {
                const env = {
                  DB: {
                    prepare: (sql) => ({
                      bind: (...params) => ({
                        all: async () => {
                          if (sql.includes('SELECT * FROM Tips')) {
                            return { results: [
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
                              { id: 'morning_0', situation: 'morning', language: 'en', content: 'Take a deep breath, feel the morning air.', likes: 0 },
                              { id: 'morning_1', situation: 'morning', language: 'en', content: 'Take a moment to be grateful for what you have.', likes: 0 },
                              { id: 'work_0', situation: 'work', language: 'en', content: 'Close your eyes, focus on your breath for 30 seconds.', likes: 0 },
                              { id: 'work_1', situation: 'work', language: 'en', content: 'Stand up and do some simple stretches.', likes: 0 },
                              { id: 'break_0', situation: 'break', language: 'en', content: 'Find a quiet place and close your eyes to rest.', likes: 0 },
                              { id: 'break_1', situation: 'break', language: 'en', content: 'Listen to a song you like, relax your mind.', likes: 0 },
                              { id: 'evening_0', situation: 'evening', language: 'en', content: 'Write down three things that made you happy today.', likes: 0 },
                              { id: 'evening_1', situation: 'evening', language: 'en', content: 'Chat with family or friends, share your feelings.', likes: 0 },
                              { id: 'sleep_0', situation: 'sleep', language: 'en', content: 'Take a few deep breaths, relax your body.', likes: 0 },
                              { id: 'sleep_1', situation: 'sleep', language: 'en', content: 'Imagine a peaceful scene to help you fall asleep.', likes: 0 },
                            ]};
                          } else if (sql.includes('UPDATE Tips SET likes = likes + 1 WHERE id = ?')) {
                            return;
                          }
                        },
                      }),
                    }),
                  },
                };
                await loadTips(env);
                  document.querySelectorAll('#situation-buttons button').forEach(button => {
                    button.addEventListener('click', () => showTip(button.dataset.situation));
                  });
                  document.getElementById('next-tip').addEventListener('click', showNextTip);
                  document.getElementById('like-button').addEventListener('click', () => likeTip(env));
              });
          </script>
      </body>`);
      response = new Response(newBody, response);
      return response;
    }
    
    response = await fetch(request);
    return response;
}