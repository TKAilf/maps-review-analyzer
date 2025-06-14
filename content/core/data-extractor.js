// src/content/analyzer/data-extractor.js - 改善版（動的コンテンツ対応）

/**
 * Google Mapsからレビューデータを抽出するクラス
 */
class DataExtractor {
    constructor() {
        this.constants = window.MRA_CONSTANTS;
        this.maxRetries = 5;
        this.retryDelay = 1000;
    }

    /**
     * レビューデータを抽出
     * @returns {Promise<Object>} 抽出されたレビューデータ
     */
    async extractReviewData() {
        try {
            console.log("Starting data extraction...");

            // Google Mapsが完全に読み込まれるまで待機（リトライ機能付き）
            await this.waitForPageLoadWithRetry();

            const placeName = this.extractPlaceName();
            const ratings = this.extractRatings();
            const totalReviews = this.extractTotalReviews();
            const recentReviews = await this.extractRecentReviews();

            const result = {
                placeName,
                ratings,
                totalReviews,
                recentReviews,
                extractedAt: new Date().toISOString(),
            };

            console.log("Data extraction completed:", result);
            return result;
        } catch (error) {
            console.error("Data extraction failed:", error);
            throw error;
        }
    }

    /**
     * ページの読み込み完了を待機（リトライ機能付き）
     */
    async waitForPageLoadWithRetry() {
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            console.log(
                `Page load check attempt ${attempt + 1}/${this.maxRetries}`
            );

            const isReady = await this.checkPageReadiness();
            if (isReady) {
                console.log("Page is ready for data extraction");
                return;
            }

            if (attempt < this.maxRetries - 1) {
                console.log(
                    `Page not ready, waiting ${this.retryDelay}ms before retry...`
                );
                await new Promise((resolve) =>
                    setTimeout(resolve, this.retryDelay)
                );
            }
        }

        console.warn(
            "Page readiness check timeout, proceeding with extraction"
        );
    }

    /**
     * ページの準備状況をチェック
     * @returns {Promise<boolean>} ページが準備できているかどうか
     */
    async checkPageReadiness() {
        // 基本的な要素の存在チェック
        const basicElementsExist =
            document.querySelector('[role="main"]') &&
            (document.querySelector("h1") ||
                document.querySelector('[data-value="Reviews"]'));

        if (!basicElementsExist) {
            console.log("Basic elements not found");
            return false;
        }

        // 場所名が取得できるかチェック
        const placeName = this.extractPlaceName();
        if (!placeName || placeName === "不明な場所") {
            console.log("Place name not available");
            return false;
        }

        // 少なくとも評価情報か総レビュー数のいずれかが取得できるかチェック
        const totalReviews = this.extractTotalReviews();
        const ratings = this.extractRatings();
        const hasReviewData =
            totalReviews > 0 ||
            Object.values(ratings).some((count) => count > 0);

        if (!hasReviewData) {
            console.log("No review data available yet");
            return false;
        }

        console.log("Page readiness check passed");
        return true;
    }

    /**
     * 場所名を抽出（改善版）
     * @returns {string} 場所名
     */
    extractPlaceName() {
        // より包括的なセレクターリスト
        const selectors = [
            'h1[data-attrid="title"]',
            "h1.DUwDvf.lfPIob",
            "h1.DUwDvf",
            ".x3AX1-LfntMc-header-title-title",
            ".x3AX1-LfntMc-header-title",
            '[role="main"] h1',
            'h1[class*="DUwDvf"]',
            '[data-value="Reviews"]',
            ".DUwDvf.lfPIob",
            // より一般的なセレクターも追加
            "main h1",
            '[role="heading"][aria-level="1"]',
            // Google Mapsの特定バージョンに対応
            ".qrShPb h1",
            ".lMbq3e h1",
        ];

        for (const selector of selectors) {
            try {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim()) {
                    const text = element.textContent.trim();
                    // 明らかに場所名ではないテキストを除外
                    if (
                        text &&
                        text.length > 1 &&
                        text.length < 200 &&
                        !text.includes("Reviews") &&
                        !text.includes("レビュー")
                    ) {
                        console.log(
                            `Found place name with selector ${selector}: ${text}`
                        );
                        return text;
                    }
                }
            } catch (error) {
                console.warn(`Error with selector ${selector}:`, error);
            }
        }

        // さらなるフォールバック：タイトルタグから抽出を試行
        try {
            const title = document.title;
            if (title && title.includes(" - Google")) {
                const placeName = title.split(" - Google")[0].trim();
                if (placeName && placeName.length > 1) {
                    console.log(
                        `Extracted place name from title: ${placeName}`
                    );
                    return placeName;
                }
            }
        } catch (error) {
            console.warn("Failed to extract from title:", error);
        }

        console.warn("Could not extract place name");
        return "不明な場所";
    }

    /**
     * 評価分布を抽出（改善版）
     * @returns {Object} 評価分布
     */
    extractRatings() {
        const ratings = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        try {
            // 複数のパターンを試行
            const selectorGroups = [
                // 最新のGoogle Mapsレイアウト
                {
                    container: ".jANrlb",
                    bars: ".BHOKXe",
                },
                // 代替レイアウト
                {
                    container: '[aria-label*="stars"]',
                    bars: ".BHOKXe",
                },
                // テーブル形式
                {
                    container: ".RWPxGd tbody",
                    bars: "tr",
                },
                // より一般的なパターン
                {
                    container: ".jANrlb",
                    bars: "tr",
                },
            ];

            for (const group of selectorGroups) {
                const container = document.querySelector(group.container);
                if (container) {
                    const elements = container.querySelectorAll(group.bars);
                    if (elements.length >= 5) {
                        console.log(
                            `Found rating bars with pattern: ${group.container} > ${group.bars}`
                        );

                        let success = false;
                        elements.forEach((element, index) => {
                            if (index < 5) {
                                const starLevel = 5 - index; // 5星から1星の順序
                                const count =
                                    this.extractCountFromElement(element);
                                if (count >= 0) {
                                    ratings[starLevel] = count;
                                    success = true;
                                }
                            }
                        });

                        if (success) break;
                    }
                }
            }

            // aria-labelからの抽出（フォールバック）
            if (Object.values(ratings).every((count) => count === 0)) {
                this.extractRatingsFromAriaLabels(ratings);
            }

            // 特定の星評価要素を直接検索（最終フォールバック）
            if (Object.values(ratings).every((count) => count === 0)) {
                this.extractRatingsFromStarElements(ratings);
            }
        } catch (error) {
            console.error("Error extracting ratings:", error);
        }

        console.log("Extracted ratings:", ratings);
        return ratings;
    }

    /**
     * 星評価要素から直接抽出
     * @param {Object} ratings - 評価オブジェクト
     */
    extractRatingsFromStarElements(ratings) {
        try {
            // 評価バーに関連する要素を探す
            const possibleContainers = [
                ".section-rating-histogram",
                '[class*="rating"]',
                '[class*="histogram"]',
                '[aria-label*="stars"]',
            ];

            for (const containerSelector of possibleContainers) {
                const containers = document.querySelectorAll(containerSelector);

                for (const container of containers) {
                    const text =
                        container.textContent ||
                        container.getAttribute("aria-label") ||
                        "";

                    // テキストから評価数を抽出
                    for (let stars = 1; stars <= 5; stars++) {
                        const patterns = [
                            new RegExp(
                                `${stars}\\s*stars?[^\\d]*(\\d+(?:,\\d+)*)`,
                                "i"
                            ),
                            new RegExp(
                                `${stars}\\s*つ星[^\\d]*(\\d+(?:,\\d+)*)`,
                                "i"
                            ),
                        ];

                        for (const pattern of patterns) {
                            const match = text.match(pattern);
                            if (match) {
                                const count = parseInt(
                                    match[1].replace(/,/g, "")
                                );
                                if (!isNaN(count)) {
                                    ratings[stars] = count;
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.warn("Error extracting from star elements:", error);
        }
    }

    /**
     * 要素から数値を抽出（改善版）
     * @param {Element} element - 対象要素
     * @returns {number} 抽出された数値
     */
    extractCountFromElement(element) {
        try {
            // テキストコンテンツから数値を抽出
            const text = element.textContent || "";
            const textMatch = text.match(/(\d+(?:,\d+)*)/);
            if (textMatch) {
                const count = parseInt(textMatch[1].replace(/,/g, ""));
                if (!isNaN(count)) return count;
            }

            // aria-labelから抽出
            const ariaLabel = element.getAttribute("aria-label") || "";
            const ariaMatch = ariaLabel.match(/(\d+(?:,\d+)*)/);
            if (ariaMatch) {
                const count = parseInt(ariaMatch[1].replace(/,/g, ""));
                if (!isNaN(count)) return count;
            }

            // data属性から抽出を試行
            const dataValue =
                element.getAttribute("data-value") ||
                element.getAttribute("data-count") ||
                "";
            if (dataValue) {
                const count = parseInt(dataValue.replace(/,/g, ""));
                if (!isNaN(count)) return count;
            }

            // 子要素のテキストも確認
            const children = element.querySelectorAll("*");
            for (const child of children) {
                const childText = child.textContent || "";
                const childMatch = childText.match(/(\d+(?:,\d+)*)/);
                if (childMatch) {
                    const count = parseInt(childMatch[1].replace(/,/g, ""));
                    if (!isNaN(count)) return count;
                }
            }
        } catch (error) {
            console.warn("Error extracting count from element:", error);
        }

        return 0;
    }

    /**
     * 総レビュー数を抽出（改善版）
     * @returns {number} 総レビュー数
     */
    extractTotalReviews() {
        const selectors = [
            '[aria-label*="reviews"]',
            '[aria-label*="件のレビュー"]',
            ".F7nice",
            ".jANrlb .fontBodyMedium",
            ".RWPxGd .fontBodyMedium",
            // 追加のセレクター
            '[data-value="Reviews"]',
            ".section-rating-summary",
            '[class*="review"] [class*="count"]',
            '[class*="rating"] [class*="count"]',
        ];

        for (const selector of selectors) {
            try {
                const elements = document.querySelectorAll(selector);

                for (const element of elements) {
                    const sources = [
                        element.textContent || "",
                        element.getAttribute("aria-label") || "",
                        element.getAttribute("title") || "",
                    ];

                    for (const source of sources) {
                        // より柔軟な数値抽出パターン
                        const patterns = [
                            /(\d+(?:,\d+)*)\s*(?:reviews?|件のレビュー|レビュー)/i,
                            /(?:reviews?|レビュー)[:\s]*(\d+(?:,\d+)*)/i,
                            /(\d+(?:,\d+)*)/,
                        ];

                        for (const pattern of patterns) {
                            const match = source.match(pattern);
                            if (match) {
                                const count = parseInt(
                                    match[1].replace(/,/g, "")
                                );
                                if (count > 0 && count < 1000000) {
                                    // 妥当な範囲の数値
                                    console.log(
                                        `Found total reviews: ${count} from selector: ${selector}`
                                    );
                                    return count;
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn(`Error with selector ${selector}:`, error);
            }
        }

        // 評価分布から計算（フォールバック）
        const ratings = this.extractRatings();
        const total = Object.values(ratings).reduce(
            (sum, count) => sum + count,
            0
        );
        if (total > 0) {
            console.log(`Calculated total reviews from ratings: ${total}`);
            return total;
        }

        console.warn("Could not extract total review count");
        return 0;
    }

    /**
     * 最近のレビューを抽出（改善版）
     * @returns {Promise<Array>} レビュー配列
     */
    async extractRecentReviews() {
        try {
            console.log("Extracting recent reviews...");

            // レビューセクションが見つからない場合は一度スクロールを試行
            await this.ensureReviewsVisible();

            const reviews = [];
            const maxReviews = 20;

            // 複数のセレクターパターンを試行
            const selectorGroups = [
                // 最新のレイアウト
                "[data-review-id]",
                // クラスベース
                ".jftiEf.fontBodyMedium",
                ".MyEned",
                ".wiI7pd",
                // より一般的なパターン
                '[jsaction*="review"]',
                '[role="listitem"]',
                ".section-review",
            ];

            let foundReviews = [];

            for (const selector of selectorGroups) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(
                        `Found ${elements.length} potential review elements with: ${selector}`
                    );
                    foundReviews = Array.from(elements);
                    break;
                }
            }

            // レビュー要素が見つからない場合は、より汎用的な検索
            if (foundReviews.length === 0) {
                foundReviews = this.findReviewElementsByContent();
            }

            // 各要素を処理
            for (
                let i = 0;
                i < Math.min(foundReviews.length, maxReviews);
                i++
            ) {
                try {
                    const reviewData = this.extractSingleReview(
                        foundReviews[i]
                    );
                    if (reviewData && this.validateReviewData(reviewData)) {
                        reviews.push(reviewData);
                    }
                } catch (error) {
                    console.warn("Failed to extract single review:", error);
                }
            }

            console.log(`Successfully extracted ${reviews.length} reviews`);
            return reviews;
        } catch (error) {
            console.error("Error extracting recent reviews:", error);
            return [];
        }
    }

    /**
     * レビューが表示されるようにする
     */
    async ensureReviewsVisible() {
        try {
            // レビューボタンを探してクリック
            const reviewButton = document.querySelector(
                '[data-value="Reviews"]'
            );
            if (reviewButton && reviewButton.offsetParent !== null) {
                console.log("Clicking reviews tab");
                reviewButton.click();
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            // レビューセクションまでスクロール
            const reviewSection =
                document.querySelector('[data-value="Reviews"]') ||
                document.querySelector(".section-listbox") ||
                document.querySelector('[role="main"]');

            if (reviewSection) {
                reviewSection.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        } catch (error) {
            console.warn("Could not ensure reviews visibility:", error);
        }
    }

    /**
     * コンテンツベースでレビュー要素を検索
     * @returns {Array<Element>} 見つかったレビュー要素
     */
    findReviewElementsByContent() {
        const allDivs = document.querySelectorAll("div");
        const potentialReviews = [];

        for (const div of allDivs) {
            // レビューらしい特徴を持つ要素をチェック
            if (this.looksLikeReviewElement(div)) {
                potentialReviews.push(div);
            }
        }

        console.log(
            `Found ${potentialReviews.length} potential review elements by content`
        );
        return potentialReviews.slice(0, 20); // 最大20件
    }

    /**
     * 要素がレビューらしいかチェック
     * @param {Element} element - チェックする要素
     * @returns {boolean} レビューらしいかどうか
     */
    looksLikeReviewElement(element) {
        try {
            const text = element.textContent || "";
            const hasReasonableLength = text.length > 20 && text.length < 2000;

            if (!hasReasonableLength) return false;

            // レビューらしい特徴をチェック
            const reviewIndicators = [
                // 日付パターン
                /\d+\s*(日|days?|weeks?|months?)\s*(前|ago)/,
                // 星評価
                element.querySelector('[aria-label*="stars"]'),
                element.querySelector('[role="img"]'),
                // ユーザー情報
                element.querySelector("[alt]"),
                element.querySelector('[data-href*="contrib"]'),
                // レビューっぽいクラス名
                /review|rating|comment/.test(element.className),
                // アクション要素
                element.querySelector('[data-value*="helpful"]'),
                element.querySelector('[data-value*="report"]'),
            ];

            return reviewIndicators.some((indicator) => {
                if (typeof indicator === "boolean") return indicator;
                if (indicator instanceof RegExp) return indicator.test(text);
                return !!indicator;
            });
        } catch (error) {
            return false;
        }
    }

    /**
     * 単一のレビューを抽出（改善版）
     * @param {Element} element - レビュー要素
     * @returns {Object|null} レビューデータ
     */
    extractSingleReview(element) {
        try {
            const text = this.extractReviewText(element);
            const dateText = this.extractReviewDate(element);
            const hasPhotos = this.checkReviewPhotos(element);

            return {
                text: text || "",
                textLength: text ? text.length : 0,
                dateText: dateText || "",
                hasPhotos: hasPhotos,
                elementInfo: {
                    className: element.className,
                    tagName: element.tagName,
                },
            };
        } catch (error) {
            console.warn("Error extracting single review:", error);
            return null;
        }
    }

    /**
     * レビューテキストを抽出（改善版）
     * @param {Element} element - レビュー要素
     * @returns {string} レビューテキスト
     */
    extractReviewText(element) {
        const textSelectors = [
            ".MyEned",
            ".wiI7pd",
            "[data-expandable-section]",
            ".fontBodyMedium .wiI7pd",
            ".rsqaWe",
            // 追加のセレクター
            '[jsaction*="expandableText"]',
            ".section-review-text",
            '[class*="review-text"]',
            '[class*="expandable"]',
        ];

        // 特定のセレクターで検索
        for (const selector of textSelectors) {
            try {
                const textElement = element.querySelector(selector);
                if (textElement && textElement.textContent.trim()) {
                    const text = textElement.textContent.trim();
                    if (text.length > 5) {
                        return text;
                    }
                }
            } catch (error) {
                console.warn(`Error with text selector ${selector}:`, error);
            }
        }

        // フォールバック1: より深い階層を検索
        const allTextElements = element.querySelectorAll("span, div, p");
        let longestText = "";

        for (const textEl of allTextElements) {
            const text = textEl.textContent?.trim() || "";
            if (
                text.length > longestText.length &&
                text.length > 10 &&
                text.length < 1000
            ) {
                // 他の要素のテキストを含まないか確認
                const isDirectText = !Array.from(textEl.children).some(
                    (child) =>
                        child.textContent && text.includes(child.textContent)
                );
                if (isDirectText) {
                    longestText = text;
                }
            }
        }

        if (longestText) {
            return longestText;
        }

        // フォールバック2: 要素自体のテキスト（子要素を除外）
        try {
            const elementText = element.textContent || "";
            const childTexts = Array.from(element.children).map(
                (child) => child.textContent || ""
            );
            let directText = elementText;

            // 子要素のテキストを除去
            for (const childText of childTexts) {
                if (childText) {
                    directText = directText.replace(childText, "").trim();
                }
            }

            if (directText.length > 10 && directText.length < 1000) {
                return directText;
            }
        } catch (error) {
            console.warn("Error extracting direct text:", error);
        }

        return "";
    }

    /**
     * レビュー日付を抽出（改善版）
     * @param {Element} element - レビュー要素
     * @returns {string} 日付テキスト
     */
    extractReviewDate(element) {
        const dateSelectors = [
            ".rsqaWe",
            ".DU9Pgb",
            ".fontCaption",
            ".dehysf",
            // 追加のセレクター
            '[class*="date"]',
            '[class*="time"]',
            ".section-review-subtitle",
            '[data-value*="time"]',
        ];

        // 特定のセレクターで検索
        for (const selector of dateSelectors) {
            try {
                const dateElement = element.querySelector(selector);
                if (dateElement && dateElement.textContent.trim()) {
                    const dateText = dateElement.textContent.trim();
                    if (this.isDateText(dateText)) {
                        return dateText;
                    }
                }
            } catch (error) {
                console.warn(`Error with date selector ${selector}:`, error);
            }
        }

        // フォールバック: 全ての小さなテキスト要素を確認
        const smallElements = element.querySelectorAll("span, div, time");
        for (const el of smallElements) {
            const text = el.textContent?.trim() || "";
            if (text.length < 50 && this.isDateText(text)) {
                return text;
            }
        }

        return "";
    }

    /**
     * テキストが日付かどうかをチェック（改善版）
     * @param {string} text - チェックするテキスト
     * @returns {boolean} 日付かどうか
     */
    isDateText(text) {
        if (!text || typeof text !== "string") return false;

        const datePatterns = [
            // 相対日付（日本語）
            /\d+\s*(分|時間|日|週間|か?月|年)\s*前/,
            // 相対日付（英語）
            /\d+\s*(minutes?|hours?|days?|weeks?|months?|years?)\s*ago/,
            // 絶対日付（日本語）
            /\d{4}年\d{1,2}月(\d{1,2}日)?/,
            // 絶対日付（国際形式）
            /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
            // 月名を含む形式
            /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}/i,
            // その他の日付パターン
            /\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)/i,
        ];

        return datePatterns.some((pattern) => pattern.test(text));
    }

    /**
     * レビューに写真があるかチェック（改善版）
     * @param {Element} element - レビュー要素
     * @returns {boolean} 写真があるかどうか
     */
    checkReviewPhotos(element) {
        const photoSelectors = [
            "[data-photo-index]",
            'img[src*="googleusercontent"]',
            ".KtCyie img",
            ".EDblX img",
            // 追加のセレクター
            '[class*="photo"] img',
            '[class*="image"] img',
            'img[src*="maps.googleapis.com"]',
            '[aria-label*="photo"]',
            '[aria-label*="image"]',
        ];

        for (const selector of photoSelectors) {
            try {
                const photos = element.querySelectorAll(selector);
                if (photos.length > 0) {
                    // 実際に画像かどうかをチェック
                    for (const photo of photos) {
                        if (
                            photo.src &&
                            photo.src.length > 10 &&
                            !photo.src.includes("data:image") &&
                            photo.offsetWidth > 10 &&
                            photo.offsetHeight > 10
                        ) {
                            return true;
                        }
                    }
                }
            } catch (error) {
                console.warn(`Error with photo selector ${selector}:`, error);
            }
        }

        return false;
    }

    /**
     * aria-labelから評価を抽出（改善版）
     * @param {Object} ratings - 評価オブジェクト
     */
    extractRatingsFromAriaLabels(ratings) {
        try {
            const elements = document.querySelectorAll(
                '[aria-label*="stars"], [aria-label*="つ星"]'
            );

            elements.forEach((element) => {
                const ariaLabel = element.getAttribute("aria-label");

                // 複数のパターンを試行
                const patterns = [
                    /(\d+)\s*stars?.*?(\d+(?:,\d+)*)/i,
                    /(\d+)\s*つ星.*?(\d+(?:,\d+)*)/,
                    /(\d+(?:,\d+)*)\s*(?:reviews?|件).*?(\d+)\s*stars?/i,
                ];

                for (const pattern of patterns) {
                    const match = ariaLabel.match(pattern);
                    if (match) {
                        let stars, count;

                        // パターンによって数値の位置が異なる
                        if (pattern.source.includes("reviews?.*stars?")) {
                            count = parseInt(match[1].replace(/,/g, ""));
                            stars = parseInt(match[2]);
                        } else {
                            stars = parseInt(match[1]);
                            count = parseInt(match[2].replace(/,/g, ""));
                        }

                        if (stars >= 1 && stars <= 5 && !isNaN(count)) {
                            ratings[stars] = count;
                        }
                    }
                }
            });
        } catch (error) {
            console.warn("Error extracting ratings from aria-labels:", error);
        }
    }

    /**
     * レビューデータの品質チェック（改善版）
     * @param {Object} reviewData - チェックするレビューデータ
     * @returns {boolean} データが有効かどうか
     */
    validateReviewData(reviewData) {
        if (!reviewData) return false;

        // 基本的な構造チェック
        const hasValidStructure =
            reviewData.hasOwnProperty("text") &&
            reviewData.hasOwnProperty("textLength") &&
            reviewData.hasOwnProperty("dateText") &&
            reviewData.hasOwnProperty("hasPhotos");

        if (!hasValidStructure) return false;

        // データの内容チェック
        const hasValidContent =
            reviewData.textLength >= 0 &&
            reviewData.textLength <= 10000 && // 妥当な長さの上限
            typeof reviewData.hasPhotos === "boolean";

        if (!hasValidContent) return false;

        // 最低限のコンテンツがあるかチェック
        const hasMinimumContent =
            reviewData.textLength > 0 ||
            reviewData.dateText.length > 0 ||
            reviewData.hasPhotos;

        return hasMinimumContent;
    }

    /**
     * デバッグ情報を取得（改善版）
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            url: window.location.href,
            title: document.title,
            mainElements: {
                hasMain: !!document.querySelector('[role="main"]'),
                hasH1: !!document.querySelector("h1"),
                hasReviews: !!document.querySelector('[data-value="Reviews"]'),
                reviewElements:
                    document.querySelectorAll("[data-review-id]").length,
                potentialReviewElements: document.querySelectorAll(
                    ".jftiEf, .MyEned, .wiI7pd"
                ).length,
            },
            extractedData: {
                placeName: this.extractPlaceName(),
                totalReviews: this.extractTotalReviews(),
                ratingsSum: Object.values(this.extractRatings()).reduce(
                    (a, b) => a + b,
                    0
                ),
            },
            pageReadyState: document.readyState,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * レビューデータの統計情報を計算
     * @param {Array} reviews - レビュー配列
     * @returns {Object} 統計情報
     */
    calculateReviewStats(reviews) {
        if (!reviews || reviews.length === 0) {
            return {
                totalCount: 0,
                averageLength: 0,
                photosCount: 0,
                recentCount: 0,
            };
        }

        const totalCount = reviews.length;
        const totalLength = reviews.reduce(
            (sum, review) => sum + review.textLength,
            0
        );
        const averageLength = Math.round(totalLength / totalCount);
        const photosCount = reviews.filter((review) => review.hasPhotos).length;

        // 最近のレビューを判定（30日以内）
        const recentCount = reviews.filter((review) => {
            const dateInfo = window.TextUtils?.parseDateText(review.dateText);
            return dateInfo && dateInfo.isRecent;
        }).length;

        return {
            totalCount,
            averageLength,
            photosCount,
            recentCount,
            photosRatio: totalCount > 0 ? photosCount / totalCount : 0,
            recentRatio: totalCount > 0 ? recentCount / totalCount : 0,
        };
    }
}

// グローバルスコープに公開
if (typeof window !== "undefined") {
    window.DataExtractor = DataExtractor;
}
