// src/content/utils/communication.js

/**
 * Background scriptとの通信を管理するクラス
 */
class Communication {
    constructor() {
        this.constants = window.MRA_CONSTANTS;
        this.defaultTimeout = 5000;
    }

    /**
     * Background scriptにメッセージを送信
     * @param {Object} message - 送信するメッセージ
     * @param {number} timeout - タイムアウト時間（ミリ秒）
     * @returns {Promise<Object>} レスポンス
     */
    async sendMessage(message, timeout = this.defaultTimeout) {
        return new Promise((resolve, reject) => {
            // タイムアウト設定
            const timeoutId = setTimeout(() => {
                reject(new Error(`Message timeout after ${timeout}ms`));
            }, timeout);

            try {
                chrome.runtime.sendMessage(message, (response) => {
                    clearTimeout(timeoutId);

                    // Chrome runtime エラーチェック
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }

                    // レスポンスの検証
                    if (!response) {
                        reject(
                            new Error(
                                "No response received from background script"
                            )
                        );
                        return;
                    }

                    if (response.success) {
                        resolve(response);
                    } else {
                        reject(
                            new Error(
                                response.error || "Unknown error occurred"
                            )
                        );
                    }
                });
            } catch (error) {
                clearTimeout(timeoutId);
                reject(new Error(`Failed to send message: ${error.message}`));
            }
        });
    }

    /**
     * 設定を取得
     * @returns {Promise<Object>} 設定データ
     */
    async getSettings() {
        try {
            const response = await this.sendMessage({
                type: this.constants.MESSAGE_TYPES.GET_SETTINGS,
            });
            return response.data;
        } catch (error) {
            console.error("Failed to get settings:", error);
            throw error;
        }
    }

    /**
     * 設定を保存
     * @param {Object} settingsData - 保存する設定データ
     * @returns {Promise<Object>} 更新された設定データ
     */
    async saveSettings(settingsData) {
        try {
            const response = await this.sendMessage({
                type: this.constants.MESSAGE_TYPES.SET_STORAGE_DATA,
                data: settingsData,
            });
            return response.data;
        } catch (error) {
            console.error("Failed to save settings:", error);
            throw error;
        }
    }

    /**
     * 分析結果を保存
     * @param {Object} analysisData - 分析結果データ
     * @returns {Promise<void>}
     */
    async saveAnalysisResult(analysisData) {
        try {
            await this.sendMessage({
                type: this.constants.MESSAGE_TYPES.SAVE_ANALYSIS_RESULT,
                data: analysisData,
            });
        } catch (error) {
            console.error("Failed to save analysis result:", error);
            throw error;
        }
    }

    /**
     * 分析履歴を取得
     * @param {number} limit - 取得件数の制限
     * @returns {Promise<Array>} 分析履歴
     */
    async getAnalysisHistory(limit = null) {
        try {
            const response = await this.sendMessage({
                type: this.constants.MESSAGE_TYPES.GET_ANALYSIS_HISTORY,
                limit: limit,
            });
            return response.data;
        } catch (error) {
            console.error("Failed to get analysis history:", error);
            throw error;
        }
    }

    /**
     * 分析履歴をクリア
     * @returns {Promise<void>}
     */
    async clearAnalysisHistory() {
        try {
            await this.sendMessage({
                type: "CLEAR_ANALYSIS_HISTORY",
            });
        } catch (error) {
            console.error("Failed to clear analysis history:", error);
            throw error;
        }
    }

    /**
     * 接続状態をテスト
     * @returns {Promise<boolean>} 接続可能かどうか
     */
    async testConnection() {
        try {
            await this.sendMessage(
                {
                    type: "PING",
                },
                2000
            );
            return true;
        } catch (error) {
            console.warn("Connection test failed:", error);
            return false;
        }
    }

    /**
     * リトライ機能付きメッセージ送信
     * @param {Object} message - 送信するメッセージ
     * @param {number} maxRetries - 最大リトライ回数
     * @param {number} retryDelay - リトライ間隔（ミリ秒）
     * @returns {Promise<Object>} レスポンス
     */
    async sendMessageWithRetry(message, maxRetries = 3, retryDelay = 1000) {
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(
                        `Retrying message send, attempt ${attempt}/${maxRetries}`
                    );
                    await new Promise((resolve) =>
                        setTimeout(resolve, retryDelay * attempt)
                    );
                }

                const response = await this.sendMessage(message);
                return response;
            } catch (error) {
                lastError = error;
                console.warn(
                    `Message send attempt ${attempt + 1} failed:`,
                    error.message
                );

                // 致命的なエラーの場合はリトライしない
                if (
                    error.message.includes("Extension context invalidated") ||
                    error.message.includes("Could not establish connection")
                ) {
                    break;
                }
            }
        }

        throw lastError;
    }

    /**
     * バッチでメッセージを送信
     * @param {Array} messages - メッセージ配列
     * @param {number} batchSize - バッチサイズ
     * @returns {Promise<Array>} レスポンス配列
     */
    async sendBatchMessages(messages, batchSize = 5) {
        const results = [];

        for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize);

            const batchPromises = batch.map(async (message, index) => {
                try {
                    const response = await this.sendMessage(message);
                    return { index: i + index, success: true, data: response };
                } catch (error) {
                    return {
                        index: i + index,
                        success: false,
                        error: error.message,
                    };
                }
            });

            const batchResults = await Promise.allSettled(batchPromises);
            results.push(
                ...batchResults.map((result) =>
                    result.status === "fulfilled"
                        ? result.value
                        : { success: false, error: result.reason.message }
                )
            );

            // バッチ間で少し待機
            if (i + batchSize < messages.length) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }

        return results;
    }

    /**
     * エラーハンドリング用のヘルパー
     * @param {Error} error - エラーオブジェクト
     * @returns {Object} 構造化されたエラー情報
     */
    handleError(error) {
        const errorInfo = {
            message: error.message,
            type: "communication_error",
            timestamp: new Date().toISOString(),
            recoverable: true,
        };

        // エラータイプに応じた分類
        if (error.message.includes("timeout")) {
            errorInfo.type = "timeout_error";
            errorInfo.recoverable = true;
        } else if (error.message.includes("Extension context invalidated")) {
            errorInfo.type = "context_invalidated";
            errorInfo.recoverable = false;
        } else if (error.message.includes("Could not establish connection")) {
            errorInfo.type = "connection_error";
            errorInfo.recoverable = false;
        }

        return errorInfo;
    }

    /**
     * 拡張機能のコンテキストが有効かチェック
     * @returns {boolean} コンテキストが有効かどうか
     */
    isExtensionContextValid() {
        try {
            return !!(chrome && chrome.runtime && chrome.runtime.id);
        } catch (error) {
            return false;
        }
    }

    /**
     * デバッグ情報を取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            extensionId: chrome?.runtime?.id || "unknown",
            contextValid: this.isExtensionContextValid(),
            url: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
        };
    }
}

// グローバルスコープに公開
if (typeof window !== "undefined") {
    window.Communication = Communication;
}
