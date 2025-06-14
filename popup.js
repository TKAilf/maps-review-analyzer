// popup.js - 修正版

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
}
