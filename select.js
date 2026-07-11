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

let filterState = { search: '', priceMin: '', priceMax: '' };
let isCollectionMode = false;
let currentLang = 'zh';
let currentFolder = 'default';
let folders = [{ id: 'default', name: '默认' }];

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
    pageStructureHint: '未能识别到商品，页面结构可能已更新。请刷新 1688 页面后重试'
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
    pageStructureHint: 'No products recognized. The page structure may have changed. Refresh the 1688 page and try again.'
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
}

async function saveCollection(products) {
  await chrome.storage.local.set({ productCollection: products });
}

async function saveFolders(f) {
  await chrome.storage.local.set({ folders: f });
}

function getFolderProducts(folderId) {
  if (!isCollectionMode) return currentProducts;
  return currentProducts
    .map((p, index) => ({ product: p, index }))
    .filter(({ product }) => (product.folder || 'default') === folderId);
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

    const item = document.createElement('div');
    item.className = 'product-item selected';
    item.dataset.index = index;

    const deleteBtnHtml = isCollectionMode
      ? `<button class="delete-btn" data-index="${index}" title="Delete">✕</button>`
      : '';

    const priceValue = product.价格 != null ? String(product.价格) : '';
    const imageUrl = normalizeImageUrl(product.图片链接);

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

    const productInfo = item.querySelector('.product-info');
    productInfo.addEventListener('click', (e) => {
      if (e.target.classList.contains('price-input')) return;
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
    if (!title.includes(q) && !shop.includes(q)) return false;
  }
  const price = parseFloat(product.价格);
  if (filterState.priceMin !== '' && !isNaN(price)) {
    if (price < parseFloat(filterState.priceMin)) return false;
  }
  if (filterState.priceMax !== '' && !isNaN(price)) {
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
      priceMax: priceMax.value || ''
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
    filterState = { search: '', priceMin: '', priceMax: '' };
    applyFilters();
  });
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
      const result = await chrome.storage.local.get(['productCollection', 'folders']);
      currentProducts = result.productCollection || [];
      folders = result.folders || [{ id: 'default', name: currentLang === 'en' ? 'Default' : '默认' }];

      if (currentProducts.length === 0) {
        throw new Error(t('collectionEmpty'));
      }

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
      initResizeHandle();
      return;
    }

    const tabId = parseInt(params.get('tabId'), 10);
    if (!tabId) throw new Error(t('missingParam'));
    currentTabId = tabId;

    const settings = await chrome.storage.sync.get('settings');
    const opts = settings.settings || {};
    if (opts.language) currentLang = opts.language;
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
      renderProductList(currentProducts);
      loadingOverlay.style.display = 'none';
      mainContainer.style.display = 'flex';
      initKeyboardShortcuts();
      initFilters();
      initResizeHandle();

      if (response.quality && response.quality.ok === false) {
        const sub = document.querySelector('.header-sub');
        if (sub) sub.textContent = t('qualityWarning');
      }
    } else {
      throw new Error((response && response.message) || t('pageStructureHint'));
    }
  } catch (error) {
    loadingOverlay.innerHTML = `
      <div style="text-align: center; color: #999; max-width: 420px; padding: 0 20px;">
        <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
        <div style="font-size: 14px; margin-bottom: 12px; line-height: 1.5;">${escapeHtml(error.message || t('noProducts'))}</div>
        <div style="font-size: 12px; margin-bottom: 20px; color: #bbb;">${escapeHtml(t('pageStructureHint'))}</div>
        <button onclick="window.close()" style="padding: 10px 30px; font-size: 14px; background: #ff6600; color: white; border: none; border-radius: 6px; cursor: pointer;">Close</button>
      </div>
    `;
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
