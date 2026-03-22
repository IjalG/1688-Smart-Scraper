/**
 * 1688 智能选品助手 - Content Script
 * 负责从页面DOM中提取商品数据
 */

(function() {
  'use strict';

  // 配置项
  const CONFIG = {
    maxProducts: 0,  // 0 = 全部
    filterAds: true,
    exportFormat: 'xlsx',
    selectors: {
      productCards: [
        '.search-offer-wrapper:not(.cardui-adOffer)',
        '[class*="search-offer-wrapper"]:not([class*="adOffer"])',
        '[data-renderkey]'
      ],
      image: [
        'img.main-img',
        'img[class*="main-img"]'
      ],
      link: [
        'a[href*="offer"]',
        'a[href*="1688.com"]',
        'a'
      ],
      title: [
        '.offer-title',
        '.title-text',
        '[class*="title-text"]',
        '[class*="TitleText"]',
        'a[title]'
      ],
      shop: [
        '.desc-text',
        '.offer-desc-item .desc-text',
        '[class*="desc-text"]'
      ],
      adMarkers: [
        '.cardui-adOffer',
        '[class*="adOffer"]',
        '[class*="ad-offer"]'
      ]
    }
  };

  function querySelectorFirst(container, selectors) {
    for (const selector of selectors) {
      try {
        const element = container.querySelector(selector);
        if (element) return element;
      } catch (e) {}
    }
    return null;
  }

  function querySelectorAllFirst(container, selectors) {
    for (const selector of selectors) {
      try {
        const elements = container.querySelectorAll(selector);
        if (elements.length > 0) return elements;
      } catch (e) {}
    }
    return [];
  }

  function cleanText(text) {
    if (!text) return '';
    return String(text).replace(/[\s\n\r\t]+/g, ' ').trim();
  }

  function isAdCard(card) {
    const className = card.className || '';
    if (className.includes('adOffer') || className.includes('ad-offer') || className.includes('AdOffer')) {
      return true;
    }
    for (const selector of CONFIG.selectors.adMarkers) {
      try {
        if (card.matches && card.matches(selector)) return true;
        if (card.querySelector(selector)) return true;
      } catch (e) {}
    }
    return false;
  }

  function extractPrice(card) {
    const priceItem = card.querySelector('.price-item');
    if (priceItem) {
      const match = priceItem.textContent.match(/[\d,.]+/);
      return match ? match[0] : '';
    }
    return '';
  }

  function extractSales(card) {
    const salesEl = card.querySelector('.col-desc_after');
    if (salesEl) {
      const match = salesEl.textContent.match(/[\d.]+\s*[万千百]?/);
      return match ? match[0].trim() : '0';
    }
    return '0';
  }

  function extractImageUrl(card) {
    const imgElement = querySelectorFirst(card, CONFIG.selectors.image);
    if (!imgElement) return '';
    let imageUrl = imgElement.getAttribute('data-src') ||
                   imgElement.getAttribute('data-lazy-src') ||
                   imgElement.getAttribute('src') || '';
    imageUrl = String(imageUrl || '');
    if (!imageUrl || imageUrl.length < 10 ||
        imageUrl.includes('loading') ||
        imageUrl.includes('placeholder') ||
        imageUrl.includes('blank') ||
        imageUrl === 'about:blank') {
      return '';
    }
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    }
    return imageUrl;
  }

  function extractLink(card) {
    const allLinks = card.querySelectorAll('a[href]');
    let offerId = null;
    
    for (const link of allLinks) {
      const href = link.href || '';
      const offerIdMatch = href.match(/offerId=(\d+)/);
      if (offerIdMatch) {
        offerId = offerIdMatch[1];
        if (!href.includes('similar_search') && !href.includes('air.1688.com')) {
          if (href.includes('detail.1688.com')) return href;
        }
      }
    }
    
    if (offerId) return `https://detail.1688.com/offer/${offerId}.html`;
    
    for (const link of allLinks) {
      const href = link.href || '';
      if (href.includes('detail.1688.com/offer/') && !href.includes('similar_search')) {
        return href;
      }
    }
    return '';
  }

  function extractTitle(card) {
    let titleEl = card.querySelector('.title-text');
    if (titleEl) return cleanText(titleEl.textContent);
    
    titleEl = card.querySelector('.offer-title');
    if (titleEl) return cleanText(titleEl.textContent);

    titleEl = card.querySelector('.offer-title-row');
    if (titleEl) return cleanText(titleEl.textContent);
    
    const linkEl = card.querySelector('a[title]');
    if (linkEl && linkEl.title && !linkEl.title.includes('旺旺')) {
      return cleanText(linkEl.title);
    }

    const imgElement = querySelectorFirst(card, CONFIG.selectors.image);
    if (imgElement) {
      const alt = imgElement.getAttribute('alt');
      if (alt) return cleanText(alt);
    }
    
    titleEl = card.querySelector('[class*="title"]');
    if (titleEl) {
      const text = cleanText(titleEl.textContent);
      if (text && text.length > 3 && !text.includes('旺旺')) return text;
    }
    return '';
  }

  function extractShopName(card) {
    const shopLink = card.querySelector('.offer-shop-row .offer-desc-item[href*=".1688.com"]');
    if (shopLink) {
      const textEl = shopLink.querySelector('.desc-text');
      return textEl ? cleanText(textEl.textContent) : '';
    }
    return '';
  }

  function extractProductData(card, index) {
    return {
      序号: index + 1,
      商品标题: extractTitle(card),
      价格: extractPrice(card),
      销量: extractSales(card),
      店铺名称: extractShopName(card),
      图片链接: extractImageUrl(card),
      商品链接: extractLink(card)
    };
  }

  function findProductCards() {
    for (const selector of CONFIG.selectors.productCards) {
      try {
        const cards = document.querySelectorAll(selector);
        if (cards.length > 0) return cards;
      } catch (e) {}
    }
    return [];
  }

  function extractProducts() {
    console.log('[1688智能选品助手] 开始提取商品数据...');
    const productCards = findProductCards();
    console.log(`[1688智能选品助手] 找到 ${productCards.length} 个商品卡片`);

    const products = [];
    let validCount = 0;
    const maxCount = CONFIG.maxProducts > 0 ? CONFIG.maxProducts : Infinity;

    for (let i = 0; i < productCards.length && validCount < maxCount; i++) {
      const card = productCards[i];
      
      if (CONFIG.filterAds && isAdCard(card)) {
        console.log(`[1688智能选品助手] 跳过广告卡片 #${i}`);
        continue;
      }

      const productData = extractProductData(card, validCount);
      
      if (productData.商品标题) {
        console.log(`[1688智能选品助手] 提取商品 #${validCount}:`, productData.商品标题);
        products.push(productData);
        validCount++;
      }
    }

    console.log(`[1688智能选品助手] 成功提取 ${products.length} 个有效商品`);
    return products;
  }

  function showNotification(message, type = 'info') {
    const existingNotification = document.getElementById('scraper-notification');
    if (existingNotification) existingNotification.remove();

    const notification = document.createElement('div');
    notification.id = 'scraper-notification';
    notification.className = `scraper-notification scraper-notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('scraper-notification-fade');
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }

  async function imageToBase64(url) {
    if (!url) return '';
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('[1688智能选品助手] 图片转换失败:', url, e);
      return '';
    }
  }

  async function generateXLSX(products) {
    console.log('[1688智能选品助手] 正在下载图片...');
    const imagePromises = products.map(async (product, index) => {
      if (product.图片链接) {
        console.log(`[1688智能选品助手] 下载图片 ${index + 1}/${products.length}`);
        const base64 = await imageToBase64(product.图片链接);
        return { ...product, 图片base64: base64 };
      }
      return { ...product, 图片base64: '' };
    });
    
    const productsWithImages = await Promise.all(imagePromises);
    console.log('[1688智能选品助手] 图片下载完成');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '1688智能选品助手';
    
    const worksheet = workbook.addWorksheet('商品数据', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    worksheet.columns = [
      { header: '序号', key: '序号', width: 8 },
      { header: '图片', key: '图片', width: 15 },
      { header: '商品标题', key: '商品标题', width: 50 },
      { header: '价格(元)', key: '价格', width: 12 },
      { header: '销量', key: '销量', width: 12 },
      { header: '店铺名称', key: '店铺名称', width: 25 },
      { header: '商品链接', key: '商品链接', width: 40 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF6600' }
    };
    headerRow.alignment = { horizontal: 'left', vertical: 'middle' };

    for (let i = 0; i < productsWithImages.length; i++) {
      const product = productsWithImages[i];
      const rowNum = i + 2;
      
      const row = worksheet.addRow({
        序号: product.序号,
        商品标题: product.商品标题,
        价格: product.价格,
        销量: product.销量,
        店铺名称: product.店铺名称,
        商品链接: product.商品链接
      });

      row.height = 65;

      if (product.图片base64) {
        try {
          const base64Data = product.图片base64.split(',')[1];
          const imageId = workbook.addImage({
            base64: base64Data,
            extension: product.图片base64.includes('image/png') ? 'png' : 'jpeg'
          });
          
          worksheet.addImage(imageId, {
            tl: { col: 1, row: rowNum - 1 },
            ext: { width: 60, height: 60 }
          });
        } catch (e) {
          console.warn('[1688智能选品助手] 添加图片失败:', e);
        }
      }

      row.getCell('序号').alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell('商品标题').alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      row.getCell('价格').alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell('销量').alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell('店铺名称').alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell('商品链接').alignment = { horizontal: 'left', vertical: 'middle' };
    }

    return await workbook.xlsx.writeBuffer();
  }

  function generateMarkdown(products) {
    let md = '# 1688 商品数据\n\n';
    md += `> 导出时间: ${new Date().toLocaleString('zh-CN')}\n`;
    md += `> 商品数量: ${products.length}\n\n`;
    md += '---\n\n';

    for (const product of products) {
      md += `## ${product.序号}. ${product.商品标题 || '未知商品'}\n\n`;
      
      if (product.图片链接) {
        md += `![商品图片](${product.图片链接})\n\n`;
      }
      
      md += '| 属性 | 值 |\n';
      md += '| --- | --- |\n';
      md += `| 价格 | ${product.价格 || '-'} 元 |\n`;
      md += `| 销量 | ${product.销量 || '0'} |\n`;
      md += `| 店铺 | ${product.店铺名称 || '-'} |\n`;
      if (product.商品链接) {
        md += `| 链接 | [查看商品](${product.商品链接}) |\n`;
      }
      md += '\n---\n\n';
    }

    return md;
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function executeExtraction(options = {}) {
    // 应用设置
    CONFIG.maxProducts = options.maxProducts || 0;
    CONFIG.filterAds = options.filterAds !== false;
    CONFIG.exportFormat = options.exportFormat || 'xlsx';

    showNotification('正在提取商品数据...', 'info');

    try {
      const products = extractProducts();

      if (products.length === 0) {
        showNotification('未找到有效商品数据，请确保页面已加载完成', 'warning');
        return { success: false, message: '未找到有效商品数据' };
      }

      const now = new Date();
      const dateStr = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0');
      const timeStr = now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0');

      if (CONFIG.exportFormat === 'xlsx') {
        showNotification(`正在下载 ${products.length} 个商品图片...`, 'info');
        const buffer = await generateXLSX(products);
        const filename = `1688_products_${dateStr}_${timeStr}.xlsx`;
        downloadFile(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else {
        const markdown = generateMarkdown(products);
        const filename = `1688_products_${dateStr}_${timeStr}.md`;
        downloadFile(markdown, filename, 'text/markdown;charset=utf-8');
      }

      showNotification(`成功提取 ${products.length} 个商品！`, 'success');
      
      return { 
        success: true, 
        count: products.length,
        products: products 
      };

    } catch (error) {
      console.error('[1688智能选品助手] 提取失败:', error);
      showNotification('提取失败: ' + error.message, 'error');
      return { success: false, message: error.message };
    }
  }

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractProducts') {
    executeExtraction(request.options).then(result => {
      sendResponse(result);
    });
    return true;
  }

  if (request.action === 'getProducts') {
    const products = extractProducts();
    sendResponse({ success: true, products: products });
    return true;
  }

  if (request.action === 'exportSelected') {
    exportSelectedProducts(request.products, request.options).then(result => {
      sendResponse(result);
    });
    return true;
  }

  if (request.action === 'ping') {
    sendResponse({ status: 'ready' });
    return true;
  }
});

async function exportSelectedProducts(products, options = {}) {
  const exportFormat = options.exportFormat || 'xlsx';

  showNotification(`正在导出 ${products.length} 个商品...`, 'info');

  try {
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0');
    const timeStr = now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0');

    const productsWithIndex = products.map((p, i) => ({ ...p, 序号: i + 1 }));

    if (exportFormat === 'xlsx') {
      showNotification(`正在下载 ${products.length} 个商品图片...`, 'info');
      const buffer = await generateXLSX(productsWithIndex);
      const filename = `1688_products_${dateStr}_${timeStr}.xlsx`;
      downloadFile(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else {
      const markdown = generateMarkdown(productsWithIndex);
      const filename = `1688_products_${dateStr}_${timeStr}.md`;
      downloadFile(markdown, filename, 'text/markdown;charset=utf-8');
    }

    showNotification(`成功导出 ${products.length} 个商品！`, 'success');
    return { success: true, count: products.length };
  } catch (error) {
    console.error('[1688智能选品助手] 导出失败:', error);
    showNotification('导出失败: ' + error.message, 'error');
    return { success: false, message: error.message };
  }
}

console.log('[1688智能选品助手] 内容脚本已加载，点击扩展图标开始抓取');
})();