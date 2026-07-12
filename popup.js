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
    addedWithSkipped: '已添加 {added} 个，跳过重复 {skipped} 个',
    allDuplicates: '没有新商品，{skipped} 个均为重复',
    qualityWarning: '已提取商品，但部分字段可能不完整',
    refreshRetry: '请刷新1688页面后重试',
    collectionEmpty: '收藏夹为空，请先添加商品',
    settingsSaved: '设置已保存',
    exportFormat: '导出格式',
    maxProducts: '抓取数量 (0 = 全部)',
    filterAds: '过滤广告商品',
    imageSize: 'Excel 图片尺寸',
    imageSizeSmall: '小 (80px)',
    imageSizeMedium: '中 (120px)',
    imageSizeLarge: '大 (160px)',
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
    aiHint: '无法正常提取信息？试试 AI 分析模式吧',
    aiRepair: '开始 AI 修复',
    aiRepairing: '正在 AI 分析修复...',
    aiRepairOk: '修复完成，已重新提取并保存规则',
    aiRepairFail: '未能自动修复，请稍后重试或检查 API 配置',
    aiNeedKey: '请先在设置中填写 AI API Key',
    clearAiRules: '清除 AI 规则 / 回退内置',
    aiRulesCleared: '已清除 AI 规则并回退内置规则',
    backupCollection: '备份收藏夹',
    restoreCollection: '恢复收藏夹',
    backupDone: '已导出收藏备份',
    restoreDone: '已恢复收藏：{count} 个商品',
    restoreInvalid: '备份文件无效',
    restoreConfirm: '恢复将覆盖当前收藏夹与文件夹，是否继续？',
    collectionTools: '收藏工具',
    aiApiKey: 'AI API Key（可选，仅手动修复时使用）',
    aiBaseUrl: 'AI Base URL',
    aiModel: 'AI Model',
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
    addedWithSkipped: 'Added {added}, skipped {skipped} duplicates',
    allDuplicates: 'No new products, {skipped} already in collection',
    qualityWarning: 'Products extracted, but some fields may be incomplete',
    refreshRetry: 'Please refresh the 1688 page and try again',
    collectionEmpty: 'Collection is empty, add products first',
    settingsSaved: 'Settings saved',
    exportFormat: 'Export Format',
    maxProducts: 'Max Products (0 = all)',
    filterAds: 'Filter Ad Products',
    imageSize: 'Excel Image Size',
    imageSizeSmall: 'Small (80px)',
    imageSizeMedium: 'Medium (120px)',
    imageSizeLarge: 'Large (160px)',
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
    aiHint: 'Cannot extract products? Try AI analysis mode',
    aiRepair: 'Start AI Repair',
    aiRepairing: 'Running AI repair...',
    aiRepairOk: 'Repair complete. Rules saved and re-extracted',
    aiRepairFail: 'Auto repair failed. Retry later or check API settings',
    aiNeedKey: 'Please set AI API Key in settings first',
    clearAiRules: 'Clear AI rules / rollback builtin',
    aiRulesCleared: 'AI rules cleared, back to builtin',
    backupCollection: 'Backup Collection',
    restoreCollection: 'Restore Collection',
    backupDone: 'Collection backup exported',
    restoreDone: 'Restored {count} products',
    restoreInvalid: 'Invalid backup file',
    restoreConfirm: 'Restore will overwrite current collection and folders. Continue?',
    collectionTools: 'Collection Tools',
    aiApiKey: 'AI API Key (optional, manual repair only)',
    aiBaseUrl: 'AI Base URL',
    aiModel: 'AI Model',
    cols: { '序号': 'No.', '图片': 'Image', '商品标题': 'Title', '价格': 'Price', '销量': 'Sales', '店铺名称': 'Shop', '商品链接': 'Link' }
  }
};

const ALL_COLUMNS = ['序号', '图片', '商品标题', '价格', '销量', '店铺名称', '商品链接'];

const DEFAULT_SETTINGS = {
  exportFormat: 'xlsx',
  maxProducts: 0,
  filterAds: true,
  imageSize: 120,
  columns: { '序号': true, '图片': true, '商品标题': true, '价格': true, '销量': true, '店铺名称': true, '商品链接': true },
  language: 'zh',
  aiApiKey: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiModel: 'gpt-4o-mini'
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

function showAiHint(show, text) {
  const hint = document.getElementById('aiHint');
  if (!hint) return;
  if (show) {
    hint.style.display = 'block';
    hint.textContent = text || t('aiHint');
  } else {
    hint.style.display = 'none';
    hint.textContent = '';
  }
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
  document.getElementById('folderSelectWrap').style.display = 'block';
}

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

  const imageSizeLabel = document.querySelector('#imageSize')?.previousElementSibling;
  if (imageSizeLabel) imageSizeLabel.textContent = t('imageSize');
  const imageSizeSelect = document.getElementById('imageSize');
  if (imageSizeSelect && imageSizeSelect.options.length >= 3) {
    imageSizeSelect.options[0].textContent = t('imageSizeSmall');
    imageSizeSelect.options[1].textContent = t('imageSizeMedium');
    imageSizeSelect.options[2].textContent = t('imageSizeLarge');
  }

  document.querySelectorAll('.column-grid label')[0].lastChild.textContent = ' ' + t('cols')['序号'];
  document.querySelectorAll('.column-grid label')[1].lastChild.textContent = ' ' + t('cols')['图片'];
  document.querySelectorAll('.column-grid label')[2].lastChild.textContent = ' ' + t('cols')['商品标题'];
  document.querySelectorAll('.column-grid label')[3].lastChild.textContent = ' ' + t('cols')['价格'];
  document.querySelectorAll('.column-grid label')[4].lastChild.textContent = ' ' + t('cols')['销量'];
  document.querySelectorAll('.column-grid label')[5].lastChild.textContent = ' ' + t('cols')['店铺名称'];
  document.querySelectorAll('.column-grid label')[6].lastChild.textContent = ' ' + t('cols')['商品链接'];

  document.getElementById('saveSettingsBtn').textContent = t('save');
  document.getElementById('cancelSettingsBtn').textContent = t('cancel');

  const aiRepairBtn = document.getElementById('aiRepairBtn');
  if (aiRepairBtn) aiRepairBtn.textContent = t('aiRepair');
  const clearAiRulesBtn = document.getElementById('clearAiRulesBtn');
  if (clearAiRulesBtn) clearAiRulesBtn.textContent = t('clearAiRules');
  const backupBtn = document.getElementById('backupCollectionBtn');
  if (backupBtn) backupBtn.textContent = t('backupCollection');
  const restoreBtn = document.getElementById('restoreCollectionBtn');
  if (restoreBtn) restoreBtn.textContent = t('restoreCollection');
  const collectionToolsTitle = document.getElementById('collectionToolsTitle');
  if (collectionToolsTitle) collectionToolsTitle.textContent = t('collectionTools');
  const aiApiKeyLabel = document.querySelector('#aiApiKey')?.previousElementSibling;
  if (aiApiKeyLabel) aiApiKeyLabel.textContent = t('aiApiKey');
  const aiBaseUrlLabel = document.querySelector('#aiBaseUrl')?.previousElementSibling;
  if (aiBaseUrlLabel) aiBaseUrlLabel.textContent = t('aiBaseUrl');
  const aiModelLabel = document.querySelector('#aiModel')?.previousElementSibling;
  if (aiModelLabel) aiModelLabel.textContent = t('aiModel');

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
  const imageSizeEl = document.getElementById('imageSize');
  if (imageSizeEl) imageSizeEl.value = String(settings.imageSize || 120);

  ALL_COLUMNS.forEach(col => {
    const cb = document.getElementById('col_' + col);
    if (cb) cb.checked = settings.columns[col] !== false;
  });

  document.getElementById('language').value = settings.language || 'zh';
  const aiApiKeyEl = document.getElementById('aiApiKey');
  const aiBaseUrlEl = document.getElementById('aiBaseUrl');
  const aiModelEl = document.getElementById('aiModel');
  if (aiApiKeyEl) aiApiKeyEl.value = settings.aiApiKey || '';
  if (aiBaseUrlEl) aiBaseUrlEl.value = settings.aiBaseUrl || DEFAULT_SETTINGS.aiBaseUrl;
  if (aiModelEl) aiModelEl.value = settings.aiModel || DEFAULT_SETTINGS.aiModel;

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

    if (response && response.success && response.products && response.products.length > 0) {
      const result = await chrome.storage.local.get(['productCollection', 'folders']);
      const collection = result.productCollection || [];
      const folders = result.folders || [{ id: 'default', name: settings.language === 'en' ? 'Default' : '默认' }];

      const existingIds = new Set();
      collection.forEach(p => {
        if (p._offerId) existingIds.add(String(p._offerId));
      });

      let addedCount = 0;
      let skippedCount = 0;
      const targetFolder = document.getElementById('popupFolderSelect').value || 'default';
      response.products.forEach(p => {
        const match = (p.商品链接 || '').match(/offer[=/](\d+)/);
        const offerId = p._offerId || (match ? match[1] : null);
        if (offerId && existingIds.has(String(offerId))) {
          skippedCount++;
          return;
        }
        if (offerId) {
          collection.push({
            ...p,
            _offerId: String(offerId),
            folder: targetFolder,
            status: p.status || 'pending',
            notes: p.notes || '',
            tags: Array.isArray(p.tags) ? p.tags : []
          });
          existingIds.add(String(offerId));
          addedCount++;
        } else {
          collection.push({
            ...p,
            folder: targetFolder,
            status: p.status || 'pending',
            notes: p.notes || '',
            tags: Array.isArray(p.tags) ? p.tags : []
          });
          addedCount++;
        }
      });

      await chrome.storage.local.set({ productCollection: collection, folders: folders });
      if (addedCount === 0 && skippedCount > 0) {
        status.textContent = t('allDuplicates').replace('{skipped}', skippedCount);
      } else if (skippedCount > 0) {
        status.textContent = t('addedWithSkipped')
          .replace('{added}', addedCount)
          .replace('{skipped}', skippedCount);
      } else {
        status.textContent = t('addedToCollection').replace('{count}', addedCount);
      }
      if (response.quality && response.quality.ok === false) {
        status.textContent += ' · ' + (response.message || t('qualityWarning'));
      }
      status.className = 'status';
      updateCollectionBadge();
    } else {
      status.textContent = (response && response.message) || t('noProducts');
      status.className = 'status error';
      const needAi = !response || !response.success || response.suggestAiRepair || (response.quality && response.quality.suggestAiRepair);
      showAiHint(needAi, (response && (response.aiHint || (response.quality && response.quality.aiHint))) || t('aiHint'));
    }
  } catch (error) {
    console.error(error);
    status.textContent = t('refreshRetry');
    status.className = 'status error';
    showAiHint(true, t('aiHint'));
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

  const imageSizeRaw = parseInt(document.getElementById('imageSize')?.value || '120', 10);
  const imageSize = [80, 120, 160].includes(imageSizeRaw) ? imageSizeRaw : 120;

  const settings = {
    exportFormat: document.getElementById('exportFormat').value,
    maxProducts: parseInt(document.getElementById('maxProducts').value) || 0,
    filterAds: document.getElementById('filterAds').checked,
    imageSize,
    columns: columns,
    language: document.getElementById('language').value || 'zh',
    aiApiKey: (document.getElementById('aiApiKey')?.value || '').trim(),
    aiBaseUrl: (document.getElementById('aiBaseUrl')?.value || DEFAULT_SETTINGS.aiBaseUrl).trim().replace(/\/$/, ''),
    aiModel: (document.getElementById('aiModel')?.value || DEFAULT_SETTINGS.aiModel).trim()
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
  const imageSizeEl = document.getElementById('imageSize');
  if (imageSizeEl) imageSizeEl.value = String(settings.imageSize || 120);
  document.getElementById('language').value = settings.language || 'zh';
  if (document.getElementById('aiApiKey')) document.getElementById('aiApiKey').value = settings.aiApiKey || '';
  if (document.getElementById('aiBaseUrl')) document.getElementById('aiBaseUrl').value = settings.aiBaseUrl || DEFAULT_SETTINGS.aiBaseUrl;
  if (document.getElementById('aiModel')) document.getElementById('aiModel').value = settings.aiModel || DEFAULT_SETTINGS.aiModel;

  ALL_COLUMNS.forEach(col => {
    const cb = document.getElementById('col_' + col);
    if (cb) cb.checked = settings.columns[col] !== false;
  });

  showMainView();
});


document.getElementById('aiRepairBtn')?.addEventListener('click', async () => {
  const status = document.getElementById('status');
  const btn = document.getElementById('aiRepairBtn');
  const settings = await loadSettings();
  if (!settings.aiApiKey) {
    status.textContent = t('aiNeedKey');
    status.className = 'status error';
    showSettingsView();
    return;
  }

  btn.disabled = true;
  status.textContent = t('aiRepairing');
  status.className = 'status';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes('1688.com')) {
      status.textContent = t('useOn1688');
      status.className = 'status error';
      btn.disabled = false;
      return;
    }

    // 自定义兼容接口域名需要可选主机权限
    try {
      const base = (settings.aiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
      const origin = new URL(base).origin + '/*';
      if (chrome.permissions && chrome.permissions.request) {
        await chrome.permissions.request({ origins: [origin] });
      }
    } catch (permErr) {
      console.warn('[1688 Smart Scraper] optional host permission skipped', permErr);
    }

    const result = await chrome.runtime.sendMessage({ action: 'runAiRepair', tabId: tab.id });
    if (result && result.success) {
      const count = Array.isArray(result.products) ? result.products.length : 0;
      const okMsg = result.message || (count > 0 ? `${t('aiRepairOk')}（${count}）` : t('aiRepairOk'));
      status.textContent = okMsg;
      status.className = 'status success';
      showAiHint(false);
      // Keep success message visible long enough for the user to notice
      const token = String(Date.now());
      status.dataset.msgToken = token;
      setTimeout(() => {
        if (status.dataset.msgToken === token && status.classList.contains('success')) {
          status.textContent = '';
          status.className = 'status';
          delete status.dataset.msgToken;
        }
      }, 5000);
    } else {
      status.textContent = (result && result.message) || t('aiRepairFail');
      status.className = 'status error';
      showAiHint(true, t('aiHint'));
    }
  } catch (error) {
    console.error(error);
    status.textContent = t('aiRepairFail') + (error && error.message ? ': ' + error.message : '');
    status.className = 'status error';
  }

  btn.disabled = false;
});

document.getElementById('clearAiRulesBtn')?.addEventListener('click', async () => {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'clearAiAdapters' });
    const status = document.getElementById('status');
    status.textContent = (result && result.message) || t('aiRulesCleared');
    status.className = 'status';
    showMainView();
    setTimeout(() => {
      if (status.textContent === ((result && result.message) || t('aiRulesCleared'))) status.textContent = '';
    }, 2500);
  } catch (error) {
    const status = document.getElementById('status');
    status.textContent = error.message || String(error);
    status.className = 'status error';
  }
});

function setPopupStatus(message, kind) {
  const status = document.getElementById('status');
  if (!status) return;
  status.textContent = message || '';
  status.className = kind === 'error' ? 'status error' : (kind === 'success' ? 'status success' : 'status');
}

document.getElementById('backupCollectionBtn')?.addEventListener('click', async () => {
  try {
    const result = await chrome.storage.local.get(['productCollection', 'folders']);
    const products = result.productCollection || [];
    const folders = result.folders || [{ id: 'default', name: '默认' }];
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      folders,
      productCollection: products
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `1688-collection-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setPopupStatus(t('backupDone'), 'success');
    showMainView();
  } catch (error) {
    setPopupStatus(error.message || String(error), 'error');
  }
});

document.getElementById('restoreCollectionBtn')?.addEventListener('click', () => {
  const input = document.getElementById('restoreCollectionInput');
  if (input) {
    input.value = '';
    input.click();
  }
});

document.getElementById('restoreCollectionInput')?.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!confirm(t('restoreConfirm'))) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const products = data.productCollection || data.products || data.collection || [];
    if (!Array.isArray(products)) throw new Error(t('restoreInvalid'));
    let folders = data.folders;
    if (!Array.isArray(folders) || folders.length === 0) {
      folders = [{ id: 'default', name: '默认' }];
    }
    const parseTags = (value) => {
      if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
      }
      return String(value || '')
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean);
    };
    const normalized = products.map((p) => ({
      ...p,
      folder: (p && p.folder) || 'default',
      status: ['pending', 'candidate', 'rejected'].includes(p && p.status) ? p.status : 'pending',
      notes: (p && p.notes) != null ? String(p.notes) : '',
      tags: parseTags(p && p.tags)
    }));
    await chrome.storage.local.set({ productCollection: normalized, folders });
    await updateCollectionBadge();
    setPopupStatus(t('restoreDone').replace('{count}', String(normalized.length)), 'success');
    showMainView();
  } catch (error) {
    setPopupStatus((error && error.message) || t('restoreInvalid'), 'error');
  }
});
