// src/background/storage-manager.js - Service Worker対応版

/**
 * ストレージ操作を管理するクラス
 */
class StorageManager {
    constructor() {
        // Service Worker環境でも動作するように修正
        this.config = self.MRA_CONFIG || globalThis.MRA_CONFIG;
        this.constants = self.MRA_CONSTANTS || globalThis.MRA_CONSTANTS;

        // 設定が読み込まれていない場合のフォールバック
        if (!this.config || !this.constants) {
            console.warn("Config or Constants not loaded, using fallback");
            this.initializeFallbackConfig();
        }
    }

    /**
     * フォールバック設定を初期化
     */
    initializeFallbackConfig() {
        this.config = {
            DEFAULT_SETTINGS: {
                isEnabled: true,
                settings: {
                    analysisMode: "standard",
                    showDetailedAnalysis: true,
                    minimumReviewsForAnalysis: 5,
                    suspicionThreshold: 40,
                    autoAnalysis: true,
                    debugMode: false,
                },
            },
            CONFIG_UTILS: {
                mergeSettings: (current, updates) => {
                    const merged = JSON.parse(JSON.stringify(current));
                    if (updates.isEnabled !== undefined) {
                        merged.isEnabled = updates.isEnabled;
                    }
                    if (
                        updates.settings &&
                        typeof updates.settings === "object"
                    ) {
                        Object.assign(merged.settings, updates.settings);
                    }
                    return merged;
                },
            },
            CONFIG_VALIDATORS: {
                validateSettings: (settings) => {
                    if (!settings || typeof settings !== "object") {
                        return {
                            valid: false,
                            errors: [],
                            settings: this.config.DEFAULT_SETTINGS,
                        };
                    }
                    return { valid: true, errors: [], settings };
                },
            },
            ANALYSIS_CONSTANTS: {
                MAX_HISTORY_ITEMS: 20,
            },
        };

        this.constants = {
            MESSAGE_TYPES: {
                GET_SETTINGS: "GET_SETTINGS",
                SET_STORAGE_DATA: "SET_STORAGE_DATA",
                SAVE_ANALYSIS_RESULT: "SAVE_ANALYSIS_RESULT",
                GET_ANALYSIS_HISTORY: "GET_ANALYSIS_HISTORY",
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
                await chrome.storage.sync.set(this.config.DEFAULT_SETTINGS);
                console.log("Default settings initialized");
            } else {
                // 既存設定を最新スキーマに更新
                const updated = this.config.CONFIG_UTILS.mergeSettings(
                    this.config.DEFAULT_SETTINGS,
                    existing
                );
                await chrome.storage.sync.set(updated);
                console.log("Settings updated to latest schema");
            }
        } catch (error) {
            console.error("Failed to initialize settings:", error);
            // フォールバック: デフォルト設定を強制設定
            await chrome.storage.sync.set(this.config.DEFAULT_SETTINGS);
        }
    }

    /**
     * 設定を取得
     * @returns {Promise<Object>} - 設定オブジェクト
     */
    async getSettings() {
        try {
            const data = await chrome.storage.sync.get(null);

            // データが空の場合はデフォルト設定を返す
            if (!data || Object.keys(data).length === 0) {
                return this.config.DEFAULT_SETTINGS;
            }

            const validation =
                this.config.CONFIG_VALIDATORS.validateSettings(data);

            if (!validation.valid) {
                console.warn(
                    "Invalid settings detected, using corrected version:",
                    validation.errors
                );
                // 修正された設定を保存
                await chrome.storage.sync.set(validation.settings);
                return validation.settings;
            }

            return data;
        } catch (error) {
            console.error("Failed to get settings:", error);
            return this.config.DEFAULT_SETTINGS;
        }
    }

    /**
     * 設定を更新
     * @param {Object} newData - 新しい設定データ
     * @returns {Promise<Object>} - 更新後の設定
     */
    async updateSettings(newData) {
        try {
            const currentSettings = await this.getSettings();
            const mergedSettings = this.config.CONFIG_UTILS.mergeSettings(
                currentSettings,
                newData
            );

            await chrome.storage.sync.set(mergedSettings);
            console.log("Settings updated successfully:", mergedSettings);
            return mergedSettings;
        } catch (error) {
            console.error("Failed to update settings:", error);
            throw new Error("設定の更新に失敗しました: " + error.message);
        }
    }

    /**
     * 分析結果を保存
     * @param {Object} analysisData - 分析データ
     * @returns {Promise<void>}
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
                version: "1.0.0", // 将来のデータ移行用
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
            const maxItems =
                this.config.ANALYSIS_CONSTANTS?.MAX_HISTORY_ITEMS || 20;
            if (analysisHistory.length > maxItems) {
                analysisHistory.splice(maxItems);
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
     * @param {number} limit - 取得件数の制限
     * @returns {Promise<Array>} - 分析履歴
     */
    async getAnalysisHistory(limit = null) {
        try {
            const { analysisHistory = [] } = await chrome.storage.local.get([
                "analysisHistory",
            ]);

            // データの整合性チェック
            const validHistory = analysisHistory.filter(
                (item) =>
                    item &&
                    item.id &&
                    item.placeName &&
                    typeof item.trustScore === "number"
            );

            // 無効なデータが見つかった場合はクリーンアップ
            if (validHistory.length !== analysisHistory.length) {
                await chrome.storage.local.set({
                    analysisHistory: validHistory,
                });
                console.log("Cleaned up invalid history entries");
            }

            return limit ? validHistory.slice(0, limit) : validHistory;
        } catch (error) {
            console.error("Failed to get analysis history:", error);
            return [];
        }
    }

    /**
     * 分析履歴をクリア
     * @returns {Promise<void>}
     */
    async clearAnalysisHistory() {
        try {
            await chrome.storage.local.remove(["analysisHistory"]);
            console.log("Analysis history cleared");
        } catch (error) {
            console.error("Failed to clear analysis history:", error);
            throw new Error("履歴のクリアに失敗しました: " + error.message);
        }
    }

    /**
     * ストレージ使用量を取得
     * @returns {Promise<Object>} - 使用量情報
     */
    async getStorageUsage() {
        try {
            const syncUsage = await chrome.storage.sync.getBytesInUse();
            const localUsage = await chrome.storage.local.getBytesInUse();

            return {
                sync: {
                    used: syncUsage,
                    quota: chrome.storage.sync.QUOTA_BYTES,
                    percentage:
                        (syncUsage / chrome.storage.sync.QUOTA_BYTES) * 100,
                },
                local: {
                    used: localUsage,
                    quota: chrome.storage.local.QUOTA_BYTES,
                    percentage:
                        (localUsage / chrome.storage.local.QUOTA_BYTES) * 100,
                },
            };
        } catch (error) {
            console.error("Failed to get storage usage:", error);
            return null;
        }
    }

    /**
     * データをエクスポート
     * @returns {Promise<Object>} - エクスポートデータ
     */
    async exportData() {
        try {
            const settings = await this.getSettings();
            const history = await this.getAnalysisHistory();

            return {
                version: "1.0.0",
                exportDate: new Date().toISOString(),
                settings,
                history,
            };
        } catch (error) {
            console.error("Failed to export data:", error);
            throw new Error(
                "データのエクスポートに失敗しました: " + error.message
            );
        }
    }

    /**
     * データをインポート
     * @param {Object} importData - インポートデータ
     * @returns {Promise<void>}
     */
    async importData(importData) {
        try {
            // データの検証
            if (!importData || !importData.version) {
                throw new Error("無効なインポートデータです");
            }

            // 設定のインポート
            if (importData.settings) {
                const validation =
                    this.config.CONFIG_VALIDATORS.validateSettings(
                        importData.settings
                    );
                await chrome.storage.sync.set(validation.settings);
            }

            // 履歴のインポート
            if (importData.history && Array.isArray(importData.history)) {
                const validHistory = importData.history.filter(
                    (item) =>
                        item &&
                        item.id &&
                        item.placeName &&
                        typeof item.trustScore === "number"
                );
                await chrome.storage.local.set({
                    analysisHistory: validHistory,
                });
            }

            console.log("Data imported successfully");
        } catch (error) {
            console.error("Failed to import data:", error);
            throw new Error(
                "データのインポートに失敗しました: " + error.message
            );
        }
    }

    /**
     * ストレージの整合性チェック
     * @returns {Promise<Object>} - チェック結果
     */
    async checkIntegrity() {
        try {
            const issues = [];

            // 設定の整合性チェック
            const settings = await this.getSettings();
            const validation =
                this.config.CONFIG_VALIDATORS.validateSettings(settings);
            if (!validation.valid) {
                issues.push({
                    type: "settings",
                    severity: "medium",
                    description: "設定に問題があります",
                    errors: validation.errors,
                });
            }

            // 履歴の整合性チェック
            const history = await this.getAnalysisHistory();
            const invalidEntries = history.filter(
                (item) =>
                    !item ||
                    !item.id ||
                    !item.placeName ||
                    typeof item.trustScore !== "number"
            );

            if (invalidEntries.length > 0) {
                issues.push({
                    type: "history",
                    severity: "low",
                    description: `${invalidEntries.length}件の無効な履歴エントリがあります`,
                    count: invalidEntries.length,
                });
            }

            // ストレージ容量のチェック
            const usage = await this.getStorageUsage();
            if (
                usage &&
                (usage.sync.percentage > 80 || usage.local.percentage > 80)
            ) {
                issues.push({
                    type: "storage",
                    severity: "high",
                    description: "ストレージ容量が不足しています",
                    usage,
                });
            }

            return {
                healthy: issues.length === 0,
                issues,
                lastCheck: new Date().toISOString(),
            };
        } catch (error) {
            console.error("Failed to check storage integrity:", error);
            return {
                healthy: false,
                issues: [
                    {
                        type: "system",
                        severity: "high",
                        description: "整合性チェックに失敗しました",
                        error: error.message,
                    },
                ],
                lastCheck: new Date().toISOString(),
            };
        }
    }

    /**
     * デバッグ情報を取得
     * @returns {Object} デバッグ情報
     */
    async getDebugInfo() {
        return {
            configLoaded: !!this.config,
            constantsLoaded: !!this.constants,
            timestamp: new Date().toISOString(),
            storageUsage: await this.getStorageUsage().catch(() => null),
        };
    }
}

// Service Worker環境で公開
if (typeof self !== "undefined") {
    self.StorageManager = StorageManager;
}

// ブラウザ環境で公開（後方互換性）
if (typeof window !== "undefined") {
    window.StorageManager = StorageManager;
}
