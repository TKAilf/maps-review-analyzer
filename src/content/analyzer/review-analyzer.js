// src/content/analyzer/review-analyzer.js

/**
 * メインのレビュー分析クラス
 */
class ReviewAnalyzer {
    constructor() {
        this.constants = window.MRA_CONSTANTS;
        this.config = window.MRA_CONFIG;
        this.patternDetector = null;
        this.scoreCalculator = null;
        this.dataExtractor = null;
        this.resultRenderer = null;
        this.communication = null;
        this.isAnalyzing = false;
        this.settings = {};
        this.analysisTimeout = null;

        this.init();
    }

    /**
     * 初期化処理
     */
    async init() {
        try {
            console.log("ReviewAnalyzer initializing...");

            // 設定を取得
            this.settings = await this.loadSettings();
            console.log("Settings loaded:", this.settings);

            // 各コンポーネントを初期化
            this.patternDetector = new PatternDetector(
                this.settings.settings || this.settings
            );
            this.scoreCalculator = new ScoreCalculator(
                this.settings.settings || this.settings
            );
            this.dataExtractor = new DataExtractor();
            this.resultRenderer = new ResultRenderer();
            this.communication = new Communication();

            // メッセージリスナーを設定
            this.setupMessageListeners();

            // 自動分析が有効な場合は実行
            const autoAnalysis =
                this.settings.settings?.autoAnalysis ??
                this.settings.autoAnalysis ??
                true;
            if (autoAnalysis) {
                // 少し待ってから分析を開始（ページの読み込み完了を待つ）
                this.analysisTimeout = setTimeout(() => {
                    this.performAnalysis();
                }, 2000);
            }

            console.log("ReviewAnalyzer initialized successfully");
        } catch (error) {
            console.error("ReviewAnalyzer initialization failed:", error);
        }
    }

    /**
     * 設定を読み込み
     * @returns {Promise<Object>} 設定オブジェクト
     */
    async loadSettings() {
        try {
            const response = await this.communication.sendMessage({
                type: this.constants.MESSAGE_TYPES.GET_SETTINGS,
            });

            return response.data || this.config.DEFAULT_SETTINGS;
        } catch (error) {
            console.error("Failed to load settings:", error);
            return this.config.DEFAULT_SETTINGS;
        }
    }

    /**
     * メッセージリスナーを設定
     */
    setupMessageListeners() {
        chrome.runtime.onMessage.addListener(
            (message, sender, sendResponse) => {
                try {
                    if (
                        message.type ===
                        this.constants.MESSAGE_TYPES.MANUAL_ANALYSIS_REQUEST
                    ) {
                        console.log("Manual analysis requested");
                        this.performAnalysis();
                        sendResponse({ success: true });
                    } else if (
                        message.type ===
                        this.constants.MESSAGE_TYPES.PAGE_LOADED
                    ) {
                        console.log("Page loaded message received");
                        // ページ読み込み時の自動分析
                        if (
                            this.settings.settings?.autoAnalysis ??
                            this.settings.autoAnalysis ??
                            true
                        ) {
                            setTimeout(() => this.performAnalysis(), 1000);
                        }
                        sendResponse({ success: true });
                    } else if (message.type === "SETTINGS_UPDATED") {
                        console.log("Settings updated");
                        this.settings = message.data;
                        this.updateComponents();
                        sendResponse({ success: true });
                    }
                } catch (error) {
                    console.error("Error handling message:", error);
                    sendResponse({ success: false, error: error.message });
                }

                return true; // 非同期レスポンスを示す
            }
        );
    }

    /**
     * コンポーネントの設定を更新
     */
    updateComponents() {
        try {
            const settings = this.settings.settings || this.settings;
            if (this.patternDetector) {
                this.patternDetector.settings = settings;
            }
            if (this.scoreCalculator) {
                this.scoreCalculator.settings = settings;
            }
        } catch (error) {
            console.error("Failed to update components:", error);
        }
    }

    /**
     * 分析を実行
     */
    async performAnalysis() {
        if (this.isAnalyzing) {
            console.log("Analysis already in progress");
            return;
        }

        try {
            this.isAnalyzing = true;
            console.log("Starting analysis...");

            // データ抽出
            const reviewData = await this.dataExtractor.extractReviewData();
            console.log("Extracted review data:", reviewData);

            const minimumReviews =
                this.settings.settings?.minimumReviewsForAnalysis ??
                this.settings.minimumReviewsForAnalysis ??
                5;

            if (!reviewData || reviewData.totalReviews < minimumReviews) {
                console.log("Insufficient data for analysis");
                this.resultRenderer.displayInsufficientData(
                    reviewData?.placeName || "この場所",
                    reviewData?.totalReviews || 0
                );
                return;
            }

            // パターン検出
            console.log("Detecting patterns...");
            const patternResult =
                this.patternDetector.detectAllPatterns(reviewData);
            console.log("Pattern detection result:", patternResult);

            // スコア計算
            console.log("Calculating trust score...");
            const scoreResult = this.scoreCalculator.calculateTrustScore(
                patternResult.suspicionFactors,
                patternResult.suspiciousPatterns,
                reviewData
            );
            console.log("Score calculation result:", scoreResult);

            // 結果表示
            console.log("Displaying results...");
            const settings = this.settings.settings || this.settings;
            this.resultRenderer.displayTrustScore(
                scoreResult,
                settings,
                reviewData.placeName
            );

            // 結果を保存
            await this.saveAnalysisResult({
                url: window.location.href,
                placeName: reviewData.placeName,
                trustScore: scoreResult.score,
                totalReviews: reviewData.totalReviews,
                suspiciousPatterns: patternResult.suspiciousPatterns,
                analysisMode: settings.analysisMode || "standard",
            });

            console.log("Analysis completed successfully");
        } catch (error) {
            console.error("Analysis failed:", error);
            this.resultRenderer.displayError(
                "分析中にエラーが発生しました: " + error.message,
                "この場所"
            );
        } finally {
            this.isAnalyzing = false;
        }
    }

    /**
     * 分析結果を保存
     * @param {Object} data - 保存するデータ
     */
    async saveAnalysisResult(data) {
        try {
            await this.communication.sendMessage({
                type: this.constants.MESSAGE_TYPES.SAVE_ANALYSIS_RESULT,
                data: data,
            });
            console.log("Analysis result saved");
        } catch (error) {
            console.error("Failed to save analysis result:", error);
        }
    }

    /**
     * 手動で分析を再実行
     */
    reanalyze() {
        console.log("Manual reanalysis triggered");
        this.performAnalysis();
    }

    /**
     * クリーンアップ処理
     */
    destroy() {
        try {
            console.log("ReviewAnalyzer destroying...");

            // タイムアウトをクリア
            if (this.analysisTimeout) {
                clearTimeout(this.analysisTimeout);
                this.analysisTimeout = null;
            }

            // 表示要素を削除
            if (this.resultRenderer) {
                this.resultRenderer.removeExisting();
            }

            // フラグをリセット
            this.isAnalyzing = false;

            console.log("ReviewAnalyzer destroyed");
        } catch (error) {
            console.error("Error during ReviewAnalyzer destruction:", error);
        }
    }

    /**
     * 現在の分析状態を取得
     * @returns {Object} 状態情報
     */
    getStatus() {
        return {
            isAnalyzing: this.isAnalyzing,
            hasSettings: Object.keys(this.settings).length > 0,
            componentsReady: !!(
                this.patternDetector &&
                this.scoreCalculator &&
                this.dataExtractor &&
                this.resultRenderer &&
                this.communication
            ),
            isDisplayed: this.resultRenderer
                ? this.resultRenderer.isDisplayed()
                : false,
        };
    }
}

// グローバルスコープに公開
if (typeof window !== "undefined") {
    window.ReviewAnalyzer = ReviewAnalyzer;
}
