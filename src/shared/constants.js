// src/shared/constants.js

/**
 * メッセージタイプの定数
 */
const MESSAGE_TYPES = {
    GET_SETTINGS: "GET_SETTINGS",
    SET_STORAGE_DATA: "SET_STORAGE_DATA",
    SAVE_ANALYSIS_RESULT: "SAVE_ANALYSIS_RESULT",
    GET_ANALYSIS_HISTORY: "GET_ANALYSIS_HISTORY",
    PAGE_LOADED: "PAGE_LOADED",
    MANUAL_ANALYSIS_REQUEST: "MANUAL_ANALYSIS_REQUEST",
};

/**
 * 分析モードの定数
 */
const ANALYSIS_MODES = {
    LENIENT: "lenient",
    STANDARD: "standard",
    STRICT: "strict",
};

/**
 * 疑わしいパターンの重要度
 */
const SEVERITY_LEVELS = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
};

/**
 * 疑わしいパターンのタイプ
 */
const PATTERN_TYPES = {
    POLARIZED_RATINGS: "polarized_ratings",
    BURST_POSTING: "burst_posting",
    SHORT_REVIEWS: "short_reviews",
    DUPLICATE_PATTERNS: "duplicate_patterns",
    NEW_ACCOUNTS: "new_accounts",
};

/**
 * 信頼度スコアの閾値
 */
const TRUST_SCORE_THRESHOLDS = {
    HIGH: 80, // 高信頼度
    MEDIUM: 60, // 中信頼度
    LOW: 40, // 低信頼度
};

/**
 * DOMセレクター
 */
const SELECTORS = {
    // Google Maps関連
    GOOGLE_MAPS: {
        REVIEW_ELEMENTS: "[data-review-id]",
        RATING_BARS: '[role="img"][aria-label*="stars"]',
        PLACE_TITLE: [
            'h1[data-attrid="title"]',
            "h1.DUwDvf.lfPIob",
            '[data-value="Reviews"]',
            ".DUwDvf.lfPIob",
        ],
        REVIEW_TEXT: ["[data-expandable-section]", ".MyEned", ".wiI7pd"],
        AUTHOR_INFO: ['[aria-label*="Photo"]', ".d4r55"],
        DATE_INFO: [".rsqaWe", ".DU9Pgb"],
        PHOTOS: ["[data-photo-index]", 'img[src*="googleusercontent"]'],
        OVERALL_RATING: '[jsaction*="pane.rating"]',
        REVIEW_COUNT: '[aria-label*="reviews"]',
    },

    // 挿入位置の候補
    INSERT_LOCATIONS: [
        '[data-value="Reviews"]',
        ".m6QErb.DxyBCb.kA9KIf.dS8AEf.ecceSd",
        ".TIHn2",
        ".m6QErb",
        ".DxyBCb",
        '[role="main"]',
    ],
};

/**
 * 時間関連の定数
 */
const TIME_CONSTANTS = {
    REANALYSIS_DEBOUNCE: 2000, // 再分析のデバウンス時間 (ms)
    PAGE_LOAD_CHECK_INTERVAL: 1000, // ページ読み込みチェック間隔 (ms)
    MESSAGE_TIMEOUT: 5000, // メッセージタイムアウト (ms)
    SUCCESS_HIDE_DELAY: 3000, // 成功メッセージ非表示遅延 (ms)
    ERROR_HIDE_DELAY: 5000, // エラーメッセージ非表示遅延 (ms)
};

/**
 * UI関連の定数
 */
const UI_CONSTANTS = {
    ELEMENT_IDS: {
        TRUST_SCORE: "review-trust-score",
        STATUS_INDICATOR: "statusIndicator",
        STATUS_TEXT: "statusText",
        TOGGLE_BTN: "toggleBtn",
        SAVE_BTN: "saveBtn",
        ANALYZE_BTN: "analyzeBtn",
        ERROR_MESSAGE: "errorMessage",
        SUCCESS_MESSAGE: "successMessage",
        LOADING: "loading",
        HISTORY_LIST: "historyList",
    },

    CLASSES: {
        ENABLED: "enabled",
        DISABLED: "disabled",
        EMPTY_HISTORY: "empty-history",
    },

    COLORS: {
        HIGH_TRUST: "#4caf50",
        MEDIUM_TRUST: "#ff9800",
        LOW_TRUST: "#f44336",
        VERY_LOW_TRUST: "#9c27b0",
    },
};

/**
 * 分析関連の定数
 */
const ANALYSIS_CONSTANTS = {
    // 極端評価検出の閾値
    POLARIZED_THRESHOLDS: {
        [ANALYSIS_MODES.STRICT]: 0.6,
        [ANALYSIS_MODES.STANDARD]: 0.7,
        [ANALYSIS_MODES.LENIENT]: 0.8,
    },

    // その他の検出閾値
    BURST_POSTING_THRESHOLD: 0.3,
    SHORT_REVIEW_THRESHOLD: 0.4,
    NEW_ACCOUNT_THRESHOLD: 0.3,
    TEXT_SIMILARITY_THRESHOLD: 0.8,

    // レビュー文字数
    SHORT_REVIEW_LENGTH: 10,
    SUSPICIOUS_REVIEW_LENGTH: 20,

    // 履歴保持件数
    MAX_HISTORY_ITEMS: 20,
    MAX_DISPLAY_HISTORY: 5,
};

/**
 * エラーメッセージ
 */
const ERROR_MESSAGES = {
    SETTINGS_LOAD_FAILED: "設定の読み込みに失敗しました",
    SETTINGS_SAVE_FAILED: "設定の保存に失敗しました",
    ANALYSIS_FAILED: "分析の実行に失敗しました",
    NOT_GOOGLE_MAPS: "Google Mapsページで実行してください",
    COMMUNICATION_FAILED: "Background scriptとの通信に失敗しました",
    NO_RESPONSE: "Background scriptからレスポンスがありません",
    TOGGLE_FAILED: "切り替えに失敗しました",
};

/**
 * 成功メッセージ
 */
const SUCCESS_MESSAGES = {
    SETTINGS_SAVED: "設定を保存しました",
    ANALYSIS_STARTED: "分析を開始しました",
    EXTENSION_ENABLED: "拡張機能を有効にしました",
    EXTENSION_DISABLED: "拡張機能を無効にしました",
};

// グローバルスコープに定数を公開
if (typeof window !== "undefined") {
    window.MRA_CONSTANTS = {
        MESSAGE_TYPES,
        ANALYSIS_MODES,
        SEVERITY_LEVELS,
        PATTERN_TYPES,
        TRUST_SCORE_THRESHOLDS,
        SELECTORS,
        TIME_CONSTANTS,
        UI_CONSTANTS,
        ANALYSIS_CONSTANTS,
        ERROR_MESSAGES,
        SUCCESS_MESSAGES,
    };
}
