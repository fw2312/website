console.log('C1: Importing DatabaseManager');
import { DatabaseManager } from './DatabaseManager.js';

console.log('C2: Defining StateManager');
const StateManager = {
  state: {
    currentSituation: '',
    currentTipId: null,
    tips: {}
  },
  setState(newState) {
    console.log('C3: Setting state', newState);
    this.state = { ...this.state, ...newState };
  },
  getState() {
    console.log('C4: Getting state');
    return { ...this.state };
  }
};

console.log('C5: Defining UIManager');
const UIManager = {
  async showTip(situation) {
    console.log('C6: Showing tip for situation', situation);
    const { tips } = StateManager.getState();
    if (!tips[situation]) {
      console.log('C7: No tips found for situation', situation);
      ErrorTracker.showErrorToUser("找不到相关提示");
      return;
    }
    const situationTips = tips[situation];
    const randomIndex = Math.floor(Math.random() * situationTips.length);
    const selectedTip = situationTips[randomIndex];
    console.log('C8: Selected tip', selectedTip);
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

console.log('C9: Defining ErrorTracker');
const ErrorTracker = {
  showErrorToUser(message) {
    console.log('C10: Showing error to user', message);
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
    setTimeout(() => {
      console.log('C11: Removing error message');
      errorDiv.remove();
    }, 5000);
  }
};

console.log('C12: Defining initializeApp');
async function initializeApp(env) {
  try {
    console.log('C13: Creating DatabaseManager');
    const dbManager = new DatabaseManager(env.DB);
    console.log('C14: Testing database connection');
    if (!await dbManager.testConnection()) {
      throw new Error('数据库连接失败');
    }
    console.log('C15: Loading tips');
    const tips = await dbManager.loadTips();
    console.log('C16: Setting tips in state');
    StateManager.setState({ tips });
    console.log('C17: Setting up event listeners');
    setupEventListeners();
    console.log('C18: App initialized successfully');
    window.dbManager = dbManager;
  } catch (error) {
    console.error('C19: Initialization failed:', error);
    ErrorTracker.showErrorToUser("初始化失败，请刷新重试");
  }
}

console.log('C20: Defining setupEventListeners');
function setupEventListeners() {
  console.log('C21: Setting up situation button listeners');
  document.querySelectorAll('#situation-buttons button').forEach(button => {
    button.addEventListener('click', (e) => {
      console.log('C22: Situation button clicked', e.target.dataset.situation);
      UIManager.showTip(e.target.dataset.situation);
    });
  });

  console.log('C23: Setting up next tip button listener');
  document.getElementById('next-tip').addEventListener('click', () => {
    console.log('C24: Next tip button clicked');
    const { currentSituation } = StateManager.getState();
    UIManager.showTip(currentSituation);
  });

  console.log('C25: Setting up like button listener');
  document.getElementById('like-button').addEventListener('click', async () => {
    console.log('C26: Like button clicked');
    const { currentTipId } = StateManager.getState();
    if (currentTipId && window.dbManager) {
      const likeButton = document.getElementById('like-button');
      likeButton.disabled = true;
      console.log('C27: Updating like count');
      await window.dbManager.updateLikeCount(currentTipId);
      console.log('C28: Getting updated like count');
      const likeCount = await window.dbManager.getLikeCount(currentTipId);
      likeButton.textContent = `已喜欢 (${likeCount})`;
      setTimeout(() => {
        console.log('C29: Resetting like button');
        likeButton.disabled = false;
        likeButton.textContent = '喜欢';
      }, 2000);
    }
  });
}

console.log('C30: Setting up DOMContentLoaded listener');
document.addEventListener('DOMContentLoaded', async () => {
  console.log('C31: DOM content loaded, initializing app');
  const env = { 
    DB: window?.env?.DB || globalThis?.DB || window?.DB
  };
  if (!env.DB) {
    console.error('C32: Database environment not configured');
    ErrorTracker.showErrorToUser("数据库配置错误，请检查环境设置");
    return;
  }
  await initializeApp(env);
});

console.log('C33: Exporting managers');
export { StateManager, UIManager, ErrorTracker };