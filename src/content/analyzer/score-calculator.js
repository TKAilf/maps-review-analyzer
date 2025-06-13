// src/content/analyzer/score-calculator.js

/**
 * 信頼度スコアを計算するクラス
 */
class ScoreCalculator {
    constructor(settings = {}) {
        this.settings = settings;
        this.constants = window.MRA_CONSTANTS;
        this.config = window.MRA_CONFIG;
    }

    /**
     * 総合信頼度スコアを計算
     * @param {Object} suspicionFactors - 疑念要因のスコア
     * @param {Array} suspiciousPatterns - 検出されたパターン
     * @param {Object} reviewData - レビューデータ
     * @returns {Object} - 計算結果
     */
    calculateTrustScore(suspicionFactors, suspiciousPatterns, reviewData) {
        // 基本スコア計算
        const baseScore = this.calculateBaseScore(suspicionFactors);

        // ボーナス・ペナルティ適用
        const adjustedScore = this.applyAdjustments(
            baseScore,
            suspiciousPatterns,
            reviewData
        );

        // 最終スコア（10-100の範囲に制限）
        const finalScore = Math.max(10, Math.min(100, adjustedScore));

        // 信頼度レベルを決定
        const trustLevel = this.determineTrustLevel(finalScore);

        // 詳細情報を生成
        const details = this.generateScoreDetails(
            suspicionFactors,
            suspiciousPatterns,
            reviewData
        );

        return {
            score: Math.round(finalScore),
            level: trustLevel,
            details,
            breakdown: this.createScoreBreakdown(
                suspicionFactors,
                baseScore,
                adjustedScore,
                finalScore
            ),
        };
    }

    /**
     * 基本スコアを計算（疑念要因の重み付き合計）
     * @param {Object} suspicionFactors - 疑念要因
     * @returns {number} - 基本スコア
     */
    calculateBaseScore(suspicionFactors) {
        let totalSuspicion = 0;
        const weights = this.config.ANALYSIS_WEIGHTS;

        // 各要因に重みを適用して合計
        Object.keys(suspicionFactors).forEach((factor) => {
            const value = suspicionFactors[factor] || 0;
            const weight = weights[factor]?.weight || 1.0;
            totalSuspicion += value * weight;
        });

        // 100から減算して信頼度スコアに変換
        return 100 - totalSuspicion;
    }

    /**
     * 追加の調整を適用
     * @param {number} baseScore - 基本スコア
     * @param {Array} suspiciousPatterns - 疑わしいパターン
     * @param {Object} reviewData - レビューデータ
     * @returns {number} - 調整後スコア
     */
    applyAdjustments(baseScore, suspiciousPatterns, reviewData) {
        let adjustedScore = baseScore;

        // レビュー数による調整
        adjustedScore = this.adjustForReviewCount(adjustedScore, reviewData);

        // パターンの重要度による調整
        adjustedScore = this.adjustForPatternSeverity(
            adjustedScore,
            suspiciousPatterns
        );

        // 評価分布の自然性による調整
        adjustedScore = this.adjustForRatingNaturalness(
            adjustedScore,
            reviewData
        );

        // 分析モードによる調整
        adjustedScore = this.adjustForAnalysisMode(adjustedScore);

        return adjustedScore;
    }

    /**
     * レビュー数による信頼性調整
     * @param {number} score - 現在のスコア
     * @param {Object} reviewData - レビューデータ
     * @returns {number} - 調整後スコア
     */
    adjustForReviewCount(score, reviewData) {
        const totalReviews = reviewData.totalReviews || 0;

        // レビュー数が少ない場合は信頼性を下げる
        if (totalReviews < 10) {
            return score * 0.9; // 10%減点
        } else if (totalReviews < 5) {
            return score * 0.8; // 20%減点
        }

        // レビュー数が多い場合はボーナス
        if (totalReviews > 100) {
            return Math.min(score * 1.05, 100); // 5%ボーナス（上限100）
        }

        return score;
    }

    /**
     * パターンの重要度による調整
     * @param {number} score - 現在のスコア
     * @param {Array} suspiciousPatterns - 疑わしいパターン
     * @returns {number} - 調整後スコア
     */
    adjustForPatternSeverity(score, suspiciousPatterns) {
        let adjustment = 0;

        suspiciousPatterns.forEach((pattern) => {
            switch (pattern.severity) {
                case this.constants.SEVERITY_LEVELS.HIGH:
                    adjustment -= 5; // 高重要度パターンで追加減点
                    break;
                case this.constants.SEVERITY_LEVELS.MEDIUM:
                    adjustment -= 2; // 中重要度パターンで軽微な減点
                    break;
                // 低重要度は追加調整なし
            }
        });

        return score + adjustment;
    }

    /**
     * 評価分布の自然性による調整
     * @param {number} score - 現在のスコア
     * @param {Object} reviewData - レビューデータ
     * @returns {number} - 調整後スコア
     */
    adjustForRatingNaturalness(score, reviewData) {
        const { ratings, totalReviews } = reviewData;

        if (totalReviews < 5) return score;

        // 正規分布に近い場合はボーナス
        const naturalness = this.calculateRatingNaturalness(
            ratings,
            totalReviews
        );

        if (naturalness > 0.8) {
            return Math.min(score * 1.03, 100); // 3%ボーナス
        } else if (naturalness < 0.3) {
            return score * 0.95; // 5%減点
        }

        return score;
    }

    /**
     * 分析モードによる調整
     * @param {number} score - 現在のスコア
     * @returns {number} - 調整後スコア
     */
    adjustForAnalysisMode(score) {
        const mode = this.settings.analysisMode || "standard";

        switch (mode) {
            case this.constants.ANALYSIS_MODES.STRICT:
                return score * 0.95; // 厳格モードでは5%減点
            case this.constants.ANALYSIS_MODES.LENIENT:
                return Math.min(score * 1.05, 100); // 寛容モードでは5%ボーナス
            default:
                return score; // 標準モードは調整なし
        }
    }

    /**
     * 評価分布の自然性を計算
     * @param {Object} ratings - 評価分布
     * @param {number} totalReviews - 総レビュー数
     * @returns {number} - 自然性スコア (0-1)
     */
    calculateRatingNaturalness(ratings, totalReviews) {
        if (totalReviews === 0) return 0;

        // 各評価の比率を計算
        const ratios = {};
        for (let i = 1; i <= 5; i++) {
            ratios[i] = (ratings[i] || 0) / totalReviews;
        }

        // 理想的な分布と比較（4.0-4.5星の店舗を想定）
        const idealRatios = { 1: 0.05, 2: 0.05, 3: 0.15, 4: 0.35, 5: 0.4 };

        // 差の二乗和を計算
        let totalDifference = 0;
        for (let i = 1; i <= 5; i++) {
            const difference = Math.abs(ratios[i] - idealRatios[i]);
            totalDifference += difference * difference;
        }

        // 自然性スコアを計算（差が小さいほど高スコア）
        return Math.max(0, 1 - Math.sqrt(totalDifference));
    }

    /**
     * 信頼度レベルを決定
     * @param {number} score - 信頼度スコア
     * @returns {string} - 信頼度レベル
     */
    determineTrustLevel(score) {
        const thresholds = this.constants.TRUST_SCORE_THRESHOLDS;

        if (score >= thresholds.HIGH) {
            return "high";
        } else if (score >= thresholds.MEDIUM) {
            return "medium";
        } else if (score >= thresholds.LOW) {
            return "low";
        } else {
            return "very_low";
        }
    }

    /**
     * スコア詳細情報を生成
     * @param {Object} suspicionFactors - 疑念要因
     * @param {Array} suspiciousPatterns - 疑わしいパターン
     * @param {Object} reviewData - レビューデータ
     * @returns {Object} - 詳細情報
     */
    generateScoreDetails(suspicionFactors, suspiciousPatterns, reviewData) {
        const details = {
            totalReviews: reviewData.totalReviews || 0,
            analysisMode: this.settings.analysisMode || "standard",
            patternsDetected: suspiciousPatterns.length,
            mainConcerns: [],
            positiveFactors: [],
            recommendations: [],
        };

        // 主な懸念事項を特定
        details.mainConcerns = this.identifyMainConcerns(
            suspiciousPatterns,
            suspicionFactors
        );

        // ポジティブ要因を特定
        details.positiveFactors = this.identifyPositiveFactors(
            reviewData,
            suspiciousPatterns
        );

        // 推奨事項を生成
        details.recommendations = this.generateRecommendations(
            details.mainConcerns,
            details.positiveFactors
        );

        return details;
    }

    /**
     * 主な懸念事項を特定
     * @param {Array} suspiciousPatterns - 疑わしいパターン
     * @param {Object} suspicionFactors - 疑念要因
     * @returns {Array} - 懸念事項リスト
     */
    identifyMainConcerns(suspiciousPatterns, suspicionFactors) {
        const concerns = [];

        // 高重要度パターンを優先
        const highSeverityPatterns = suspiciousPatterns.filter(
            (p) => p.severity === this.constants.SEVERITY_LEVELS.HIGH
        );

        if (highSeverityPatterns.length > 0) {
            concerns.push({
                type: "high_severity_patterns",
                description: `${highSeverityPatterns.length}件の重要な問題が検出されました`,
                patterns: highSeverityPatterns.map((p) => p.type),
            });
        }

        // 最も高いスコアの疑念要因を特定
        const maxFactor = Object.keys(suspicionFactors).reduce((max, key) =>
            suspicionFactors[key] > suspicionFactors[max] ? key : max
        );

        if (suspicionFactors[maxFactor] > 30) {
            concerns.push({
                type: "dominant_factor",
                description: `${this.getFactorDescription(
                    maxFactor
                )}が特に顕著です`,
                factor: maxFactor,
                score: suspicionFactors[maxFactor],
            });
        }

        return concerns;
    }

    /**
     * ポジティブ要因を特定
     * @param {Object} reviewData - レビューデータ
     * @param {Array} suspiciousPatterns - 疑わしいパターン
     * @returns {Array} - ポジティブ要因リスト
     */
    identifyPositiveFactors(reviewData, suspiciousPatterns) {
        const positives = [];

        // 十分なレビュー数
        if (reviewData.totalReviews >= 50) {
            positives.push({
                type: "sufficient_reviews",
                description: `十分な数のレビュー（${reviewData.totalReviews}件）があります`,
            });
        }

        // パターン検出が少ない
        if (suspiciousPatterns.length === 0) {
            positives.push({
                type: "no_suspicious_patterns",
                description: "疑わしいパターンは検出されませんでした",
            });
        }

        // 評価分布の自然性
        const naturalness = this.calculateRatingNaturalness(
            reviewData.ratings,
            reviewData.totalReviews
        );
        if (naturalness > 0.7) {
            positives.push({
                type: "natural_distribution",
                description: "評価分布が自然なパターンを示しています",
            });
        }

        return positives;
    }

    /**
     * 推奨事項を生成
     * @param {Array} concerns - 懸念事項
     * @param {Array} positives - ポジティブ要因
     * @returns {Array} - 推奨事項リスト
     */
    generateRecommendations(concerns, positives) {
        const recommendations = [];

        if (concerns.length === 0) {
            recommendations.push({
                type: "low_risk",
                text: "レビューは概ね信頼できると考えられます",
            });
        } else if (concerns.length >= 2) {
            recommendations.push({
                type: "high_risk",
                text: "複数の疑わしい要素があるため、他の情報源と照らし合わせることをお勧めします",
            });
        } else {
            recommendations.push({
                type: "moderate_risk",
                text: "一部疑わしい要素がありますが、総合的に判断することをお勧めします",
            });
        }

        // 具体的な注意点
        const hasHighSeverity = concerns.some(
            (c) => c.type === "high_severity_patterns"
        );
        if (hasHighSeverity) {
            recommendations.push({
                type: "detailed_check",
                text: "個別のレビュー内容を詳しく確認することをお勧めします",
            });
        }

        return recommendations;
    }

    /**
     * スコア内訳を作成
     * @param {Object} suspicionFactors - 疑念要因
     * @param {number} baseScore - 基本スコア
     * @param {number} adjustedScore - 調整後スコア
     * @param {number} finalScore - 最終スコア
     * @returns {Object} - スコア内訳
     */
    createScoreBreakdown(
        suspicionFactors,
        baseScore,
        adjustedScore,
        finalScore
    ) {
        return {
            suspicionFactors: { ...suspicionFactors },
            baseScore: Math.round(baseScore),
            adjustedScore: Math.round(adjustedScore),
            finalScore: Math.round(finalScore),
            adjustments: Math.round(adjustedScore - baseScore),
            confidence: this.calculateConfidence(suspicionFactors, finalScore),
        };
    }

    /**
     * 信頼度を計算
     * @param {Object} suspicionFactors - 疑念要因
     * @param {number} finalScore - 最終スコア
     * @returns {number} - 信頼度 (0-1)
     */
    calculateConfidence(suspicionFactors, finalScore) {
        // スコアの極端さと疑念要因の一貫性から信頼度を計算
        const factorCount = Object.values(suspicionFactors).filter(
            (v) => v > 0
        ).length;
        const avgFactor =
            Object.values(suspicionFactors).reduce((sum, v) => sum + v, 0) / 5;

        let confidence = 0.8; // 基本信頼度

        // 極端なスコアの場合は信頼度を下げる
        if (finalScore > 90 || finalScore < 20) {
            confidence -= 0.1;
        }

        // 多くの要因が検出された場合は信頼度を上げる
        if (factorCount >= 3) {
            confidence += 0.1;
        }

        // 要因の強さが一定以上の場合は信頼度を上げる
        if (avgFactor > 20) {
            confidence += 0.05;
        }

        return Math.max(0.5, Math.min(1.0, confidence));
    }

    /**
     * 疑念要因の説明を取得
     * @param {string} factor - 要因キー
     * @returns {string} - 説明文
     */
    getFactorDescription(factor) {
        const descriptions = {
            polarizedRatings: "極端な評価の偏り",
            burstPosting: "短期間での集中投稿",
            shortReviews: "極端に短いレビュー",
            duplicatePatterns: "類似・重複レビュー",
            newAccounts: "新規アカウントからの投稿",
        };

        return descriptions[factor] || factor;
    }

    /**
     * スコアに対応する色を取得
     * @param {number} score - スコア
     * @returns {string} - 色コード
     */
    getScoreColor(score) {
        const colors = this.constants.UI_CONSTANTS.COLORS;

        if (score >= this.constants.TRUST_SCORE_THRESHOLDS.HIGH) {
            return colors.HIGH_TRUST;
        } else if (score >= this.constants.TRUST_SCORE_THRESHOLDS.MEDIUM) {
            return colors.MEDIUM_TRUST;
        } else if (score >= this.constants.TRUST_SCORE_THRESHOLDS.LOW) {
            return colors.LOW_TRUST;
        } else {
            return colors.VERY_LOW_TRUST;
        }
    }

    /**
     * スコアに対応するテキストを取得
     * @param {number} score - スコア
     * @returns {string} - 説明テキスト
     */
    getScoreText(score) {
        if (score >= this.constants.TRUST_SCORE_THRESHOLDS.HIGH) {
            return "信頼度が高いです";
        } else if (score >= this.constants.TRUST_SCORE_THRESHOLDS.MEDIUM) {
            return "概ね信頼できます";
        } else if (score >= this.constants.TRUST_SCORE_THRESHOLDS.LOW) {
            return "注意が必要です";
        } else {
            return "疑わしい要素があります";
        }
    }
}

// グローバルスコープに公開
if (typeof window !== "undefined") {
    window.ScoreCalculator = ScoreCalculator;
}
