// popup.js - デバッグ機能強化版

/**
 * ポップアップメインクラス
 */
class PopupMain {
    constructor() {
        this.controllers = {};
        this.components = {};
        this.currentSettings = null;
        this.isInitialized = false;
        this.debugMode = false;
        this.init();
    }

    /**
     * 初期化処理
     */
    async init() {
        try {
            this.log("Popup initializing...");

            // 共通モジュールの初期化確認
            this.verifyModules();

            // コントローラーの初期化
            this.initializeControllers();

            // コンポーネントの初期化
            this.initializeComponents();

            // イベントリスナーの設定
            this.setupEventListeners();

            // 初期データの読み込み
            await this.loadInitialData();

            this.isInitialized = true;
            this.log("Popup initialized successfully");
        } catch (error) {
            this.error("Failed to initialize popup:", error);
            this.showError("初期化に失敗しました: " + error.message);
        }
    }

    /**
     * 必要なモジュールが読み込まれているかチェック
     */
    verifyModules() {
        const requiredModules = ["MRA_CONSTANTS", "MRA_CONFIG"];

        const missingModules = requiredModules.filter(
            (module) => !window[module]
        );

        if (missingModules.length > 0) {
            throw new Error(
                `Required modules not loaded: ${missingModules.join(", ")}`
            );
        }

        this.log("All required modules verified");
    }

    /**
     * コントローラーの初期化
     */
    initializeControllers() {
        this.controllers.settings = new SettingsController();
        this.controllers.history = new HistoryController();
        this.controllers.ui = new UIController();
        this.log("Controllers initialized");
    }

    /**
     * コンポーネントの初期化
     */
    initializeComponents() {
        const statusIndicator = document.getElementById("statusIndicator");
        const statusText = document.getElementById("statusText");
        const historyList = document.getElementById("historyList");

        if (statusIndicator && statusText) {
            this.components.statusDisplay = new StatusDisplay(
                statusIndicator,
                statusText
            );
        }

        this.components.settingsPanel = new SettingsPanel();

        if (historyList) {
            this.components.historyList = new HistoryList(historyList);
        }

        this.log("Components initialized");
    }

    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        // ボタンイベント
        const toggleBtn = document.getElementById("toggleBtn");
        const saveBtn = document.getElementById("saveBtn");
        const analyzeBtn = document.getElementById("analyzeBtn");

        if (toggleBtn) {
            toggleBtn.addEventListener("click", () => {
                this.log("Toggle button clicked");
                this.toggleExtension();
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                this.log("Save button clicked");
                this.saveSettings();
            });
        }

        if (analyzeBtn) {
            analyzeBtn.addEventListener("click", () => {
                this.log("Analyze button clicked");
                this.requestManualAnalysis();
            });
        }

        // 設定変更イベント
        const settingElements = [
            "analysisMode",
            "showDetailedAnalysis",
            "minimumReviews",
            "suspicionThreshold",
        ];

        settingElements.forEach((id) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener("change", () => {
                    this.log(
                        `Setting ${id} changed to:`,
                        element.type === "checkbox"
                            ? element.checked
                            : element.value
                    );
                    this.onSettingChange(
                        id,
                        element.type === "checkbox"
                            ? element.checked
                            : element.value
                    );
                });
            }
        });

        // キーボードショートカット
        document.addEventListener("keydown", (event) => {
            this.handleKeyboardShortcuts(event);
        });

        this.log("Event listeners setup completed");
    }

    /**
     * 初期データの読み込み
     */
    async loadInitialData() {
        try {
            this.log("Loading initial data...");

            // 設定の読み込み
            this.currentSettings = await this.loadSettings();
            this.log("Settings loaded:", this.currentSettings);

            // 履歴の読み込み
            await this.loadHistory();

            // UIの更新
            this.updateUI();

            this.log("Initial data loaded successfully");
        } catch (error) {
            this.error("Failed to load initial data:", error);
            this.showError("データの読み込みに失敗しました");
        }
    }

    /**
     * 設定を読み込み
     */
    async loadSettings() {
        try {
            this.log("Requesting settings from background...");

            const response = await chrome.runtime.sendMessage({
                type: window.MRA_CONSTANTS.MESSAGE_TYPES.GET_SETTINGS,
            });

            this.log("Settings response received:", response);

            if (response && response.success) {
                const settings = response.data;
                this.updateSettingsUI(settings);
                this.updateStatusDisplay(settings);
                return settings;
            } else {
                throw new Error(response?.error || "設定の取得に失敗しました");
            }
        } catch (error) {
            this.error("Failed to load settings:", error);
            // デフォルト設定を使用
            const defaultSettings = window.MRA_CONFIG.DEFAULT_SETTINGS;
            this.updateSettingsUI(defaultSettings);
            this.updateStatusDisplay(defaultSettings);
            return defaultSettings;
        }
    }

    /**
     * 設定UIを更新
     */
    updateSettingsUI(settings) {
        this.log("Updating settings UI with:", settings);

        const settingsData = settings.settings || settings;

        // 分析モード
        const analysisMode = document.getElementById("analysisMode");
        if (analysisMode) {
            analysisMode.value = settingsData.analysisMode || "standard";
            this.log("Analysis mode set to:", analysisMode.value);
        }

        // 詳細分析表示
        const showDetailedAnalysis = document.getElementById(
            "showDetailedAnalysis"
        );
        if (showDetailedAnalysis) {
            showDetailedAnalysis.checked =
                settingsData.showDetailedAnalysis || false;
            this.log(
                "Show detailed analysis set to:",
                showDetailedAnalysis.checked
            );
        }

        // 最小レビュー数
        const minimumReviews = document.getElementById("minimumReviews");
        if (minimumReviews) {
            minimumReviews.value = settingsData.minimumReviewsForAnalysis || 5;
            this.log("Minimum reviews set to:", minimumReviews.value);
        }

        // 疑念閾値
        const suspicionThreshold =
            document.getElementById("suspicionThreshold");
        if (suspicionThreshold) {
            suspicionThreshold.value = settingsData.suspicionThreshold || 40;
            this.log("Suspicion threshold set to:", suspicionThreshold.value);
        }
    }

    /**
     * ステータス表示を更新
     */
    updateStatusDisplay(settings) {
        const isEnabled = settings.isEnabled !== false; // デフォルトはtrue
        this.log("Updating status display. Enabled:", isEnabled);

        // ステータスインジケーター
        const statusIndicator = document.getElementById("statusIndicator");
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${
                isEnabled ? "enabled" : "disabled"
            }`;
        }

        // ステータステキスト
        const statusText = document.getElementById("statusText");
        if (statusText) {
            statusText.textContent = isEnabled ? "有効" : "無効";
        }

        // トグルボタン
        const toggleBtn = document.getElementById("toggleBtn");
        if (toggleBtn) {
            toggleBtn.textContent = isEnabled ? "無効化" : "有効化";
            toggleBtn.disabled = false;
        }

        // ステータス表示コンポーネントも更新
        if (this.components.statusDisplay) {
            this.components.statusDisplay.update(isEnabled);
        }
    }

    /**
     * 履歴を読み込み
     */
    async loadHistory() {
        try {
            this.log("Loading history...");

            const response = await chrome.runtime.sendMessage({
                type: window.MRA_CONSTANTS.MESSAGE_TYPES.GET_ANALYSIS_HISTORY,
                limit: 5,
            });

            this.log("History response:", response);

            if (response && response.success) {
                this.updateHistoryUI(response.data);
            } else {
                this.updateHistoryUI([]);
            }
        } catch (error) {
            this.error("Failed to load history:", error);
            this.updateHistoryUI([]);
        }
    }

    /**
     * 履歴UIを更新
     */
    updateHistoryUI(history) {
        this.log("Updating history UI with:", history);

        if (this.components.historyList) {
            this.components.historyList.render(history);
        } else {
            // フォールバック
            const historyList = document.getElementById("historyList");
            if (historyList) {
                if (!history || history.length === 0) {
                    historyList.className = "empty-history";
                    historyList.textContent = "履歴はまだありません";
                } else {
                    historyList.className = "";
                    historyList.innerHTML = "";

                    history.forEach((item) => {
                        const historyItem = this.createHistoryItem(item);
                        historyList.appendChild(historyItem);
                    });
                }
            }
        }
    }

    /**
     * 履歴アイテムを作成
     */
    createHistoryItem(item) {
        const div = document.createElement("div");
        div.className = "history-item";

        const scoreColor = this.getScoreColor(item.trustScore);
        const date = new Date(item.timestamp).toLocaleDateString("ja-JP");

        div.innerHTML = `
            <div class="place-name">${this.escapeHtml(item.placeName)}</div>
            <div class="score">
                <span class="score-value" style="background-color: ${scoreColor}">
                    ${item.trustScore}
                </span>
                <span class="date">${date}</span>
            </div>
        `;

        return div;
    }

    /**
     * スコアに応じた色を取得
     */
    getScoreColor(score) {
        if (score >= 80) return "#4caf50";
        if (score >= 60) return "#ff9800";
        if (score >= 40) return "#f44336";
        return "#9c27b0";
    }

    /**
     * 拡張機能の有効/無効を切り替え
     */
    async toggleExtension() {
        try {
            this.log("Toggling extension...");

            const currentEnabled = this.currentSettings?.isEnabled !== false;
            const newEnabled = !currentEnabled;

            this.log(
                "Current enabled:",
                currentEnabled,
                "New enabled:",
                newEnabled
            );

            this.controllers.ui.showLoading(true);

            const response = await chrome.runtime.sendMessage({
                type: window.MRA_CONSTANTS.MESSAGE_TYPES.SET_STORAGE_DATA,
                data: { isEnabled: newEnabled },
            });

            this.log("Toggle response:", response);

            if (response && response.success) {
                this.currentSettings = response.data;
                this.updateStatusDisplay(this.currentSettings);
                this.showSuccess(
                    newEnabled
                        ? "拡張機能を有効にしました"
                        : "拡張機能を無効にしました"
                );
                this.log("Extension toggle successful");
            } else {
                throw new Error(response?.error || "切り替えに失敗しました");
            }
        } catch (error) {
            this.error("Failed to toggle extension:", error);
            this.showError("切り替えに失敗しました: " + error.message);
        } finally {
            this.controllers.ui.showLoading(false);
        }
    }

    /**
     * 設定を保存
     */
    async saveSettings() {
        try {
            this.log("Saving settings...");

            this.controllers.ui.showLoading(true);

            const settingsData = this.collectSettingsData();
            this.log("Collected settings data:", settingsData);

            const response = await chrome.runtime.sendMessage({
                type: window.MRA_CONSTANTS.MESSAGE_TYPES.SET_STORAGE_DATA,
                data: { settings: settingsData },
            });

            this.log("Save settings response:", response);

            if (response && response.success) {
                this.currentSettings = response.data;
                this.showSuccess("設定を保存しました");
                this.log("Settings saved successfully");
            } else {
                throw new Error(response?.error || "設定の保存に失敗しました");
            }
        } catch (error) {
            this.error("Failed to save settings:", error);
            this.showError("設定の保存に失敗しました: " + error.message);
        } finally {
            this.controllers.ui.showLoading(false);
        }
    }

    /**
     * 設定データを収集
     */
    collectSettingsData() {
        const data = {
            analysisMode:
                document.getElementById("analysisMode")?.value || "standard",
            showDetailedAnalysis:
                document.getElementById("showDetailedAnalysis")?.checked ||
                false,
            minimumReviewsForAnalysis:
                parseInt(document.getElementById("minimumReviews")?.value) || 5,
            suspicionThreshold:
                parseInt(
                    document.getElementById("suspicionThreshold")?.value
                ) || 40,
        };

        this.log("Collected settings:", data);
        return data;
    }

    /**
     * 手動分析を実行要求
     */
    async requestManualAnalysis() {
        try {
            this.log("Requesting manual analysis...");

            this.controllers.ui.showLoading(true);

            // アクティブタブを取得
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });

            this.log("Active tab:", tab);

            if (!tab || !tab.url || !tab.url.includes("google.com/maps")) {
                throw new Error("Google Mapsページで実行してください");
            }

            // Content scriptに手動分析を要求
            await chrome.tabs.sendMessage(tab.id, {
                type: window.MRA_CONSTANTS.MESSAGE_TYPES
                    .MANUAL_ANALYSIS_REQUEST,
            });

            this.showSuccess("分析を開始しました");
            this.log("Manual analysis request sent successfully");

            // 少し待ってから履歴を更新
            setTimeout(() => {
                this.loadHistory();
            }, 2000);
        } catch (error) {
            this.error("Manual analysis failed:", error);
            this.showError("分析の実行に失敗しました: " + error.message);
        } finally {
            this.controllers.ui.showLoading(false);
        }
    }

    /**
     * 設定変更時の処理
     */
    onSettingChange(settingId, value) {
        this.log(`Setting ${settingId} changed to:`, value);
        // リアルタイムでの設定反映が必要な場合はここで処理
    }

    /**
     * UIを更新
     */
    updateUI() {
        if (this.controllers.ui) {
            this.controllers.ui.updateDisplay();
        }
    }

    /**
     * キーボードショートカットの処理
     */
    handleKeyboardShortcuts(event) {
        if (event.key === "Escape") {
            window.close();
        } else if (event.ctrlKey && event.key === "s") {
            event.preventDefault();
            this.saveSettings();
        } else if (event.ctrlKey && event.key === "r") {
            event.preventDefault();
            this.requestManualAnalysis();
        } else if (event.ctrlKey && event.shiftKey && event.key === "D") {
            // デバッグモード切り替え
            this.debugMode = !this.debugMode;
            this.log("Debug mode:", this.debugMode ? "enabled" : "disabled");
        }
    }

    /**
     * 成功メッセージを表示
     */
    showSuccess(message) {
        if (this.controllers.ui) {
            this.controllers.ui.showSuccess(message);
        } else {
            console.log("Success:", message);
        }
    }

    /**
     * エラーメッセージを表示
     */
    showError(message) {
        if (this.controllers.ui) {
            this.controllers.ui.showError(message);
        } else {
            console.error("Error:", message);
        }
    }

    /**
     * HTMLエスケープ
     */
    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text || "";
        return div.innerHTML;
    }

    /**
     * ログ出力（デバッグ用）
     */
    log(...args) {
        if (this.debugMode) {
            console.log("[PopupMain]", ...args);
        }
    }

    /**
     * エラーログ出力
     */
    error(...args) {
        console.error("[PopupMain]", ...args);
    }

    /**
     * デバッグ情報を取得
     */
    getDebugInfo() {
        return {
            isInitialized: this.isInitialized,
            debugMode: this.debugMode,
            currentSettings: this.currentSettings,
            controllers: Object.keys(this.controllers),
            components: Object.keys(this.components),
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * クリーンアップ処理
     */
    destroy() {
        // イベントリスナーの削除など
        Object.values(this.controllers).forEach((controller) => {
            if (controller && controller.destroy) {
                controller.destroy();
            }
        });
        this.isInitialized = false;
        this.log("PopupMain destroyed");
    }
}

// 簡略化されたコントローラークラス（popup.js内で定義）
class SettingsController {
    constructor() {
        this.constants = window.MRA_CONSTANTS;
        this.config = window.MRA_CONFIG;
    }

    destroy() {
        // クリーンアップ処理
    }
}

class HistoryController {
    constructor() {
        this.constants = window.MRA_CONSTANTS;
    }

    destroy() {
        // クリーンアップ処理
    }
}

class UIController {
    constructor() {
        this.loadingElement = document.getElementById("loading");
        this.errorElement = document.getElementById("errorMessage");
        this.successElement = document.getElementById("successMessage");
    }

    showLoading(show = true) {
        if (this.loadingElement) {
            this.loadingElement.style.display = show ? "block" : "none";
        }
    }

    showError(message) {
        if (this.errorElement) {
            this.errorElement.textContent = message;
            this.errorElement.style.display = "block";
            setTimeout(() => {
                this.errorElement.style.display = "none";
            }, 5000);
        }
    }

    showSuccess(message) {
        if (this.successElement) {
            this.successElement.textContent = message;
            this.successElement.style.display = "block";
            setTimeout(() => {
                this.successElement.style.display = "none";
            }, 3000);
        }
    }

    updateDisplay() {
        console.log("UI display updated");
    }

    destroy() {
        // クリーンアップ処理
    }
}

class StatusDisplay {
    constructor(indicatorElement, textElement) {
        this.indicator = indicatorElement;
        this.text = textElement;
    }

    update(isEnabled) {
        if (this.indicator) {
            this.indicator.className = `status-indicator ${
                isEnabled ? "enabled" : "disabled"
            }`;
        }
        if (this.text) {
            this.text.textContent = isEnabled ? "有効" : "無効";
        }
    }
}

class SettingsPanel {
    constructor() {
        // 設定パネルの初期化
    }
}

class HistoryList {
    constructor(containerElement) {
        this.container = containerElement;
    }

    render(historyData) {
        if (!this.container) return;

        if (!historyData || historyData.length === 0) {
            this.container.className = "empty-history";
            this.container.textContent = "履歴はまだありません";
            return;
        }

        this.container.className = "";
        this.container.innerHTML = "";

        historyData.forEach((item) => {
            const element = this.createHistoryElement(item);
            this.container.appendChild(element);
        });
    }

    createHistoryElement(item) {
        const div = document.createElement("div");
        div.className = "history-item";

        const scoreColor = this.getScoreColor(item.trustScore);
        const date = new Date(item.timestamp).toLocaleDateString("ja-JP");

        div.innerHTML = `
            <div class="place-name">${this.escapeHtml(item.placeName)}</div>
            <div class="score">
                <span class="score-value" style="background-color: ${scoreColor}">
                    ${item.trustScore}
                </span>
                <span class="date">${date}</span>
            </div>
        `;

        return div;
    }

    getScoreColor(score) {
        if (score >= 80) return "#4caf50";
        if (score >= 60) return "#ff9800";
        if (score >= 40) return "#f44336";
        return "#9c27b0";
    }

    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text || "";
        return div.innerHTML;
    }
}

// ポップアップ初期化
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded, initializing popup...");
    window.popupMain = new PopupMain();
});

// ページ離脱時のクリーンアップ
window.addEventListener("beforeunload", () => {
    if (window.popupMain) {
        window.popupMain.destroy();
    }
});

// エラーハンドリング
window.addEventListener("error", (event) => {
    console.error("Popup error:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection in popup:", event.reason);
});

// デバッグ用グローバル関数
window.getPopupDebugInfo = () => {
    if (window.popupMain) {
        return window.popupMain.getDebugInfo();
    }
    return { error: "PopupMain not initialized" };
};

window.enablePopupDebug = () => {
    if (window.popupMain) {
        window.popupMain.debugMode = true;
        console.log("Popup debug mode enabled");
    }
};
