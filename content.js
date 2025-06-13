// content.js - 修正版

/**
 * スクリプトを非同期で読み込む
 * @param {string} src - スクリプトソース
 * @returns {Promise} - 読み込み完了のPromise
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL(src);
        script.onload = () => {
            console.log(`Loaded: ${src}`);
            resolve();
        };
        script.onerror = (error) => {
            console.error(`Failed to load: ${src}`, error);
            reject(error);
        };
        document.head.appendChild(script);
    });
}

/**
 * モジュールを順次読み込みして初期化
 */
(async function initializeContentScript() {
    try {
        // Google Mapsページかチェック
        if (
            !window.location.hostname.includes("google.com") ||
            !window.location.pathname.includes("/maps/")
        ) {
            console.log("Not a Google Maps page, skipping initialization");
            return;
        }

        // 既に初期化済みかチェック
        if (window.mapsReviewAnalyzer) {
            console.log("Maps Review Analyzer already initialized");
            return;
        }

        console.log("Initializing Maps Review Analyzer...");

        // 必要なスクリプトを順次読み込み
        const scripts = [
            "src/shared/constants.js",
            "src/shared/config.js",
            "src/content/utils/communication.js",
            "src/content/utils/text-utils.js",
            "src/content/analyzer/data-extractor.js",
            "src/content/analyzer/pattern-detector.js",
            "src/content/analyzer/score-calculator.js",
            "src/content/ui/dom-utils.js",
            "src/content/ui/result-renderer.js",
            "src/content/analyzer/review-analyzer.js",
        ];

        // 順次読み込み（並列ではなく直列で確実に）
        for (const script of scripts) {
            await loadScript(script);
            // 小さな遅延を追加してブラウザに処理時間を与える
            await new Promise((resolve) => setTimeout(resolve, 10));
        }

        // 依存関係をチェック
        const requiredGlobals = [
            "MRA_CONSTANTS",
            "MRA_CONFIG",
            "Communication",
            "DataExtractor",
            "PatternDetector",
            "ScoreCalculator",
            "ResultRenderer",
            "ReviewAnalyzer",
        ];

        const missing = requiredGlobals.filter((name) => !window[name]);
        if (missing.length > 0) {
            throw new Error(`Missing required modules: ${missing.join(", ")}`);
        }

        console.log("All modules loaded successfully");

        // ページが完全に読み込まれるまで待機
        if (document.readyState === "loading") {
            await new Promise((resolve) => {
                document.addEventListener("DOMContentLoaded", resolve);
            });
        }

        // さらに少し待機（Google Mapsの動的コンテンツのため）
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // メインアナライザーを初期化
        window.mapsReviewAnalyzer = new ReviewAnalyzer();

        console.log("Maps Review Analyzer initialized successfully");
    } catch (error) {
        console.error("Failed to initialize Maps Review Analyzer:", error);

        // エラー詳細をBackground scriptに送信
        try {
            chrome.runtime.sendMessage({
                type: "INITIALIZATION_ERROR",
                error: error.message,
                url: window.location.href,
            });
        } catch (bgError) {
            console.error("Failed to report initialization error:", bgError);
        }
    }
})();

/**
 * ページ離脱時のクリーンアップ
 */
window.addEventListener("beforeunload", () => {
    if (window.mapsReviewAnalyzer) {
        try {
            window.mapsReviewAnalyzer.destroy();
        } catch (error) {
            console.error("Error during cleanup:", error);
        }
    }
});

/**
 * エラーハンドリング
 */
window.addEventListener("error", (event) => {
    if (event.error && event.error.message.includes("Maps Review Analyzer")) {
        console.error("Maps Review Analyzer Error:", event.error);
    }
});

/**
 * 未処理のPromiseリジェクションをキャッチ
 */
window.addEventListener("unhandledrejection", (event) => {
    if (
        event.reason &&
        event.reason.message &&
        event.reason.message.includes("Maps Review Analyzer")
    ) {
        console.error(
            "Unhandled Promise Rejection in Maps Review Analyzer:",
            event.reason
        );
    }
});
