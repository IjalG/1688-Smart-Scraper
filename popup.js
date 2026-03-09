// 默认设置
const DEFAULT_SETTINGS = {
  exportFormat: 'xlsx',
  maxProducts: 0,  // 0 = 全部
  filterAds: true
};

// 加载设置
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get('settings');
    return { ...DEFAULT_SETTINGS, ...result.settings };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

// 保存设置
async function saveSettings(settings) {
  await chrome.storage.sync.set({ settings });
}

// 显示主视图
function showMainView() {
  document.getElementById('mainView').classList.add('active');
  document.getElementById('settingsView').classList.remove('active');
}

// 显示设置视图
function showSettingsView() {
  document.getElementById('mainView').classList.remove('active');
  document.getElementById('settingsView').classList.add('active');
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await loadSettings();
  
  // 设置表单值
  document.getElementById('exportFormat').value = settings.exportFormat;
  document.getElementById('maxProducts').value = settings.maxProducts;
  document.getElementById('filterAds').checked = settings.filterAds;
});

// 开始抓取按钮
document.getElementById('fetchBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const btn = document.getElementById('fetchBtn');
  
  btn.disabled = true;
  status.textContent = '正在抓取...';
  status.className = 'status';

  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      status.textContent = '未找到活动标签页';
      status.className = 'status error';
      btn.disabled = false;
      return;
    }

    // 检查是否是1688页面
    if (!tab.url || !tab.url.includes('1688.com')) {
      status.textContent = '请在1688页面使用';
      status.className = 'status error';
      btn.disabled = false;
      return;
    }

    // 加载设置
    const settings = await loadSettings();

    // 发送消息给 content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'extractProducts',
      options: {
        exportFormat: settings.exportFormat,
        maxProducts: settings.maxProducts,
        filterAds: settings.filterAds
      }
    });

    if (response && response.success) {
      status.textContent = `成功抓取 ${response.count} 个商品`;
      window.close();
    } else {
      status.textContent = response?.message || '抓取失败';
      status.className = 'status error';
    }

  } catch (error) {
    console.error(error);
    status.textContent = '请刷新1688页面后重试';
    status.className = 'status error';
  }

  btn.disabled = false;
});

// 设置按钮
document.getElementById('settingsBtn').addEventListener('click', showSettingsView);

// 保存设置按钮
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const settings = {
    exportFormat: document.getElementById('exportFormat').value,
    maxProducts: parseInt(document.getElementById('maxProducts').value) || 0,
    filterAds: document.getElementById('filterAds').checked
  };
  
  await saveSettings(settings);
  showMainView();
  
  const status = document.getElementById('status');
  status.textContent = '设置已保存';
  status.className = 'status';
  setTimeout(() => { status.textContent = ''; }, 2000);
});

// 取消设置按钮
document.getElementById('cancelSettingsBtn').addEventListener('click', async () => {
  // 恢复原来的设置值
  const settings = await loadSettings();
  document.getElementById('exportFormat').value = settings.exportFormat;
  document.getElementById('maxProducts').value = settings.maxProducts;
  document.getElementById('filterAds').checked = settings.filterAds;
  
  showMainView();
});