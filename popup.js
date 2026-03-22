const DEFAULT_SETTINGS = {
  exportFormat: 'xlsx',
  maxProducts: 0,
  filterAds: true
};

async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get('settings');
    return { ...DEFAULT_SETTINGS, ...result.settings };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(settings) {
  await chrome.storage.sync.set({ settings });
}

function showMainView() {
  document.getElementById('mainView').classList.add('active');
  document.getElementById('settingsView').classList.remove('active');
}

function showSettingsView() {
  document.getElementById('mainView').classList.remove('active');
  document.getElementById('settingsView').classList.add('active');
}

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await loadSettings();

  document.getElementById('exportFormat').value = settings.exportFormat;
  document.getElementById('maxProducts').value = settings.maxProducts;
  document.getElementById('filterAds').checked = settings.filterAds;
});

document.getElementById('fetchBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const btn = document.getElementById('fetchBtn');

  btn.disabled = true;
  status.textContent = '正在抓取...';
  status.className = 'status';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      status.textContent = '未找到活动标签页';
      status.className = 'status error';
      btn.disabled = false;
      return;
    }

    if (!tab.url || !tab.url.includes('1688.com')) {
      status.textContent = '请在1688页面使用';
      status.className = 'status error';
      btn.disabled = false;
      return;
    }

    const settings = await loadSettings();

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

document.getElementById('selectBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const btn = document.getElementById('selectBtn');

  btn.disabled = true;
  status.textContent = '正在打开...';
  status.className = 'status';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      status.textContent = '未找到活动标签页';
      status.className = 'status error';
      btn.disabled = false;
      return;
    }

    if (!tab.url || !tab.url.includes('1688.com')) {
      status.textContent = '请在1688页面使用';
      status.className = 'status error';
      btn.disabled = false;
      return;
    }

    const selectUrl = chrome.runtime.getURL(`select.html?tabId=${tab.id}`);
    await chrome.tabs.create({ url: selectUrl });
    window.close();

  } catch (error) {
    console.error(error);
    status.textContent = '请刷新1688页面后重试';
    status.className = 'status error';
  }

  btn.disabled = false;
});

document.getElementById('settingsBtn').addEventListener('click', showSettingsView);

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

document.getElementById('cancelSettingsBtn').addEventListener('click', async () => {
  const settings = await loadSettings();
  document.getElementById('exportFormat').value = settings.exportFormat;
  document.getElementById('maxProducts').value = settings.maxProducts;
  document.getElementById('filterAds').checked = settings.filterAds;

  showMainView();
});
