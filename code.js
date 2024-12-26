import { DatabaseManager } from './DatabaseManager.js';

export const translations = {
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
    intro: "Choose your current situation for suitable soul tips. Each exercise takes only 30 seconds to find peace in your busy day.",
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

const StateManager = {
  state: {
    currentLanguage: 'zh',
    currentSituation: '',
    currentTipId: null,
    isAudioPlaying: false,
    currentAudioType: 'meditation',
    tips: {}
  },

  listeners: new Set(),

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  },

  getState() {
    return { ...this.state };
  },

  notifyListeners() {
    if (this.listeners.size > 0) {
      this.listeners.forEach(listener => listener(this.state));
    }
  }
};

const audioFiles = {
    meditation: new Audio('/static/sounds/meditation.mp3'),
    beach: new Audio('/static/sounds/beach.mp3'),
    forest: new Audio('/static/sounds/forest.mp3')
};

Object.values(audioFiles).forEach(audio => {
    audio.loop = true;
    audio.onerror = () => {
      ErrorTracker.showErrorToUser("音频文件加载失败");
    };
});

const AudioManager = {
  async play(type) {
    if (StateManager.state.isAudioPlaying) {
      audioFiles[StateManager.state.currentAudioType].pause();
    }

    try {
      await audioFiles[type].play();
      StateManager.setState({ 
        isAudioPlaying: true, 
        currentAudioType: type 
      });
      UIManager.updateAudioButton();
    } catch (error) {
      console.error('音频播放失败:', error);
      ErrorTracker.showErrorToUser("播放音频失败，请检查浏览器设置");
    }
  },

  stop() {
    const { currentAudioType } = StateManager.state;
    audioFiles[currentAudioType].pause();
    StateManager.setState({ isAudioPlaying: false });
    UIManager.updateAudioButton();
  },

  toggle() {
    const { isAudioPlaying, currentAudioType } = StateManager.state;
    if (isAudioPlaying) {
      this.stop();
    } else {
      this.play(currentAudioType);
    }
  }
};

const UIManager = {
  updateUILanguage() {
    const { currentLanguage } = StateManager.getState();
    
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

    this.updateAudioButton();
  },

  updateAudioButton() {
    const { isAudioPlaying, currentLanguage } = StateManager.getState();
    const audioButton = document.getElementById('audio-toggle');
    const audioText = audioButton.querySelector('.button-text');
    const audioIcon = audioButton.querySelector('.button-icon');
    
    audioText.textContent = translations[currentLanguage][isAudioPlaying ? 'stopMusic' : 'playMusic'];
    audioIcon.textContent = isAudioPlaying ? '🔈' : '🔊';
  },

  async showTip(situation) {
    const { currentLanguage, tips } = StateManager.getState();
    
    if (!tips[situation]?.[currentLanguage]) {
      ErrorTracker.showErrorToUser("找不到相关提示");
      return;
    }

    const situationTips = tips[situation][currentLanguage];
    const randomIndex = Math.floor(Math.random() * situationTips.length);
    const selectedTip = situationTips[randomIndex];
    
    StateManager.setState({ 
      currentTipId: selectedTip.id, 
      currentSituation: situation 
    });
    
    document.getElementById('spiritual-tip').textContent = selectedTip.content;
    document.getElementById('next-tip').style.display = 'block';
    
    const likeButton = document.getElementById('like-button');
    likeButton.disabled = false;
    likeButton.textContent = translations[currentLanguage].like;
  }
};

const ErrorTracker = {
  showErrorToUser(message) {
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
};

async function initializeApp(env) {
  try {
    const dbManager = new DatabaseManager(env.DB);
    
    if (!await dbManager.testConnection()) {
      throw new Error('数据库连接失败');
    }

    const tips = await dbManager.loadTips();
    StateManager.setState({ tips });
    
    UIManager.updateUILanguage();
    setupEventListeners();
    
    console.log('应用初始化成功');
    window.dbManager = dbManager;
  } catch (error) {
    console.error('初始化失败:', error);
    ErrorTracker.showErrorToUser("初始化失败，请刷新重试");
  }
}

function setupEventListeners() {
  document.getElementById('audio-toggle').addEventListener('click', () => AudioManager.toggle());
  
  document.getElementById('language-switch').addEventListener('click', () => {
    const currentLang = StateManager.getState().currentLanguage;
    StateManager.setState({ currentLanguage: currentLang === 'zh' ? 'en' : 'zh' });
    UIManager.updateUILanguage();
  });

  document.querySelectorAll('#situation-buttons button').forEach(button => {
    button.addEventListener('click', (e) => {
      UIManager.showTip(e.target.dataset.situation);
    });
  });

  document.getElementById('next-tip').addEventListener('click', () => {
    const { currentSituation } = StateManager.getState();
    UIManager.showTip(currentSituation);
  });

  document.getElementById('like-button').addEventListener('click', async () => {
    const { currentTipId } = StateManager.getState();
    if (currentTipId && window.dbManager) {
      const likeButton = document.getElementById('like-button');
      likeButton.disabled = true;
      await window.dbManager.updateLikeCount(currentTipId);
      const likeCount = await window.dbManager.getLikeCount(currentTipId);
      likeButton.textContent = `${translations[StateManager.state.currentLanguage].liked} (${likeCount})`;
      setTimeout(() => {
        likeButton.disabled = false;
        likeButton.textContent = translations[StateManager.state.currentLanguage].like;
      }, 2000);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof window === 'undefined') {
    console.error('运行环境错误');
    return;
  }

  const env = { 
    DB: window?.env?.DB || globalThis?.DB || window?.DB
  };

  if (!env.DB) {
    console.error('数据库环境未正确配置');
    ErrorTracker.showErrorToUser("数据库配置错误，请检查环境设置");
    return;
  }

  await initializeApp(env);
});

export { StateManager, AudioManager, UIManager, ErrorTracker };
