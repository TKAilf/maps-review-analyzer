// content.js - URL判定修正版（動的コンテンツ検知改善）

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
 * Google Mapsの動的コンテンツが読み込まれているかチェック
 * @returns {boolean} 動的コンテンツが読み込まれているかどうか
 */
function isGoogleMapsContentLoaded() {
    // 複数の条件をチェックして、実際にマップコンテンツが読み込まれているか確認
    const conditions = [
        // 基本的なページ構造
        () => document.querySelector('[role="main"]'),
        () =>
            document.querySelector("h1") ||
            document.querySelector('[data-value="Reviews"]'),

        // より具体的なGoogle Maps要素
        () =>
            document.querySelector('[data-attrid="title"]') ||
            document.querySelector(".DUwDvf") ||
            document.querySelector('[aria-label*="reviews"]'),

        // マップ自体の存在
        () =>
            document.querySelector('[role="region"]') ||
            document.querySelector('[data-value="Directions"]') ||
            document.querySelector('[data-value="Save"]'),

        // レビュー関連要素（オプショナル）
        () =>
            document.querySelector("[data-review-id]") ||
            document.querySelector(".jftiEf") ||
            document.querySelector('[aria-label*="stars"]') ||
            true, // レビューがない場合もあるので、この条件は常にtrue
    ];

    const results = conditions.map((condition, index) => {
        const result = condition();
        console.log(`Content check ${index + 1}:`, !!result);
        return !!result;
    });

    // 最初の4つの条件のうち少なくとも3つが満たされていればOK
    const essentialChecks = results.slice(0, 4);
    const passedEssentialChecks = essentialChecks.filter(Boolean).length;

    const isLoaded = passedEssentialChecks >= 3;
    console.log(
        `Google Maps content loaded check: ${passedEssentialChecks}/4 essential checks passed, result: ${isLoaded}`
    );

    return isLoaded;
}

/**
 * Google Mapsコンテンツの読み込み完了を待機
 * @param {number} maxWaitTime - 最大待機時間（ミリ秒）
 * @returns {Promise<boolean>} 読み込み完了のPromise
 */
function waitForGoogleMapsContent(maxWaitTime = 15000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const checkInterval = 500;

        const checkContent = () => {
            console.log("Checking Google Maps content...");

            if (isGoogleMapsContentLoaded()) {
                console.log("Google Maps content detected!");
                resolve(true);
                return;
            }

            const elapsedTime = Date.now() - startTime;
            if (elapsedTime >= maxWaitTime) {
                console.log("Timeout waiting for Google Maps content");
                resolve(false);
                return;
            }

            console.log(
                `Still waiting for content... (${elapsedTime}ms elapsed)`
            );
            setTimeout(checkContent, checkInterval);
        };

        // 即座にチェックを開始
        checkContent();
    });
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
            "shared/constants.js", // ルートからの相対パス
            "shared/config.js",
            "content/utils/communication.js",
            "content/utils/text-utils.js",
            "content/core/data-extractor.js",
            "content/core/pattern-detector.js",
            "content/core/score-calculator.js",
            "content/utils/dom-utils.js",
            "content/ui/result-renderer.js",
            "content/core/review-analyzer.js",
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

        // Google Mapsの動的コンテンツが読み込まれるまで待機
        console.log("Waiting for Google Maps content to load...");
        const contentLoaded = await waitForGoogleMapsContent(15000);

        if (!contentLoaded) {
            console.warn(
                "Google Maps content may not be fully loaded, but proceeding with initialization"
            );
        }

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

/**
 * ページの変更を監視（SPAの場合）
 */
let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log("URL changed to:", lastUrl);

        // Google Mapsページの場合は再初期化
        if (isGoogleMapsUrl() && !window.mapsReviewAnalyzer) {
            setTimeout(() => {
                console.log("Reinitializing due to URL change...");
                initializeContentScript();
            }, 2000);
        }
    }
});

urlObserver.observe(document.body, {
    childList: true,
    subtree: true,
});
