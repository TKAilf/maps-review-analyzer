// background.js

// 必要なモジュールを読み込み
importScripts(
    "src/shared/constants.js",
    "src/shared/config.js",
    "src/background/storage-manager.js",
    "src/background/message-handler.js"
);

/**
 * メイン背景処理クラス
 */
class BackgroundService {
    constructor() {
        this.storageManager = new StorageManager();
        this.messageHandler = new MessageHandler(this.storageManager);
        this.init();
    }

    /**
     * 初期化処理
     */
    init() {
        // 拡張機能インストール時の処理
        chrome.runtime.onInstalled.addListener((details) => {
            console.log("Maps Review Analyzer installed:", details);
            this.storageManager.initializeSettings();
        });

        // メッセージ処理の設定
        chrome.runtime.onMessage.addListener(
            (message, sender, sendResponse) => {
                this.messageHandler.handleMessage(
                    message,
                    sender,
                    sendResponse
                );
                return true; // 非同期レスポンスを示す
            }
        );

        // タブ更新の監視
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });

        // アクションクリックの処理
        chrome.action.onClicked.addListener((tab) => {
            this.handleActionClick(tab);
        });
    }

    /**
     * タブ更新時の処理
     * @param {number} tabId - タブID
     * @param {Object} changeInfo - 変更情報
     * @param {Object} tab - タブ情報
     */
    handleTabUpdate(tabId, changeInfo, tab) {
        if (
            changeInfo.status === "complete" &&
            tab.url &&
            tab.url.includes("google.com/maps")
        ) {
            console.log("Google Maps page loaded:", tab.url);

            // Content scriptに分析開始を通知
            chrome.tabs
                .sendMessage(tabId, {
                    type: window.MRA_CONSTANTS.MESSAGE_TYPES.PAGE_LOADED,
                    data: { url: tab.url },
                })
                .catch((error) => {
                    // Content scriptがまだ読み込まれていない場合は無視
                    console.log(
                        "Could not send message to tab:",
                        error.message
                    );
                });
        }
    }

    /**
     * アクションクリック時の処理
     * @param {Object} tab - タブ情報
     */
    async handleActionClick(tab) {
        if (tab.url && tab.url.includes("google.com/maps")) {
            try {
                // Content scriptに手動分析を指示
                await chrome.tabs.sendMessage(tab.id, {
                    type: window.MRA_CONSTANTS.MESSAGE_TYPES
                        .MANUAL_ANALYSIS_REQUEST,
                });
            } catch (error) {
                console.error("Failed to send manual analysis request:", error);
            }
        }
    }
}

// サービス初期化
const backgroundService = new BackgroundService();
