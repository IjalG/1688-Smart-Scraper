/**
 * 1688 智能选品助手 - Background Service Worker
 * 处理扩展图标点击和消息转发
 */

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getConfig') {
    chrome.storage.sync.get('settings', (result) => {
      sendResponse({ config: result.settings || {} });
    });
    return true;
  }
});

// 安装时初始化默认设置
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[1688智能选品助手] 首次安装，初始化配置...');
    chrome.storage.sync.set({
      settings: {
        exportFormat: 'xlsx',
        maxProducts: 0,
        filterAds: true
      }
    });
  }
});

console.log('[1688智能选品助手] Background service worker 已启动');