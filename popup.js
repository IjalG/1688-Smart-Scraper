const I18N = {
  zh: {
    appName: '1688 智能选品助手',
    addToCollection: '加入收藏夹',
    selectExport: '选取导出',
    viewCollection: '查看收藏夹',
    settings: '设置',
    notFoundTab: '未找到活动标签页',
    useOn1688: '请在1688页面使用',
    loading: '正在加载...',
    noProducts: '未找到商品数据',
    addedToCollection: '已添加 {count} 个商品到收藏夹',
    refreshRetry: '请刷新1688页面后重试',
    collectionEmpty: '收藏夹为空，请先添加商品',
    settingsSaved: '设置已保存',
    exportFormat: '导出格式',
    maxProducts: '抓取数量 (0 = 全部)',
    filterAds: '过滤广告商品',
    exportColumns: '导出字段',
    save: '保存',
    cancel: '取消',
    language: '语言',
    chinese: '中文',
    english: 'English',
    folder: '添加到文件夹',
    newFolder: '新建文件夹',
    defaultFolder: '默认',
    selectFolder: '选择文件夹',
    cols: { '序号': '序号', '图片': '图片', '商品标题': '商品标题', '价格': '价格', '销量': '销量', '店铺名称': '店铺名称', '商品链接': '商品链接' }
  },
  en: {
    appName: '1688 Smart Scraper',
    addToCollection: 'Add to Collection',
    selectExport: 'Select & Export',
    viewCollection: 'View Collection',
    settings: 'Settings',
    notFoundTab: 'No active tab found',
    useOn1688: 'Please use on 1688.com',
    loading: 'Loading...',
    noProducts: 'No products found',
    addedToCollection: 'Added {count} products to collection',
    refreshRetry: 'Please refresh the 1688 page and try again',
    collectionEmpty: 'Collection is empty, add products first',
    settingsSaved: 'Settings saved',
    exportFormat: 'Export Format',
    maxProducts: 'Max Products (0 = all)',
    filterAds: 'Filter Ad Products',
    exportColumns: 'Export Columns',
    save: 'Save',
    cancel: 'Cancel',
    language: 'Language',
    chinese: '中文',
    english: 'English',
    folder: 'Add to Folder',
    newFolder: 'New Folder',
    defaultFolder: 'Default',
    selectFolder: 'Select Folder',
    cols: { '序号': 'No.', '图片': 'Image', '商品标题': 'Title', '价格': 'Price', '销量': 'Sales', '店铺名称': 'Shop', '商品链接': 'Link' }
  }
};

const ALL_COLUMNS = ['序号', '图片', '商品标题', '价格', '销量', '店铺名称', '商品链接'];

const DEFAULT_SETTINGS = {
  exportFormat: 'xlsx',
  maxProducts: 0,
  filterAds: true,
  columns: { '序号': true, '图片': true, '商品标题': true, '价格': true, '销量': true, '店铺名称': true, '商品链接': true },
  language: 'zh'
};

async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get('settings');
    const loaded = result.settings || {};
    return {
      ...DEFAULT_SETTINGS,
      ...loaded,
      columns: { ...DEFAULT_SETTINGS.columns, ...(loaded.columns || {}) }
    };
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

async function updateCollectionBadge() {
  try {
    const result = await chrome.storage.local.get('productCollection');
    const collection = result.productCollection || [];
    const badge = document.getElementById('collectionBadge');
    badge.textContent = collection.length;
    badge.style.display = collection.length > 0 ? 'inline-block' : 'none';
  } catch (e) {
    const badge = document.getElementById('collectionBadge');
    badge.textContent = '0';
    badge.style.display = 'none';
  }
}

async function loadFolders() {
  try {
    const result = await chrome.storage.local.get('folders');
    return result.folders || [{ id: 'default', name: '默认' }];
  } catch {
    return [{ id: 'default', name: '默认' }];
  }
}

async function renderPopupFolders() {
  const folders = await loadFolders();
  const settings = window._cachedSettings || DEFAULT_SETTINGS;
  const lang = settings.language || 'zh';
  const select = document.getElementById('popupFolderSelect');
  select.innerHTML = '';
  folders.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    select.appendChild(opt);
  });
  document.getElementById('folderSelectWrap').style.display = 'flex';
}

document.getElementById('popupNewFolderBtn').addEventListener('click', async () => {
  const settings = window._cachedSettings || DEFAULT_SETTINGS;
  const lang = settings.language || 'zh';
  const name = prompt(lang === 'en' ? 'Enter folder name' : '请输入文件夹名称');
  if (!name || !name.trim()) return;

  const folders = await loadFolders();
  if (folders.some(f => f.name === name.trim())) {
    alert(lang === 'en' ? 'Folder already exists' : '文件夹已存在');
    return;
  }

  const id = 'folder_' + Date.now();
  folders.push({ id, name: name.trim() });
  await chrome.storage.local.set({ folders: folders });
  await renderPopupFolders();
  document.getElementById('popupFolderSelect').value = id;
});

function t(key) {
  const settings = window._cachedSettings || DEFAULT_SETTINGS;
  const lang = settings.language || 'zh';
  const dict = I18N[lang] || I18N.zh;
  return dict[key] || key;
}

function applyLanguage() {
  document.getElementById('addToCollectionBtn').textContent = t('addToCollection');
  document.getElementById('selectBtn').textContent = t('selectExport');
  document.getElementById('openCollectionBtn').childNodes[0].textContent = t('viewCollection') + ' ';
  document.getElementById('settingsBtn').textContent = t('settings');
  document.querySelector('.settings-title').textContent = t('settings');

  document.querySelector('#exportFormat').previousElementSibling.textContent = t('exportFormat');
  document.querySelector('#maxProducts').previousElementSibling.textContent = t('maxProducts');
  document.querySelector('#filterAds').parentElement.lastChild.textContent = ' ' + t('filterAds');

  document.querySelectorAll('.column-grid label')[0].lastChild.textContent = ' ' + t('cols')['序号'];
  document.querySelectorAll('.column-grid label')[1].lastChild.textContent = ' ' + t('cols')['图片'];
  document.querySelectorAll('.column-grid label')[2].lastChild.textContent = ' ' + t('cols')['商品标题'];
  document.querySelectorAll('.column-grid label')[3].lastChild.textContent = ' ' + t('cols')['价格'];
  document.querySelectorAll('.column-grid label')[4].lastChild.textContent = ' ' + t('cols')['销量'];
  document.querySelectorAll('.column-grid label')[5].lastChild.textContent = ' ' + t('cols')['店铺名称'];
  document.querySelectorAll('.column-grid label')[6].lastChild.textContent = ' ' + t('cols')['商品链接'];

  document.getElementById('saveSettingsBtn').textContent = t('save');
  document.getElementById('cancelSettingsBtn').textContent = t('cancel');

  const langSelect = document.getElementById('language');
  if (langSelect.options.length === 0) {
    const opt1 = document.createElement('option');
    opt1.value = 'zh'; opt1.textContent = t('chinese');
    const opt2 = document.createElement('option');
    opt2.value = 'en'; opt2.textContent = t('english');
    langSelect.appendChild(opt1);
    langSelect.appendChild(opt2);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await loadSettings();
  window._cachedSettings = settings;

  document.getElementById('exportFormat').value = settings.exportFormat;
  document.getElementById('maxProducts').value = settings.maxProducts;
  document.getElementById('filterAds').checked = settings.filterAds;

  ALL_COLUMNS.forEach(col => {
    const cb = document.getElementById('col_' + col);
    if (cb) cb.checked = settings.columns[col] !== false;
  });

  document.getElementById('language').value = settings.language || 'zh';

  updateCollectionBadge();
  applyLanguage();
  renderPopupFolders();

  document.getElementById('language').addEventListener('change', async (e) => {
    settings.language = e.target.value;
    await saveSettings(settings);
    window._cachedSettings = settings;
    applyLanguage();
    renderPopupFolders();
  });
});

document.getElementById('addToCollectionBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const btn = document.getElementById('addToCollectionBtn');

  btn.disabled = true;
  status.textContent = t('loading');
  status.className = 'status';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      status.textContent = t('notFoundTab');
      status.className = 'status error';
      btn.disabled = false;
      return;
    }
    if (!tab.url || !tab.url.includes('1688.com')) {
      status.textContent = t('useOn1688');
      status.className = 'status error';
      btn.disabled = false;
      return;
    }

    const settings = await loadSettings();
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getProducts',
      options: { exportFormat: settings.exportFormat, maxProducts: settings.maxProducts, filterAds: settings.filterAds }
    });

    if (response && response.success && response.products.length > 0) {
      const result = await chrome.storage.local.get(['productCollection', 'folders']);
      const collection = result.productCollection || [];
      const folders = result.folders || [{ id: 'default', name: settings.language === 'en' ? 'Default' : '默认' }];

      const existingIds = new Set();
      collection.forEach(p => { if (p._offerId) existingIds.add(p._offerId); });

      let addedCount = 0;
      const targetFolder = document.getElementById('popupFolderSelect').value || 'default';
      response.products.forEach(p => {
        const match = (p.商品链接 || '').match(/offer[=/](\d+)/);
        const offerId = match ? match[1] : null;
        if (offerId && !existingIds.has(offerId)) {
          collection.push({ ...p, _offerId: offerId, folder: targetFolder });
          existingIds.add(offerId);
          addedCount++;
        } else if (!offerId) {
          collection.push({ ...p, folder: targetFolder });
          addedCount++;
        }
      });

      await chrome.storage.local.set({ productCollection: collection, folders: folders });
      status.textContent = t('addedToCollection').replace('{count}', addedCount);
      status.className = 'status';
      updateCollectionBadge();
    } else {
      status.textContent = t('noProducts');
      status.className = 'status error';
    }
  } catch (error) {
    console.error(error);
    status.textContent = t('refreshRetry');
    status.className = 'status error';
  }

  btn.disabled = false;
});

document.getElementById('selectBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const btn = document.getElementById('selectBtn');

  btn.disabled = true;
  status.textContent = t('loading');
  status.className = 'status';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      status.textContent = t('notFoundTab');
      status.className = 'status error';
      btn.disabled = false;
      return;
    }
    if (!tab.url || !tab.url.includes('1688.com')) {
      status.textContent = t('useOn1688');
      status.className = 'status error';
      btn.disabled = false;
      return;
    }

    const selectUrl = chrome.runtime.getURL(`select.html?tabId=${tab.id}`);
    await chrome.tabs.create({ url: selectUrl });
    window.close();
  } catch (error) {
    console.error(error);
    status.textContent = t('refreshRetry');
    status.className = 'status error';
  }

  btn.disabled = false;
});

document.getElementById('openCollectionBtn').addEventListener('click', async () => {
  const result = await chrome.storage.local.get('productCollection');
  const collection = result.productCollection || [];

  if (collection.length === 0) {
    const status = document.getElementById('status');
    status.textContent = t('collectionEmpty');
    status.className = 'status';
    return;
  }

  const settings = await loadSettings();
  const collectionUrl = chrome.runtime.getURL(`select.html?mode=collection&lang=${settings.language || 'zh'}`);
  await chrome.tabs.create({ url: collectionUrl });
  window.close();
});

document.getElementById('settingsBtn').addEventListener('click', showSettingsView);

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const columns = {};
  ALL_COLUMNS.forEach(col => {
    const cb = document.getElementById('col_' + col);
    columns[col] = cb ? cb.checked : true;
  });

  const settings = {
    exportFormat: document.getElementById('exportFormat').value,
    maxProducts: parseInt(document.getElementById('maxProducts').value) || 0,
    filterAds: document.getElementById('filterAds').checked,
    columns: columns,
    language: document.getElementById('language').value || 'zh'
  };

  await saveSettings(settings);
  window._cachedSettings = settings;
  showMainView();
  applyLanguage();

  const status = document.getElementById('status');
  status.textContent = t('settingsSaved');
  status.className = 'status';
  setTimeout(() => { status.textContent = ''; }, 2000);
});

document.getElementById('cancelSettingsBtn').addEventListener('click', async () => {
  const settings = await loadSettings();
  document.getElementById('exportFormat').value = settings.exportFormat;
  document.getElementById('maxProducts').value = settings.maxProducts;
  document.getElementById('filterAds').checked = settings.filterAds;
  document.getElementById('language').value = settings.language || 'zh';

  ALL_COLUMNS.forEach(col => {
    const cb = document.getElementById('col_' + col);
    if (cb) cb.checked = settings.columns[col] !== false;
  });

  showMainView();
});
