let currentProducts = [];
let selectedProducts = new Set();
let currentTabId = null;
let focusedIndex = -1;
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
    folderRenamed: '已重命名文件夹'
  },
  en: {
    productSelection: '1688 Product Selection',
    clickToPreview: 'Click products to preview on the right',
    loadingProducts: 'Loading products...',
    selectAll: 'Select All',
    deselectAll: 'Deselect',
    deleteSelected: 'Delete Selected',
    clearCollection: 'Clear Collection',
    newFolder: 'New Folder',
    renameFolder: 'Rename',
    deleteFolder: 'Delete Folder',
    searchPlaceholder: 'Search title/shop...',
    minPrice: 'Min price',
    maxPrice: 'Max price',
    clearFilter: 'Clear',
    exportSelected: 'Export Selected',
    clickToPreviewTitle: 'Click a product to preview',
    openNewTab: 'Open in new tab ↗',
    keyToggle: 'toggle',
    keyNavigate: 'navigate',
    keyPreview: 'preview',
    keyDelete: 'delete',
    noProducts: 'No products found',
    missingParam: 'Missing parameter',
    collectionEmpty: 'Collection is empty',
    selectOne: 'Please select at least one product',
    exportFailed: 'Export failed, please retry',
    exporting: 'Exporting...',
    totalProducts: '{count} products',
    selectedCount: 'Selected: {count}',
    confirmDeleteSelected: 'Delete {count} selected products?',
    confirmClearCollection: 'Clear entire collection? This cannot be undone.',
    confirmDeleteFolder: 'Delete folder "{name}" and its {count} products?',
    folderName: 'Enter folder name',
    renameFolderPrompt: 'Enter new name',
    folderExists: 'Folder already exists',
    cannotDeleteDefault: 'Cannot delete default folder',
    collectionCleared: 'Collection cleared',
    folderDeleted: 'Folder deleted',
    folderCreated: 'Folder created',
    folderRenamed: 'Folder renamed'
  }
};

function t(key) {
  return (I18N[currentLang] || I18N.zh)[key] || key;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });
}

function msg(key, vars) {
  let str = t(key);
  Object.keys(vars).forEach(k => { str = str.replace('{' + k + '}', vars[k]); });
  return str;
}

async function saveCollection(products) {
  await chrome.storage.local.set({ productCollection: products });
}

async function saveFolders(f) {
  await chrome.storage.local.set({ folders: f });
}

function getFolderProducts(folderId) {
  if (folderId === 'all') return currentProducts;
  return currentProducts.filter(p => p.folder === folderId);
}

function updateSelectCount() {
  document.getElementById('selectCount').textContent = msg('selectedCount', { count: selectedProducts.size });
}

function updateFolderProductsCount() {
  const products = getFolderProducts(currentFolder);
  document.querySelector('.header-sub').textContent = msg('totalProducts', { count: products.length });
}

function renderFolderSelect() {
  const select = document.getElementById('folderSelect');
  select.innerHTML = '';
  folders.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    if (f.id === currentFolder) opt.selected = true;
    select.appendChild(opt);
  });
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
      document.querySelector('[data-i18n-key="Delete"]').style.display = 'inline-block';
      document.querySelector('[data-i18n="keyDelete"]').style.display = 'inline';

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

    const tabId = parseInt(params.get('tabId'));
    if (!tabId) throw new Error(t('missingParam'));

    currentTabId = tabId;

    const settings = await chrome.storage.sync.get('settings');
    const opts = settings.settings || {};

    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'getProducts',
      options: {
        maxProducts: opts.maxProducts || 0,
        filterAds: opts.filterAds !== false,
        exportFormat: opts.exportFormat || 'xlsx'
      }
    });

    if (response && response.success) {
      currentProducts = response.products;
      renderProductList(currentProducts);
      loadingOverlay.style.display = 'none';
      mainContainer.style.display = 'flex';
      initKeyboardShortcuts();
      initFilters();
      initResizeHandle();
    } else {
      throw new Error(response?.message || t('noProducts'));
    }
  } catch (error) {
    loadingOverlay.innerHTML = `
      <div style="text-align: center; color: #999;">
        <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
        <div style="font-size: 14px; margin-bottom: 20px;">${error.message}</div>
        <button onclick="window.close()" style="padding: 10px 30px; font-size: 14px; background: #ff6600; color: white; border: none; border-radius: 6px; cursor: pointer;">Close</button>
      </div>
    `;
  }
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
    const idx = parseInt(item.dataset.index);
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

  let debounceTimer;
  const onFilterChange = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      filterState.search = searchInput.value.trim();
      filterState.priceMin = priceMin.value;
      filterState.priceMax = priceMax.value;
      applyFilters();
    }, 200);
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

function renderProductList(products) {
  const productList = document.getElementById('productList');

  if (products.length === 0) {
    productList.innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">${t('noProducts')}</div>`;
    return;
  }

  productList.innerHTML = '';
  selectedProducts.clear();
  focusedIndex = -1;

  products.forEach((product, index) => {
    selectedProducts.add(index);

    const item = document.createElement('div');
    item.className = 'product-item selected';
    item.dataset.index = index;

    const deleteBtnHtml = isCollectionMode ? `<button class="delete-btn" data-index="${index}" title="Delete">✕</button>` : '';

    item.innerHTML = `
      <input type="checkbox" checked data-index="${index}">
      <img class="product-thumb" src="${product.图片链接 || ''}" alt="product" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23f5f5f5%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2212%22>no image</text></svg>'">
      <div class="product-info" data-link="${product.商品链接 || ''}">
        <div class="product-title">${product.商品标题 || 'Unknown'}</div>
        <div class="product-meta">
          <span class="product-price">${product.价格 || '-'}元</span>
          <span style="margin-left: 8px;">${currentLang === 'en' ? 'Sales' : '销量'}: ${product.销量 || '0'}</span>
        </div>
        <div class="product-shop">${product.店铺名称 || ''}</div>
      </div>
      ${deleteBtnHtml}
    `;

    const checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      const idx = parseInt(e.target.dataset.index);
      if (e.target.checked) {
        selectedProducts.add(idx);
        item.classList.add('selected');
      } else {
        selectedProducts.delete(idx);
        item.classList.remove('selected');
      }
      updateSelectCount();
    });

    const productInfo = item.querySelector('.product-info');
    productInfo.addEventListener('click', (e) => {
      e.stopPropagation();
      const link = productInfo.dataset.link;
      if (link) showPreview(link, product.商品标题 || 'Product');
    });

    const thumb = item.querySelector('.product-thumb');
    thumb.addEventListener('click', (e) => {
      e.stopPropagation();
      const link = productInfo.dataset.link;
      if (link) showPreview(link, product.商品标题 || 'Product');
    });

    item.addEventListener('click', (e) => {
      if (e.target === checkbox) return;
      if (e.target.classList.contains('delete-btn')) return;
      setFocus(index);
    });

    if (isCollectionMode) {
      const deleteBtn = item.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(e.target.dataset.index);
        currentProducts.splice(idx, 1);
        selectedProducts.clear();
        const fp = getFolderProducts(currentFolder);
        renderProductList(fp);
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
  items.forEach(item => item.classList.remove('focused'));

  const target = document.querySelector(`.product-item[data-index="${index}"]`);
  if (target && !target.classList.contains('hidden')) {
    target.classList.add('focused');
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    focusedIndex = index;

    const product = currentProducts[index];
    const link = product.商品链接;
    if (link) showPreview(link, product.商品标题 || 'Product');
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
      const visibleIndices = Array.from(items).map(item => parseInt(item.dataset.index));

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
      if (product.商品链接) showPreview(product.商品链接, product.商品标题 || 'Product');
    }

    if (e.key === 'Delete' && isCollectionMode) {
      e.preventDefault();
      if (focusedIndex === -1) return;
      currentProducts.splice(focusedIndex, 1);
      selectedProducts.clear();
      const fp = getFolderProducts(currentFolder);
      renderProductList(fp);
      applyFilters();
      saveCollection(currentProducts);
      updateFolderProductsCount();
      focusedIndex = -1;
    }
  });
}

document.getElementById('selectAllBtn').addEventListener('click', () => {
  const items = document.querySelectorAll('.product-item');
  items.forEach((item) => {
    const idx = parseInt(item.dataset.index);
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
    const idx = parseInt(item.dataset.index);
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
  indicesToRemove.forEach(idx => { currentProducts.splice(idx, 1); });

  selectedProducts.clear();
  const fp = getFolderProducts(currentFolder);
  renderProductList(fp);
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
  const fp = getFolderProducts(currentFolder);
  renderProductList(fp);
  applyFilters();
  updateFolderProductsCount();
});

document.getElementById('newFolderBtn').addEventListener('click', () => {
  const name = prompt(t('folderName'));
  if (!name || !name.trim()) return;

  const id = 'folder_' + Date.now();
  if (folders.some(f => f.name === name.trim())) {
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
  const folder = folders.find(f => f.id === currentFolder);
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

  const folder = folders.find(f => f.id === currentFolder);
  if (!folder) return;

  const count = getFolderProducts(currentFolder).length;
  if (!confirm(msg('confirmDeleteFolder', { name: folder.name, count }))) return;

  currentProducts = currentProducts.filter(p => p.folder !== currentFolder);
  folders = folders.filter(f => f.id !== currentFolder);
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
  const selectedList = Array.from(selectedProducts)
    .sort((a, b) => a - b)
    .map(idx => currentProducts[idx]);

  if (selectedList.length === 0) {
    alert(t('selectOne'));
    return;
  }

  const exportBtn = document.getElementById('exportBtn');
  exportBtn.disabled = true;
  exportBtn.textContent = t('exporting');

  try {
    const settings = await chrome.storage.sync.get('settings');
    const exportFormat = settings.settings?.exportFormat || 'xlsx';

    if (isCollectionMode) {
      await chrome.runtime.sendMessage({
        action: 'exportFromCollection',
        products: selectedList,
        options: { exportFormat, language: currentLang }
      });
    } else {
      await chrome.tabs.sendMessage(currentTabId, {
        action: 'exportSelected',
        products: selectedList,
        options: { exportFormat, language: currentLang }
      });
    }

    window.close();
  } catch (error) {
    console.error(error);
    alert(t('exportFailed'));
    exportBtn.disabled = false;
    exportBtn.textContent = t('exportSelected');
  }
});

document.addEventListener('DOMContentLoaded', init);
