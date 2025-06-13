// background.js - Service Worker for Maps Review Analyzer

// 拡張機能インストール時の初期化
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Maps Review Analyzer installed:", details);

  // 初期設定をストレージに保存
  chrome.storage.sync.set({
    isEnabled: true,
    settings: {
      analysisMode: "standard", // standard, strict, lenient
      showDetailedAnalysis: true,
      minimumReviewsForAnalysis: 5,
      suspicionThreshold: 40,
    },
  });
});

// Content scriptからのメッセージを処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  switch (message.type) {
    case "GET_SETTINGS":
      handleGetSettings(sendResponse);
      return true;

    case "SAVE_ANALYSIS_RESULT":
      handleSaveAnalysisResult(message.data, sendResponse);
      return true;

    case "GET_ANALYSIS_HISTORY":
      handleGetAnalysisHistory(sendResponse);
      return true;

    default:
      sendResponse({ error: "Unknown message type" });
  }
});

// 設定取得処理
async function handleGetSettings(sendResponse) {
  try {
    const data = await chrome.storage.sync.get(null);
    sendResponse({ success: true, data });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// 分析結果保存処理
async function handleSaveAnalysisResult(analysisData, sendResponse) {
  try {
    const { analysisHistory = [] } = await chrome.storage.local.get([
      "analysisHistory",
    ]);

    const newResult = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      url: analysisData.url,
      placeName: analysisData.placeName,
      trustScore: analysisData.trustScore,
      totalReviews: analysisData.totalReviews,
      suspiciousPatterns: analysisData.suspiciousPatterns,
    };

    // 最新20件のみ保持
    analysisHistory.unshift(newResult);
    if (analysisHistory.length > 20) {
      analysisHistory.splice(20);
    }

    await chrome.storage.local.set({ analysisHistory });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// 分析履歴取得処理
async function handleGetAnalysisHistory(sendResponse) {
  try {
    const { analysisHistory = [] } = await chrome.storage.local.get([
      "analysisHistory",
    ]);
    sendResponse({ success: true, data: analysisHistory });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// タブ更新時の処理
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("google.com/maps")
  ) {
    console.log("Google Maps page loaded:", tab.url);

    // Content scriptに分析開始を通知
    chrome.tabs
      .sendMessage(tabId, {
        type: "PAGE_LOADED",
        data: { url: tab.url },
      })
      .catch((error) => {
        // Content scriptがまだ読み込まれていない場合は無視
        console.log("Could not send message to tab:", error.message);
      });
  }
});

// アクション（拡張機能アイコン）クリック時の処理
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && tab.url.includes("google.com/maps")) {
    try {
      // Content scriptに手動分析を指示
      await chrome.tabs.sendMessage(tab.id, {
        type: "MANUAL_ANALYSIS_REQUEST",
      });
    } catch (error) {
      console.error("Failed to send manual analysis request:", error);
    }
  }
});
