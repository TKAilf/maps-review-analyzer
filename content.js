// content.js

/**
 * スクリプトを非同期で読み込む
 * @param {string} src - スクリプトソース
 * @returns {Promise} - 読み込み完了のPromise
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL(src);
        script.onload = resolve;
        script.onerror = reject;
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
            return;
        }

        console.log("Initializing Maps Review Analyzer...");

        // 共通モジュールの読み込み
        await loadScript("src/shared/constants.js");
        await loadScript("src/shared/config.js");

        // ユーティリティの読み込み
        await loadScript("src/content/utils/communication.js");
        await loadScript("src/content/utils/text-utils.js");

        // 分析エンジンの読み込み
        await loadScript("src/content/analyzer/pattern-detector.js");
        await loadScript("src/content/analyzer/score-calculator.js");
        await loadScript("src/content/analyzer/data-extractor.js");

        // UI関連の読み込み
        await loadScript("src/content/ui/dom-utils.js");
        await loadScript("src/content/ui/result-renderer.js");

        // メイン分析クラスの読み込み
        await loadScript("src/content/analyzer/review-analyzer.js");

        console.log("All modules loaded successfully");

        // メインアナライザーを初期化
        window.mapsReviewAnalyzer = new ReviewAnalyzer();

        console.log("Maps Review Analyzer initialized");
    } catch (error) {
        console.error("Failed to initialize Maps Review Analyzer:", error);
    }
})();

/**
 * ページ離脱時のクリーンアップ
 */
window.addEventListener("beforeunload", () => {
    if (window.mapsReviewAnalyzer) {
        window.mapsReviewAnalyzer.destroy();
    }
});

/**
 * エラーハンドリング
 */
window.addEventListener("error", (event) => {
    console.error("Maps Review Analyzer Error:", event.error);
});

/**
 * 未処理のPromiseリジェクションをキャッチ
 */
window.addEventListener("unhandledrejection", (event) => {
    console.error(
        "Unhandled Promise Rejection in Maps Review Analyzer:",
        event.reason
    );
});
