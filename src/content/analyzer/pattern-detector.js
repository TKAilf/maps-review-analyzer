// src/content/analyzer/pattern-detector.js

/**
 * 疑わしいパターンを検出するクラス
 */
class PatternDetector {
    constructor(settings = {}) {
        this.settings = settings;
        this.constants = window.MRA_CONSTANTS;
        this.config = window.MRA_CONFIG;
    }

    /**
     * すべての疑わしいパターンを検出
     * @param {Object} reviewData - レビューデータ
     * @returns {Object} - 検出結果
     */
    detectAllPatterns(reviewData) {
        const suspicionFactors = {
            polarizedRatings: 0,
            burstPosting: 0,
            shortReviews: 0,
            duplicatePatterns: 0,
            newAccounts: 0,
        };

        const suspiciousPatterns = [];

        // 各パターンの検出
        const polarized = this.detectPolarizedRatings(reviewData);
        if (polarized.detected) {
            suspicionFactors.polarizedRatings = polarized.score;
            suspiciousPatterns.push(polarized.pattern);
        }

        const burst = this.detectBurstPosting(reviewData);
        if (burst.detected) {
            suspicionFactors.burstPosting = burst.score;
            suspiciousPatterns.push(burst.pattern);
        }

        const shortReviews = this.detectShortReviews(reviewData);
        if (shortReviews.detected) {
            suspicionFactors.shortReviews = shortReviews.score;
            suspiciousPatterns.push(shortReviews.pattern);
        }

        const duplicates = this.detectDuplicatePatterns(reviewData);
        if (duplicates.detected) {
            suspicionFactors.duplicatePatterns = duplicates.score;
            suspiciousPatterns.push(duplicates.pattern);
        }

        const newAccounts = this.detectNewAccounts(reviewData);
        if (newAccounts.detected) {
            suspicionFactors.newAccounts = newAccounts.score;
            suspiciousPatterns.push(newAccounts.pattern);
        }

        return {
            suspicionFactors,
            suspiciousPatterns,
        };
    }

    /**
     * 極端な評価の偏りを検出
     * @param {Object} reviewData - レビューデータ
     * @returns {Object} - 検出結果
     */
    detectPolarizedRatings(reviewData) {
        const { ratings, totalReviews } = reviewData;
        const minReviews = this.settings.minimumReviewsForAnalysis || 5;

        if (totalReviews < minReviews) {
            return { detected: false };
        }

        const extremeRatings = ratings[1] + ratings[5];
        const middleRatings = ratings[2] + ratings[3] + ratings[4];

        if (totalReviews === 0) {
            return { detected: false };
        }

        const extremeRatio = extremeRatings / totalReviews;
        const middleRatio = middleRatings / totalReviews;

        // 分析モードに応じて閾値を調整
        const thresholds = this.config.ANALYSIS_CONSTANTS.POLARIZED_THRESHOLDS;
        const threshold =
            thresholds[this.settings.analysisMode] || thresholds.standard;

        if (extremeRatio > threshold && middleRatio < 0.2) {
            const weight = this.config.ANALYSIS_WEIGHTS.polarizedRatings.weight;
            const maxScore =
                this.config.ANALYSIS_WEIGHTS.polarizedRatings.maxScore;
            const score = Math.min(extremeRatio * 100 * weight, maxScore);

            return {
                detected: true,
                score,
                pattern: {
                    type: this.constants.PATTERN_TYPES.POLARIZED_RATINGS,
                    description: `極端な評価が${(extremeRatio * 100).toFixed(
                        1
                    )}%を占めています`,
                    severity: this.constants.SEVERITY_LEVELS.HIGH,
                    metadata: {
                        extremeRatio,
                        middleRatio,
                        extremeCount: extremeRatings,
                        middleCount: middleRatings,
                    },
                },
            };
        }

        return { detected: false };
    }

    /**
     * 短期間での集中投稿を検出
     * @param {Object} reviewData - レビューデータ
     * @returns {Object} - 検出結果
     */
    detectBurstPosting(reviewData) {
        const { recentReviews } = reviewData;

        if (!recentReviews || recentReviews.length === 0) {
            return { detected: false };
        }

        const recentKeywords = this.getRecentDateKeywords();
        const recentCount = recentReviews.filter((review) =>
            recentKeywords.some((keyword) => review.dateText.includes(keyword))
        ).length;

        if (recentCount > 5) {
            const totalReviews = Math.max(
                reviewData.totalReviews,
                recentReviews.length
            );
            const burstRatio = recentCount / totalReviews;
            const threshold =
                this.config.ANALYSIS_CONSTANTS.BURST_POSTING_THRESHOLD;

            if (burstRatio > threshold) {
                const weight = this.config.ANALYSIS_WEIGHTS.burstPosting.weight;
                const maxScore =
                    this.config.ANALYSIS_WEIGHTS.burstPosting.maxScore;
                const score = Math.min(burstRatio * 100 * weight, maxScore);

                return {
                    detected: true,
                    score,
                    pattern: {
                        type: this.constants.PATTERN_TYPES.BURST_POSTING,
                        description: `最近${recentCount}件の集中投稿があります`,
                        severity: this.constants.SEVERITY_LEVELS.MEDIUM,
                        metadata: {
                            recentCount,
                            burstRatio,
                            totalReviews,
                        },
                    },
                };
            }
        }

        return { detected: false };
    }

    /**
     * 極端に短いレビューを検出
     * @param {Object} reviewData - レビューデータ
     * @returns {Object} - 検出結果
     */
    detectShortReviews(reviewData) {
        const { recentReviews } = reviewData;

        if (!recentReviews || recentReviews.length === 0) {
            return { detected: false };
        }

        const shortLength = this.config.ANALYSIS_CONSTANTS.SHORT_REVIEW_LENGTH;
        const shortReviews = recentReviews.filter(
            (review) => review.textLength > 0 && review.textLength < shortLength
        );

        const shortRatio = shortReviews.length / recentReviews.length;
        const threshold = this.config.ANALYSIS_CONSTANTS.SHORT_REVIEW_THRESHOLD;

        if (shortRatio > threshold) {
            const weight = this.config.ANALYSIS_WEIGHTS.shortReviews.weight;
            const maxScore = this.config.ANALYSIS_WEIGHTS.shortReviews.maxScore;
            const score = Math.min(shortRatio * 100 * weight, maxScore);

            return {
                detected: true,
                score,
                pattern: {
                    type: this.constants.PATTERN_TYPES.SHORT_REVIEWS,
                    description: `極端に短いレビューが${(
                        shortRatio * 100
                    ).toFixed(1)}%含まれています`,
                    severity: this.constants.SEVERITY_LEVELS.LOW,
                    metadata: {
                        shortCount: shortReviews.length,
                        shortRatio,
                        averageLength:
                            this.calculateAverageLength(recentReviews),
                    },
                },
            };
        }

        return { detected: false };
    }

    /**
     * 類似・重複レビューパターンを検出
     * @param {Object} reviewData - レビューデータ
     * @returns {Object} - 検出結果
     */
    detectDuplicatePatterns(reviewData) {
        const { recentReviews } = reviewData;

        if (!recentReviews || recentReviews.length < 3) {
            return { detected: false };
        }

        const reviewTexts = recentReviews
            .map((review) => review.text)
            .filter((text) => text && text.length > 5);

        if (reviewTexts.length < 3) {
            return { detected: false };
        }

        const similarities = this.findSimilarTexts(reviewTexts);

        if (similarities.length > 0) {
            const weight =
                this.config.ANALYSIS_WEIGHTS.duplicatePatterns.weight;
            const baseScore = similarities.length * 15;
            const score = Math.min(
                baseScore * weight,
                this.config.ANALYSIS_WEIGHTS.duplicatePatterns.maxScore
            );

            return {
                detected: true,
                score,
                pattern: {
                    type: this.constants.PATTERN_TYPES.DUPLICATE_PATTERNS,
                    description: `${similarities.length}組の類似レビューが見つかりました`,
                    severity: this.constants.SEVERITY_LEVELS.HIGH,
                    metadata: {
                        similarityCount: similarities.length,
                        similarities: similarities.slice(0, 3), // 最初の3組のみ保存
                        averageSimilarity:
                            this.calculateAverageSimilarity(similarities),
                    },
                },
            };
        }

        return { detected: false };
    }

    /**
     * 新規アカウントからの疑わしい投稿を検出
     * @param {Object} reviewData - レビューデータ
     * @returns {Object} - 検出結果
     */
    detectNewAccounts(reviewData) {
        const { recentReviews } = reviewData;

        if (!recentReviews || recentReviews.length === 0) {
            return { detected: false };
        }

        const suspiciousLength =
            this.config.ANALYSIS_CONSTANTS.SUSPICIOUS_REVIEW_LENGTH;
        const suspiciousAuthors = recentReviews.filter(
            (review) =>
                !review.hasPhotos &&
                review.textLength > 0 &&
                review.textLength < suspiciousLength
        );

        const suspiciousRatio = suspiciousAuthors.length / recentReviews.length;
        const threshold = this.config.ANALYSIS_CONSTANTS.NEW_ACCOUNT_THRESHOLD;

        if (suspiciousRatio > threshold) {
            const weight = this.config.ANALYSIS_WEIGHTS.newAccounts.weight;
            const maxScore = this.config.ANALYSIS_WEIGHTS.newAccounts.maxScore;
            const score = Math.min(suspiciousRatio * 100 * weight, maxScore);

            return {
                detected: true,
                score,
                pattern: {
                    type: this.constants.PATTERN_TYPES.NEW_ACCOUNTS,
                    description: `新規アカウントからの投稿が${(
                        suspiciousRatio * 100
                    ).toFixed(1)}%含まれています`,
                    severity: this.constants.SEVERITY_LEVELS.MEDIUM,
                    metadata: {
                        suspiciousCount: suspiciousAuthors.length,
                        suspiciousRatio,
                        totalReviews: recentReviews.length,
                    },
                },
            };
        }

        return { detected: false };
    }

    /**
     * テキストの類似性を検出
     * @param {string[]} texts - テキスト配列
     * @returns {Array} - 類似ペアの配列
     */
    findSimilarTexts(texts) {
        const similarities = [];
        const threshold =
            this.config.ANALYSIS_CONSTANTS.TEXT_SIMILARITY_THRESHOLD;

        for (let i = 0; i < texts.length; i++) {
            for (let j = i + 1; j < texts.length; j++) {
                const similarity = this.calculateTextSimilarity(
                    texts[i],
                    texts[j]
                );
                if (similarity > threshold) {
                    similarities.push({
                        text1: texts[i],
                        text2: texts[j],
                        similarity,
                    });
                }
            }
        }

        return similarities;
    }

    /**
     * テキスト間の類似度を計算
     * @param {string} text1 - テキスト1
     * @param {string} text2 - テキスト2
     * @returns {number} - 類似度 (0-1)
     */
    calculateTextSimilarity(text1, text2) {
        if (!text1 || !text2) return 0;

        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));

        const intersection = new Set(
            [...words1].filter((word) => words2.has(word))
        );
        const union = new Set([...words1, ...words2]);

        return union.size > 0 ? intersection.size / union.size : 0;
    }

    /**
     * 最近の日付を示すキーワードを取得
     * @returns {string[]} - キーワード配列
     */
    getRecentDateKeywords() {
        const locale = this.detectLocale();
        const patterns =
            this.config.I18N_CONFIG.RECENT_DATE_PATTERNS[locale] ||
            this.config.I18N_CONFIG.RECENT_DATE_PATTERNS.ja;

        // 正規表現から抽出可能なキーワードを生成
        return [
            "日前",
            "週間前",
            "時間前",
            "分前",
            "day ago",
            "week ago",
            "hour ago",
            "minute ago",
            "days ago",
            "weeks ago",
            "hours ago",
            "minutes ago",
        ];
    }

    /**
     * ロケールを検出
     * @returns {string} - ロケール文字列
     */
    detectLocale() {
        const lang = navigator.language || navigator.userLanguage || "ja";
        return lang.startsWith("ja") ? "ja" : "en";
    }

    /**
     * レビューの平均文字数を計算
     * @param {Array} reviews - レビュー配列
     * @returns {number} - 平均文字数
     */
    calculateAverageLength(reviews) {
        if (!reviews || reviews.length === 0) return 0;

        const totalLength = reviews.reduce(
            (sum, review) => sum + (review.textLength || 0),
            0
        );
        return Math.round(totalLength / reviews.length);
    }

    /**
     * 類似度の平均を計算
     * @param {Array} similarities - 類似度配列
     * @returns {number} - 平均類似度
     */
    calculateAverageSimilarity(similarities) {
        if (!similarities || similarities.length === 0) return 0;

        const totalSimilarity = similarities.reduce(
            (sum, item) => sum + item.similarity,
            0
        );
        return Math.round((totalSimilarity / similarities.length) * 100) / 100;
    }
}

// グローバルスコープに公開
if (typeof window !== "undefined") {
    window.PatternDetector = PatternDetector;
}
