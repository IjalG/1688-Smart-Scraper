/**
 * 1688 智能选品助手 - Content Script
 * 负责从页面DOM中提取商品数据
 */

(function() {
  'use strict';

  const ALL_COLUMNS = ['序号', '图片', '商品标题', '价格', '销量', '店铺名称', '商品链接'];

  const DEFAULT_COLUMNS = {
    '序号': true, '图片': true, '商品标题': true,
    '价格': true, '销量': true, '店铺名称': true, '商品链接': true
  };

  const CONFIG = {
    maxProducts: 0,
    filterAds: true,
    exportFormat: 'xlsx',
    columns: { ...DEFAULT_COLUMNS },
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

  const I18N_EXPORT = {
    zh: {
      cols: { '序号': '序号', '图片': '图片', '商品标题': '商品标题', '价格': '价格(元)', '销量': '销量', '店铺名称': '店铺名称', '商品链接': '商品链接' },
      title: '1688 商品数据',
      exportTime: '导出时间',
      productCount: '商品数量',
      price: '价格',
      sales: '销量',
      shop: '店铺',
      link: '链接',
      viewProduct: '查看商品',
      unknown: '未知商品',
      yuan: '元',
      attr: '属性',
      value: '值'
    },
    en: {
      cols: { '序号': 'No.', '图片': 'Image', '商品标题': 'Title', '价格': 'Price (CNY)', '销量': 'Sales', '店铺名称': 'Shop', '商品链接': 'Link' },
      title: '1688 Product Data',
      exportTime: 'Export Time',
      productCount: 'Products',
      price: 'Price',
      sales: 'Sales',
      shop: 'Shop',
      link: 'Link',
      viewProduct: 'View Product',
      unknown: 'Unknown',
      yuan: 'CNY',
      attr: 'Attribute',
      value: 'Value'
    }
  };

  function getDict(lang) {
    return I18N_EXPORT[lang] || I18N_EXPORT.zh;
  }

  async function generateXLSX(products, lang) {
    const dict = getDict(lang);
    console.log('[1688智能选品助手] 导出语言:', lang, dict);
    console.log('[1688智能选品助手] 正在下载图片...');
    const imagePromises = products.map(async (product, index) => {
      if (product.图片链接 && CONFIG.columns['图片']) {
        console.log(`[1688智能选品助手] 下载图片 ${index + 1}/${products.length}`);
        const base64 = await imageToBase64(product.图片链接);
        return { ...product, 图片base64: base64 };
      }
      return { ...product, 图片base64: '' };
    });

    const productsWithImages = await Promise.all(imagePromises);
    console.log('[1688智能选品助手] 图片下载完成');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '1688 Smart Scraper';

    const worksheet = workbook.addWorksheet('Products', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    const colHeaders = [];
    const colKeys = [];
    const colWidths = { '序号': 8, '图片': 15, '商品标题': 50, '价格': 12, '销量': 12, '店铺名称': 25, '商品链接': 40 };

    ALL_COLUMNS.forEach(key => {
      if (CONFIG.columns[key]) {
        colHeaders.push(dict.cols[key]);
        colKeys.push(key);
      }
    });

    worksheet.columns = colHeaders.map((h, i) => ({
      header: h,
      key: colKeys[i],
      width: colWidths[colKeys[i]] || 20
    }));

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

      const rowData = {};
      colKeys.forEach(key => {
        rowData[key] = product[key] || '';
      });

      const row = worksheet.addRow(rowData);
      row.height = 65;

      if (CONFIG.columns['图片'] && product.图片base64) {
        try {
          const base64Data = product.图片base64.split(',')[1];
          const imageId = workbook.addImage({
            base64: base64Data,
            extension: product.图片base64.includes('image/png') ? 'png' : 'jpeg'
          });

          const imgColIdx = colKeys.indexOf('图片');
          worksheet.addImage(imageId, {
            tl: { col: imgColIdx, row: rowNum - 1 },
            ext: { width: 60, height: 60 }
          });
        } catch (e) {
          console.warn('[1688智能选品助手] 添加图片失败:', e);
        }
      }

      colKeys.forEach(key => {
        const cell = row.getCell(key);
        if (key === '商品标题') {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    }

    return await workbook.xlsx.writeBuffer();
  }

  function generateMarkdown(products, lang) {
    const dict = getDict(lang);
    const locale = lang === 'en' ? 'en-US' : 'zh-CN';
    let md = `# ${dict.title}\n\n`;
    md += `> ${dict.exportTime}: ${new Date().toLocaleString(locale)}\n`;
    md += `> ${dict.productCount}: ${products.length}\n\n`;
    md += '---\n\n';

    for (const product of products) {
      md += `## ${product.序号}. ${product.商品标题 || dict.unknown}\n\n`;

      if (CONFIG.columns['图片'] && product.图片链接) {
        md += `![Product](${product.图片链接})\n\n`;
      }

      md += `| ${dict.attr} | ${dict.value} |\n`;
      md += '| --- | --- |\n';
      if (CONFIG.columns['价格']) md += `| ${dict.price} | ${product.价格 || '-'} ${dict.yuan} |\n`;
      if (CONFIG.columns['销量']) md += `| ${dict.sales} | ${product.销量 || '0'} |\n`;
      if (CONFIG.columns['店铺名称']) md += `| ${dict.shop} | ${product.店铺名称 || '-'} |\n`;
      if (CONFIG.columns['商品链接'] && product.商品链接) {
        md += `| ${dict.link} | [${dict.viewProduct}](${product.商品链接}) |\n`;
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

  async function exportSelectedProducts(products, options = {}) {
    const exportFormat = options.exportFormat || 'xlsx';
    const lang = options.language || 'zh';
    if (options.columns) {
      Object.keys(options.columns).forEach(key => {
        CONFIG.columns[key] = options.columns[key];
      });
    }

    showNotification(lang === 'en' ? `Exporting ${products.length} products...` : `正在导出 ${products.length} 个商品...`, 'info');

    try {
      const now = new Date();
      const dateStr = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0');
      const timeStr = now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0');

      const productsWithIndex = products.map((p, i) => ({ ...p, 序号: i + 1 }));

      if (exportFormat === 'xlsx') {
        showNotification(lang === 'en' ? `Downloading ${products.length} images...` : `正在下载 ${products.length} 个商品图片...`, 'info');
        const buffer = await generateXLSX(productsWithIndex, lang);
        const filename = `1688_products_${dateStr}_${timeStr}.xlsx`;
        downloadFile(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else {
        const markdown = generateMarkdown(productsWithIndex, lang);
        const filename = `1688_products_${dateStr}_${timeStr}.md`;
        downloadFile(markdown, filename, 'text/markdown;charset=utf-8');
      }

      showNotification(lang === 'en' ? `Successfully exported ${products.length} products!` : `成功导出 ${products.length} 个商品！`, 'success');
      return { success: true, count: products.length };
    } catch (error) {
      console.error('[1688智能选品助手] 导出失败:', error);
      showNotification(lang === 'en' ? 'Export failed: ' + error.message : '导出失败: ' + error.message, 'error');
      return { success: false, message: error.message };
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getProducts') {
      const options = request.options || {};
      CONFIG.maxProducts = options.maxProducts || 0;
      CONFIG.filterAds = options.filterAds !== false;
      CONFIG.exportFormat = options.exportFormat || 'xlsx';
      if (options.columns) {
        Object.keys(options.columns).forEach(key => {
          CONFIG.columns[key] = options.columns[key];
        });
      }
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

  console.log('[1688智能选品助手] 内容脚本已加载');
})();
