// popup.js

/**
 * ポップアップメインクラス
 */
class PopupMain {
    constructor() {
        this.controllers = {};
        this.components = {};
        this.init();
    }

    /**
     * 初期化処理
     */
    async init() {
        try {
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

            console.log("Popup initialized successfully");
        } catch (error) {
            console.error("Failed to initialize popup:", error);
            this.showError("初期化に失敗しました: " + error.message);
        }
    }

    /**
     * 必要なモジュールが読み込まれているかチェック
     */
    verifyModules() {
        const requiredModules = [
            "MRA_CONSTANTS",
            "MRA_CONFIG",
            "SettingsController",
            "HistoryController",
            "UIController",
        ];

        const missingModules = requiredModules.filter(
            (module) => !window[module]
        );

        if (missingModules.length > 0) {
            throw new Error(
                `Required modules not loaded: ${missingModules.join(", ")}`
            );
        }
    }

    /**
     * コントローラーの初期化
     */
    initializeControllers() {
        this.controllers.settings = new window.SettingsController();
        this.controllers.history = new window.HistoryController();
        this.controllers.ui = new window.UIController();
    }

    /**
     * コンポーネントの初期化
     */
    initializeComponents() {
        this.components.statusDisplay = new window.StatusDisplay(
            document.getElementById("statusIndicator"),
            document.getElementById("statusText")
        );

        this.components.settingsPanel = new window.SettingsPanel();
        this.components.historyList = new window.HistoryList(
            document.getElementById("historyList")
        );
    }

    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        // ボタンイベント
        document.getElementById("toggleBtn")?.addEventListener("click", () => {
            this.controllers.settings.toggleExtension();
        });

        document.getElementById("saveBtn")?.addEventListener("click", () => {
            this.controllers.settings.saveSettings();
        });

        document.getElementById("analyzeBtn")?.addEventListener("click", () => {
            this.requestManualAnalysis();
        });

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
                    this.controllers.settings.onSettingChange(
                        id,
                        element.value || element.checked
                    );
                });
            }
        });

        // キーボードショートカット
        document.addEventListener("keydown", (event) => {
            this.handleKeyboardShortcuts(event);
        });
    }

    /**
     * 初期データの読み込み
     */
    async loadInitialData() {
        // 設定の読み込み
        await this.controllers.settings.loadSettings();

        // 履歴の読み込み
        await this.controllers.history.loadHistory();

        // UIの更新
        this.controllers.ui.updateDisplay();
    }

    /**
     * 手動分析の実行要求
     */
    async requestManualAnalysis() {
        try {
            this.controllers.ui.showLoading(true);

            // アクティブタブを取得
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });

            if (!tab || !tab.url || !tab.url.includes("google.com/maps")) {
                throw new Error("Google Mapsページで実行してください");
            }

            // Content scriptに手動分析を要求
            await chrome.tabs.sendMessage(tab.id, {
                type: window.MRA_CONSTANTS.MESSAGE_TYPES
                    .MANUAL_ANALYSIS_REQUEST,
            });

            this.controllers.ui.showSuccess("分析を開始しました");

            // 少し待ってから履歴を更新
            setTimeout(() => {
                this.controllers.history.loadHistory();
            }, 2000);
        } catch (error) {
            console.error("Manual analysis failed:", error);
            this.controllers.ui.showError(
                "分析の実行に失敗しました: " + error.message
            );
        } finally {
            this.controllers.ui.showLoading(false);
        }
    }

    /**
     * キーボードショートカットの処理
     * @param {KeyboardEvent} event - キーボードイベント
     */
    handleKeyboardShortcuts(event) {
        if (event.key === "Escape") {
            window.close();
        } else if (event.ctrlKey && event.key === "s") {
            event.preventDefault();
            this.controllers.settings.saveSettings();
        } else if (event.ctrlKey && event.key === "r") {
            event.preventDefault();
            this.requestManualAnalysis();
        }
    }

    /**
     * エラー表示
     * @param {string} message - エラーメッセージ
     */
    showError(message) {
        this.controllers.ui.showError(message);
    }

    /**
     * クリーンアップ処理
     */
    destroy() {
        // イベントリスナーの削除など
        Object.values(this.controllers).forEach((controller) => {
            if (controller.destroy) {
                controller.destroy();
            }
        });
    }
}

// ポップアップ初期化
document.addEventListener("DOMContentLoaded", () => {
    window.popupMain = new PopupMain();
});

// ページ離脱時のクリーンアップ
window.addEventListener("beforeunload", () => {
    if (window.popupMain) {
        window.popupMain.destroy();
    }
});
