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
        'img[class*="main-img"]',
        'img[class*="offer-img"]',
        'img[class*="OfferImg"]',
        '.mojar-element-image img',
        '.offer-img-wrapper img',
        'img[src*="alicdn.com"]',
        'img[data-src*="alicdn.com"]'
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

  function isUsableImageUrl(url) {
    const imageUrl = String(url || '').trim();
    if (!imageUrl || imageUrl.length < 10) return false;
    const lower = imageUrl.toLowerCase();
    if (lower.startsWith('data:image/svg')) return false;
    if (lower.includes('loading') || lower.includes('placeholder') || lower.includes('blank')) return false;
    if (imageUrl === 'about:blank') return false;
    return true;
  }

  function normalizeImageUrl(url) {
    let imageUrl = String(url || '').trim();
    if (!imageUrl) return '';
    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
    if (imageUrl.startsWith('http://')) imageUrl = 'https://' + imageUrl.slice(7);

    // 保留 query/hash，仅清理路径部分
    let suffix = '';
    const qIndex = imageUrl.search(/[?#]/);
    if (qIndex >= 0) {
      suffix = imageUrl.slice(qIndex);
      imageUrl = imageUrl.slice(0, qIndex);
    }

    // 1688/alicdn 常见缩略图形态（保留第一个真实图片扩展名）:
    // xxx.jpg_300x300q90.jpg_.webp
    // xxx.jpg.jpg_.webp  ← 旧逻辑会误收成 xxx.jpg.jpg 并 404
    // xxx.jpg_sum.jpg / xxx.png_b.jpg
    imageUrl = imageUrl.replace(/(\.(?:jpe?g|png|gif|bmp))(?:[._].+)?$/i, '$1');
    return imageUrl + suffix;
  }

  function extractImageUrl(card) {
    const candidates = [];
    const pushCandidate = (value) => {
      if (!value) return;
      const normalized = normalizeImageUrl(value);
      if (isUsableImageUrl(normalized)) candidates.push(normalized);
    };

    const imgElements = [];
    for (const selector of CONFIG.selectors.image) {
      try {
        card.querySelectorAll(selector).forEach((el) => imgElements.push(el));
      } catch (e) {}
    }
    if (imgElements.length === 0) {
      card.querySelectorAll('img').forEach((el) => imgElements.push(el));
    }

    for (const imgElement of imgElements) {
      pushCandidate(imgElement.getAttribute('data-src'));
      pushCandidate(imgElement.getAttribute('data-lazy-src'));
      pushCandidate(imgElement.getAttribute('data-original'));
      pushCandidate(imgElement.getAttribute('data-lazyload-src'));
      pushCandidate(imgElement.currentSrc);
      pushCandidate(imgElement.getAttribute('src'));

      const srcset = imgElement.getAttribute('srcset') || imgElement.getAttribute('data-srcset');
      if (srcset) {
        const first = String(srcset).split(',')[0].trim().split(' ')[0];
        pushCandidate(first);
      }
    }

    // 背景图兜底
    const bgNodes = card.querySelectorAll('[style*="background"]');
    bgNodes.forEach((node) => {
      const style = node.getAttribute('style') || '';
      const match = style.match(/url\((['"]?)(.*?)\1\)/i);
      if (match) pushCandidate(match[2]);
    });

    const preferred = candidates.find((url) => /alicdn\.com|cbu01\.alicdn\.com|img\.alicdn\.com/i.test(url));
    return preferred || candidates[0] || '';
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

  async function exportSelectedProducts(products, options = {}) {
    const exportFormat = options.exportFormat || 'xlsx';
    const lang = options.language || 'zh';

    showNotification(lang === 'en' ? `Exporting ${products.length} products...` : `正在导出 ${products.length} 个商品...`, 'info');

    try {
      // 交由 background service worker 下载图片并生成文件，避免页面 CORS 限制
      const result = await chrome.runtime.sendMessage({
        action: 'exportSelected',
        products,
        options: {
          exportFormat,
          language: lang,
          columns: CONFIG.columns
        }
      });

      if (!result || !result.success) {
        throw new Error(result?.message || (lang === 'en' ? 'Export failed' : '导出失败'));
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
        CONFIG.columns = { ...DEFAULT_COLUMNS, ...options.columns };
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
