// background.js - 修正版（設定保存対応）
/**
 * メイン背景処理クラス
 */
class BackgroundService {
    constructor() {
        this.storageManager = null;
        this.messageHandler = null;
        this.init();
    }

    /**
     * 初期化処理
     */
    async init() {
        console.log("BackgroundService initializing...");

        try {
            // 必要なクラスの読み込みを待機
            await this.waitForClasses();

            // インスタンスを初期化
            this.storageManager = new StorageManager();
            this.messageHandler = new MessageHandler(this.storageManager);

            // メッセージリスナーを設定
            this.setupMessageListeners();

            // 初期設定を行う
            await this.storageManager.initializeSettings();

            console.log("BackgroundService initialized successfully");
        } catch (error) {
            console.error("Failed to initialize BackgroundService:", error);
        }
    }

    /**
     * 必要なクラスの読み込みを待機
     */
    async waitForClasses() {
        let attempts = 0;
        const maxAttempts = 50; // 5秒間待機

        while (attempts < maxAttempts) {
            if (self.StorageManager && self.MessageHandler) {
                console.log("Required classes loaded");
                return;
            }

            await new Promise((resolve) => setTimeout(resolve, 100));
            attempts++;
        }

        throw new Error("Required classes not loaded within timeout");
    }

    /**
     * メッセージリスナーを設定
     */
    setupMessageListeners() {
        chrome.runtime.onMessage.addListener(
            (message, sender, sendResponse) => {
                console.log(
                    "Background received message:",
                    message.type,
                    message
                );

                if (this.messageHandler) {
                    // 非同期処理を適切に処理
                    this.messageHandler.handleMessage(
                        message,
                        sender,
                        sendResponse
                    );
                    return true; // 非同期レスポンスを示す
                } else {
                    console.error("MessageHandler not initialized");
                    sendResponse({
                        success: false,
                        error: "MessageHandler not initialized",
                    });
                    return false;
                }
            }
        );
    }

    /**
     * タブ更新時の処理
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
                    type: "PAGE_LOADED",
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
     */
    async handleActionClick(tab) {
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
    }
}

/**
 * ストレージ操作を管理するクラス（簡易版）
 */
class StorageManager {
    constructor() {
        this.defaultSettings = {
            isEnabled: true,
            settings: {
                analysisMode: "standard",
                showDetailedAnalysis: true,
                minimumReviewsForAnalysis: 5,
                suspicionThreshold: 40,
                autoAnalysis: true,
                debugMode: false,
            },
        };
    }

    /**
     * 初期設定を保存
     */
    async initializeSettings() {
        try {
            const existing = await this.getSettings();

            // 既存設定がない場合のみ初期化
            if (!existing || Object.keys(existing).length === 0) {
                await chrome.storage.sync.set(this.defaultSettings);
                console.log("Default settings initialized");
            } else {
                console.log("Settings already exist:", existing);
            }
        } catch (error) {
            console.error("Failed to initialize settings:", error);
            // フォールバック: デフォルト設定を強制設定
            await chrome.storage.sync.set(this.defaultSettings);
        }
    }

    /**
     * 設定を取得
     */
    async getSettings() {
        try {
            const data = await chrome.storage.sync.get(null);
            console.log("Retrieved settings:", data);

            // データが空の場合はデフォルト設定を返す
            if (!data || Object.keys(data).length === 0) {
                console.log("No settings found, returning defaults");
                return this.defaultSettings;
            }

            // 設定の検証と修正
            const validatedSettings = this.validateAndFixSettings(data);
            return validatedSettings;
        } catch (error) {
            console.error("Failed to get settings:", error);
            return this.defaultSettings;
        }
    }

    /**
     * 設定を更新
     */
    async updateSettings(newData) {
        try {
            console.log("Updating settings with:", newData);

            const currentSettings = await this.getSettings();
            console.log("Current settings:", currentSettings);

            const mergedSettings = this.mergeSettings(currentSettings, newData);
            console.log("Merged settings:", mergedSettings);

            await chrome.storage.sync.set(mergedSettings);
            console.log("Settings saved successfully");

            // 保存後に検証
            const savedSettings = await chrome.storage.sync.get(null);
            console.log("Verified saved settings:", savedSettings);

            return savedSettings;
        } catch (error) {
            console.error("Failed to update settings:", error);
            throw new Error("設定の更新に失敗しました: " + error.message);
        }
    }

    /**
     * 設定をマージ
     */
    mergeSettings(current, updates) {
        const merged = JSON.parse(JSON.stringify(current));

        if (updates.isEnabled !== undefined) {
            merged.isEnabled = updates.isEnabled;
        }

        if (updates.settings && typeof updates.settings === "object") {
            merged.settings = merged.settings || {};
            Object.assign(merged.settings, updates.settings);
        }

        return merged;
    }

    /**
     * 設定を検証・修正
     */
    validateAndFixSettings(settings) {
        const fixed = {
            isEnabled: settings.isEnabled !== false,
            settings: {
                analysisMode: ["lenient", "standard", "strict"].includes(
                    settings.settings?.analysisMode
                )
                    ? settings.settings.analysisMode
                    : "standard",
                showDetailedAnalysis:
                    settings.settings?.showDetailedAnalysis !== false,
                minimumReviewsForAnalysis:
                    typeof settings.settings?.minimumReviewsForAnalysis ===
                    "number"
                        ? Math.max(
                              1,
                              Math.min(
                                  100,
                                  settings.settings.minimumReviewsForAnalysis
                              )
                          )
                        : 5,
                suspicionThreshold:
                    typeof settings.settings?.suspicionThreshold === "number"
                        ? Math.max(
                              0,
                              Math.min(
                                  100,
                                  settings.settings.suspicionThreshold
                              )
                          )
                        : 40,
                autoAnalysis: settings.settings?.autoAnalysis !== false,
                debugMode: settings.settings?.debugMode === true,
            },
        };

        return fixed;
    }

    /**
     * 分析結果を保存
     */
    async saveAnalysisResult(analysisData) {
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
                analysisMode: analysisData.analysisMode || "standard",
                version: "1.0.0",
            };

            // 重複チェック（同じURLの結果は更新）
            const existingIndex = analysisHistory.findIndex(
                (item) => item.url === newResult.url
            );
            if (existingIndex !== -1) {
                analysisHistory[existingIndex] = newResult;
            } else {
                analysisHistory.unshift(newResult);
            }

            // 最大保持件数の制限
            if (analysisHistory.length > 20) {
                analysisHistory.splice(20);
            }

            await chrome.storage.local.set({ analysisHistory });
            console.log("Analysis result saved:", newResult.placeName);
        } catch (error) {
            console.error("Failed to save analysis result:", error);
            throw new Error("分析結果の保存に失敗しました: " + error.message);
        }
    }

    /**
     * 分析履歴を取得
     */
    async getAnalysisHistory(limit = null) {
        try {
            const { analysisHistory = [] } = await chrome.storage.local.get([
                "analysisHistory",
            ]);
            return limit ? analysisHistory.slice(0, limit) : analysisHistory;
        } catch (error) {
            console.error("Failed to get analysis history:", error);
            return [];
        }
    }
}

/**
 * メッセージ処理を管理するクラス（簡易版）
 */
class MessageHandler {
    constructor(storageManager) {
        this.storageManager = storageManager;
        this.messageHandlers = {
            GET_SETTINGS: this.handleGetSettings.bind(this),
            SET_STORAGE_DATA: this.handleSetStorageData.bind(this),
            SAVE_ANALYSIS_RESULT: this.handleSaveAnalysisResult.bind(this),
            GET_ANALYSIS_HISTORY: this.handleGetAnalysisHistory.bind(this),
        };
    }

    /**
     * メッセージを処理
     */
    async handleMessage(message, sender, sendResponse) {
        try {
            console.log("Processing message:", message.type);

            // メッセージの検証
            if (!message || !message.type) {
                console.error("Invalid message format");
                sendResponse({
                    success: false,
                    error: "Invalid message format",
                });
                return false;
            }

            const handler = this.messageHandlers[message.type];

            if (!handler) {
                console.warn(`Unknown message type: ${message.type}`);
                sendResponse({
                    success: false,
                    error: `Unknown message type: ${message.type}`,
                });
                return false;
            }

            // ハンドラーを実行
            const result = await handler(message, sender);
            console.log("Message handled successfully:", message.type, result);
            sendResponse(result);
        } catch (error) {
            console.error("Message handling error:", error);
            sendResponse({
                success: false,
                error: error.message || "Unknown error occurred",
            });
        }

        return true; // 非同期処理を示す
    }

    /**
     * 設定取得処理
     */
    async handleGetSettings(message, sender) {
        try {
            console.log("Handling GET_SETTINGS");
            const data = await this.storageManager.getSettings();
            console.log("Settings retrieved:", data);
            return {
                success: true,
                data,
            };
        } catch (error) {
            console.error("Failed to get settings:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * 設定保存処理
     */
    async handleSetStorageData(message, sender) {
        try {
            console.log("Handling SET_STORAGE_DATA with data:", message.data);

            if (!message.data) {
                throw new Error("No data provided for storage update");
            }

            const updatedData = await this.storageManager.updateSettings(
                message.data
            );
            console.log("Storage update completed:", updatedData);

            return {
                success: true,
                data: updatedData,
            };
        } catch (error) {
            console.error("Failed to update storage data:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * 分析結果保存処理
     */
    async handleSaveAnalysisResult(message, sender) {
        try {
            if (!message.data) {
                throw new Error("No analysis data provided");
            }

            await this.storageManager.saveAnalysisResult(message.data);

            return {
                success: true,
            };
        } catch (error) {
            console.error("Failed to save analysis result:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * 分析履歴取得処理
     */
    async handleGetAnalysisHistory(message, sender) {
        try {
            const limit = message.limit || null;
            const data = await this.storageManager.getAnalysisHistory(limit);

            return {
                success: true,
                data,
            };
        } catch (error) {
            console.error("Failed to get analysis history:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

// Service Worker環境でクラスを公開
self.StorageManager = StorageManager;
self.MessageHandler = MessageHandler;

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
                console.log("Background service fully activated");
            } catch (error) {
                console.error(
                    "Failed to initialize background service:",
                    error
                );
            }
        })()
    );
});

// タブ更新の監視
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (backgroundService) {
        backgroundService.handleTabUpdate(tabId, changeInfo, tab);
    }
});

// アクションクリックの処理
chrome.action.onClicked.addListener((tab) => {
    if (backgroundService) {
        backgroundService.handleActionClick(tab);
    }
});
