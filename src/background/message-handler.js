// src/background/message-handler.js (修正版)

/**
 * メッセージ処理を管理するクラス
 */
class MessageHandler {
    constructor(storageManager) {
        this.storageManager = storageManager;
        this.constants = window.MRA_CONSTANTS;
        this.messageHandlers = this.initializeHandlers();
    }

    /**
     * メッセージハンドラーを初期化
     * @returns {Object} - ハンドラーマップ
     */
    initializeHandlers() {
        return {
            [this.constants.MESSAGE_TYPES.GET_SETTINGS]:
                this.handleGetSettings.bind(this),
            [this.constants.MESSAGE_TYPES.SET_STORAGE_DATA]:
                this.handleSetStorageData.bind(this),
            [this.constants.MESSAGE_TYPES.SAVE_ANALYSIS_RESULT]:
                this.handleSaveAnalysisResult.bind(this),
            [this.constants.MESSAGE_TYPES.GET_ANALYSIS_HISTORY]:
                this.handleGetAnalysisHistory.bind(this),

            // 追加のメッセージタイプ
            CLEAR_ANALYSIS_HISTORY: this.handleClearAnalysisHistory.bind(this),
            GET_STORAGE_USAGE: this.handleGetStorageUsage.bind(this),
            EXPORT_DATA: this.handleExportData.bind(this),
            IMPORT_DATA: this.handleImportData.bind(this),
            CHECK_INTEGRITY: this.handleCheckIntegrity.bind(this),
            GET_DEBUG_INFO: this.handleGetDebugInfo.bind(this),
        };
    }

    /**
     * メッセージを処理
     * @param {Object} message - メッセージオブジェクト
     * @param {Object} sender - 送信者情報
     * @param {Function} sendResponse - レスポンス関数
     * @returns {boolean} - 非同期処理かどうか
     */
    async handleMessage(message, sender, sendResponse) {
        try {
            console.log("Background received message:", message.type, message);

            // メッセージの基本検証
            if (!this.validateMessage(message)) {
                sendResponse({
                    success: false,
                    error: "Invalid message format",
                });
                return false;
            }

            // 送信者の検証
            if (!this.validateSender(sender)) {
                sendResponse({
                    success: false,
                    error: "Invalid sender",
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
     * @param {Object} message - メッセージ
     * @param {Object} sender - 送信者
     * @returns {Promise<Object>} - レスポンス
     */
    async handleGetSettings(message, sender) {
        try {
            const data = await this.storageManager.getSettings();
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
     * @param {Object} message - メッセージ
     * @param {Object} sender - 送信者
     * @returns {Promise<Object>} - レスポンス
     */
    async handleSetStorageData(message, sender) {
        try {
            if (!message.data) {
                throw new Error("No data provided for storage update");
            }

            console.log("Processing storage update with data:", message.data);

            const updatedData = await this.storageManager.updateSettings(
                message.data
            );
            console.log("Storage update completed:", updatedData);

            // 他のタブに設定変更を通知
            this.notifySettingsChange(sender, updatedData);

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
     * @param {Object} message - メッセージ
     * @param {Object} sender - 送信者
     * @returns {Promise<Object>} - レスポンス
     */
    async handleSaveAnalysisResult(message, sender) {
        try {
            if (!message.data) {
                throw new Error("No analysis data provided");
            }

            await this.storageManager.saveAnalysisResult(message.data);

            // 他のタブに新しい分析結果を通知
            this.notifyAnalysisResult(sender, message.data);

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
     * @param {Object} message - メッセージ
     * @param {Object} sender - 送信者
     * @returns {Promise<Object>} - レスポンス
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

    /**
     * 分析履歴クリア処理
     * @param {Object} message - メッセージ
     * @param {Object} sender - 送信者
     * @returns {Promise<Object>} - レスポンス
     */
    async handleClearAnalysisHistory(message, sender) {
        try {
            await this.storageManager.clearAnalysisHistory();

            // 他のタブに履歴クリアを通知
            this.notifyHistoryCleared(sender);

            return {
                success: true,
            };
        } catch (error) {
            console.error("Failed to clear analysis history:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * ストレージ使用量取得処理
     * @param {Object} message - メッセージ
     * @param {Object} sender - 送信者
     * @returns {Promise<Object>} - レスポンス
     */
    async handleGetStorageUsage(message, sender) {
        try {
            const usage = await this.storageManager.getStorageUsage();

            return {
                success: true,
                data: usage,
            };
        } catch (error) {
            console.error("Failed to get storage usage:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * データエクスポート処理
     * @param {Object} message - メッセージ
     * @param {Object} sender - 送信者
     * @returns {Promise<Object>} - レスポンス
     */
    async handleExportData(message, sender) {
        try {
            const exportData = await this.storageManager.exportData();

            return {
                success: true,
                data: exportData,
            };
        } catch (error) {
            console.error("Failed to export data:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * データインポート処理
     * @param {Object} message - メッセージ
     * @param {Object} sender - 送信者
     * @returns {Promise<Object>} - レスポンス
     */
    async handleImportData(message, sender) {
        try {
            if (!message.data) {
                throw new Error("No import data provided");
            }

            await this.storageManager.importData(message.data);

            // 他のタブにデータ更新を通知
            this.notifyDataImported(sender);

            return {
                success: true,
            };
        } catch (error) {
            console.error("Failed to import data:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * 整合性チェック処理
     * @param {Object} message - メッセージ
     * @param {Object} sender - 送信者
     * @returns {Promise<Object>} - レスポンス
     */
    async handleCheckIntegrity(message, sender) {
        try {
            const result = await this.storageManager.checkIntegrity();

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Failed to check integrity:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * デバッグ情報取得処理
     * @param {Object} message - メッセージ
     * @param {Object} sender - 送信者
     * @returns {Promise<Object>} - レスポンス
     */
    async handleGetDebugInfo(message, sender) {
        try {
            const debugInfo = await this.storageManager.getDebugInfo();

            return {
                success: true,
                data: debugInfo,
            };
        } catch (error) {
            console.error("Failed to get debug info:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * 設定変更を他のタブに通知
     * @param {Object} sender - 送信者
     * @param {Object} updatedData - 更新されたデータ
     */
    async notifySettingsChange(sender, updatedData) {
        try {
            const tabs = await chrome.tabs.query({
                url: [
                    "https://www.google.com/maps/*",
                    "https://maps.google.com/*",
                ],
            });

            tabs.forEach((tab) => {
                if (tab.id !== sender.tab?.id) {
                    chrome.tabs
                        .sendMessage(tab.id, {
                            type: "SETTINGS_UPDATED",
                            data: updatedData,
                        })
                        .catch((error) => {
                            // タブが応答しない場合は無視
                            console.log(
                                "Could not notify tab of settings change:",
                                error.message
                            );
                        });
                }
            });
        } catch (error) {
            console.error("Failed to notify settings change:", error);
        }
    }

    /**
     * 分析結果を他のタブに通知
     * @param {Object} sender - 送信者
     * @param {Object} analysisData - 分析データ
     */
    async notifyAnalysisResult(sender, analysisData) {
        try {
            // ポップアップウィンドウに通知
            chrome.runtime
                .sendMessage({
                    type: "ANALYSIS_RESULT_UPDATED",
                    data: analysisData,
                })
                .catch(() => {
                    // ポップアップが開いていない場合は無視
                });
        } catch (error) {
            console.error("Failed to notify analysis result:", error);
        }
    }

    /**
     * 履歴クリアを他のタブに通知
     * @param {Object} sender - 送信者
     */
    async notifyHistoryCleared(sender) {
        try {
            // ポップアップウィンドウに通知
            chrome.runtime
                .sendMessage({
                    type: "HISTORY_CLEARED",
                })
                .catch(() => {
                    // ポップアップが開いていない場合は無視
                });
        } catch (error) {
            console.error("Failed to notify history cleared:", error);
        }
    }

    /**
     * データインポートを他のタブに通知
     * @param {Object} sender - 送信者
     */
    async notifyDataImported(sender) {
        try {
            const tabs = await chrome.tabs.query({
                url: [
                    "https://www.google.com/maps/*",
                    "https://maps.google.com/*",
                ],
            });

            tabs.forEach((tab) => {
                chrome.tabs
                    .sendMessage(tab.id, {
                        type: "DATA_IMPORTED",
                    })
                    .catch((error) => {
                        console.log(
                            "Could not notify tab of data import:",
                            error.message
                        );
                    });
            });

            // ポップアップウィンドウにも通知
            chrome.runtime
                .sendMessage({
                    type: "DATA_IMPORTED",
                })
                .catch(() => {
                    // ポップアップが開いていない場合は無視
                });
        } catch (error) {
            console.error("Failed to notify data imported:", error);
        }
    }

    /**
     * メッセージの検証
     * @param {Object} message - メッセージ
     * @returns {boolean} - 有効かどうか
     */
    validateMessage(message) {
        if (!message || typeof message !== "object") {
            console.warn("Invalid message: not an object");
            return false;
        }

        if (!message.type || typeof message.type !== "string") {
            console.warn("Invalid message: missing or invalid type");
            return false;
        }

        return true;
    }

    /**
     * 送信者の検証
     * @param {Object} sender - 送信者
     * @returns {boolean} - 有効かどうか
     */
    validateSender(sender) {
        // 基本的な送信者チェック
        if (!sender) {
            console.warn("Invalid sender: null or undefined");
            return false;
        }

        // コンテンツスクリプトからの場合はURLチェック
        if (sender.tab && sender.tab.url) {
            try {
                const url = new URL(sender.tab.url);
                const allowedDomains = ["google.com", "maps.google.com"];
                const isAllowed = allowedDomains.some((domain) =>
                    url.hostname.includes(domain)
                );

                if (!isAllowed) {
                    console.warn(
                        "Invalid sender: domain not allowed",
                        url.hostname
                    );
                    return false;
                }
            } catch (error) {
                console.warn("Invalid sender: malformed URL", sender.tab.url);
                return false;
            }
        }

        // ポップアップやサービスワーカーからの場合は許可
        return true;
    }

    /**
     * エラーハンドリング用のヘルパー
     * @param {Error} error - エラーオブジェクト
     * @returns {Object} 構造化されたエラー情報
     */
    handleError(error) {
        const errorInfo = {
            message: error.message,
            type: "message_handler_error",
            timestamp: new Date().toISOString(),
            stack: error.stack,
        };

        // エラータイプに応じた分類
        if (error.message.includes("storage")) {
            errorInfo.type = "storage_error";
        } else if (error.message.includes("permission")) {
            errorInfo.type = "permission_error";
        } else if (error.message.includes("timeout")) {
            errorInfo.type = "timeout_error";
        }

        return errorInfo;
    }

    /**
     * デバッグ情報を取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            handlersCount: Object.keys(this.messageHandlers).length,
            supportedMessageTypes: Object.keys(this.messageHandlers),
            timestamp: new Date().toISOString(),
            constants: this.constants ? "loaded" : "missing",
            storageManager: this.storageManager ? "available" : "missing",
        };
    }
}

// グローバルスコープに公開
if (typeof window !== "undefined") {
    window.MessageHandler = MessageHandler;
}
