// background.js - Manifest V3対応版（Service Worker対応）

// Service Worker内でのグローバル変数定義
let MRA_CONSTANTS, MRA_CONFIG, StorageManager, MessageHandler;

// 必要なモジュールを読み込み
try {
    importScripts(
        "src/shared/constants.js",
        "src/shared/config.js",
        "src/background/storage-manager.js",
        "src/background/message-handler.js"
    );

    // Service Worker内でグローバル変数を初期化
    MRA_CONSTANTS = self.MRA_CONSTANTS;
    MRA_CONFIG = self.MRA_CONFIG;
    StorageManager = self.StorageManager;
    MessageHandler = self.MessageHandler;
} catch (error) {
    console.error("Failed to load background scripts:", error);
}

/**
 * メイン背景処理クラス
 */
class BackgroundService {
    constructor() {
        if (!StorageManager || !MessageHandler) {
            console.error("Required classes not loaded");
            return;
        }

        this.storageManager = new StorageManager();
        this.messageHandler = new MessageHandler(this.storageManager);
        this.init();
    }

    /**
     * 初期化処理
     */
    init() {
        console.log("BackgroundService initializing...");

        // メッセージ処理の設定
        chrome.runtime.onMessage.addListener(
            (message, sender, sendResponse) => {
                if (this.messageHandler) {
                    this.messageHandler.handleMessage(
                        message,
                        sender,
                        sendResponse
                    );
                    return true; // 非同期レスポンスを示す
                }
                return false;
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

        console.log("BackgroundService initialized");
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
                    type:
                        MRA_CONSTANTS?.MESSAGE_TYPES?.PAGE_LOADED ||
                        "PAGE_LOADED",
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
                    type:
                        MRA_CONSTANTS?.MESSAGE_TYPES?.MANUAL_ANALYSIS_REQUEST ||
                        "MANUAL_ANALYSIS_REQUEST",
                });
            } catch (error) {
                console.error("Failed to send manual analysis request:", error);
            }
        }
    }
}

// 拡張機能レベルでのグローバル変数
let backgroundService = null;

// Service Worker ライフサイクル
self.addEventListener("install", (event) => {
    console.log("Service Worker installing...");
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    console.log("Service Worker activating...");
    event.waitUntil(
        (async () => {
            try {
                // サービス初期化
                backgroundService = new BackgroundService();

                // 初期設定を行う
                if (backgroundService && backgroundService.storageManager) {
                    await backgroundService.storageManager.initializeSettings();
                    console.log("Background service fully activated");
                } else {
                    console.error("Failed to initialize BackgroundService");
                }
            } catch (error) {
                console.error("Failed to initialize settings:", error);
            }
        })()
    );
});
