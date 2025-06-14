// content.js - URL判定修正版

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
        (document.head || document.documentElement).appendChild(script);
    });
}

/**
 * Google MapsのURLかどうかを判定する（改善版）
 * @param {string} url - 判定するURL（デフォルトは現在のURL）
 * @returns {boolean} Google MapsのURLかどうか
 */
function isGoogleMapsUrl(url = window.location.href) {
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
            "www.google.co.uk",
            "maps.google.co.uk",
            "www.google.de",
            "maps.google.de",
            "www.google.fr",
            "maps.google.fr",
            "www.google.ca",
            "maps.google.ca",
            "www.google.com.au",
            "maps.google.com.au",
        ];

        const isValidDomain = validDomains.some(
            (domain) =>
                urlObj.hostname === domain ||
                urlObj.hostname.endsWith("." + domain)
        );

        const isValidPath = urlObj.pathname.includes("/maps");

        console.log("Google Maps URL validation:", {
            url: url,
            hostname: urlObj.hostname,
            pathname: urlObj.pathname,
            isValidDomain: isValidDomain,
            isValidPath: isValidPath,
            result: isValidDomain && isValidPath,
        });

        return isValidDomain && isValidPath;
    } catch (error) {
        console.error("URL parsing error:", error);
        return false;
    }
}

/**
 * モジュールを順次読み込みして初期化
 */
(async function initializeContentScript() {
    try {
        // Google Mapsページかチェック（改善版）
        if (!isGoogleMapsUrl()) {
            console.log("Not a Google Maps page, skipping initialization");
            console.log("Current URL:", window.location.href);
            return;
        }

        // 既に初期化済みかチェック
        if (window.mapsReviewAnalyzer) {
            console.log("Maps Review Analyzer already initialized");
            return;
        }

        console.log("Initializing Maps Review Analyzer...");
        console.log("Current URL:", window.location.href);

        // 必要なスクリプトを順次読み込み
        const scripts = [
            "src/shared/constants.js",
            "src/shared/config.js",
            "src/content/analyzer/utils/communication.js",
            "src/content/analyzer/utils/text-utils.js",
            "src/content/analyzer/data-extractor.js",
            "src/content/analyzer/pattern-detector.js",
            "src/content/analyzer/score-calculator.js",
            "src/content/analyzer/utils/dom-utils.js",
            "src/content/analyzer/ui/result-renderer.js",
            "src/content/analyzer/review-analyzer.js",
        ];

        // 順次読み込み（並列ではなく直列で確実に）
        for (const script of scripts) {
            await loadScript(script);
            // 小さな遅延を追加してブラウザに処理時間を与える
            await new Promise((resolve) => setTimeout(resolve, 50));
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
                document.addEventListener("DOMContentLoaded", resolve, {
                    once: true,
                });
            });
        }

        // さらに少し待機（Google Mapsの動的コンテンツのため）
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // メインアナライザーを初期化
        window.mapsReviewAnalyzer = new window.ReviewAnalyzer();

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
