// src/content/analyzer/data-extractor.js

/**
 * Google Mapsからレビューデータを抽出するクラス
 */
class DataExtractor {
    constructor() {
        this.constants = window.MRA_CONSTANTS;
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    /**
     * レビューデータを抽出
     * @returns {Promise<Object>} 抽出されたレビューデータ
     */
    async extractReviewData() {
        try {
            console.log("Starting data extraction...");

            // Google Mapsが完全に読み込まれるまで待機
            await this.waitForPageLoad();

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
     * ページの読み込み完了を待機
     */
    async waitForPageLoad() {
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            // 基本的なGoogle Maps要素の存在をチェック
            const hasBasicElements =
                document.querySelector('[role="main"]') &&
                (document.querySelector("h1") ||
                    document.querySelector('[data-value="Reviews"]'));

            if (hasBasicElements) {
                console.log("Basic page elements found");
                return;
            }

            console.log(`Waiting for page load... attempt ${attempts + 1}`);
            await new Promise((resolve) => setTimeout(resolve, 500));
            attempts++;
        }

        console.warn("Page load timeout, proceeding with extraction");
    }

    /**
     * 場所名を抽出
     * @returns {string} 場所名
     */
    extractPlaceName() {
        const selectors = [
            'h1[data-attrid="title"]',
            "h1.DUwDvf.lfPIob",
            "h1.DUwDvf",
            ".x3AX1-LfntMc-header-title-title",
            ".x3AX1-LfntMc-header-title",
            "h1",
            '[data-value="Reviews"]',
            ".DUwDvf.lfPIob",
        ];

        for (const selector of selectors) {
            try {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim()) {
                    const text = element.textContent.trim();
                    console.log(
                        `Found place name with selector ${selector}: ${text}`
                    );
                    return text;
                }
            } catch (error) {
                console.warn(`Error with selector ${selector}:`, error);
            }
        }

        console.warn("Could not extract place name");
        return "不明な場所";
    }

    /**
     * 評価分布を抽出
     * @returns {Object} 評価分布
     */
    extractRatings() {
        const ratings = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        try {
            // 評価バーを探す（複数のパターンを試行）
            const selectors = [
                ".jANrlb .BHOKXe",
                '[aria-label*="stars"] .BHOKXe',
                ".RWPxGd tbody tr",
                ".jANrlb tr",
            ];

            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length >= 5) {
                    console.log(`Found rating bars with selector: ${selector}`);

                    elements.forEach((element, index) => {
                        if (index < 5) {
                            const starLevel = 5 - index; // 5星から1星の順序
                            const count = this.extractCountFromElement(element);
                            if (count > 0) {
                                ratings[starLevel] = count;
                            }
                        }
                    });

                    break;
                }
            }

            // 代替方法：aria-labelから抽出
            if (Object.values(ratings).every((count) => count === 0)) {
                this.extractRatingsFromAriaLabels(ratings);
            }
        } catch (error) {
            console.error("Error extracting ratings:", error);
        }

        console.log("Extracted ratings:", ratings);
        return ratings;
    }

    /**
     * 要素から数値を抽出
     * @param {Element} element - 対象要素
     * @returns {number} 抽出された数値
     */
    extractCountFromElement(element) {
        try {
            // テキストコンテンツから数値を抽出
            const text = element.textContent || "";
            const match = text.match(/(\d+(?:,\d+)*)/);
            if (match) {
                return parseInt(match[1].replace(/,/g, ""));
            }

            // aria-labelから抽出
            const ariaLabel = element.getAttribute("aria-label") || "";
            const ariaMatch = ariaLabel.match(/(\d+(?:,\d+)*)/);
            if (ariaMatch) {
                return parseInt(ariaMatch[1].replace(/,/g, ""));
            }

            // スタイルや幅から推測（プログレスバーの場合）
            const style = element.getAttribute("style") || "";
            const widthMatch = style.match(/width:\s*(\d+(?:\.\d+)?)%/);
            if (widthMatch) {
                const percentage = parseFloat(widthMatch[1]);
                // 幅から概算（この方法は正確ではないので最後の手段）
                return Math.round(percentage / 10);
            }
        } catch (error) {
            console.warn("Error extracting count from element:", error);
        }

        return 0;
    }

    /**
     * aria-labelから評価を抽出
     * @param {Object} ratings - 評価オブジェクト
     */
    extractRatingsFromAriaLabels(ratings) {
        try {
            const elements = document.querySelectorAll('[aria-label*="stars"]');

            elements.forEach((element) => {
                const ariaLabel = element.getAttribute("aria-label");
                const match = ariaLabel.match(
                    /(\d+)\s*stars?.*?(\d+(?:,\d+)*)/
                );
                if (match) {
                    const stars = parseInt(match[1]);
                    const count = parseInt(match[2].replace(/,/g, ""));
                    if (stars >= 1 && stars <= 5) {
                        ratings[stars] = count;
                    }
                }
            });
        } catch (error) {
            console.warn("Error extracting ratings from aria-labels:", error);
        }
    }

    /**
     * 総レビュー数を抽出
     * @returns {number} 総レビュー数
     */
    extractTotalReviews() {
        const selectors = [
            '[aria-label*="reviews"]',
            '[aria-label*="件のレビュー"]',
            ".F7nice",
            ".jANrlb .fontBodyMedium",
            ".RWPxGd .fontBodyMedium",
        ];

        for (const selector of selectors) {
            try {
                const elements = document.querySelectorAll(selector);

                for (const element of elements) {
                    const text =
                        element.textContent ||
                        element.getAttribute("aria-label") ||
                        "";
                    const match = text.match(/(\d+(?:,\d+)*)/);
                    if (match) {
                        const count = parseInt(match[1].replace(/,/g, ""));
                        if (count > 0) {
                            console.log(`Found total reviews: ${count}`);
                            return count;
                        }
                    }
                }
            } catch (error) {
                console.warn(`Error with selector ${selector}:`, error);
            }
        }

        // 評価分布から計算
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
     * 最近のレビューを抽出
     * @returns {Promise<Array>} レビュー配列
     */
    async extractRecentReviews() {
        try {
            console.log("Extracting recent reviews...");

            // レビューセクションを探す
            await this.scrollToReviews();

            const reviews = [];
            const selectors = [
                "[data-review-id]",
                ".jftiEf.fontBodyMedium",
                ".MyEned",
                ".wiI7pd",
            ];

            for (const selector of selectors) {
                const reviewElements = document.querySelectorAll(selector);

                if (reviewElements.length > 0) {
                    console.log(
                        `Found ${reviewElements.length} review elements with selector: ${selector}`
                    );

                    for (
                        let i = 0;
                        i < Math.min(reviewElements.length, 20);
                        i++
                    ) {
                        try {
                            const reviewData = this.extractSingleReview(
                                reviewElements[i]
                            );
                            if (reviewData) {
                                reviews.push(reviewData);
                            }
                        } catch (error) {
                            console.warn(
                                "Failed to extract single review:",
                                error
                            );
                        }
                    }
                    break;
                }
            }

            console.log(`Extracted ${reviews.length} reviews`);
            return reviews;
        } catch (error) {
            console.error("Error extracting recent reviews:", error);
            return [];
        }
    }

    /**
     * レビューセクションまでスクロール
     */
    async scrollToReviews() {
        try {
            const reviewButton = document.querySelector(
                '[data-value="Reviews"]'
            );
            if (reviewButton) {
                reviewButton.scrollIntoView({ behavior: "smooth" });
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.warn("Could not scroll to reviews:", error);
        }
    }

    /**
     * 単一のレビューを抽出
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
            };
        } catch (error) {
            console.warn("Error extracting single review:", error);
            return null;
        }
    }

    /**
     * レビューテキストを抽出
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
        ];

        for (const selector of textSelectors) {
            try {
                const textElement = element.querySelector(selector);
                if (textElement && textElement.textContent.trim()) {
                    return textElement.textContent.trim();
                }
            } catch (error) {
                console.warn(`Error with text selector ${selector}:`, error);
            }
        }

        // フォールバック：要素自体のテキストコンテンツ
        const text = element.textContent || "";
        if (text.length > 10 && text.length < 1000) {
            return text.trim();
        }

        return "";
    }

    /**
     * レビュー日付を抽出
     * @param {Element} element - レビュー要素
     * @returns {string} 日付テキスト
     */
    extractReviewDate(element) {
        const dateSelectors = [".rsqaWe", ".DU9Pgb", ".fontCaption", ".dehysf"];

        for (const selector of dateSelectors) {
            try {
                const dateElement = element.querySelector(selector);
                if (dateElement && dateElement.textContent.trim()) {
                    const dateText = dateElement.textContent.trim();
                    // 日付らしいテキストかチェック
                    if (this.isDateText(dateText)) {
                        return dateText;
                    }
                }
            } catch (error) {
                console.warn(`Error with date selector ${selector}:`, error);
            }
        }

        return "";
    }

    /**
     * テキストが日付かどうかをチェック
     * @param {string} text - チェックするテキスト
     * @returns {boolean} 日付かどうか
     */
    isDateText(text) {
        const datePatterns = [
            /\d+\s*(日|days?|weeks?|months?|years?)\s*(前|ago)/,
            /\d{4}年\d{1,2}月/,
            /\d{1,2}\/\d{1,2}\/\d{4}/,
            /\d{1,2}-\d{1,2}-\d{4}/,
            /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
        ];

        return datePatterns.some((pattern) => pattern.test(text));
    }

    /**
     * レビューに写真があるかチェック
     * @param {Element} element - レビュー要素
     * @returns {boolean} 写真があるかどうか
     */
    checkReviewPhotos(element) {
        const photoSelectors = [
            "[data-photo-index]",
            'img[src*="googleusercontent"]',
            ".KtCyie img",
            ".EDblX img",
        ];

        for (const selector of photoSelectors) {
            try {
                const photos = element.querySelectorAll(selector);
                if (photos.length > 0) {
                    return true;
                }
            } catch (error) {
                console.warn(`Error with photo selector ${selector}:`, error);
            }
        }

        return false;
    }

    /**
     * より広範囲なレビュー要素の探索
     * @returns {Array<Element>} 見つかったレビュー要素
     */
    findReviewElements() {
        const possibleSelectors = [
            // 一般的なレビュー要素
            "[data-review-id]",
            ".jftiEf",
            ".fontBodyMedium",

            // レビューコンテナの可能性
            '[jsaction*="review"]',
            '[role="listitem"]',
            ".review-item",

            // より汎用的なセレクター
            "div[data-value]",
            "div[aria-label]",
        ];

        const foundElements = [];

        for (const selector of possibleSelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(
                        `Found ${elements.length} potential review elements with: ${selector}`
                    );
                    foundElements.push(...Array.from(elements));
                }
            } catch (error) {
                console.warn(`Error with selector ${selector}:`, error);
            }
        }

        // 重複を除去
        return [...new Set(foundElements)];
    }

    /**
     * レビュー要素かどうかを判定
     * @param {Element} element - 判定する要素
     * @returns {boolean} レビュー要素かどうか
     */
    isReviewElement(element) {
        try {
            const text = element.textContent || "";
            const hasReasonableLength = text.length > 10 && text.length < 2000;

            // レビューらしい要素の特徴をチェック
            const hasDateIndicators =
                /\d+\s*(日|days?|weeks?|months?)\s*(前|ago)/.test(text);
            const hasStarRating =
                element.querySelector('[aria-label*="stars"]') ||
                element.querySelector('[role="img"]');
            const hasUserInfo =
                element.querySelector("[alt]") ||
                element.querySelector('[data-href*="contrib"]');

            return (
                hasReasonableLength &&
                (hasDateIndicators || hasStarRating || hasUserInfo)
            );
        } catch (error) {
            return false;
        }
    }

    /**
     * レビューデータの品質チェック
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

        // データの内容チェック
        const hasValidContent =
            reviewData.textLength >= 0 &&
            typeof reviewData.hasPhotos === "boolean";

        return hasValidStructure && hasValidContent;
    }

    /**
     * デバッグ情報を取得
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
        const recentCount = reviews.filter((review) => {
            const dateInfo = window.TextUtils?.parseDateText(review.dateText);
            return dateInfo && dateInfo.isRecent;
        }).length;

        return {
            totalCount,
            averageLength,
            photosCount,
            recentCount,
            photosRatio: photosCount / totalCount,
            recentRatio: recentCount / totalCount,
        };
    }
}

// グローバルスコープに公開
if (typeof window !== "undefined") {
    window.DataExtractor = DataExtractor;
}
