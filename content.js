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
        '[data-renderkey]',
        '.offer-list-row',
        '.sm-offer-item',
        '[class*="offer-item"]',
        '[class*="OfferItem"]',
        '[class*="gallery-offer"]'
      ],
      image: [
        'img.main-img',
        'img[class*="main-img"]',
        'img[class*="offer-img"]',
        'img[class*="OfferImg"]',
        '.mojar-element-image img',
        '.offer-img-wrapper img',
        'img[src*="alicdn.com"]',
        'img[data-src*="alicdn.com"]',
        'img[data-lazy-src*="alicdn.com"]'
      ],
      link: [
        'a[href*="detail.1688.com/offer"]',
        'a[href*="offerId="]',
        'a[href*="offer"]',
        'a[href*="1688.com"]',
        'a'
      ],
      title: [
        '.title-text',
        '.offer-title',
        '[class*="title-text"]',
        '[class*="TitleText"]',
        '[class*="offer-title"]',
        'a[title]'
      ],
      shop: [
        '.desc-text',
        '.offer-desc-item .desc-text',
        '[class*="desc-text"]',
        '[class*="shop-name"]',
        '[class*="company-name"]'
      ],
      adMarkers: [
        '.cardui-adOffer',
        '[class*="adOffer"]',
        '[class*="ad-offer"]'
      ]
    }
  };

  const ADAPTER_STORAGE_KEY = 'aiAdapters';
  const ACTIVE_ADAPTER_KEY = 'activeAdapterId';

  const BUILTIN_ADAPTER = {
    id: 'builtin-1688-search-v1',
    version: '1.8.0',
    site: '1688-search',
    source: 'builtin',
    card: CONFIG.selectors.productCards.join(', '),
    fields: {
      title: CONFIG.selectors.title.slice(),
      price: ['.price-item', '[class*="price-item"]', '[class*="price"]', '[class*="Price"]'],
      sales: [
        '.col-desc_after',
        '[class*="col-desc_after"]',
        '[class*="desc_after"]',
        '[class*="sale-num"]',
        '[class*="sold-count"]',
        '[class*="offer-sale"]',
        '[class*="row-sale"]',
        '[class*="sale"]',
        '[class*="sold"]'
      ],
      shop: CONFIG.selectors.shop.slice(),
      image: CONFIG.selectors.image.slice(),
      link: CONFIG.selectors.link.slice()
    },
    filters: {
      skipCard: CONFIG.selectors.adMarkers.slice()
    }
  };

  function asSelectorList(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normalizeAdapter(raw, source) {
    if (!raw || typeof raw !== 'object') return null;
    const fields = raw.fields && typeof raw.fields === 'object' ? raw.fields : {};
    const filters = raw.filters && typeof raw.filters === 'object' ? raw.filters : {};
    const card = asSelectorList(raw.card);
    const normalized = {
      id: String(raw.id || (source === 'ai' ? 'ai-' + Date.now() : 'adapter')),
      version: String(raw.version || new Date().toISOString().slice(0, 10)),
      site: String(raw.site || '1688-search'),
      source: source || raw.source || 'custom',
      card: card.join(', '),
      fields: {
        title: asSelectorList(fields.title),
        price: asSelectorList(fields.price),
        sales: asSelectorList(fields.sales),
        shop: asSelectorList(fields.shop),
        image: asSelectorList(fields.image),
        link: asSelectorList(fields.link)
      },
      filters: {
        skipCard: asSelectorList(filters.skipCard)
      }
    };
    if (!normalized.fields.title.length && !normalized.fields.link.length && !card.length) {
      return null;
    }
    return normalized;
  }

  async function loadStoredAdapters() {
    try {
      const result = await chrome.storage.local.get([ADAPTER_STORAGE_KEY, ACTIVE_ADAPTER_KEY]);
      const list = Array.isArray(result[ADAPTER_STORAGE_KEY]) ? result[ADAPTER_STORAGE_KEY] : [];
      const adapters = list
        .map((item) => normalizeAdapter(item, item && item.source === 'builtin' ? 'builtin' : 'ai'))
        .filter(Boolean);
      return {
        adapters,
        activeAdapterId: result[ACTIVE_ADAPTER_KEY] || ''
      };
    } catch (e) {
      return { adapters: [], activeAdapterId: '' };
    }
  }

  async function getAdapterRegistry() {
    const stored = await loadStoredAdapters();
    const map = new Map();
    map.set(BUILTIN_ADAPTER.id, { ...BUILTIN_ADAPTER });
    stored.adapters.forEach((adapter) => {
      if (adapter.id === BUILTIN_ADAPTER.id) return;
      map.set(adapter.id, adapter);
    });
    // AI adapters first when active, then remaining AI, then builtin
    const all = Array.from(map.values());
    all.sort((a, b) => {
      if (a.id === stored.activeAdapterId) return -1;
      if (b.id === stored.activeAdapterId) return 1;
      if (a.source === 'ai' && b.source !== 'ai') return -1;
      if (b.source === 'ai' && a.source !== 'ai') return 1;
      return 0;
    });
    return { adapters: all, activeAdapterId: stored.activeAdapterId };
  }

  function querySelectorFirst(container, selectors) {
    for (const selector of selectors) {
      try {
        const element = container.querySelector(selector);
        if (element) return element;
      } catch (e) {}
    }
    return null;
  }

  function cleanText(text) {
    if (!text) return '';
    return String(text).replace(/[\s\n\r\t]+/g, ' ').trim();
  }

  function isAdCard(card, adapter) {
    const className = card.className || '';
    if (typeof className === 'string' &&
      (className.includes('adOffer') || className.includes('ad-offer') || className.includes('AdOffer'))) {
      return true;
    }
    const markers = (adapter && adapter.filters && adapter.filters.skipCard && adapter.filters.skipCard.length)
      ? adapter.filters.skipCard
      : CONFIG.selectors.adMarkers;
    for (const selector of markers) {
      try {
        if (card.matches && card.matches(selector)) return true;
        if (card.querySelector(selector)) return true;
      } catch (e) {}
    }
    return false;
  }

  function cleanPrice(value) {
    if (value == null) return '';
    const text = cleanText(String(value));
    if (!text) return '';
    const match = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
    return match ? match[1] : '';
  }

  function cleanSales(value) {
    if (value == null) return '0';
    let text = cleanText(String(value));
    if (!text) return '0';

    // 兼容：已售1万+ / 成交 2.3万笔 / 1000+人付款 / 1w+
    text = text
      .replace(/已售|再成交|成交|销量|付款|人付款|笔|件|次|＋|\+/gi, ' ')
      .replace(/,/g, '')
      .trim();

    const match = text.match(/([\d.]+)\s*([万千百wWkK]?)/);
    if (!match) {
      const plain = text.match(/[\d.]+/);
      return plain ? plain[0] : '0';
    }

    let num = parseFloat(match[1]);
    if (Number.isNaN(num)) return '0';
    const unit = (match[2] || '').toLowerCase();
    if (unit === '万' || unit === 'w') num *= 10000;
    else if (unit === '千') num *= 1000;
    else if (unit === '百') num *= 100;
    else if (unit === 'k') num *= 1000;

    if (num >= 10000) {
      const v = num / 10000;
      return (Math.round(v * 10) / 10) + '万';
    }
    if (Number.isInteger(num)) return String(num);
    return String(Math.round(num * 10) / 10);
  }

  function extractPrice(card, adapter) {
    const selectors = (adapter && adapter.fields && adapter.fields.price && adapter.fields.price.length)
      ? adapter.fields.price.concat(['span', 'div'])
      : [
      '.price-item',
      '[class*="price-item"]',
      '[class*="price"]',
      '[class*="Price"]',
      'span',
      'div'
    ];
    for (const selector of selectors) {
      try {
        const nodes = card.querySelectorAll(selector);
        for (const node of nodes) {
          const text = cleanText(node.textContent);
          if (!text || text.length > 30) continue;
          if (!/[¥￥]|元|\d/.test(text)) continue;
          if (!/\d/.test(text)) continue;
          // 避免把销量等字段误识别成价格
          if (/成交|已售|销量|人付款/.test(text) && !/[¥￥]/.test(text)) continue;
          const price = cleanPrice(text);
          if (price) return price;
        }
      } catch (e) {}
    }
    return '';
  }

  function extractSales(card, adapter) {
    const pickFromText = (text, { allowPureNumber = false } = {}) => {
      const cleaned = cleanText(text);
      if (!cleaned || cleaned.length > 40) return '';
      if (!/\d/.test(cleaned)) return '';
      if (/[¥￥]/.test(cleaned)) return '';
      // 明确销量语义，或 1688 常见纯数字缩写：1000+ / 1万+ / 2.3万
      const hasKeyword = /(成交|已售|销量|人付款|付款|热销|售出|月销|总销)/.test(cleaned);
      const pureNumberLike = /^[\d.,]+\s*[万千百wWkK]?\s*[+＋]?$/.test(cleaned);
      if (!hasKeyword && !pureNumberLike && !allowPureNumber) return '';
      // 稳定销量节点里即使带少量前缀，也尝试抽数字
      if (!hasKeyword && !pureNumberLike && allowPureNumber) {
        if (!/[\d.,]+\s*[万千百wWkK]?/.test(cleaned)) return '';
      }
      const sales = cleanSales(cleaned);
      return sales && sales !== '0' ? sales : '';
    };

    // 1) adapter 字段选择器 / 旧版搜索页稳定选择器
    const classicSelectors = (adapter && adapter.fields && adapter.fields.sales && adapter.fields.sales.length)
      ? adapter.fields.sales
      : [
      '.col-desc_after',
      '[class*="col-desc_after"]',
      '[class*="desc_after"]',
      '[class*="sale-num"]',
      '[class*="sold-count"]',
      '[class*="offer-sale"]',
      '[class*="row-sale"]'
    ];
    for (const selector of classicSelectors) {
      try {
        const nodes = card.querySelectorAll(selector);
        for (const node of nodes) {
          const sales = pickFromText(node.textContent, { allowPureNumber: true });
          if (sales) return sales;
        }
      } catch (e) {}
    }

    // 2) class 名像销量的节点
    const classHintSelectors = [
      '[class*="sale"]',
      '[class*="Sale"]',
      '[class*="sold"]',
      '[class*="Sold"]',
      '[class*="deal"]',
      '[class*="Deal"]',
      '[class*="volume"]',
      '[class*="trade"]'
    ];
    for (const selector of classHintSelectors) {
      try {
        const nodes = card.querySelectorAll(selector);
        for (const node of nodes) {
          const sales = pickFromText(node.textContent);
          if (sales) return sales;
        }
      } catch (e) {}
    }

    // 3) 卡片全文正则兜底
    const full = cleanText(card.textContent || '');
    const patterns = [
      /(?:已售|成交|销量)\s*([\d.,]+\s*[万千百wWkK]?\s*[+＋]?)/i,
      /([\d.,]+\s*[万千百wWkK]?\s*[+＋]?)\s*(?:人付款|付款|笔成交|成交)/i
    ];
    for (const re of patterns) {
      const m = full.match(re);
      if (m && m[1]) {
        const sales = cleanSales(m[1]);
        if (sales && sales !== '0') return sales;
      }
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

    let suffix = '';
    const qIndex = imageUrl.search(/[?#]/);
    if (qIndex >= 0) {
      suffix = imageUrl.slice(qIndex);
      imageUrl = imageUrl.slice(0, qIndex);
    }

    // 1688/alicdn 常见缩略图形态（保留第一个真实图片扩展名）
    imageUrl = imageUrl.replace(/(\.(?:jpe?g|png|gif|bmp))(?:[._].+)?$/i, '$1');
    return imageUrl + suffix;
  }

  function extractImageUrl(card, adapter) {
    const candidates = [];
    const pushCandidate = (value) => {
      if (!value) return;
      const normalized = normalizeImageUrl(value);
      if (isUsableImageUrl(normalized)) candidates.push(normalized);
    };

    const imageSelectors = (adapter && adapter.fields && adapter.fields.image && adapter.fields.image.length)
      ? adapter.fields.image
      : CONFIG.selectors.image;
    const imgElements = [];
    for (const selector of imageSelectors) {
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

    const bgNodes = card.querySelectorAll('[style*="background"]');
    bgNodes.forEach((node) => {
      const style = node.getAttribute('style') || '';
      const match = style.match(/url\((['"]?)(.*?)\1\)/i);
      if (match) pushCandidate(match[2]);
    });

    const preferred = candidates.find((url) => /alicdn\.com|cbu01\.alicdn\.com|img\.alicdn\.com/i.test(url));
    return preferred || candidates[0] || '';
  }

  function extractOfferIdFromHref(href) {
    if (!href) return '';
    const text = String(href);
    let match = text.match(/offer\/(\d+)\.html/i);
    if (match) return match[1];
    match = text.match(/offerId=(\d+)/i);
    if (match) return match[1];
    match = text.match(/[?&]offer[=/](\d+)/i);
    if (match) return match[1];
    return '';
  }

  function extractLink(card, adapter) {
    const preferredSelectors = (adapter && adapter.fields && adapter.fields.link && adapter.fields.link.length)
      ? adapter.fields.link
      : [];
    for (const selector of preferredSelectors) {
      try {
        const nodes = card.querySelectorAll(selector);
        for (const link of nodes) {
          const href = link.href || link.getAttribute('href') || '';
          const id = extractOfferIdFromHref(href);
          if (id) {
            if (href.includes('detail.1688.com')) return href.split('?')[0];
            return `https://detail.1688.com/offer/${id}.html`;
          }
        }
      } catch (e) {}
    }

    const allLinks = card.querySelectorAll('a[href]');
    let offerId = null;

    for (const link of allLinks) {
      const href = link.href || '';
      const id = extractOfferIdFromHref(href);
      if (id) {
        offerId = id;
        if (!href.includes('similar_search') && !href.includes('air.1688.com')) {
          if (href.includes('detail.1688.com')) return href.split('?')[0];
        }
      }
    }

    if (offerId) return `https://detail.1688.com/offer/${offerId}.html`;

    for (const link of allLinks) {
      const href = link.href || '';
      if (href.includes('detail.1688.com/offer/') && !href.includes('similar_search')) {
        return href.split('?')[0];
      }
    }
    return '';
  }

  function extractTitle(card, adapter) {
    const titleSelectors = (adapter && adapter.fields && adapter.fields.title && adapter.fields.title.length)
      ? adapter.fields.title
      : CONFIG.selectors.title;
    for (const selector of titleSelectors) {
      try {
        const titleEl = card.querySelector(selector);
        if (!titleEl) continue;
        if (selector === 'a[title]') {
          const title = cleanText(titleEl.title || '');
          if (title && !title.includes('旺旺')) return title;
          continue;
        }
        const text = cleanText(titleEl.textContent);
        if (text && text.length > 2 && !text.includes('旺旺')) return text;
      } catch (e) {}
    }

    const imgElement = querySelectorFirst(card, (adapter && adapter.fields && adapter.fields.image) || CONFIG.selectors.image);
    if (imgElement) {
      const alt = imgElement.getAttribute('alt');
      if (alt) return cleanText(alt);
    }

    const titleEl = card.querySelector('[class*="title"]');
    if (titleEl) {
      const text = cleanText(titleEl.textContent);
      if (text && text.length > 3 && !text.includes('旺旺')) return text;
    }
    return '';
  }

  function extractShopName(card, adapter) {
    const shopLink = card.querySelector('.offer-shop-row .offer-desc-item[href*=".1688.com"]');
    if (shopLink) {
      const textEl = shopLink.querySelector('.desc-text');
      return textEl ? cleanText(textEl.textContent) : cleanText(shopLink.textContent);
    }

    const shopSelectors = (adapter && adapter.fields && adapter.fields.shop && adapter.fields.shop.length)
      ? adapter.fields.shop
      : CONFIG.selectors.shop;
    for (const selector of shopSelectors) {
      try {
        const el = card.querySelector(selector);
        if (!el) continue;
        const text = cleanText(el.textContent);
        if (text && text.length > 1 && text.length < 80) return text;
      } catch (e) {}
    }
    return '';
  }

  function extractProductData(card, index, adapter) {
    const link = extractLink(card, adapter);
    const offerId = extractOfferIdFromHref(link);
    return {
      序号: index + 1,
      商品标题: extractTitle(card, adapter),
      价格: extractPrice(card, adapter),
      销量: extractSales(card, adapter),
      店铺名称: extractShopName(card, adapter),
      图片链接: extractImageUrl(card, adapter),
      商品链接: link,
      _offerId: offerId || undefined,
      _adapterId: adapter && adapter.id ? adapter.id : undefined
    };
  }

  function findProductCardsBySelectors(adapter) {
    const cardSelectors = adapter && adapter.card
      ? asSelectorList(adapter.card)
      : CONFIG.selectors.productCards;
    for (const selector of cardSelectors) {
      try {
        const cards = document.querySelectorAll(selector);
        if (cards.length > 0) return Array.from(cards);
      } catch (e) {}
    }
    return [];
  }

  function scoreCardElement(el) {
    if (!el || el.closest('script, style, noscript')) return -1;
    const text = cleanText(el.textContent || '');
    if (text.length < 8 || text.length > 2000) return -1;

    let score = 0;
    const hasOfferLink = !!el.querySelector('a[href*="detail.1688.com/offer"], a[href*="offerId="]');
    const hasImage = !!el.querySelector('img[src*="alicdn"], img[data-src*="alicdn"], img');
    const hasPriceLike = /[¥￥]\s*\d|\d+(\.\d+)?\s*元/.test(text);

    if (hasOfferLink) score += 4;
    if (hasImage) score += 2;
    if (hasPriceLike) score += 2;
    if (/(成交|已售|销量)/.test(text)) score += 1;
    return score;
  }

  function findProductCardsHeuristic() {
    const anchors = Array.from(document.querySelectorAll('a[href*="detail.1688.com/offer"], a[href*="offerId="]'));
    const scored = new Map();

    anchors.forEach((anchor) => {
      let node = anchor;
      for (let depth = 0; depth < 6 && node; depth++) {
        node = node.parentElement;
        if (!node || node === document.body || node === document.documentElement) break;
        const score = scoreCardElement(node);
        if (score < 5) continue;
        const prev = scored.get(node) || 0;
        if (score > prev) scored.set(node, score);
      }
    });

    const cards = Array.from(scored.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([el]) => el)
      .filter((el, idx, arr) => !arr.some((other, j) => j !== idx && other.contains(el)));

    return cards;
  }

  function findProductCards(adapter) {
    const bySelector = findProductCardsBySelectors(adapter);
    if (bySelector.length > 0) return bySelector;
    // 仅内置路径允许启发式兜底，避免 AI 坏规则被启发式掩盖后无法察觉
    if (!adapter || adapter.source === 'builtin' || adapter.id === BUILTIN_ADAPTER.id) {
      return findProductCardsHeuristic();
    }
    return [];
  }

  function scoreProduct(product) {
    let score = 0;
    if (product.商品标题) score += 2;
    if (product.价格) score += 2;
    if (product.图片链接) score += 2;
    if (product.商品链接) score += 2;
    if (product.店铺名称) score += 1;
    if (product.销量 && product.销量 !== '0') score += 1;
    return score;
  }

  function dedupeProducts(products) {
    const result = [];
    const seen = new Set();
    for (const product of products) {
      const offerId = product._offerId || extractOfferIdFromHref(product.商品链接);
      const key = offerId
        ? `id:${offerId}`
        : `t:${product.商品标题 || ''}|p:${product.价格 || ''}|s:${product.店铺名称 || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (offerId) product._offerId = offerId;
      result.push(product);
    }
    return result;
  }

  function buildQualityReport(products, cardCount) {
    const total = products.length;
    if (total === 0) {
      return {
        ok: false,
        total: 0,
        cardCount,
        score: 0,
        missing: { title: 0, price: 0, image: 0, link: 0 },
        message: cardCount > 0
          ? '检测到疑似商品卡片，但未能提取有效字段，页面结构可能已更新'
          : '未找到商品卡片，请确认当前是 1688 搜索结果页，并向下滚动加载商品'
      };
    }

    const missing = {
      title: products.filter((p) => !p.商品标题).length,
      price: products.filter((p) => !p.价格).length,
      image: products.filter((p) => !p.图片链接).length,
      link: products.filter((p) => !p.商品链接).length
    };
    const avgScore = products.reduce((sum, p) => sum + scoreProduct(p), 0) / total;
    const missingRate = (missing.price + missing.image + missing.link) / (total * 3);
    const ok = avgScore >= 4 && missingRate < 0.6;

    return {
      ok,
      total,
      cardCount,
      score: Math.round(avgScore * 10) / 10,
      missing,
      message: ok
        ? `成功提取 ${total} 个商品`
        : `已提取 ${total} 个商品，但部分字段缺失较多（价格缺失 ${missing.price}，图片缺失 ${missing.image}）`
    };
  }

  function extractProductsWithAdapter(adapter) {
    const productCards = findProductCards(adapter);
    const products = [];
    let validCount = 0;
    const maxCount = CONFIG.maxProducts > 0 ? CONFIG.maxProducts : Infinity;

    for (let i = 0; i < productCards.length && validCount < maxCount; i++) {
      const card = productCards[i];
      if (CONFIG.filterAds && isAdCard(card, adapter)) continue;

      const productData = extractProductData(card, validCount, adapter);
      if (productData.商品标题 || productData.商品链接 || productData.图片链接) {
        products.push(productData);
        validCount++;
      }
    }

    const deduped = dedupeProducts(products).map((item, index) => ({
      ...item,
      序号: index + 1
    }));
    const quality = buildQualityReport(deduped, productCards.length);
    quality.adapterId = adapter && adapter.id ? adapter.id : '';
    quality.adapterSource = adapter && adapter.source ? adapter.source : '';
    return { products: deduped, quality, cardCount: productCards.length, adapter };
  }

  function rankExtraction(result) {
    if (!result || !result.quality) return -1;
    const q = result.quality;
    const total = q.total || 0;
    if (total === 0) return 0;
    const avg = Number(q.score) || 0;
    const missing = q.missing || {};
    const missingPenalty = ((missing.price || 0) + (missing.image || 0) + (missing.link || 0)) / (total * 3);
    return total * 10 + avg * 5 - missingPenalty * 20 + (q.ok ? 5 : 0);
  }

  async function extractProducts() {
    console.log('[1688智能选品助手] 开始提取商品数据...');
    const registry = await getAdapterRegistry();
    const attempts = [];
    let best = null;

    for (const adapter of registry.adapters) {
      try {
        const result = extractProductsWithAdapter(adapter);
        attempts.push({
          adapterId: adapter.id,
          source: adapter.source,
          total: result.quality.total,
          score: result.quality.score,
          ok: result.quality.ok,
          rank: rankExtraction(result)
        });
        if (!best || rankExtraction(result) > rankExtraction(best)) {
          best = result;
        }
      } catch (error) {
        attempts.push({
          adapterId: adapter.id,
          source: adapter.source,
          error: error.message || String(error),
          rank: -1
        });
      }
    }

    if (!best) {
      best = {
        products: [],
        quality: {
          ok: false,
          total: 0,
          cardCount: 0,
          score: 0,
          missing: { title: 0, price: 0, image: 0, link: 0 },
          message: '未找到商品卡片，请确认当前是 1688 搜索结果页，并向下滚动加载商品'
        }
      };
    }

    best.quality.attempts = attempts;
    best.quality.suggestAiRepair = !best.quality.ok || best.products.length === 0;
    if (best.products.length === 0) {
      best.quality.message = best.quality.message || '未能识别到商品卡片，页面结构可能已更新';
      best.quality.aiHint = '无法正常提取信息？试试 AI 分析模式吧';
    } else if (!best.quality.ok) {
      best.quality.aiHint = '无法正常提取信息？试试 AI 分析模式吧';
    }

    console.log('[1688智能选品助手] 提取完成:', best.quality);
    return best;
  }

  function simplifyCardHtml(card) {
    const clone = card.cloneNode(true);
    clone.querySelectorAll('script, style, noscript, svg, iframe').forEach((el) => el.remove());
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
    const toClean = [];
    while (walker.nextNode()) toClean.push(walker.currentNode);
    toClean.forEach((el) => {
      [...el.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const keep = name === 'class' || name === 'id' || name === 'href' || name === 'src' ||
          name === 'data-src' || name === 'data-lazy-src' || name === 'title' || name === 'alt' ||
          name === 'data-renderkey' || name.startsWith('data-offer');
        if (!keep) el.removeAttribute(attr.name);
      });
      if (el.childNodes && el.childNodes.length > 40) {
        // keep structure shallow for token budget
      }
    });
    let html = clone.outerHTML || '';
    html = html.replace(/\s+/g, ' ').trim();
    if (html.length > 4500) html = html.slice(0, 4500) + '<!--truncated-->';
    return html;
  }

  function sampleDOMForRepair(maxCards) {
    const limit = Math.max(1, Math.min(3, maxCards || 3));
    let cards = findProductCardsBySelectors(BUILTIN_ADAPTER);
    if (cards.length === 0) cards = findProductCardsHeuristic();
    if (cards.length === 0) {
      // last resort: offer anchors' parents
      const anchors = Array.from(document.querySelectorAll('a[href*="detail.1688.com/offer"], a[href*="offerId="]')).slice(0, limit);
      cards = anchors.map((a) => a.closest('[class]') || a.parentElement).filter(Boolean);
    }
    const samples = [];
    const seen = new Set();
    for (const card of cards) {
      if (!card || seen.has(card)) continue;
      seen.add(card);
      samples.push({
        html: simplifyCardHtml(card),
        text: cleanText(card.textContent || '').slice(0, 300)
      });
      if (samples.length >= limit) break;
    }
    return {
      url: location.href,
      title: document.title || '',
      sampleCount: samples.length,
      samples
    };
  }

  function dryRunAdapter(rawAdapter) {
    const adapter = normalizeAdapter(rawAdapter, rawAdapter && rawAdapter.source === 'builtin' ? 'builtin' : 'ai');
    if (!adapter) {
      return {
        success: false,
        message: '适配器格式无效',
        products: [],
        quality: { ok: false, total: 0, message: '适配器格式无效' }
      };
    }
    const result = extractProductsWithAdapter(adapter);
    return {
      success: result.products.length > 0,
      adapter,
      products: result.products,
      quality: result.quality,
      message: result.quality.message,
      rank: rankExtraction(result)
    };
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

      extractProducts().then((result) => {
        const products = result.products || [];
        const quality = result.quality || {};
        sendResponse({
          success: products.length > 0,
          products,
          quality,
          message: quality.message,
          aiHint: quality.aiHint || '',
          suggestAiRepair: !!quality.suggestAiRepair
        });
      }).catch((error) => {
        sendResponse({
          success: false,
          products: [],
          quality: { ok: false, total: 0, message: error.message || String(error), suggestAiRepair: true },
          message: error.message || String(error),
          aiHint: '无法正常提取信息？试试 AI 分析模式吧',
          suggestAiRepair: true
        });
      });
      return true;
    }

    if (request.action === 'sampleDOMForRepair') {
      try {
        const sample = sampleDOMForRepair(request.maxCards || 3);
        sendResponse({ success: sample.sampleCount > 0, sample, message: sample.sampleCount ? 'ok' : '未找到可分析的商品样本' });
      } catch (error) {
        sendResponse({ success: false, message: error.message || String(error) });
      }
      return true;
    }

    if (request.action === 'dryRunAdapter') {
      try {
        const result = dryRunAdapter(request.adapter);
        sendResponse(result);
      } catch (error) {
        sendResponse({ success: false, message: error.message || String(error), products: [], quality: { ok: false, total: 0 } });
      }
      return true;
    }

    if (request.action === 'getAdapterStatus') {
      getAdapterRegistry().then((registry) => {
        sendResponse({
          success: true,
          activeAdapterId: registry.activeAdapterId || BUILTIN_ADAPTER.id,
          adapters: registry.adapters.map((a) => ({ id: a.id, source: a.source, version: a.version, site: a.site }))
        });
      }).catch((error) => {
        sendResponse({ success: false, message: error.message || String(error) });
      });
      return true;
    }

    if (request.action === 'exportSelected') {
      exportSelectedProducts(request.products, request.options).then((result) => {
        sendResponse(result);
      });
      return true;
    }

    if (request.action === 'ping') {
      sendResponse({ status: 'ready' });
      return true;
    }
  });

  console.log('[1688智能选品助手] 内容脚本已加载 v1.8.0');
})();
