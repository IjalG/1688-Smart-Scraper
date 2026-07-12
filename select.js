let currentProducts = [];
let selectedProducts = new Set();
let currentTabId = null;
let focusedIndex = -1;
let contextImageIndex = -1;

function normalizeImageUrl(url) {
  let imageUrl = String(url || '').trim();
  if (!imageUrl) return '';
  if (imageUrl.startsWith('data:image/')) return imageUrl;
  if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
  if (imageUrl.startsWith('http://')) imageUrl = 'https://' + imageUrl.slice(7);

  let suffix = '';
  const qIndex = imageUrl.search(/[?#]/);
  if (qIndex >= 0) {
    suffix = imageUrl.slice(qIndex);
    imageUrl = imageUrl.slice(0, qIndex);
  }

  imageUrl = imageUrl.replace(/(\.(?:jpe?g|png|gif|bmp))(?:[._].+)?$/i, '$1');
  return imageUrl + suffix;
}

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let filterState = { search: '', priceMin: '', priceMax: '', status: 'all' };
let sortState = { mode: 'default', weightPrice: 1, weightSales: 1 };
let isCollectionMode = false;
let workbenchMode = 'simple'; // simple | pro
let currentLang = 'zh';
let currentFolder = 'default';
let folders = [{ id: 'default', name: '默认' }];

const STATUS_VALUES = ['pending', 'candidate', 'rejected'];
const DEFAULT_STATUS = 'pending';

function initResizeHandle() {
  const handle = document.getElementById('resizeHandle');
  const leftPanel = document.querySelector('.left-panel');
  if (!handle || !leftPanel) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = leftPanel.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const delta = e.clientX - startX;
    const containerWidth = document.querySelector('.container').offsetWidth;
    const newWidth = Math.min(Math.max(startWidth + delta, 250), containerWidth * 0.7);
    leftPanel.style.width = newWidth + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

const I18N = {
  zh: {
    productSelection: '1688 商品选择',
    clickToPreview: '点击商品可在右侧查看详情',
    loadingProducts: '正在加载商品数据...',
    selectAll: '全选',
    deselectAll: '取消全选',
    deleteSelected: '删除选中',
    clearCollection: '清空收藏夹',
    newFolder: '新建文件夹',
    renameFolder: '重命名',
    deleteFolder: '删除文件夹',
    searchPlaceholder: '搜索标题/店铺...',
    minPrice: '最低价',
    maxPrice: '最高价',
    clearFilter: '清除',
    exportSelected: '导出选中的商品',
    clickToPreviewTitle: '请点击左侧商品查看详情',
    openNewTab: '在新标签页打开 ↗',
    keyToggle: '勾选',
    keyNavigate: '切换',
    keyPreview: '预览',
    keyDelete: '删除',
    noProducts: '未找到商品数据',
    missingParam: '缺少参数',
    collectionEmpty: '收藏夹为空',
    selectOne: '请至少选择一个商品',
    exportFailed: '导出失败，请重试',
    exporting: '正在导出...',
    totalProducts: '共 {count} 个商品',
    selectedCount: '已选: {count} 个商品',
    confirmDeleteSelected: '确定要删除选中的 {count} 个商品吗？',
    confirmClearCollection: '确定要清空收藏夹吗？此操作不可撤销。',
    confirmDeleteFolder: '确定要删除文件夹「{name}」及其中的 {count} 个商品吗？',
    folderName: '请输入文件夹名称',
    renameFolderPrompt: '请输入新名称',
    folderExists: '文件夹已存在',
    cannotDeleteDefault: '不能删除默认文件夹',
    collectionCleared: '收藏夹已清空',
    folderDeleted: '已删除文件夹',
    folderCreated: '已创建文件夹',
    folderRenamed: '已重命名文件夹',
    sales: '销量',
    statusFilter: '状态',
    statusAll: '全部',
    statusPending: '待看',
    statusCandidate: '候选',
    statusRejected: '淘汰',
    notePlaceholder: '备注（可搜索）',
    tagsPlaceholder: '标签，逗号分隔',
    sortBy: '排序',
    sortDefault: '默认',
    sortScoreDesc: '评分高→低',
    sortPriceAsc: '价格低→高',
    sortPriceDesc: '价格高→低',
    sortSalesDesc: '销量高→低',
    weightPrice: '价权',
    weightSales: '销权',
    scoreLabel: '评分',
    backupCollection: '备份',
    restoreCollection: '恢复',
    backupDone: '已导出收藏备份',
    restoreDone: '已恢复收藏：{count} 个商品',
    restoreInvalid: '备份文件无效',
    restoreConfirm: '恢复将覆盖当前收藏夹与文件夹，是否继续？',
    priceUnit: '元',
    replaceImage: '替换图片',
    openImage: '查看图片',
    dragReplaceTip: '拖入替换',
    invalidImage: '请拖入有效的图片文件或图片地址',
    imageReplaced: '图片已替换',
    enterImageUrl: '请输入图片 URL',
    exportProgress: '导出进度: {current}/{total}',
    exportDownloading: '正在下载图片 {current}/{total}',
    exportBuilding: '正在生成表格...',
    exportSaving: '正在保存文件...',
    exportDone: '导出完成',
    qualityWarning: '已提取商品，但部分字段可能不完整，可直接修改售价和图片后再导出',
    pageStructureHint: '未能识别到商品，页面结构可能已更新。请刷新 1688 页面后重试',
    aiHint: '无法正常提取信息？试试 AI 分析模式吧',
    aiRepair: '开始 AI 修复',
    aiRepairing: '正在 AI 分析修复...',
    aiRepairOk: '修复完成，已重新提取并保存规则',
    aiRepairFail: '未能自动修复，请稍后重试或检查扩展设置中的 AI 配置',
    aiNeedKey: '请先在扩展弹窗设置中填写 AI API Key',
    retryLoad: '重新加载'
  },
  en: {
    productSelection: '1688 Product Selection',
    clickToPreview: 'Click products to preview on the right',
    loadingProducts: 'Loading products...',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    deleteSelected: 'Delete Selected',
    clearCollection: 'Clear Collection',
    newFolder: 'New Folder',
    renameFolder: 'Rename',
    deleteFolder: 'Delete Folder',
    searchPlaceholder: 'Search title/shop...',
    minPrice: 'Min',
    maxPrice: 'Max',
    clearFilter: 'Clear',
    exportSelected: 'Export Selected',
    clickToPreviewTitle: 'Click a product to preview',
    openNewTab: 'Open in new tab ↗',
    keyToggle: 'Toggle',
    keyNavigate: 'Navigate',
    keyPreview: 'Preview',
    keyDelete: 'Delete',
    noProducts: 'No products found',
    missingParam: 'Missing parameter',
    collectionEmpty: 'Collection is empty',
    selectOne: 'Please select at least one product',
    exportFailed: 'Export failed, please retry',
    exporting: 'Exporting...',
    totalProducts: '{count} products',
    selectedCount: 'Selected: {count}',
    confirmDeleteSelected: 'Delete {count} selected products?',
    confirmClearCollection: 'Clear the collection? This cannot be undone.',
    confirmDeleteFolder: 'Delete folder "{name}" and its {count} products?',
    folderName: 'Enter folder name',
    renameFolderPrompt: 'Enter new name',
    folderExists: 'Folder already exists',
    cannotDeleteDefault: 'Cannot delete default folder',
    collectionCleared: 'Collection cleared',
    folderDeleted: 'Folder deleted',
    folderCreated: 'Folder created',
    folderRenamed: 'Folder renamed',
    sales: 'Sales',
    statusFilter: 'Status',
    statusAll: 'All',
    statusPending: 'Pending',
    statusCandidate: 'Candidate',
    statusRejected: 'Rejected',
    notePlaceholder: 'Notes (searchable)',
    tagsPlaceholder: 'Tags, comma separated',
    sortBy: 'Sort',
    sortDefault: 'Default',
    sortScoreDesc: 'Score high→low',
    sortPriceAsc: 'Price low→high',
    sortPriceDesc: 'Price high→low',
    sortSalesDesc: 'Sales high→low',
    weightPrice: 'Price w.',
    weightSales: 'Sales w.',
    scoreLabel: 'Score',
    backupCollection: 'Backup',
    restoreCollection: 'Restore',
    backupDone: 'Collection backup exported',
    restoreDone: 'Restored {count} products',
    restoreInvalid: 'Invalid backup file',
    restoreConfirm: 'Restore will overwrite current collection and folders. Continue?',
    priceUnit: '',
    replaceImage: 'Replace image',
    openImage: 'Open image',
    dragReplaceTip: 'Drop to replace',
    invalidImage: 'Please provide a valid image file or image URL',
    imageReplaced: 'Image replaced',
    enterImageUrl: 'Enter image URL',
    exportProgress: 'Export progress: {current}/{total}',
    exportDownloading: 'Downloading images {current}/{total}',
    exportBuilding: 'Building workbook...',
    exportSaving: 'Saving file...',
    exportDone: 'Export completed',
    qualityWarning: 'Products extracted, but some fields may be incomplete. You can edit price/image before export.',
    pageStructureHint: 'No products recognized. The page structure may have changed. Refresh the 1688 page and try again.',
    aiHint: 'Cannot extract products? Try AI analysis mode',
    aiRepair: 'Start AI Repair',
    aiRepairing: 'Running AI repair...',
    aiRepairOk: 'Repair complete. Rules saved and re-extracted',
    aiRepairFail: 'Auto repair failed. Retry later or check AI settings in the extension popup',
    aiNeedKey: 'Please set AI API Key in the extension popup settings first',
    retryLoad: 'Reload'
  }
};

function t(key) {
  const dict = I18N[currentLang] || I18N.zh;
  return dict[key] || key;
}

function msg(key, vars) {
  let text = t(key);
  Object.keys(vars || {}).forEach((k) => {
    text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
  });
  return text;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.placeholder = t(key);
  });
  document.title = t('productSelection');
  const h1 = document.querySelector('.header h1');
  if (h1) h1.textContent = t('productSelection');
  const sub = document.querySelector('.header-sub');
  if (sub && !isCollectionMode) sub.textContent = t('clickToPreview');

  const ctxReplace = document.getElementById('ctxReplaceImage');
  const ctxOpen = document.getElementById('ctxOpenImage');
  if (ctxReplace) ctxReplace.textContent = t('replaceImage');
  if (ctxOpen) ctxOpen.textContent = t('openImage');

  // select options with data-i18n
  document.querySelectorAll('option[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
}

async function saveCollection(products) {
  await chrome.storage.local.set({ productCollection: products });
}

async function saveFolders(f) {
  await chrome.storage.local.set({ folders: f });
}

function normalizeStatus(status) {
  return STATUS_VALUES.includes(status) ? status : DEFAULT_STATUS;
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeProductMeta(product) {
  if (!product || typeof product !== 'object') return product;
  product.folder = product.folder || 'default';
  product.status = normalizeStatus(product.status);
  product.notes = product.notes != null ? String(product.notes) : '';
  product.tags = parseTags(product.tags);
  return product;
}

function normalizeCollection(list) {
  return (list || []).map((item) => normalizeProductMeta({ ...item }));
}

function parseSalesNumber(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase().replace(/,/g, '');
  if (!text) return 0;
  const match = text.match(/([\d.]+)\s*([万千百wk])?/i);
  if (!match) {
    const n = parseFloat(text.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  let num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return 0;
  const unit = (match[2] || '').toLowerCase();
  if (unit === '万' || unit === 'w') num *= 10000;
  else if (unit === '千' || unit === 'k') num *= 1000;
  else if (unit === '百') num *= 100;
  return num;
}

function parsePriceNumber(value) {
  const n = parseFloat(String(value == null ? '' : value).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function computeScore(product, weights) {
  const wPrice = Number(weights && weights.weightPrice);
  const wSales = Number(weights && weights.weightSales);
  const priceW = Number.isFinite(wPrice) ? wPrice : 1;
  const salesW = Number.isFinite(wSales) ? wSales : 1;
  const price = parsePriceNumber(product.价格);
  const sales = parseSalesNumber(product.销量);
  // Lower price better; missing price gets neutral 0 contribution
  const priceScore = Number.isFinite(price) && price > 0 ? (100 / (price + 1)) : 0;
  const salesScore = Math.log10(sales + 1) * 20;
  const statusBoost = product.status === 'candidate' ? 8 : (product.status === 'rejected' ? -20 : 0);
  return priceW * priceScore + salesW * salesScore + statusBoost;
}

function statusLabel(status) {
  const key = status === 'candidate' ? 'statusCandidate'
    : status === 'rejected' ? 'statusRejected'
    : 'statusPending';
  return t(key);
}

function isProMode() {
  return workbenchMode === 'pro';
}

function normalizeWorkbenchMode(mode) {
  return mode === 'pro' ? 'pro' : 'simple';
}

function effectiveSortWeights() {
  if (!isProMode()) {
    return { weightPrice: 1, weightSales: 1 };
  }
  return {
    weightPrice: Number.isFinite(Number(sortState.weightPrice)) ? Number(sortState.weightPrice) : 1,
    weightSales: Number.isFinite(Number(sortState.weightSales)) ? Number(sortState.weightSales) : 1
  };
}

function applyWorkbenchModeUI() {
  const weightControls = document.getElementById('weightControls');
  if (weightControls) {
    // Weights only in pro mode (collection + direct select)
    weightControls.classList.toggle('hidden', !isProMode());
  }
  document.querySelectorAll('.collection-only').forEach((el) => {
    el.classList.toggle('hidden', !isCollectionMode);
  });
  if (!isProMode()) {
    sortState.weightPrice = 1;
    sortState.weightSales = 1;
    const weightPrice = document.getElementById('weightPrice');
    const weightSales = document.getElementById('weightSales');
    if (weightPrice) weightPrice.value = '1';
    if (weightSales) weightSales.value = '1';
  }
}

function sortProductEntries(entries) {
  if (!sortState.mode || sortState.mode === 'default') return entries;
  return entries.slice().sort((a, b) => {
    const pa = a.product;
    const pb = b.product;
    if (sortState.mode === 'score_desc') {
      const weights = effectiveSortWeights();
      return computeScore(pb, weights) - computeScore(pa, weights);
    }
    if (sortState.mode === 'price_asc') {
      const va = parsePriceNumber(pa.价格);
      const vb = parsePriceNumber(pb.价格);
      if (!Number.isFinite(va) && !Number.isFinite(vb)) return 0;
      if (!Number.isFinite(va)) return 1;
      if (!Number.isFinite(vb)) return -1;
      return va - vb;
    }
    if (sortState.mode === 'price_desc') {
      const va = parsePriceNumber(pa.价格);
      const vb = parsePriceNumber(pb.价格);
      if (!Number.isFinite(va) && !Number.isFinite(vb)) return 0;
      if (!Number.isFinite(va)) return 1;
      if (!Number.isFinite(vb)) return -1;
      return vb - va;
    }
    if (sortState.mode === 'sales_desc') {
      return parseSalesNumber(pb.销量) - parseSalesNumber(pa.销量);
    }
    return 0;
  });
}

function getFolderProducts(folderId) {
  let entries;
  if (!isCollectionMode) {
    entries = currentProducts.map((product, index) => ({ product, index }));
  } else {
    entries = currentProducts
      .map((p, index) => ({ product: p, index }))
      .filter(({ product }) => (product.folder || 'default') === folderId);

    if (filterState.status && filterState.status !== 'all') {
      entries = entries.filter(({ product }) => normalizeStatus(product.status) === filterState.status);
    }
  }
  return sortProductEntries(entries);
}

function updateSelectCount() {
  const el = document.querySelector('.select-count');
  if (el) el.textContent = msg('selectedCount', { count: selectedProducts.size });
}

function updateFolderProductsCount() {
  if (!isCollectionMode) return;
  const products = getFolderProducts(currentFolder);
  document.querySelector('.header-sub').textContent = msg('totalProducts', { count: products.length });
}

function renderFolderSelect() {
  const select = document.getElementById('folderSelect');
  if (!select) return;
  select.innerHTML = '';
  folders.forEach((f) => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    if (f.id === currentFolder) opt.selected = true;
    select.appendChild(opt);
  });
}

function persistProductEdits() {
  if (isCollectionMode) {
    saveCollection(currentProducts);
  }
}

function setProductImage(index, imageUrl) {
  const normalized = normalizeImageUrl(imageUrl);
  if (!normalized) return false;
  if (!currentProducts[index]) return false;
  currentProducts[index].图片链接 = normalized;
  const thumb = document.querySelector(`.product-item[data-index="${index}"] .product-thumb`);
  if (thumb) thumb.src = normalized;
  persistProductEdits();
  return true;
}

function setProductPrice(index, price) {
  if (!currentProducts[index]) return;
  const cleaned = String(price || '').trim();
  currentProducts[index].价格 = cleaned;
  persistProductEdits();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function extractUrlFromDataTransfer(dataTransfer) {
  if (!dataTransfer) return '';
  const uri = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain') || '';
  const html = dataTransfer.getData('text/html') || '';
  if (uri && /^https?:\/\//i.test(uri.trim())) return uri.trim();
  const match = html.match(/src=["']([^"']+)["']/i);
  if (match && match[1]) return match[1];
  if (uri && uri.startsWith('data:image/')) return uri;
  return uri.trim();
}

async function applyImageFromDropOrFile(index, dataTransfer, file) {
  try {
    if (file && file.type && file.type.startsWith('image/')) {
      const dataUrl = await readFileAsDataUrl(file);
      if (setProductImage(index, dataUrl)) return true;
    }
    if (dataTransfer && dataTransfer.files && dataTransfer.files[0]) {
      const f = dataTransfer.files[0];
      if (f.type && f.type.startsWith('image/')) {
        const dataUrl = await readFileAsDataUrl(f);
        if (setProductImage(index, dataUrl)) return true;
      }
    }
    const url = extractUrlFromDataTransfer(dataTransfer);
    if (url && setProductImage(index, url)) return true;
  } catch (e) {
    console.error(e);
  }
  return false;
}

function hideContextMenu() {
  const menu = document.getElementById('imageContextMenu');
  if (menu) menu.style.display = 'none';
  contextImageIndex = -1;
}

function showContextMenu(x, y, index) {
  const menu = document.getElementById('imageContextMenu');
  if (!menu) return;
  contextImageIndex = index;
  menu.style.display = 'block';
  const rect = menu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 8);
  const top = Math.min(y, window.innerHeight - rect.height - 8);
  menu.style.left = Math.max(8, left) + 'px';
  menu.style.top = Math.max(8, top) + 'px';
}

function bindImageEditing(thumbWrap, index) {
  const thumb = thumbWrap.querySelector('.product-thumb');

  thumbWrap.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    thumbWrap.classList.add('drag-over');
  });
  thumbWrap.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    thumbWrap.classList.remove('drag-over');
  });
  thumbWrap.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    thumbWrap.classList.remove('drag-over');
    const ok = await applyImageFromDropOrFile(index, e.dataTransfer, null);
    if (!ok) alert(t('invalidImage'));
  });

  thumb.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, index);
  });

  thumb.addEventListener('click', (e) => {
    // keep preview on normal click via outer handler
  });
}

function renderProductList(listItems) {
  const productList = document.getElementById('productList');
  const entries = isCollectionMode
    ? listItems
    : (listItems || currentProducts).map((product, index) => ({ product, index }));

  if (!entries || entries.length === 0) {
    productList.innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">${t('noProducts')}</div>`;
    selectedProducts.clear();
    updateSelectCount();
    return;
  }

  productList.innerHTML = '';
  selectedProducts.clear();
  focusedIndex = -1;

  entries.forEach(({ product, index }) => {
    selectedProducts.add(index);
    if (isCollectionMode) normalizeProductMeta(product);

    const item = document.createElement('div');
    const status = isCollectionMode ? normalizeStatus(product.status) : '';
    item.className = 'product-item selected' + (status === 'rejected' ? ' status-rejected' : '');
    item.dataset.index = index;
    if (status) item.dataset.status = status;

    const deleteBtnHtml = isCollectionMode
      ? `<button class="delete-btn" data-index="${index}" title="Delete">✕</button>`
      : '';

    const priceValue = product.价格 != null ? String(product.价格) : '';
    const imageUrl = normalizeImageUrl(product.图片链接);
    const score = computeScore(product, effectiveSortWeights());
    const scoreText = `${t('scoreLabel')}: ${score.toFixed(1)}`;
    const noteValue = product.notes || '';
    const tagsValue = Array.isArray(product.tags) ? product.tags.join(', ') : '';

    const collectionControls = isCollectionMode ? `
        <div class="product-controls">
          <span class="product-status ${escapeAttr(status)}">${escapeHtml(statusLabel(status))}</span>
          <select class="status-select" data-index="${index}">
            <option value="pending"${status === 'pending' ? ' selected' : ''}>${escapeHtml(t('statusPending'))}</option>
            <option value="candidate"${status === 'candidate' ? ' selected' : ''}>${escapeHtml(t('statusCandidate'))}</option>
            <option value="rejected"${status === 'rejected' ? ' selected' : ''}>${escapeHtml(t('statusRejected'))}</option>
          </select>
          <input class="tags-input" type="text" data-index="${index}" value="${escapeAttr(tagsValue)}" placeholder="${escapeAttr(t('tagsPlaceholder'))}">
          <span class="product-score">${escapeHtml(scoreText)}</span>
        </div>
        <textarea class="product-note" data-index="${index}" placeholder="${escapeAttr(t('notePlaceholder'))}">${escapeHtml(noteValue)}</textarea>
    ` : `
        <div class="product-controls">
          <span class="product-score">${escapeHtml(scoreText)}</span>
        </div>
    `;

    item.innerHTML = `
      <input type="checkbox" checked data-index="${index}">
      <div class="product-thumb-wrap" data-index="${index}">
        <img class="product-thumb" src="${escapeAttr(imageUrl)}" alt="product" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23f5f5f5%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2212%22>no image</text></svg>'">
        <div class="product-thumb-tip">${escapeHtml(t('dragReplaceTip'))}</div>
      </div>
      <div class="product-info" data-link="${escapeAttr(product.商品链接 || '')}">
        <div class="product-title">${escapeHtml(product.商品标题 || 'Unknown')}</div>
        <div class="product-meta">
          <input class="price-input" type="text" inputmode="decimal" value="${escapeAttr(priceValue)}" data-index="${index}" title="${escapeAttr(t('priceUnit') || 'price')}">
          <span class="price-unit">${escapeHtml(t('priceUnit'))}</span>
          <span style="margin-left: 8px;">${escapeHtml(t('sales'))}: ${escapeHtml(product.销量 || '0')}</span>
        </div>
        <div class="product-shop">${escapeHtml(product.店铺名称 || '')}</div>
        ${collectionControls}
      </div>
      ${deleteBtnHtml}
    `;

    const checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      const idx = parseInt(e.target.dataset.index, 10);
      if (e.target.checked) {
        selectedProducts.add(idx);
        item.classList.add('selected');
      } else {
        selectedProducts.delete(idx);
        item.classList.remove('selected');
      }
      updateSelectCount();
    });

    const priceInput = item.querySelector('.price-input');
    priceInput.addEventListener('click', (e) => e.stopPropagation());
    priceInput.addEventListener('mousedown', (e) => e.stopPropagation());
    priceInput.addEventListener('keydown', (e) => e.stopPropagation());
    priceInput.addEventListener('change', (e) => {
      setProductPrice(index, e.target.value);
    });
    priceInput.addEventListener('blur', (e) => {
      setProductPrice(index, e.target.value);
    });

    if (isCollectionMode) {
      const statusSelect = item.querySelector('.status-select');
      if (statusSelect) {
        statusSelect.addEventListener('click', (e) => e.stopPropagation());
        statusSelect.addEventListener('mousedown', (e) => e.stopPropagation());
        statusSelect.addEventListener('change', (e) => {
          e.stopPropagation();
          const next = normalizeStatus(e.target.value);
          currentProducts[index].status = next;
          item.dataset.status = next;
          item.classList.toggle('status-rejected', next === 'rejected');
          const badge = item.querySelector('.product-status');
          if (badge) {
            badge.className = 'product-status ' + next;
            badge.textContent = statusLabel(next);
          }
          const scoreEl = item.querySelector('.product-score');
          if (scoreEl) scoreEl.textContent = `${t('scoreLabel')}: ${computeScore(currentProducts[index], effectiveSortWeights()).toFixed(1)}`;
          persistProductEdits();
          if (filterState.status !== 'all' && filterState.status !== next) {
            renderProductList(getFolderProducts(currentFolder));
            applyFilters();
          } else if (sortState.mode === 'score_desc') {
            renderProductList(getFolderProducts(currentFolder));
            applyFilters();
          }
        });
      }
      const tagsInput = item.querySelector('.tags-input');
      if (tagsInput) {
        tagsInput.addEventListener('click', (e) => e.stopPropagation());
        tagsInput.addEventListener('mousedown', (e) => e.stopPropagation());
        tagsInput.addEventListener('keydown', (e) => e.stopPropagation());
        const commitTags = (e) => {
          currentProducts[index].tags = parseTags(e.target.value);
          e.target.value = currentProducts[index].tags.join(', ');
          persistProductEdits();
        };
        tagsInput.addEventListener('change', commitTags);
        tagsInput.addEventListener('blur', commitTags);
      }
      const noteInput = item.querySelector('.product-note');
      if (noteInput) {
        noteInput.addEventListener('click', (e) => e.stopPropagation());
        noteInput.addEventListener('mousedown', (e) => e.stopPropagation());
        noteInput.addEventListener('keydown', (e) => e.stopPropagation());
        const commitNote = (e) => {
          currentProducts[index].notes = String(e.target.value || '');
          persistProductEdits();
        };
        noteInput.addEventListener('change', commitNote);
        noteInput.addEventListener('blur', commitNote);
      }
    }

    const productInfo = item.querySelector('.product-info');
    productInfo.addEventListener('click', (e) => {
      if (e.target.classList.contains('price-input')) return;
      if (e.target.classList.contains('status-select')) return;
      if (e.target.classList.contains('tags-input')) return;
      if (e.target.classList.contains('product-note')) return;
      e.stopPropagation();
      const link = productInfo.dataset.link;
      if (link) showPreview(link, product.商品标题 || 'Product');
    });

    const thumbWrap = item.querySelector('.product-thumb-wrap');
    const thumb = item.querySelector('.product-thumb');
    thumb.addEventListener('click', (e) => {
      e.stopPropagation();
      const link = productInfo.dataset.link;
      if (link) showPreview(link, product.商品标题 || 'Product');
    });
    bindImageEditing(thumbWrap, index);

    item.addEventListener('click', (e) => {
      if (e.target === checkbox) return;
      if (e.target.classList.contains('delete-btn')) return;
      if (e.target.classList.contains('price-input')) return;
      if (e.target.classList.contains('status-select')) return;
      if (e.target.classList.contains('tags-input')) return;
      if (e.target.classList.contains('product-note')) return;
      setFocus(index);
    });

    if (isCollectionMode) {
      const deleteBtn = item.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(e.target.dataset.index, 10);
        currentProducts.splice(idx, 1);
        selectedProducts.clear();
        renderProductList(getFolderProducts(currentFolder));
        applyFilters();
        saveCollection(currentProducts);
        updateFolderProductsCount();
      });
    }

    productList.appendChild(item);
  });

  updateSelectCount();
}

function setFocus(index) {
  const items = document.querySelectorAll('.product-item');
  items.forEach((item) => item.classList.remove('focused'));

  const target = document.querySelector(`.product-item[data-index="${index}"]`);
  if (target && !target.classList.contains('hidden')) {
    target.classList.add('focused');
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    focusedIndex = index;

    const product = currentProducts[index];
    if (product && product.商品链接) showPreview(product.商品链接, product.商品标题 || 'Product');
  }
}

function showPreview(url, title) {
  const previewFrame = document.getElementById('previewFrame');
  const previewPlaceholder = document.getElementById('previewPlaceholder');
  const previewTitle = document.getElementById('previewTitle');
  const openInNewTab = document.getElementById('openInNewTab');

  previewTitle.textContent = title;
  previewTitle.title = title;
  previewFrame.src = url;
  previewFrame.style.display = 'block';
  previewPlaceholder.style.display = 'none';
  openInNewTab.href = url;
  openInNewTab.style.display = 'inline';
}

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const items = document.querySelectorAll('.product-item:not(.hidden)');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const visibleIndices = Array.from(items).map((item) => parseInt(item.dataset.index, 10));

      if (focusedIndex === -1) {
        setFocus(visibleIndices[0]);
        return;
      }

      const currentPos = visibleIndices.indexOf(focusedIndex);
      if (e.key === 'ArrowDown' && currentPos < visibleIndices.length - 1) {
        setFocus(visibleIndices[currentPos + 1]);
      } else if (e.key === 'ArrowUp' && currentPos > 0) {
        setFocus(visibleIndices[currentPos - 1]);
      }
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (focusedIndex === -1) return;
      const item = document.querySelector(`.product-item[data-index="${focusedIndex}"]`);
      if (!item) return;
      const checkbox = item.querySelector('input[type="checkbox"]');
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex === -1) return;
      const product = currentProducts[focusedIndex];
      if (product && product.商品链接) showPreview(product.商品链接, product.商品标题 || 'Product');
    }

    if (e.key === 'Delete' && isCollectionMode) {
      e.preventDefault();
      if (focusedIndex === -1) return;
      currentProducts.splice(focusedIndex, 1);
      selectedProducts.clear();
      renderProductList(getFolderProducts(currentFolder));
      applyFilters();
      saveCollection(currentProducts);
      updateFolderProductsCount();
      focusedIndex = -1;
    }
  });
}

function matchesFilter(product) {
  if (filterState.search) {
    const q = filterState.search.toLowerCase();
    const title = (product.商品标题 || '').toLowerCase();
    const shop = (product.店铺名称 || '').toLowerCase();
    const notes = (product.notes || '').toLowerCase();
    const tags = parseTags(product.tags).join(' ').toLowerCase();
    if (!title.includes(q) && !shop.includes(q) && !notes.includes(q) && !tags.includes(q)) return false;
  }
  if (isCollectionMode && filterState.status && filterState.status !== 'all') {
    if (normalizeStatus(product.status) !== filterState.status) return false;
  }
  const price = parsePriceNumber(product.价格);
  if (filterState.priceMin !== '' && Number.isFinite(price)) {
    if (price < parseFloat(filterState.priceMin)) return false;
  }
  if (filterState.priceMax !== '' && Number.isFinite(price)) {
    if (price > parseFloat(filterState.priceMax)) return false;
  }
  return true;
}

function applyFilters() {
  const items = document.querySelectorAll('.product-item');
  items.forEach((item) => {
    const idx = parseInt(item.dataset.index, 10);
    const product = currentProducts[idx];
    if (product && matchesFilter(product)) {
      item.classList.remove('hidden');
    } else {
      item.classList.add('hidden');
    }
  });
  updateSelectCount();
}

function initFilters() {
  const searchInput = document.getElementById('searchInput');
  const priceMin = document.getElementById('priceMin');
  const priceMax = document.getElementById('priceMax');
  const clearBtn = document.getElementById('clearFilterBtn');
  if (!searchInput) return;

  const onFilterChange = () => {
    filterState = {
      search: searchInput.value || '',
      priceMin: priceMin.value || '',
      priceMax: priceMax.value || '',
      status: (document.getElementById('statusFilter') && document.getElementById('statusFilter').value) || filterState.status || 'all'
    };
    applyFilters();
  };

  searchInput.addEventListener('input', onFilterChange);
  priceMin.addEventListener('input', onFilterChange);
  priceMax.addEventListener('input', onFilterChange);
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    priceMin.value = '';
    priceMax.value = '';
    filterState = {
      search: '',
      priceMin: '',
      priceMax: '',
      status: (document.getElementById('statusFilter') && document.getElementById('statusFilter').value) || 'all'
    };
    applyFilters();
  });
}

function refreshProductView() {
  selectedProducts.clear();
  renderProductList(getFolderProducts(currentFolder));
  applyFilters();
  if (isCollectionMode) updateFolderProductsCount();
}

function refreshCollectionView() {
  refreshProductView();
}

function initWorkflowControls() {
  const bar = document.getElementById('workflowBar');
  if (!bar) return;
  bar.classList.add('active');
  applyWorkbenchModeUI();

  const statusFilter = document.getElementById('statusFilter');
  const sortSelect = document.getElementById('sortSelect');
  const weightPrice = document.getElementById('weightPrice');
  const weightSales = document.getElementById('weightSales');
  const backupBtn = document.getElementById('backupBtn');
  const restoreBtn = document.getElementById('restoreBtn');
  const restoreFileInput = document.getElementById('restoreFileInput');

  if (statusFilter) {
    statusFilter.value = filterState.status || 'all';
    statusFilter.addEventListener('change', () => {
      if (!isCollectionMode) return;
      filterState.status = statusFilter.value || 'all';
      refreshProductView();
    });
  }
  if (sortSelect) {
    sortSelect.value = sortState.mode || 'default';
    sortSelect.addEventListener('change', () => {
      sortState.mode = sortSelect.value || 'default';
      refreshProductView();
    });
  }
  const onWeightChange = () => {
    if (!isProMode()) {
      sortState.weightPrice = 1;
      sortState.weightSales = 1;
      return;
    }
    sortState.weightPrice = parseFloat(weightPrice && weightPrice.value) || 0;
    sortState.weightSales = parseFloat(weightSales && weightSales.value) || 0;
    if (sortState.mode === 'score_desc') refreshProductView();
    else {
      const weights = effectiveSortWeights();
      document.querySelectorAll('.product-item').forEach((item) => {
        const idx = parseInt(item.dataset.index, 10);
        const scoreEl = item.querySelector('.product-score');
        if (scoreEl && currentProducts[idx]) {
          scoreEl.textContent = `${t('scoreLabel')}: ${computeScore(currentProducts[idx], weights).toFixed(1)}`;
        }
      });
    }
  };
  if (weightPrice) weightPrice.addEventListener('change', onWeightChange);
  if (weightSales) weightSales.addEventListener('change', onWeightChange);

  if (backupBtn) {
    backupBtn.addEventListener('click', () => {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        folders,
        productCollection: currentProducts
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
      alert(t('backupDone'));
    });
  }

  if (restoreBtn && restoreFileInput) {
    restoreBtn.addEventListener('click', () => {
      restoreFileInput.value = '';
      restoreFileInput.click();
    });
    restoreFileInput.addEventListener('change', async () => {
      const file = restoreFileInput.files && restoreFileInput.files[0];
      if (!file) return;
      if (!confirm(t('restoreConfirm'))) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const products = normalizeCollection(data.productCollection || data.products || data.collection || []);
        if (!Array.isArray(products)) throw new Error('invalid');
        let nextFolders = data.folders;
        if (!Array.isArray(nextFolders) || nextFolders.length === 0) {
          nextFolders = [{ id: 'default', name: currentLang === 'en' ? 'Default' : '默认' }];
        } else {
          nextFolders = nextFolders.map((f, i) => ({
            id: String((f && f.id) || (i === 0 ? 'default' : `folder_${i}`)),
            name: String((f && f.name) || (i === 0 ? (currentLang === 'en' ? 'Default' : '默认') : `Folder ${i}`))
          }));
          if (!nextFolders.some((f) => f.id === 'default')) {
            nextFolders.unshift({ id: 'default', name: currentLang === 'en' ? 'Default' : '默认' });
          }
        }
        currentProducts = products;
        folders = nextFolders;
        currentFolder = 'default';
        await saveCollection(currentProducts);
        await saveFolders(folders);
        renderFolderSelect();
        refreshCollectionView();
        alert(msg('restoreDone', { count: currentProducts.length }));
      } catch (err) {
        console.error(err);
        alert(t('restoreInvalid'));
      }
    });
  }
}

function setExportProgress(text, active) {
  const el = document.getElementById('exportProgress');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('active', !!active && !!text);
}

function initExportProgressListener() {
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action !== 'exportProgress') return;
    const { stage, current, total } = request;
    if (stage === 'image') {
      setExportProgress(msg('exportDownloading', { current, total }), true);
    } else if (stage === 'workbook') {
      setExportProgress(t('exportBuilding'), true);
    } else if (stage === 'download') {
      setExportProgress(t('exportSaving'), true);
    } else if (stage === 'done') {
      setExportProgress(t('exportDone'), true);
    } else if (stage === 'start') {
      setExportProgress(msg('exportProgress', { current: current || 0, total: total || 0 }), true);
    }
  });
}

function initImageContextMenu() {
  const fileInput = document.getElementById('imageFileInput');
  const ctxReplace = document.getElementById('ctxReplaceImage');
  const ctxOpen = document.getElementById('ctxOpenImage');

  document.addEventListener('click', hideContextMenu);
  document.addEventListener('scroll', hideContextMenu, true);

  if (ctxReplace) {
    ctxReplace.addEventListener('click', (e) => {
      e.stopPropagation();
      if (contextImageIndex < 0) return;
      hideContextMenu();
      fileInput.dataset.index = String(contextImageIndex);
      fileInput.value = '';
      fileInput.click();
    });
  }

  if (ctxOpen) {
    ctxOpen.addEventListener('click', (e) => {
      e.stopPropagation();
      if (contextImageIndex < 0) return;
      const url = currentProducts[contextImageIndex] && currentProducts[contextImageIndex].图片链接;
      hideContextMenu();
      if (url) window.open(url, '_blank');
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const index = parseInt(fileInput.dataset.index || '-1', 10);
      const file = fileInput.files && fileInput.files[0];
      if (index < 0 || !file) return;
      const ok = await applyImageFromDropOrFile(index, null, file);
      if (!ok) alert(t('invalidImage'));
    });
  }
}

async function init() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const mainContainer = document.getElementById('mainContainer');

  try {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    currentLang = params.get('lang') || 'zh';
    isCollectionMode = (mode === 'collection');

    applyI18n();
    initImageContextMenu();
    initExportProgressListener();

    if (isCollectionMode) {
      const settingsWrap = await chrome.storage.sync.get('settings');
      const opts = settingsWrap.settings || {};
      if (opts.language) currentLang = opts.language;
      workbenchMode = normalizeWorkbenchMode(opts.workbenchMode);
      applyI18n();

      const result = await chrome.storage.local.get(['productCollection', 'folders']);
      currentProducts = normalizeCollection(result.productCollection || []);
      folders = result.folders || [{ id: 'default', name: currentLang === 'en' ? 'Default' : '默认' }];

      if (currentProducts.length === 0) {
        throw new Error(t('collectionEmpty'));
      }

      // migrate old collection items once
      await saveCollection(currentProducts);

      document.getElementById('folderBar').style.display = 'flex';
      document.getElementById('deleteSelectedBtn').style.display = 'inline-block';
      document.getElementById('clearCollectionBtn').style.display = 'inline-block';
      const delKey = document.querySelector('[data-i18n-key="Delete"]');
      const delLabel = document.querySelector('[data-i18n="keyDelete"]');
      if (delKey) delKey.style.display = 'inline-block';
      if (delLabel) delLabel.style.display = 'inline';

      renderFolderSelect();
      renderProductList(getFolderProducts(currentFolder));
      loadingOverlay.style.display = 'none';
      mainContainer.style.display = 'flex';
      updateFolderProductsCount();
      initKeyboardShortcuts();
      initFilters();
      initWorkflowControls();
      initResizeHandle();
      return;
    }

    const tabId = parseInt(params.get('tabId'), 10);
    if (!tabId) throw new Error(t('missingParam'));
    currentTabId = tabId;

    const settings = await chrome.storage.sync.get('settings');
    const opts = settings.settings || {};
    if (opts.language) currentLang = opts.language;
    workbenchMode = normalizeWorkbenchMode(opts.workbenchMode);
    if (!isProMode()) {
      sortState.weightPrice = 1;
      sortState.weightSales = 1;
    }
    applyI18n();

    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'getProducts',
      options: {
        maxProducts: opts.maxProducts || 0,
        filterAds: opts.filterAds !== false,
        exportFormat: opts.exportFormat || 'xlsx'
      }
    });

    if (response && response.products && response.products.length > 0) {
      currentProducts = response.products;
      renderProductList(getFolderProducts(currentFolder));
      loadingOverlay.style.display = 'none';
      mainContainer.style.display = 'flex';
      initKeyboardShortcuts();
      initFilters();
      initWorkflowControls();
      initResizeHandle();

      if (response.quality && response.quality.ok === false) {
        const sub = document.querySelector('.header-sub');
        if (sub) {
          const hint = response.aiHint || (response.quality && response.quality.aiHint) || t('aiHint');
          sub.innerHTML = `${escapeHtml(t('qualityWarning'))} · <a href="#" id="headerAiRepairLink" style="color:#fff;text-decoration:underline;">${escapeHtml(hint)}</a>`;
          const link = document.getElementById('headerAiRepairLink');
          if (link) {
            link.addEventListener('click', async (e) => {
              e.preventDefault();
              await runAiRepairFromSelect(currentTabId, sub);
            });
          }
        }
      }
    } else {
      const err = new Error((response && response.message) || t('pageStructureHint'));
      err.suggestAiRepair = !response || response.suggestAiRepair !== false;
      throw err;
    }
  } catch (error) {
    const message = error.message || t('noProducts');
    loadingOverlay.innerHTML = `
      <div style="text-align: center; color: #999; max-width: 460px; padding: 0 20px;">
        <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
        <div style="font-size: 14px; margin-bottom: 12px; line-height: 1.5;">${escapeHtml(message)}</div>
        <div style="font-size: 12px; margin-bottom: 8px; color: #bbb;">${escapeHtml(t('pageStructureHint'))}</div>
        <div style="font-size: 13px; margin-bottom: 16px; color: #b35c00;">${escapeHtml(t('aiHint'))}</div>
        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
          <button id="aiRepairOverlayBtn" style="padding: 10px 18px; font-size: 14px; background: #4a90d9; color: white; border: none; border-radius: 6px; cursor: pointer;">${escapeHtml(t('aiRepair'))}</button>
          <button id="reloadOverlayBtn" style="padding: 10px 18px; font-size: 14px; background: #fff; color: #333; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">${escapeHtml(t('retryLoad'))}</button>
          <button onclick="window.close()" style="padding: 10px 18px; font-size: 14px; background: #ff6600; color: white; border: none; border-radius: 6px; cursor: pointer;">Close</button>
        </div>
        <div id="aiRepairOverlayStatus" style="margin-top:12px;font-size:12px;color:#666;"></div>
      </div>
    `;
    const repairBtn = document.getElementById('aiRepairOverlayBtn');
    const reloadBtn = document.getElementById('reloadOverlayBtn');
    const statusEl = document.getElementById('aiRepairOverlayStatus');
    if (repairBtn) {
      repairBtn.addEventListener('click', async () => {
        await runAiRepairFromSelect(currentTabId, statusEl, true);
      });
    }
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => window.location.reload());
    }
  }
}

function setAiRepairStatus(statusEl, message, kind) {
  if (!statusEl) return;
  statusEl.textContent = message || '';
  if (kind === 'success') {
    statusEl.style.color = '#0a7a32';
    statusEl.style.fontWeight = '600';
  } else if (kind === 'error') {
    statusEl.style.color = '#d00';
    statusEl.style.fontWeight = '600';
  } else {
    statusEl.style.color = '#666';
    statusEl.style.fontWeight = 'normal';
  }
}

async function runAiRepairFromSelect(tabId, statusEl, reloadOnSuccess) {
  const settingsResult = await chrome.storage.sync.get('settings');
  const settings = settingsResult.settings || {};
  if (!settings.aiApiKey) {
    if (statusEl) setAiRepairStatus(statusEl, t('aiNeedKey'), 'error');
    else alert(t('aiNeedKey'));
    return;
  }
  if (!tabId) {
    if (statusEl) setAiRepairStatus(statusEl, t('missingParam'), 'error');
    return;
  }
  if (statusEl) setAiRepairStatus(statusEl, t('aiRepairing'), 'info');
  try {
    const result = await chrome.runtime.sendMessage({ action: 'runAiRepair', tabId });
    if (result && result.success) {
      const count = Array.isArray(result.products) ? result.products.length : 0;
      const okMsg = result.message || (count > 0 ? `${t('aiRepairOk')}（${count}）` : t('aiRepairOk'));
      if (statusEl) setAiRepairStatus(statusEl, okMsg, 'success');
      else alert(okMsg);
      // Show success feedback before reload so the user can notice it
      if (reloadOnSuccess !== false) {
        setTimeout(() => window.location.reload(), 1200);
      }
    } else {
      const failMsg = (result && result.message) || t('aiRepairFail');
      if (statusEl) setAiRepairStatus(statusEl, failMsg, 'error');
      else alert(failMsg);
    }
  } catch (error) {
    const failMsg = t('aiRepairFail') + (error && error.message ? ': ' + error.message : '');
    if (statusEl) setAiRepairStatus(statusEl, failMsg, 'error');
    else alert(t('aiRepairFail'));
  }
}

document.getElementById('selectAllBtn').addEventListener('click', () => {
  const items = document.querySelectorAll('.product-item');
  items.forEach((item) => {
    const idx = parseInt(item.dataset.index, 10);
    const checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    selectedProducts.add(idx);
    item.classList.add('selected');
  });
  updateSelectCount();
});

document.getElementById('deselectAllBtn').addEventListener('click', () => {
  const items = document.querySelectorAll('.product-item');
  items.forEach((item) => {
    const idx = parseInt(item.dataset.index, 10);
    const checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.checked = false;
    selectedProducts.delete(idx);
    item.classList.remove('selected');
  });
  updateSelectCount();
});

document.getElementById('deleteSelectedBtn').addEventListener('click', () => {
  if (selectedProducts.size === 0) {
    alert(t('selectOne'));
    return;
  }
  if (!confirm(msg('confirmDeleteSelected', { count: selectedProducts.size }))) return;

  const indicesToRemove = Array.from(selectedProducts).sort((a, b) => b - a);
  indicesToRemove.forEach((idx) => {
    currentProducts.splice(idx, 1);
  });

  selectedProducts.clear();
  renderProductList(getFolderProducts(currentFolder));
  applyFilters();
  saveCollection(currentProducts);
  updateFolderProductsCount();
});

document.getElementById('clearCollectionBtn').addEventListener('click', () => {
  if (!confirm(t('confirmClearCollection'))) return;
  currentProducts = [];
  selectedProducts.clear();
  saveCollection([]);
  updateFolderProductsCount();
  document.getElementById('productList').innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">${t('collectionCleared')}</div>`;
  updateSelectCount();
});

document.getElementById('folderSelect').addEventListener('change', (e) => {
  currentFolder = e.target.value;
  selectedProducts.clear();
  renderProductList(getFolderProducts(currentFolder));
  applyFilters();
  updateFolderProductsCount();
});

document.getElementById('newFolderBtn').addEventListener('click', () => {
  const name = prompt(t('folderName'));
  if (!name || !name.trim()) return;

  const id = 'folder_' + Date.now();
  if (folders.some((f) => f.name === name.trim())) {
    alert(t('folderExists'));
    return;
  }

  folders.push({ id, name: name.trim() });
  saveFolders(folders);
  renderFolderSelect();
  document.getElementById('folderSelect').value = id;
  currentFolder = id;
  selectedProducts.clear();
  renderProductList(getFolderProducts(currentFolder));
  applyFilters();
  updateFolderProductsCount();
});

document.getElementById('renameFolderBtn').addEventListener('click', () => {
  const folder = folders.find((f) => f.id === currentFolder);
  if (!folder) return;

  const name = prompt(t('renameFolderPrompt'), folder.name);
  if (!name || !name.trim()) return;

  folder.name = name.trim();
  saveFolders(folders);
  renderFolderSelect();
});

document.getElementById('deleteFolderBtn').addEventListener('click', () => {
  if (currentFolder === 'default') {
    alert(t('cannotDeleteDefault'));
    return;
  }

  const folder = folders.find((f) => f.id === currentFolder);
  if (!folder) return;

  const count = getFolderProducts(currentFolder).length;
  if (!confirm(msg('confirmDeleteFolder', { name: folder.name, count }))) return;

  currentProducts = currentProducts.filter((p) => p.folder !== currentFolder);
  folders = folders.filter((f) => f.id !== currentFolder);
  currentFolder = 'default';

  saveCollection(currentProducts);
  saveFolders(folders);
  renderFolderSelect();
  selectedProducts.clear();
  renderProductList(getFolderProducts(currentFolder));
  applyFilters();
  updateFolderProductsCount();
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  // flush focused price inputs
  document.querySelectorAll('.price-input').forEach((input) => {
    const idx = parseInt(input.dataset.index, 10);
    if (!Number.isNaN(idx)) setProductPrice(idx, input.value);
  });
  document.querySelectorAll('.product-note').forEach((input) => {
    const idx = parseInt(input.dataset.index, 10);
    if (!Number.isNaN(idx) && currentProducts[idx]) currentProducts[idx].notes = String(input.value || '');
  });
  document.querySelectorAll('.tags-input').forEach((input) => {
    const idx = parseInt(input.dataset.index, 10);
    if (!Number.isNaN(idx) && currentProducts[idx]) currentProducts[idx].tags = parseTags(input.value);
  });
  if (isCollectionMode) persistProductEdits();

  const selectedList = Array.from(selectedProducts)
    .sort((a, b) => a - b)
    .map((idx) => {
      const product = currentProducts[idx];
      return {
        ...product,
        图片链接: normalizeImageUrl(product.图片链接),
        价格: product.价格 != null ? String(product.价格).trim() : ''
      };
    });

  if (selectedList.length === 0) {
    alert(t('selectOne'));
    return;
  }

  const exportBtn = document.getElementById('exportBtn');
  exportBtn.disabled = true;
  exportBtn.textContent = t('exporting');
  setExportProgress(msg('exportProgress', { current: 0, total: selectedList.length }), true);

  try {
    const settings = await chrome.storage.sync.get('settings');
    const exportFormat = settings.settings?.exportFormat || 'xlsx';
    const columns = settings.settings?.columns;
    const imageSize = settings.settings?.imageSize || 120;

    const response = await chrome.runtime.sendMessage({
      action: isCollectionMode ? 'exportFromCollection' : 'exportSelected',
      products: selectedList,
      options: {
        exportFormat,
        language: currentLang,
        columns,
        imageSize,
        mode: isCollectionMode ? 'collection' : 'products'
      }
    });

    if (!response || !response.success) {
      throw new Error(response?.message || t('exportFailed'));
    }

    setExportProgress(t('exportDone'), true);
    setTimeout(() => window.close(), 400);
  } catch (error) {
    console.error(error);
    alert(t('exportFailed') + (error && error.message ? `\n${error.message}` : ''));
    exportBtn.disabled = false;
    exportBtn.textContent = t('exportSelected');
    setExportProgress('', false);
  }
});

document.addEventListener('DOMContentLoaded', init);
