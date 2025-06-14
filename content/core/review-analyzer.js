// src/content/analyzer/review-analyzer.js - 改善版（ページ準備状況チェック対応）

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
                // ページの準備ができるまで待ってから分析を開始
                this.analysisTimeout = setTimeout(() => {
                    this.performAnalysisIfReady();
                }, 3000);
            }

            console.log("ReviewAnalyzer initialized successfully");
        } catch (error) {
            console.error("ReviewAnalyzer initialization failed:", error);
        }
    }

    /**
     * ページの準備ができている場合のみ分析を実行
     */
    async performAnalysisIfReady() {
        try {
            const isReady = await this.checkPageReadiness();
            if (isReady) {
                console.log("Page is ready, performing analysis");
                await this.performAnalysis();
            } else {
                console.log("Page not ready, skipping auto analysis");
            }
        } catch (error) {
            console.error("Error in performAnalysisIfReady:", error);
        }
    }

    /**
     * ページの準備状況をチェック
     * @returns {Promise<boolean>} ページが準備できているかどうか
     */
    async checkPageReadiness() {
        try {
            console.log("Checking page readiness...");

            // 基本的な要素の存在チェック
            const basicElementsExist =
                document.querySelector('[role="main"]') &&
                (document.querySelector("h1") ||
                    document.querySelector('[data-value="Reviews"]'));

            if (!basicElementsExist) {
                console.log("Basic elements not found");
                return false;
            }

            // データ抽出器を使って実際にデータが取得できるかテスト
            try {
                const placeName = this.dataExtractor.extractPlaceName();
                if (!placeName || placeName === "不明な場所") {
                    console.log("Place name not available");
                    return false;
                }

                const totalReviews = this.dataExtractor.extractTotalReviews();
                const ratings = this.dataExtractor.extractRatings();
                const hasReviewData =
                    totalReviews > 0 ||
                    Object.values(ratings).some((count) => count > 0);

                if (!hasReviewData) {
                    console.log("No review data available yet");
                    return false;
                }

                console.log("Page readiness check passed");
                return true;
            } catch (error) {
                console.log("Data extraction test failed:", error);
                return false;
            }
        } catch (error) {
            console.error("Error checking page readiness:", error);
            return false;
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
                        this.handleManualAnalysisRequest(sendResponse);
                        return true; // 非同期レスポンスを示す
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
                            setTimeout(
                                () => this.performAnalysisIfReady(),
                                2000
                            );
                        }
                        sendResponse({ success: true });
                    } else if (message.type === "SETTINGS_UPDATED") {
                        console.log("Settings updated");
                        this.settings = message.data;
                        this.updateComponents();
                        sendResponse({ success: true });
                    } else if (message.type === "CHECK_PAGE_READINESS") {
                        console.log("Page readiness check requested");
                        this.handlePageReadinessCheck(sendResponse);
                        return true; // 非同期レスポンスを示す
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
     * 手動分析要求を処理
     * @param {Function} sendResponse - レスポンス関数
     */
    async handleManualAnalysisRequest(sendResponse) {
        try {
            console.log("Processing manual analysis request");

            // ページの準備状況をチェック
            const isReady = await this.checkPageReadiness();
            if (!isReady) {
                sendResponse({
                    success: false,
                    error: "ページの読み込みが完了していません",
                });
                return;
            }

            // 分析を実行
            await this.performAnalysis();

            sendResponse({ success: true });
        } catch (error) {
            console.error("Manual analysis failed:", error);
            sendResponse({
                success: false,
                error: "分析中にエラーが発生しました: " + error.message,
            });
        }
    }

    /**
     * ページ準備状況チェック要求を処理
     * @param {Function} sendResponse - レスポンス関数
     */
    async handlePageReadinessCheck(sendResponse) {
        try {
            const isReady = await this.checkPageReadiness();
            sendResponse({ ready: isReady });
        } catch (error) {
            console.error("Page readiness check failed:", error);
            sendResponse({ ready: false });
        }
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
     * 分析を実行（改善版）
     */
    async performAnalysis() {
        if (this.isAnalyzing) {
            console.log("Analysis already in progress");
            return;
        }

        try {
            this.isAnalyzing = true;
            console.log("Starting analysis...");

            // ページの準備状況を再確認
            const isReady = await this.checkPageReadiness();
            if (!isReady) {
                console.log("Page not ready for analysis");
                this.resultRenderer.displayError(
                    "ページの読み込みが完了していません。少し待ってから再試行してください。",
                    "この場所"
                );
                return;
            }

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
    async reanalyze() {
        console.log("Manual reanalysis triggered");

        // 現在の分析を停止
        if (this.analysisTimeout) {
            clearTimeout(this.analysisTimeout);
            this.analysisTimeout = null;
        }

        // 少し待ってから分析を実行
        await new Promise((resolve) => setTimeout(resolve, 500));
        await this.performAnalysis();
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

    /**
     * デバッグ情報を取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            status: this.getStatus(),
            settings: this.settings,
            pageReadiness: this.checkPageReadiness(),
            extractorDebug: this.dataExtractor
                ? this.dataExtractor.getDebugInfo()
                : null,
            timestamp: new Date().toISOString(),
        };
    }
}

// グローバルスコープに公開
if (typeof window !== "undefined") {
    window.ReviewAnalyzer = ReviewAnalyzer;
}
