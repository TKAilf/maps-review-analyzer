// src/shared/config.js

/**
 * デフォルト設定値
 */
const DEFAULT_SETTINGS = {
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

/**
 * 分析設定のスキーマ定義
 */
const SETTINGS_SCHEMA = {
    isEnabled: {
        type: "boolean",
        default: true,
        description: "拡張機能の有効/無効",
    },
    settings: {
        type: "object",
        properties: {
            analysisMode: {
                type: "string",
                enum: ["lenient", "standard", "strict"],
                default: "standard",
                description: "分析の厳格さ",
            },
            showDetailedAnalysis: {
                type: "boolean",
                default: true,
                description: "詳細分析結果の表示",
            },
            minimumReviewsForAnalysis: {
                type: "number",
                min: 1,
                max: 100,
                default: 5,
                description: "分析に必要な最小レビュー数",
            },
            suspicionThreshold: {
                type: "number",
                min: 0,
                max: 100,
                default: 40,
                description: "疑念を示すスコア閾値",
            },
            autoAnalysis: {
                type: "boolean",
                default: true,
                description: "ページ読み込み時の自動分析",
            },
            debugMode: {
                type: "boolean",
                default: false,
                description: "デバッグモード",
            },
        },
    },
};

/**
 * URL パターン設定
 */
const URL_PATTERNS = {
    GOOGLE_MAPS: [
        "*://www.google.com/maps/*",
        "*://maps.google.com/*",
        "*://google.com/maps/*",
    ],
    EXCLUDE_PATTERNS: ["*://www.google.com/maps/embed/*"],
};

/**
 * パフォーマンス設定
 */
const PERFORMANCE_CONFIG = {
    // DOM操作の最大試行回数
    MAX_DOM_RETRIES: 5,

    // MutationObserver の設定
    MUTATION_OBSERVER_CONFIG: {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false,
    },

    // バッチ処理のサイズ
    BATCH_PROCESSING_SIZE: 10,

    // メモリ使用量制限
    MAX_CACHED_RESULTS: 50,
};

/**
 * 国際化対応設定
 */
const I18N_CONFIG = {
    DEFAULT_LOCALE: "ja",
    SUPPORTED_LOCALES: ["ja", "en"],

    // 日付パターン（各言語での「最近」を示すパターン）
    RECENT_DATE_PATTERNS: {
        ja: [/(\d+)日前/, /(\d+)週間前/, /(\d+)時間前/, /(\d+)分前/],
        en: [
            /(\d+)\s+days?\s+ago/,
            /(\d+)\s+weeks?\s+ago/,
            /(\d+)\s+hours?\s+ago/,
            /(\d+)\s+minutes?\s+ago/,
        ],
    },
};

/**
 * 分析アルゴリズムの重み設定
 */
const ANALYSIS_WEIGHTS = {
    polarizedRatings: {
        weight: 1.0,
        maxScore: 90,
        description: "極端な評価の偏り",
    },
    burstPosting: {
        weight: 0.8,
        maxScore: 80,
        description: "短期間での集中投稿",
    },
    shortReviews: {
        weight: 0.6,
        maxScore: 60,
        description: "極端に短いレビュー",
    },
    duplicatePatterns: {
        weight: 1.2,
        maxScore: 100,
        description: "類似・重複レビュー",
    },
    newAccounts: {
        weight: 0.5,
        maxScore: 50,
        description: "新規アカウントからの投稿",
    },
};

/**
 * 機能フラグ設定
 */
const FEATURE_FLAGS = {
    // 実験的機能
    EXPERIMENTAL_NLP_ANALYSIS: false,
    SENTIMENT_ANALYSIS: false,
    REVIEWER_HISTORY_CHECK: false,

    // パフォーマンス最適化
    LAZY_LOADING: true,
    BACKGROUND_ANALYSIS: true,
    CACHE_OPTIMIZATION: true,

    // デバッグ機能
    CONSOLE_LOGGING: false,
    PERFORMANCE_MONITORING: false,
    ERROR_REPORTING: true,
};

/**
 * API エンドポイント設定（将来の拡張用）
 */
const API_CONFIG = {
    BASE_URL: null, // 現在は外部APIを使用しない
    ENDPOINTS: {
        REPORT_ANALYSIS: "/api/analysis/report",
        GET_REPUTATION: "/api/reputation/check",
        FEEDBACK: "/api/feedback",
    },
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
};

/**
 * セキュリティ設定
 */
const SECURITY_CONFIG = {
    // CSP設定
    ALLOWED_DOMAINS: [
        "www.google.com",
        "maps.google.com",
        "googleusercontent.com",
    ],

    // データ暗号化（将来の機能）
    ENCRYPT_SENSITIVE_DATA: false,

    // プライバシー保護
    ANONYMIZE_USER_DATA: true,
    DATA_RETENTION_DAYS: 30,
};

/**
 * 設定検証関数
 */
const CONFIG_VALIDATORS = {
    /**
     * 設定値を検証する
     * @param {Object} settings - 検証する設定
     * @returns {Object} - 検証結果とエラー
     */
    validateSettings(settings) {
        const errors = [];
        const validated = {};

        // 基本構造の検証
        if (typeof settings !== "object" || settings === null) {
            errors.push("設定は有効なオブジェクトである必要があります");
            return { valid: false, errors, settings: DEFAULT_SETTINGS };
        }

        // isEnabledの検証
        if (typeof settings.isEnabled === "boolean") {
            validated.isEnabled = settings.isEnabled;
        } else {
            validated.isEnabled = DEFAULT_SETTINGS.isEnabled;
            errors.push("isEnabledはboolean値である必要があります");
        }

        // settings.settingsの検証
        validated.settings = this.validateAnalysisSettings(
            settings.settings || {}
        );

        return {
            valid: errors.length === 0,
            errors,
            settings: validated,
        };
    },

    /**
     * 分析設定を検証する
     * @param {Object} analysisSettings - 分析設定
     * @returns {Object} - 検証済み設定
     */
    validateAnalysisSettings(analysisSettings) {
        const validated = {};
        const schema = SETTINGS_SCHEMA.settings.properties;

        Object.keys(schema).forEach((key) => {
            const config = schema[key];
            const value = analysisSettings[key];

            switch (config.type) {
                case "string":
                    if (config.enum && config.enum.includes(value)) {
                        validated[key] = value;
                    } else {
                        validated[key] = config.default;
                    }
                    break;

                case "boolean":
                    validated[key] =
                        typeof value === "boolean" ? value : config.default;
                    break;

                case "number":
                    if (
                        typeof value === "number" &&
                        value >= (config.min || -Infinity) &&
                        value <= (config.max || Infinity)
                    ) {
                        validated[key] = value;
                    } else {
                        validated[key] = config.default;
                    }
                    break;

                default:
                    validated[key] = config.default;
            }
        });

        return validated;
    },
};

/**
 * 設定ユーティリティ関数
 */
const CONFIG_UTILS = {
    /**
     * デフォルト設定を取得
     * @returns {Object} - デフォルト設定のコピー
     */
    getDefaultSettings() {
        return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    },

    /**
     * 設定をマージする
     * @param {Object} current - 現在の設定
     * @param {Object} updates - 更新する設定
     * @returns {Object} - マージされた設定
     */
    mergeSettings(current, updates) {
        const merged = JSON.parse(JSON.stringify(current));

        if (updates.isEnabled !== undefined) {
            merged.isEnabled = updates.isEnabled;
        }

        if (updates.settings && typeof updates.settings === "object") {
            Object.assign(merged.settings, updates.settings);
        }

        return CONFIG_VALIDATORS.validateSettings(merged).settings;
    },

    /**
     * 設定が変更されたかチェック
     * @param {Object} oldSettings - 古い設定
     * @param {Object} newSettings - 新しい設定
     * @returns {boolean} - 変更があったかどうか
     */
    hasSettingsChanged(oldSettings, newSettings) {
        return JSON.stringify(oldSettings) !== JSON.stringify(newSettings);
    },
};

// グローバルスコープに設定を公開
if (typeof window !== "undefined") {
    window.MRA_CONFIG = {
        DEFAULT_SETTINGS,
        SETTINGS_SCHEMA,
        URL_PATTERNS,
        PERFORMANCE_CONFIG,
        I18N_CONFIG,
        ANALYSIS_WEIGHTS,
        FEATURE_FLAGS,
        API_CONFIG,
        SECURITY_CONFIG,
        CONFIG_VALIDATORS,
        CONFIG_UTILS,
    };
}
