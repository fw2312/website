import { DatabaseManager } from './DatabaseManager.js';

const StateManager = {
  state: {
    currentSituation: '',
    currentTipId: null,
    tips: {}
  },
  setState(newState) {
    this.state = { ...this.state, ...newState };
  },
  getState() {
    return { ...this.state };
  }
};

const UIManager = {
  async showTip(situation) {
    const { tips } = StateManager.getState();
    if (!tips[situation]) {
      ErrorTracker.showErrorToUser("找不到相关提示");
      return;
    }
    const situationTips = tips[situation];
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
    likeButton.textContent = '喜欢';
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
    setupEventListeners();
    console.log('应用初始化成功');
    window.dbManager = dbManager;
  } catch (error) {
    console.error('初始化失败:', error);
    ErrorTracker.showErrorToUser("初始化失败，请刷新重试");
  }
}

function setupEventListeners() {
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
      likeButton.textContent = `已喜欢 (${likeCount})`;
      setTimeout(() => {
        likeButton.disabled = false;
        likeButton.textContent = '喜欢';
      }, 2000);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
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

export { StateManager, UIManager, ErrorTracker };