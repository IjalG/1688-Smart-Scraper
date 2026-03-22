let currentProducts = [];
let selectedProducts = new Set();
let currentTabId = null;

async function init() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const mainContainer = document.getElementById('mainContainer');

  try {
    const params = new URLSearchParams(window.location.search);
    const tabId = parseInt(params.get('tabId'));
    
    if (!tabId) {
      throw new Error('缺少参数');
    }
    
    currentTabId = tabId;

    const response = await chrome.tabs.sendMessage(tabId, { action: 'getProducts' });

    if (response && response.success) {
      currentProducts = response.products;
      renderProductList(currentProducts);
      loadingOverlay.style.display = 'none';
      mainContainer.style.display = 'flex';
    } else {
      throw new Error(response?.message || '获取商品失败');
    }
  } catch (error) {
    loadingOverlay.innerHTML = `
      <div style="text-align: center; color: #999;">
        <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
        <div style="font-size: 14px; margin-bottom: 20px;">加载失败: ${error.message}</div>
        <button onclick="window.close()" style="padding: 10px 30px; font-size: 14px; background: #ff6600; color: white; border: none; border-radius: 6px; cursor: pointer;">关闭</button>
      </div>
    `;
  }
}

function updateSelectCount() {
  document.getElementById('selectCount').textContent = `已选: ${selectedProducts.size} 个商品`;
}

function renderProductList(products) {
  const productList = document.getElementById('productList');

  if (products.length === 0) {
    productList.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">未找到商品数据</div>';
    return;
  }

  productList.innerHTML = '';
  selectedProducts.clear();

  products.forEach((product, index) => {
    selectedProducts.add(index);

    const item = document.createElement('div');
    item.className = 'product-item selected';
    item.dataset.index = index;

    item.innerHTML = `
      <input type="checkbox" checked data-index="${index}">
      <img class="product-thumb" src="${product.图片链接 || ''}" alt="商品图片" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23f5f5f5%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2212%22>无图片</text></svg>'">
      <div class="product-info" data-link="${product.商品链接 || ''}">
        <div class="product-title">${product.商品标题 || '未知商品'}</div>
        <div class="product-meta">
          <span class="product-price">${product.价格 || '-'}元</span>
          <span style="margin-left: 8px;">销量: ${product.销量 || '0'}</span>
        </div>
        <div class="product-shop">${product.店铺名称 || ''}</div>
      </div>
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
      if (link) {
        showPreview(link, product.商品标题 || '商品详情');
      }
    });

    const thumb = item.querySelector('.product-thumb');
    thumb.addEventListener('click', (e) => {
      e.stopPropagation();
      const link = productInfo.dataset.link;
      if (link) {
        showPreview(link, product.商品标题 || '商品详情');
      }
    });

    productList.appendChild(item);
  });

  updateSelectCount();
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

document.getElementById('selectAllBtn').addEventListener('click', () => {
  const items = document.querySelectorAll('.product-item');
  items.forEach((item, idx) => {
    const checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    selectedProducts.add(idx);
    item.classList.add('selected');
  });
  updateSelectCount();
});

document.getElementById('deselectAllBtn').addEventListener('click', () => {
  const items = document.querySelectorAll('.product-item');
  items.forEach((item, idx) => {
    const checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.checked = false;
    selectedProducts.delete(idx);
    item.classList.remove('selected');
  });
  updateSelectCount();
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  const selectedList = Array.from(selectedProducts)
    .sort((a, b) => a - b)
    .map(idx => currentProducts[idx]);

  if (selectedList.length === 0) {
    alert('请至少选择一个商品');
    return;
  }

  const exportBtn = document.getElementById('exportBtn');
  exportBtn.disabled = true;
  exportBtn.textContent = '正在导出...';

  try {
    const settings = await chrome.storage.sync.get('settings');
    const exportFormat = settings.settings?.exportFormat || 'xlsx';

    await chrome.tabs.sendMessage(currentTabId, {
      action: 'exportSelected',
      products: selectedList,
      options: { exportFormat }
    });

    window.close();
  } catch (error) {
    console.error(error);
    alert('导出失败，请重试');
    exportBtn.disabled = false;
    exportBtn.textContent = '导出选中的商品';
  }
});

document.addEventListener('DOMContentLoaded', init);
