// popup.js - URL判定修正版

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
        this.constants = null;
        this.config = null;
        this.init();
    }

    /**
     * 初期化処理
     */
    async init() {
        try {
            this.log("Popup initializing...");

            // 設定ファイルの読み込み確認
            await this.waitForModules();

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
     * モジュールの読み込みを待機
     */
    async waitForModules() {
        let attempts = 0;
        const maxAttempts = 20; // 最大2秒待機

        while (attempts < maxAttempts) {
            if (window.MRA_CONSTANTS && window.MRA_CONFIG) {
                this.constants = window.MRA_CONSTANTS;
                this.config = window.MRA_CONFIG;
                this.log("Modules loaded successfully");
                return;
            }

            await new Promise((resolve) => setTimeout(resolve, 100));
            attempts++;
        }

        // フォールバック設定
        this.initializeFallbackModules();
    }

    /**
     * フォールバック設定を初期化
     */
    initializeFallbackModules() {
        this.log("Using fallback modules");

        this.constants = {
            MESSAGE_TYPES: {
                GET_SETTINGS: "GET_SETTINGS",
                SET_STORAGE_DATA: "SET_STORAGE_DATA",
                SAVE_ANALYSIS_RESULT: "SAVE_ANALYSIS_RESULT",
                GET_ANALYSIS_HISTORY: "GET_ANALYSIS_HISTORY",
                MANUAL_ANALYSIS_REQUEST: "MANUAL_ANALYSIS_REQUEST",
            },
        };

        this.config = {
            DEFAULT_SETTINGS: {
                isEnabled: true,
                settings: {
                    analysisMode: "standard",
                    showDetailedAnalysis: true,
                    minimumReviewsForAnalysis: 5,
                    suspicionThreshold: 40,
                },
            },
        };
    }

    /**
     * モジュールの検証
     */
    verifyModules() {
        if (!this.constants || !this.config) {
            throw new Error("Required modules not loaded properly");
        }
        this.log("Modules verified successfully");
    }

    /**
     * コントローラーを初期化
     */
    initializeControllers() {
        try {
            // SettingsControllerが利用可能な場合は使用
            if (window.SettingsController) {
                this.controllers.settings = new window.SettingsController();
            }

            // HistoryControllerが利用可能な場合は使用
            if (window.HistoryController) {
                this.controllers.history = new window.HistoryController();
            }

            // UIControllerが利用可能な場合は使用
            if (window.UIController) {
                this.controllers.ui = new window.UIController();
            }

            this.log("Controllers initialized");
        } catch (error) {
            this.error("Failed to initialize controllers:", error);
        }
    }

    /**
     * コンポーネントを初期化
     */
    initializeComponents() {
        try {
            // ステータス表示コンポーネント
            const statusIndicator = document.getElementById("statusIndicator");
            const statusText = document.getElementById("statusText");
            if (window.StatusDisplay && statusIndicator && statusText) {
                this.components.statusDisplay = new window.StatusDisplay(
                    statusIndicator,
                    statusText
                );
            }

            // 設定パネルコンポーネント
            if (window.SettingsPanel) {
                this.components.settingsPanel = new window.SettingsPanel();
            }

            // 履歴リストコンポーネント
            const historyList = document.getElementById("historyList");
            if (window.HistoryList && historyList) {
                this.components.historyList = new window.HistoryList(
                    historyList
                );
            }

            this.log("Components initialized");
        } catch (error) {
            this.error("Failed to initialize components:", error);
        }
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        try {
            // 切り替えボタン
            const toggleBtn = document.getElementById("toggleBtn");
            if (toggleBtn) {
                toggleBtn.addEventListener("click", () =>
                    this.toggleExtension()
                );
            }

            // 保存ボタン
            const saveBtn = document.getElementById("saveBtn");
            if (saveBtn) {
                saveBtn.addEventListener("click", () => this.saveSettings());
            }

            // 分析ボタン
            const analyzeBtn = document.getElementById("analyzeBtn");
            if (analyzeBtn) {
                analyzeBtn.addEventListener("click", () =>
                    this.requestManualAnalysis()
                );
            }

            // 設定変更のリスナー
            const settingsInputs = document.querySelectorAll(
                "#analysisMode, #showDetailedAnalysis, #minimumReviews, #suspicionThreshold"
            );
            settingsInputs.forEach((input) => {
                input.addEventListener("change", () =>
                    this.onSettingChange(input)
                );
            });

            this.log("Event listeners setup completed");
        } catch (error) {
            this.error("Failed to setup event listeners:", error);
        }
    }

    /**
     * 初期データを読み込み
     */
    async loadInitialData() {
        try {
            this.showLoading(true);

            // 設定を読み込み
            await this.loadSettings();

            // 履歴を読み込み
            await this.loadHistory();

            this.hideLoading();
            this.log("Initial data loaded successfully");
        } catch (error) {
            this.hideLoading();
            this.error("Failed to load initial data:", error);
            this.showError("データの読み込みに失敗しました");
        }
    }

    /**
     * 設定を読み込み
     */
    async loadSettings() {
        try {
            const response = await this.sendMessage({
                type: this.constants.MESSAGE_TYPES.GET_SETTINGS,
            });

            if (response && response.success) {
                this.currentSettings = response.data;
                this.updateSettingsUI(this.currentSettings);
                this.log("Settings loaded:", this.currentSettings);
            } else {
                throw new Error("Failed to get settings from background");
            }
        } catch (error) {
            this.error("Settings load error:", error);
            // フォールバック設定を使用
            this.currentSettings = this.config.DEFAULT_SETTINGS;
            this.updateSettingsUI(this.currentSettings);
        }
    }

    /**
     * 履歴を読み込み
     */
    async loadHistory() {
        try {
            const response = await this.sendMessage({
                type: this.constants.MESSAGE_TYPES.GET_ANALYSIS_HISTORY,
                limit: 5,
            });

            if (response && response.success) {
                this.updateHistoryUI(response.data || []);
                this.log("History loaded");
            }
        } catch (error) {
            this.error("History load error:", error);
            this.updateHistoryUI([]);
        }
    }

    /**
     * 設定UIを更新
     */
    updateSettingsUI(settings) {
        try {
            // 有効/無効状態を更新
            const isEnabled = settings.isEnabled !== false;
            this.updateToggleButton(isEnabled);
            this.updateStatusDisplay(isEnabled);

            // 各設定値を更新
            const analysisMode = document.getElementById("analysisMode");
            if (analysisMode) {
                analysisMode.value =
                    settings.settings?.analysisMode || "standard";
            }

            const showDetailedAnalysis = document.getElementById(
                "showDetailedAnalysis"
            );
            if (showDetailedAnalysis) {
                showDetailedAnalysis.checked =
                    settings.settings?.showDetailedAnalysis !== false;
            }

            const minimumReviews = document.getElementById("minimumReviews");
            if (minimumReviews) {
                minimumReviews.value =
                    settings.settings?.minimumReviewsForAnalysis || 5;
            }

            const suspicionThreshold =
                document.getElementById("suspicionThreshold");
            if (suspicionThreshold) {
                suspicionThreshold.value =
                    settings.settings?.suspicionThreshold || 40;
            }

            this.log("Settings UI updated");
        } catch (error) {
            this.error("Failed to update settings UI:", error);
        }
    }

    /**
     * 履歴UIを更新
     */
    updateHistoryUI(history) {
        try {
            if (this.components.historyList) {
                this.components.historyList.render(history);
            } else {
                // フォールバック処理
                const historyContainer = document.getElementById("historyList");
                if (historyContainer) {
                    if (!history || history.length === 0) {
                        historyContainer.className = "empty-history";
                        historyContainer.textContent = "履歴はまだありません";
                    } else {
                        historyContainer.className = "";
                        historyContainer.innerHTML = "";

                        history.forEach((item) => {
                            const element = this.createHistoryElement(item);
                            historyContainer.appendChild(element);
                        });
                    }
                }
            }
            this.log("History UI updated");
        } catch (error) {
            this.error("Failed to update history UI:", error);
        }
    }

    /**
     * 履歴要素を作成
     */
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

    /**
     * スコアに対応する色を取得
     */
    getScoreColor(score) {
        if (score >= 80) return "#4caf50";
        if (score >= 60) return "#ff9800";
        if (score >= 40) return "#f44336";
        return "#9c27b0";
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
     * ステータス表示を更新
     */
    updateStatusDisplay(isEnabled) {
        if (this.components.statusDisplay) {
            this.components.statusDisplay.update(isEnabled);
        } else {
            // フォールバック処理
            const statusIndicator = document.getElementById("statusIndicator");
            const statusText = document.getElementById("statusText");

            if (statusIndicator) {
                statusIndicator.className = `status-indicator ${
                    isEnabled ? "enabled" : "disabled"
                }`;
            }

            if (statusText) {
                statusText.textContent = isEnabled ? "有効" : "無効";
            }
        }
    }

    /**
     * 切り替えボタンを更新
     */
    updateToggleButton(isEnabled) {
        const toggleBtn = document.getElementById("toggleBtn");
        if (toggleBtn) {
            toggleBtn.textContent = isEnabled ? "無効化" : "有効化";
            toggleBtn.disabled = false;
        }
    }

    /**
     * 拡張機能の有効/無効を切り替え
     */
    async toggleExtension() {
        try {
            const currentEnabled = this.currentSettings?.isEnabled !== false;
            const newEnabled = !currentEnabled;

            this.showLoading(true);

            const response = await this.sendMessage({
                type: this.constants.MESSAGE_TYPES.SET_STORAGE_DATA,
                data: { isEnabled: newEnabled },
            });

            this.hideLoading();

            if (response && response.success) {
                this.currentSettings = response.data;
                this.updateToggleButton(newEnabled);
                this.updateStatusDisplay(newEnabled);
                this.showSuccess(
                    newEnabled
                        ? "拡張機能を有効にしました"
                        : "拡張機能を無効にしました"
                );
            } else {
                throw new Error("Failed to toggle extension");
            }
        } catch (error) {
            this.hideLoading();
            this.error("Failed to toggle extension:", error);
            this.showError("切り替えに失敗しました");
        }
    }

    /**
     * 設定を保存
     */
    async saveSettings() {
        try {
            this.showLoading(true);

            const settingsData = this.collectSettingsFromUI();

            const response = await this.sendMessage({
                type: this.constants.MESSAGE_TYPES.SET_STORAGE_DATA,
                data: settingsData,
            });

            this.hideLoading();

            if (response && response.success) {
                this.currentSettings = response.data;
                this.showSuccess("設定を保存しました");
            } else {
                throw new Error("Failed to save settings");
            }
        } catch (error) {
            this.hideLoading();
            this.error("Failed to save settings:", error);
            this.showError("設定の保存に失敗しました");
        }
    }

    /**
     * UIから設定値を収集
     */
    collectSettingsFromUI() {
        return {
            settings: {
                analysisMode:
                    document.getElementById("analysisMode")?.value ||
                    "standard",
                showDetailedAnalysis:
                    document.getElementById("showDetailedAnalysis")?.checked !==
                    false,
                minimumReviewsForAnalysis:
                    parseInt(
                        document.getElementById("minimumReviews")?.value
                    ) || 5,
                suspicionThreshold:
                    parseInt(
                        document.getElementById("suspicionThreshold")?.value
                    ) || 40,
            },
        };
    }

    /**
     * Google MapsのURLかどうかを判定する（改善版）
     * @param {string} url - 判定するURL
     * @returns {boolean} Google MapsのURLかどうか
     */
    isGoogleMapsUrl(url) {
        if (!url || typeof url !== "string") {
            return false;
        }

        try {
            const urlObj = new URL(url);

            // Google Mapsのドメインパターンをチェック
            const validDomains = [
                "www.google.com",
                "maps.google.com",
                "google.com",
                "www.google.co.jp",
                "maps.google.co.jp",
                "google.co.jp",
                // その他の国別ドメイン
                "www.google.co.uk",
                "maps.google.co.uk",
                "www.google.de",
                "maps.google.de",
                "www.google.fr",
                "maps.google.fr",
                // 一般的なパターン
            ];

            const isValidDomain = validDomains.some(
                (domain) =>
                    urlObj.hostname === domain ||
                    urlObj.hostname.endsWith("." + domain)
            );

            const isValidPath = urlObj.pathname.includes("/maps");

            this.log("URL validation:", {
                url: url,
                hostname: urlObj.hostname,
                pathname: urlObj.pathname,
                isValidDomain: isValidDomain,
                isValidPath: isValidPath,
                result: isValidDomain && isValidPath,
            });

            return isValidDomain && isValidPath;
        } catch (error) {
            this.error("URL parsing error:", error);
            return false;
        }
    }

    /**
     * 手動分析を要求
     */
    async requestManualAnalysis() {
        try {
            // アクティブタブを取得
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });

            if (!tab || !tab.url) {
                this.showError("アクティブなタブが見つかりません");
                return;
            }

            this.log("Current tab URL:", tab.url);

            // URLが Google Maps かどうかを判定
            if (!this.isGoogleMapsUrl(tab.url)) {
                this.showError("Google Mapsページで実行してください");
                return;
            }

            this.showLoading(true);

            // コンテンツスクリプトに分析要求を送信
            await chrome.tabs.sendMessage(tab.id, {
                type: this.constants.MESSAGE_TYPES.MANUAL_ANALYSIS_REQUEST,
            });

            this.hideLoading();
            this.showSuccess("分析を開始しました");

            // 少し待ってから履歴を更新
            setTimeout(() => {
                this.loadHistory();
            }, 2000);
        } catch (error) {
            this.hideLoading();
            this.error("Failed to request manual analysis:", error);

            // エラーメッセージを詳細化
            let errorMessage = "分析の実行に失敗しました";
            if (error.message.includes("Could not establish connection")) {
                errorMessage =
                    "ページの読み込みが完了していません。少し待ってから再試行してください";
            } else if (
                error.message.includes("Extension context invalidated")
            ) {
                errorMessage = "拡張機能の再読み込みが必要です";
            }

            this.showError(errorMessage);
        }
    }

    /**
     * 設定変更時の処理
     */
    onSettingChange(input) {
        try {
            const { id, value, checked, type } = input;
            const finalValue = type === "checkbox" ? checked : value;
            this.log(`Setting ${id} changed to:`, finalValue);

            // リアルタイム設定反映は実装しない（保存ボタンでのみ反映）
        } catch (error) {
            this.error("Setting change error:", error);
        }
    }

    /**
     * Background scriptにメッセージを送信
     */
    async sendMessage(message, timeout = 10000) {
        return new Promise((resolve, reject) => {
            console.log("Sending message:", message);

            const timeoutId = setTimeout(() => {
                console.error("Message timeout:", message.type);
                reject(
                    new Error(
                        `Message timeout after ${timeout}ms for ${message.type}`
                    )
                );
            }, timeout);

            try {
                chrome.runtime.sendMessage(message, (response) => {
                    clearTimeout(timeoutId);

                    console.log("Received response:", response);

                    if (chrome.runtime.lastError) {
                        console.error(
                            "Chrome runtime error:",
                            chrome.runtime.lastError
                        );
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }

                    if (!response) {
                        console.error(
                            "No response received for:",
                            message.type
                        );
                        reject(new Error("No response received"));
                        return;
                    }

                    if (!response.success) {
                        console.error("Response indicated failure:", response);
                        reject(new Error(response.error || "Unknown error"));
                        return;
                    }

                    resolve(response);
                });
            } catch (error) {
                clearTimeout(timeoutId);
                console.error("Exception in sendMessage:", error);
                reject(error);
            }
        });
    }

    /**
     * ローディング表示
     */
    showLoading(show = true) {
        const loading = document.getElementById("loading");
        if (loading) {
            loading.style.display = show ? "block" : "none";
        }

        // ボタンを無効化
        const buttons = document.querySelectorAll(".btn, .toggle-btn");
        buttons.forEach((btn) => {
            btn.disabled = show;
        });
    }

    /**
     * ローディング非表示
     */
    hideLoading() {
        this.showLoading(false);
    }

    /**
     * エラーメッセージ表示
     */
    showError(message) {
        const errorElement = document.getElementById("errorMessage");
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = "block";
            setTimeout(() => {
                errorElement.style.display = "none";
            }, 5000);
        }
    }

    /**
     * 成功メッセージ表示
     */
    showSuccess(message) {
        const successElement = document.getElementById("successMessage");
        if (successElement) {
            successElement.textContent = message;
            successElement.style.display = "block";
            setTimeout(() => {
                successElement.style.display = "none";
            }, 3000);
        }
    }

    /**
     * ログ出力
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
            currentSettings: this.currentSettings,
            controllers: Object.keys(this.controllers),
            components: Object.keys(this.components),
            constantsLoaded: !!this.constants,
            configLoaded: !!this.config,
            timestamp: new Date().toISOString(),
        };
    }
}

// DOMが読み込まれたら初期化
document.addEventListener("DOMContentLoaded", () => {
    window.popupMain = new PopupMain();
});

// グローバルアクセス用
window.PopupMain = PopupMain;
