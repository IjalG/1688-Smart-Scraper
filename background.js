/**
 * 1688 智能选品助手 - Background Service Worker
 * 负责配置读取、图片下载（绕过页面 CORS）、Excel 生成与文件下载
 */

importScripts('exceljs.min.js');

const ALL_COLUMNS = ['序号', '图片', '商品标题', '价格', '销量', '店铺名称', '商品链接'];
const DEFAULT_COLUMNS = {
  '序号': true, '图片': true, '商品标题': true,
  '价格': true, '销量': true, '店铺名称': true, '商品链接': true
};

const IMAGE_SIZE_PRESETS = {
  80: { px: 80, colWidth: 14, rowHeight: 72 },
  120: { px: 120, colWidth: 22, rowHeight: 110 },
  160: { px: 160, colWidth: 28, rowHeight: 145 }
};

const I18N = {
  zh: {
    cols: { '序号': '序号', '图片': '图片', '商品标题': '商品标题', '价格': '价格(元)', '销量': '销量', '店铺名称': '店铺名称', '商品链接': '商品链接' },
    titleProducts: '1688 商品数据',
    titleCollection: '1688 收藏夹数据',
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
    value: '值',
    noImage: '无图'
  },
  en: {
    cols: { '序号': 'No.', '图片': 'Image', '商品标题': 'Title', '价格': 'Price (CNY)', '销量': 'Sales', '店铺名称': 'Shop', '商品链接': 'Link' },
    titleProducts: '1688 Product Data',
    titleCollection: '1688 Collection Data',
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
    value: 'Value',
    noImage: 'No image'
  }
};

function getDict(lang) {
  return I18N[lang] || I18N.zh;
}

function getTimestampParts() {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');
  const timeStr = now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0');
  return { dateStr, timeStr };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function guessImageExtension(url, contentType) {
  const type = (contentType || '').toLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'png';
  if (type.includes('gif')) return 'gif';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpeg';

  const lowerUrl = (url || '').toLowerCase();
  if (lowerUrl.includes('.png')) return 'png';
  if (lowerUrl.includes('.gif')) return 'gif';
  if (lowerUrl.includes('.webp')) return 'png';
  if (lowerUrl.startsWith('data:image/png')) return 'png';
  if (lowerUrl.startsWith('data:image/gif')) return 'gif';
  return 'jpeg';
}

function normalizeImageUrl(url) {
  if (!url) return '';
  let imageUrl = String(url).trim();
  if (!imageUrl) return '';

  // 用户拖入/粘贴的 data URL 直接保留
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

function buildImageCandidates(url) {
  const raw = String(url || '').trim();
  if (!raw) return [];

  const candidates = [];
  const push = (value) => {
    if (!value) return;
    let next = String(value).trim();
    if (!next) return;
    if (next.startsWith('//')) next = 'https:' + next;
    if (next.startsWith('http://')) next = 'https://' + next.slice(7);
    if (!candidates.includes(next)) candidates.push(next);
  };

  if (raw.startsWith('data:image/')) {
    push(raw);
    return candidates;
  }

  const base = normalizeImageUrl(raw);
  push(base);

  if (base && /\.(jpe?g|png)$/i.test(base)) {
    push(base + '_300x300q90.jpg');
    push(base + '_300x300.jpg');
    push(base + '_sum.jpg');
    push(base + '_b.jpg');
    push(base + '_.webp');
  }

  push(raw);
  return candidates;
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    base64: match[2],
    extension: guessImageExtension(dataUrl, match[1])
  };
}

async function fetchImageAsBase64(imageUrl) {
  if (String(imageUrl).startsWith('data:image/')) {
    const parsed = parseDataUrl(imageUrl);
    if (!parsed) throw new Error('Invalid data URL');
    return parsed;
  }

  const response = await fetch(imageUrl, {
    method: 'GET',
    credentials: 'omit',
    cache: 'no-cache',
    headers: {
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
    throw new Error(`Unexpected content-type: ${contentType}`);
  }

  const buffer = await response.arrayBuffer();
  if (!buffer || buffer.byteLength < 32) {
    throw new Error('Empty image body');
  }

  return {
    base64: arrayBufferToBase64(buffer),
    extension: guessImageExtension(imageUrl, contentType)
  };
}

async function imageToBase64(url) {
  const candidates = buildImageCandidates(url);
  if (candidates.length === 0) return null;

  let lastError = null;
  for (const imageUrl of candidates) {
    try {
      return await fetchImageAsBase64(imageUrl);
    } catch (error) {
      lastError = error;
      console.warn('[1688 Smart Scraper] Image download failed:', imageUrl, error && error.message ? error.message : error);
    }
  }

  console.warn('[1688 Smart Scraper] All image candidates failed:', url, lastError);
  return null;
}

function resolveImageSize(size) {
  const key = Number(size) || 120;
  return IMAGE_SIZE_PRESETS[key] || IMAGE_SIZE_PRESETS[120];
}

async function loadSettings() {
  const result = await chrome.storage.sync.get('settings');
  const settings = result.settings || {};
  return {
    exportFormat: settings.exportFormat || 'xlsx',
    columns: { ...DEFAULT_COLUMNS, ...(settings.columns || {}) },
    language: settings.language || 'zh',
    imageSize: Number(settings.imageSize) || 120
  };
}

async function downloadBlob(blob, filename) {
  // MV3 service worker 里 URL.createObjectURL 可能不存在；
  // 优先 data URL，失败再尝试 object URL。
  const buffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  const mime = blob.type || 'application/octet-stream';
  const dataUrl = `data:${mime};base64,${base64}`;

  try {
    await chrome.downloads.download({
      url: dataUrl,
      filename,
      saveAs: false
    });
    return;
  } catch (dataUrlError) {
    console.warn('[1688 Smart Scraper] data URL download failed, try object URL:', dataUrlError);
  }

  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const objectUrl = URL.createObjectURL(blob);
    try {
      await chrome.downloads.download({
        url: objectUrl,
        filename,
        saveAs: false
      });
      return;
    } finally {
      setTimeout(() => {
        try { URL.revokeObjectURL(objectUrl); } catch (e) {}
      }, 60_000);
    }
  }

  throw new Error('Download API unavailable in service worker');
}

async function notifyProgress(tabId, payload) {
  const message = {
    action: 'exportProgress',
    ...payload
  };

  // 选择页是扩展页面，tabs.sendMessage 只打到 content script；
  // 这里同时走 runtime 广播，保证 select.html 能收到进度。
  try {
    await chrome.runtime.sendMessage(message);
  } catch (e) {
    // no other extension page listening
  }

  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {
    // content page may be closed; ignore
  }
}

async function downloadImagesWithProgress(products, includeImages, tabId) {
  if (!includeImages) {
    return products.map(() => null);
  }

  const results = [];
  const total = products.length;
  for (let i = 0; i < total; i++) {
    await notifyProgress(tabId, {
      stage: 'image',
      current: i + 1,
      total,
      message: `Downloading images ${i + 1}/${total}`
    });
    const product = products[i];
    if (!product.图片链接) {
      results.push(null);
      continue;
    }
    results.push(await imageToBase64(product.图片链接));
  }
  return results;
}

async function generateXLSX(products, columns, lang, title, imageSize, tabId) {
  const dict = getDict(lang);
  const size = resolveImageSize(imageSize);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '1688 Smart Scraper';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Products', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  const colKeys = ALL_COLUMNS.filter((key) => columns[key]);
  const colWidths = {
    '序号': 8,
    '图片': size.colWidth,
    '商品标题': 50,
    '价格': 12,
    '销量': 12,
    '店铺名称': 25,
    '商品链接': 40
  };

  worksheet.columns = colKeys.map((key) => ({
    header: dict.cols[key],
    key,
    width: colWidths[key] || 20
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

  const includeImages = !!columns['图片'];
  const imageResults = await downloadImagesWithProgress(products, includeImages, tabId);

  await notifyProgress(tabId, {
    stage: 'workbook',
    current: products.length,
    total: products.length,
    message: 'Building workbook'
  });

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const rowNum = i + 2;
    const rowData = {};
    const imageInfo = imageResults[i];

    colKeys.forEach((key) => {
      if (key === '图片') {
        rowData[key] = imageInfo && imageInfo.base64 ? '' : (product.图片链接 ? dict.noImage : '');
      } else {
        rowData[key] = product[key] || '';
      }
    });

    const row = worksheet.addRow(rowData);
    row.height = includeImages ? size.rowHeight : 28;

    colKeys.forEach((key) => {
      const cell = row.getCell(key);
      if (key === '商品标题') {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      } else if (key === '图片' && !(imageInfo && imageInfo.base64)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { color: { argb: 'FF999999' }, italic: true };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });

    if (includeImages && imageInfo && imageInfo.base64) {
      try {
        const imageId = workbook.addImage({
          base64: imageInfo.base64,
          extension: imageInfo.extension || 'jpeg'
        });
        const imgColIdx = colKeys.indexOf('图片');
        if (imgColIdx >= 0) {
          const pad = Math.max(0.08, (size.px > 120 ? 0.08 : 0.1));
          worksheet.addImage(imageId, {
            tl: { col: imgColIdx + pad, row: rowNum - 1 + pad },
            ext: { width: size.px, height: size.px },
            editAs: 'oneCell'
          });
        }
      } catch (error) {
        console.warn('[1688 Smart Scraper] Failed to embed image:', error);
        const imgCell = row.getCell('图片');
        if (imgCell) {
          imgCell.value = dict.noImage;
          imgCell.font = { color: { argb: 'FF999999' }, italic: true };
          imgCell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      }
    }
  }

  void title;
  return workbook.xlsx.writeBuffer();
}

function generateMarkdown(products, columns, lang, title) {
  const dict = getDict(lang);
  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  let md = `# ${title}\n\n`;
  md += `> ${dict.exportTime}: ${new Date().toLocaleString(locale)}\n`;
  md += `> ${dict.productCount}: ${products.length}\n\n`;
  md += '---\n\n';

  for (const product of products) {
    md += `## ${product.序号}. ${product.商品标题 || dict.unknown}\n\n`;
    if (columns['图片'] && product.图片链接) {
      md += `![Product](${product.图片链接})\n\n`;
    } else if (columns['图片']) {
      md += `*${dict.noImage}*\n\n`;
    }
    md += `| ${dict.attr} | ${dict.value} |\n| --- | --- |\n`;
    if (columns['价格']) md += `| ${dict.price} | ${product.价格 || '-'} ${dict.yuan} |\n`;
    if (columns['销量']) md += `| ${dict.sales} | ${product.销量 || '0'} |\n`;
    if (columns['店铺名称']) md += `| ${dict.shop} | ${product.店铺名称 || '-'} |\n`;
    if (columns['商品链接'] && product.商品链接) {
      md += `| ${dict.link} | [${dict.viewProduct}](${product.商品链接}) |\n`;
    }
    md += '\n---\n\n';
  }

  return md;
}

async function exportProducts(products, options = {}) {
  const settings = await loadSettings();
  const exportFormat = options.exportFormat || settings.exportFormat || 'xlsx';
  const columns = { ...settings.columns, ...(options.columns || {}) };
  const lang = options.language || settings.language || 'zh';
  const mode = options.mode || 'products';
  const imageSize = options.imageSize || settings.imageSize || 120;
  const tabId = options.tabId || null;
  const dict = getDict(lang);
  const title = mode === 'collection' ? dict.titleCollection : dict.titleProducts;

  const productsWithIndex = (products || []).map((p, i) => ({
    ...p,
    序号: i + 1,
    图片链接: normalizeImageUrl(p && p.图片链接),
    价格: p && p.价格 != null ? String(p.价格).trim() : ''
  }));

  const { dateStr, timeStr } = getTimestampParts();
  const prefix = mode === 'collection' ? '1688_collection' : '1688_products';

  await notifyProgress(tabId, {
    stage: 'start',
    current: 0,
    total: productsWithIndex.length,
    message: 'Export started'
  });

  if (exportFormat === 'xlsx') {
    const buffer = await generateXLSX(productsWithIndex, columns, lang, title, imageSize, tabId);
    await notifyProgress(tabId, {
      stage: 'download',
      current: productsWithIndex.length,
      total: productsWithIndex.length,
      message: 'Saving file'
    });
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    await downloadBlob(blob, `${prefix}_${dateStr}_${timeStr}.xlsx`);
  } else {
    const markdown = generateMarkdown(productsWithIndex, columns, lang, title);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    await downloadBlob(blob, `${prefix}_${dateStr}_${timeStr}.md`);
  }

  await notifyProgress(tabId, {
    stage: 'done',
    current: productsWithIndex.length,
    total: productsWithIndex.length,
    message: 'Export completed'
  });

  return { success: true, count: productsWithIndex.length };
}

const ADAPTER_STORAGE_KEY = 'aiAdapters';
const ACTIVE_ADAPTER_KEY = 'activeAdapterId';
const BUILTIN_ADAPTER_ID = 'builtin-1688-search-v1';

function asSelectorList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeAdapter(raw, source) {
  if (!raw || typeof raw !== 'object') return null;
  const fields = raw.fields && typeof raw.fields === 'object' ? raw.fields : {};
  const filters = raw.filters && typeof raw.filters === 'object' ? raw.filters : {};
  const card = asSelectorList(raw.card);
  const adapter = {
    id: String(raw.id || `ai-${Date.now()}`),
    version: String(raw.version || new Date().toISOString().slice(0, 10)),
    site: String(raw.site || '1688-search'),
    source: source || raw.source || 'ai',
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
    },
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
  if (!adapter.card && !adapter.fields.title.length && !adapter.fields.link.length) return null;
  return adapter;
}

function extractJsonObject(text) {
  if (!text) return null;
  const raw = String(text).trim();
  try {
    return JSON.parse(raw);
  } catch (e) {}

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch (e) {}
  }

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (e) {}
  }
  return null;
}

async function loadAiSettings() {
  const result = await chrome.storage.sync.get('settings');
  const settings = result.settings || {};
  return {
    language: settings.language || 'zh',
    aiApiKey: settings.aiApiKey || '',
    aiBaseUrl: (settings.aiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, ''),
    aiModel: settings.aiModel || 'gpt-4o-mini'
  };
}

async function loadAdapterState() {
  const result = await chrome.storage.local.get([ADAPTER_STORAGE_KEY, ACTIVE_ADAPTER_KEY]);
  const adapters = Array.isArray(result[ADAPTER_STORAGE_KEY]) ? result[ADAPTER_STORAGE_KEY] : [];
  return {
    adapters: adapters.map((item) => normalizeAdapter(item, item && item.source === 'builtin' ? 'builtin' : 'ai')).filter(Boolean),
    activeAdapterId: result[ACTIVE_ADAPTER_KEY] || ''
  };
}

async function saveAdapterState(adapters, activeAdapterId) {
  await chrome.storage.local.set({
    [ADAPTER_STORAGE_KEY]: adapters,
    [ACTIVE_ADAPTER_KEY]: activeAdapterId || ''
  });
}

async function sendTabMessage(tabId, message) {
  if (!tabId) throw new Error('缺少页面标签');
  return chrome.tabs.sendMessage(tabId, message);
}

function buildRepairPrompt(sample) {
  return [
    'You are repairing CSS selector extraction rules for 1688.com product search cards.',
    'Return ONLY a JSON object with this shape:',
    '{',
    '  "version": "YYYY-MM-DD",',
    '  "site": "1688-search",',
    '  "card": "css selectors for product card root, comma separated or array",',
    '  "fields": {',
    '    "title": ["..."],',
    '    "price": ["..."],',
    '    "sales": ["..."],',
    '    "shop": ["..."],',
    '    "image": ["..."],',
    '    "link": ["..."]',
    '  },',
    '  "filters": { "skipCard": ["ad selectors"] }',
    '}',
    'Rules:',
    '- Prefer stable class/href patterns over brittle absolute paths.',
    '- card selectors must match repeated product cards.',
    '- link selectors should point to detail.1688.com/offer or offerId.',
    '- image selectors should find alicdn product images.',
    '- Do not invent product data; only selectors.',
    '- Keep selector lists short (1-6 each).',
    '',
    `Page URL: ${sample.url || ''}`,
    `Page title: ${sample.title || ''}`,
    'Sample cards:'
  ].concat((sample.samples || []).map((item, index) => {
    return `\n[Sample ${index + 1} text]\n${item.text || ''}\n[Sample ${index + 1} html]\n${item.html || ''}`;
  })).join('\n');
}

async function callLlmForAdapter(sample, aiSettings) {
  if (!aiSettings.aiApiKey) {
    throw new Error('未配置 AI API Key。请在扩展设置中填写后再试。');
  }
  const endpoint = `${aiSettings.aiBaseUrl}/chat/completions`;
  try {
    if (chrome.permissions && chrome.permissions.contains && chrome.permissions.request) {
      const origin = new URL(aiSettings.aiBaseUrl).origin + '/*';
      const has = await chrome.permissions.contains({ origins: [origin] });
      if (!has) {
        const granted = await chrome.permissions.request({ origins: [origin] });
        if (!granted) {
          throw new Error('未授予 AI 接口域名访问权限，请允许后重试');
        }
      }
    }
  } catch (permError) {
    if (String(permError.message || permError).includes('未授予')) throw permError;
    // service worker 中 request 可能受限，继续尝试 fetch
    console.warn('[1688 Smart Scraper] permission request skipped', permError);
  }
  const body = {
    model: aiSettings.aiModel,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You generate reusable CSS selector adapters for 1688 product cards. Output JSON only.'
      },
      {
        role: 'user',
        content: buildRepairPrompt(sample)
      }
    ]
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aiSettings.aiApiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`AI 请求失败 (${response.status}): ${errText.slice(0, 240) || response.statusText}`);
  }

  const data = await response.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  const parsed = extractJsonObject(content);
  if (!parsed) throw new Error('AI 返回无法解析为 JSON 适配器');
  return parsed;
}

function qualityRank(quality, productCount) {
  if (!quality) return productCount > 0 ? productCount : 0;
  const total = quality.total || productCount || 0;
  if (total === 0) return 0;
  const avg = Number(quality.score) || 0;
  const missing = quality.missing || {};
  const missingPenalty = ((missing.price || 0) + (missing.image || 0) + (missing.link || 0)) / (total * 3);
  return total * 10 + avg * 5 - missingPenalty * 20 + (quality.ok ? 5 : 0);
}

async function runAiRepair(tabId) {
  if (!tabId) throw new Error('缺少 1688 页面标签，无法采样 DOM');
  const aiSettings = await loadAiSettings();
  const sampleResp = await sendTabMessage(tabId, { action: 'sampleDOMForRepair', maxCards: 3 });
  if (!sampleResp || !sampleResp.success || !sampleResp.sample || !sampleResp.sample.sampleCount) {
    throw new Error((sampleResp && sampleResp.message) || '未找到可分析的商品样本，请先滚动加载商品');
  }

  // baseline with current best rules
  let baseline = { products: [], quality: { total: 0, score: 0, ok: false }, rank: 0 };
  try {
    const current = await sendTabMessage(tabId, {
      action: 'getProducts',
      options: { maxProducts: 0, filterAds: true }
    });
    baseline = {
      products: (current && current.products) || [],
      quality: (current && current.quality) || { total: 0, ok: false },
      rank: qualityRank(current && current.quality, (current && current.products && current.products.length) || 0)
    };
  } catch (e) {}

  const rawAdapter = await callLlmForAdapter(sampleResp.sample, aiSettings);
  const candidate = normalizeAdapter({
    ...rawAdapter,
    id: `ai-1688-${Date.now()}`,
    source: 'ai'
  }, 'ai');
  if (!candidate) throw new Error('AI 生成的适配器无效');

  const dry = await sendTabMessage(tabId, { action: 'dryRunAdapter', adapter: candidate });
  if (!dry || !dry.success || !dry.products || dry.products.length === 0) {
    return {
      success: false,
      message: (dry && dry.message) || 'AI 规则 dry-run 未提取到商品，未保存',
      dryRun: dry || null,
      baselineRank: baseline.rank
    };
  }

  const newRank = typeof dry.rank === 'number' ? dry.rank : qualityRank(dry.quality, dry.products.length);
  if (newRank < baseline.rank) {
    return {
      success: false,
      message: `AI 规则未优于现有规则（新评分 ${newRank.toFixed(1)} < 旧评分 ${baseline.rank.toFixed(1)}），未保存`,
      dryRun: dry,
      baselineRank: baseline.rank,
      newRank
    };
  }

  const state = await loadAdapterState();
  const adapters = state.adapters.filter((item) => item.source !== 'ai' || item.id !== candidate.id);
  // keep only latest few AI adapters
  const nonAi = adapters.filter((item) => item.source !== 'ai');
  const aiList = adapters.filter((item) => item.source === 'ai');
  const nextAi = [candidate].concat(aiList).slice(0, 5);
  await saveAdapterState(nonAi.concat(nextAi), candidate.id);

  return {
    success: true,
    message: `修复完成，已重新提取并保存规则（${dry.products.length} 个商品）`,
    adapter: candidate,
    products: dry.products,
    quality: dry.quality,
    baselineRank: baseline.rank,
    newRank
  };
}

async function clearAiAdapters() {
  const state = await loadAdapterState();
  const kept = state.adapters.filter((item) => item.source !== 'ai');
  await saveAdapterState(kept, '');
  return { success: true, message: '已清除 AI 规则并回退内置规则', activeAdapterId: BUILTIN_ADAPTER_ID };
}

async function getAdapterInfo() {
  const state = await loadAdapterState();
  return {
    success: true,
    activeAdapterId: state.activeAdapterId || BUILTIN_ADAPTER_ID,
    adapters: state.adapters.map((item) => ({
      id: item.id,
      source: item.source,
      version: item.version,
      site: item.site,
      updatedAt: item.updatedAt || ''
    }))
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getConfig') {
    chrome.storage.sync.get('settings', (result) => {
      sendResponse({ config: result.settings || {} });
    });
    return true;
  }

  if (request.action === 'exportFromCollection' || request.action === 'exportSelected') {
    const mode = request.action === 'exportFromCollection' ? 'collection' : 'products';
    const tabId = (request.options && request.options.tabId) || (sender && sender.tab && sender.tab.id) || null;
    exportProducts(request.products || [], {
      ...(request.options || {}),
      mode,
      tabId
    }).then((result) => {
      sendResponse(result);
    }).catch((error) => {
      console.error('[1688 Smart Scraper] Export failed:', error);
      sendResponse({ success: false, message: error.message || String(error) });
    });
    return true;
  }

  if (request.action === 'runAiRepair') {
    const tabId = request.tabId || (sender && sender.tab && sender.tab.id) || null;
    runAiRepair(tabId).then((result) => {
      sendResponse(result);
    }).catch((error) => {
      console.error('[1688 Smart Scraper] AI repair failed:', error);
      sendResponse({ success: false, message: error.message || String(error) });
    });
    return true;
  }

  if (request.action === 'clearAiAdapters') {
    clearAiAdapters().then((result) => sendResponse(result)).catch((error) => {
      sendResponse({ success: false, message: error.message || String(error) });
    });
    return true;
  }

  if (request.action === 'getAdapterInfo') {
    getAdapterInfo().then((result) => sendResponse(result)).catch((error) => {
      sendResponse({ success: false, message: error.message || String(error) });
    });
    return true;
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[1688 Smart Scraper] First install, initializing...');
    chrome.storage.sync.set({
      settings: {
        exportFormat: 'xlsx',
        maxProducts: 0,
        filterAds: true,
        columns: { ...DEFAULT_COLUMNS },
        language: 'zh',
        imageSize: 120,
        aiApiKey: '',
        aiBaseUrl: 'https://api.openai.com/v1',
        aiModel: 'gpt-4o-mini'
      }
    });
  }
});

console.log('[1688 Smart Scraper] Background service worker started v1.8.0');
