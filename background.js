/**
 * 1688 智能选品助手 - Background Service Worker
 * 处理扩展图标点击和消息转发
 */

const ALL_COLUMNS = ['序号', '图片', '商品标题', '价格', '销量', '店铺名称', '商品链接'];

const I18N = {
  zh: {
    cols: { '序号': '序号', '图片': '图片', '商品标题': '商品标题', '价格': '价格(元)', '销量': '销量', '店铺名称': '店铺名称', '商品链接': '商品链接' },
    title: '1688 收藏夹数据',
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
    title: '1688 Collection Data',
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

function getLang(lang) {
  return I18N[lang] || I18N.zh;
}

function loadExcelJS() {
  return new Promise((resolve) => {
    if (typeof ExcelJS !== 'undefined') {
      resolve(ExcelJS);
      return;
    }
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('exceljs.min.js');
    script.onload = () => resolve(ExcelJS);
    document.head.appendChild(script);
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getConfig') {
    chrome.storage.sync.get('settings', (result) => {
      sendResponse({ config: result.settings || {} });
    });
    return true;
  }

  if (request.action === 'exportFromCollection') {
    chrome.storage.sync.get('settings', async (result) => {
      const settings = result.settings || {};
      const exportFormat = settings.exportFormat || 'xlsx';
      const columns = request.options?.columns || settings.columns || {
        '序号': true, '图片': true, '商品标题': true,
        '价格': true, '销量': true, '店铺名称': true, '商品链接': true
      };
      const lang = request.options?.language || 'zh';
      const dict = getLang(lang);

      try {
        const products = request.products || [];
        const productsWithIndex = products.map((p, i) => ({ ...p, 序号: i + 1 }));

        const now = new Date();
        const dateStr = now.getFullYear().toString() +
          (now.getMonth() + 1).toString().padStart(2, '0') +
          now.getDate().toString().padStart(2, '0');
        const timeStr = now.getHours().toString().padStart(2, '0') +
          now.getMinutes().toString().padStart(2, '0');

        if (exportFormat === 'xlsx') {
          const imagePromises = productsWithIndex.map(async (product) => {
            if (product.图片链接 && columns['图片']) {
              try {
                const response = await fetch(product.图片链接);
                const blob = await response.blob();
                return new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
              } catch (e) { return ''; }
            }
            return '';
          });

          const base64Images = await Promise.all(imagePromises);
          productsWithIndex.forEach((p, i) => { p.图片base64 = base64Images[i]; });

          const workbook = new (await loadExcelJS()).Workbook();
          workbook.creator = '1688 Smart Scraper';
          const worksheet = workbook.addWorksheet('Products', {
            views: [{ state: 'frozen', ySplit: 1 }]
          });

          const colHeaders = [];
          const colKeys = [];
          const colWidths = { '序号': 8, '图片': 15, '商品标题': 50, '价格': 12, '销量': 12, '店铺名称': 25, '商品链接': 40 };

          ALL_COLUMNS.forEach(key => {
            if (columns[key]) {
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
          headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6600' } };
          headerRow.alignment = { horizontal: 'left', vertical: 'middle' };

          for (let i = 0; i < productsWithIndex.length; i++) {
            const product = productsWithIndex[i];
            const rowNum = i + 2;
            const rowData = {};
            colKeys.forEach(key => { rowData[key] = product[key] || ''; });

            const row = worksheet.addRow(rowData);
            row.height = 65;

            if (columns['图片'] && product.图片base64) {
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
              } catch (e) {}
            }
          }

          const buffer = await workbook.xlsx.writeBuffer();
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `1688_collection_${dateStr}_${timeStr}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          let md = `# ${dict.title}\n\n`;
          md += `> ${dict.exportTime}: ${new Date().toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}\n`;
          md += `> ${dict.productCount}: ${productsWithIndex.length}\n\n`;
          md += '---\n\n';

          for (const product of productsWithIndex) {
            md += `## ${product.序号}. ${product.商品标题 || dict.unknown}\n\n`;
            if (product.图片链接) {
              md += `![Product](${product.图片链接})\n\n`;
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

          const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `1688_collection_${dateStr}_${timeStr}.md`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }

        sendResponse({ success: true, count: products.length });
      } catch (error) {
        console.error('[1688 Smart Scraper] Collection export failed:', error);
        sendResponse({ success: false, message: error.message });
      }
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
        columns: {
          '序号': true, '图片': true, '商品标题': true,
          '价格': true, '销量': true, '店铺名称': true, '商品链接': true
        },
        language: 'zh'
      }
    });
  }
});

console.log('[1688 Smart Scraper] Background service worker started');
