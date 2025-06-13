// content.js - Google Maps レビュー分析 Content Script

class MapsReviewAnalyzer {
  constructor() {
    this.reviewData = {
      ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      totalReviews: 0,
      recentReviews: [],
      suspiciousPatterns: [],
    };

    this.suspicionFactors = {
      polarizedRatings: 0,
      burstPosting: 0,
      shortReviews: 0,
      duplicatePatterns: 0,
      newAccounts: 0,
    };

    this.settings = {};
    this.trustScore = 0;
    this.placeName = "";

    this.init();
  }

  async init() {
    if (!this.isGoogleMapsPage()) return;

    // 設定を読み込み
    await this.loadSettings();

    // ページ読み込み完了を待つ
    this.waitForPageLoad().then(() => {
      this.analyzeReviews();
    });

    // 動的コンテンツの変更を監視
    this.observePageChanges();

    // Background scriptからのメッセージを受信
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });
  }

  async loadSettings() {
    try {
      const response = await this.sendMessageToBackground({
        type: "GET_SETTINGS",
      });
      if (response.success) {
        this.settings = response.data.settings || {};
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      // デフォルト設定を使用
      this.settings = {
        analysisMode: "standard",
        showDetailedAnalysis: true,
        minimumReviewsForAnalysis: 5,
        suspicionThreshold: 40,
      };
    }
  }

  /**
   * Background scriptにメッセージを送信する
   * @param {Object} message - 送信するメッセージ
   * @returns {Promise<Object>} - レスポンス
   */
  sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!response) {
            reject(new Error("No response received from background script"));
          } else if (response.success === false) {
            reject(new Error(response.error || "Unknown error"));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case "PAGE_LOADED":
        setTimeout(() => this.analyzeReviews(), 2000);
        sendResponse({ success: true });
        break;

      case "MANUAL_ANALYSIS_REQUEST":
        this.analyzeReviews();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: "Unknown message type" });
    }
  }

  isGoogleMapsPage() {
    return (
      window.location.hostname === "www.google.com" &&
      window.location.pathname.includes("/maps/")
    );
  }

  /**
   * ページの変更を監視する
   */
  observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldReanalyze = false;

      mutations.forEach((mutation) => {
        // レビューコンテンツの変更を検出
        if (mutation.target.closest('[data-review-id]') ||
            mutation.target.querySelector('[data-review-id]')) {
          shouldReanalyze = true;
        }
        
        // 店舗情報の変更を検出
        if (mutation.target.closest('[data-value="Reviews"]') ||
            mutation.target.querySelector('[data-value="Reviews"]')) {
          shouldReanalyze = true;
        }
      });

      if (shouldReanalyze) {
        // 連続した変更を防ぐためにデバウンス
        clearTimeout(this.reanalysisTimeout);
        this.reanalysisTimeout = setTimeout(() => {
          this.analyzeReviews();
        }, 2000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.observer = observer;
  }

  async waitForPageLoad() {
    return new Promise((resolve) => {
      const checkForContent = () => {
        // レビューまたは店舗情報が表示されているかチェック
        const hasReviews =
          document.querySelectorAll("[data-review-id]").length > 0;
        const hasPlaceInfo =
          document.querySelector('[data-value="Reviews"]') ||
          document.querySelector('[aria-label*="reviews"]');

        if (hasReviews || hasPlaceInfo) {
          resolve();
        } else {
          setTimeout(checkForContent, 1000);
        }
      };
      checkForContent();
    });
  }

  async analyzeReviews() {
    try {
      // 店舗名を取得
      this.extractPlaceName();

      // レビューが十分にあるかチェック
      if (!this.hasEnoughReviews()) {
        this.displayInsufficientDataMessage();
        return;
      }

      // 分析をリセット
      this.resetAnalysis();

      // 評価分布を取得
      this.extractRatingDistribution();

      // 個別レビューを分析
      this.extractIndividualReviews();

      // 疑わしいパターンを検出
      this.detectSuspiciousPatterns();

      // 信頼性スコアを計算
      this.calculateTrustScore();

      // 結果を表示
      this.displayTrustScore();

      // 分析結果を保存
      await this.saveAnalysisResult();
    } catch (error) {
      console.error("Review analysis failed:", error);
      this.displayErrorMessage();
    }
  }

  extractPlaceName() {
    const selectors = [
      'h1[data-attrid="title"]',
      "h1.DUwDvf.lfPIob",
      '[data-value="Reviews"]',
      ".DUwDvf.lfPIob",
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        this.placeName = element.textContent.trim();
        break;
      }
    }

    if (!this.placeName) {
      this.placeName = "Unknown Place";
    }
  }

  hasEnoughReviews() {
    // 総レビュー数を簡易チェック
    const reviewElements = document.querySelectorAll("[data-review-id]");
    const ratingElements = document.querySelectorAll('[aria-label*="stars"]');

    return (
      reviewElements.length >= this.settings.minimumReviewsForAnalysis ||
      ratingElements.length > 0
    );
  }

  resetAnalysis() {
    this.reviewData = {
      ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      totalReviews: 0,
      recentReviews: [],
      suspiciousPatterns: [],
    };

    this.suspicionFactors = {
      polarizedRatings: 0,
      burstPosting: 0,
      shortReviews: 0,
      duplicatePatterns: 0,
      newAccounts: 0,
    };
  }

  extractRatingDistribution() {
    // 方法1: 評価分布バーから取得
    const ratingBars = document.querySelectorAll(
      '[role="img"][aria-label*="stars"]'
    );

    ratingBars.forEach((bar) => {
      const ariaLabel = bar.getAttribute("aria-label");
      const match = ariaLabel.match(/(\d+) stars?, (\d+) reviews?/);

      if (match) {
        const stars = parseInt(match[1]);
        const count = parseInt(match[2]);
        this.reviewData.ratings[stars] = count;
        this.reviewData.totalReviews += count;
      }
    });

    // 方法2: 総合評価から推測
    if (this.reviewData.totalReviews === 0) {
      this.extractRatingFromOverallScore();
    }
  }

  extractRatingFromOverallScore() {
    // 総合評価とレビュー数を取得
    const ratingText = document.querySelector('[jsaction*="pane.rating"]');
    const reviewCountText = document.querySelector('[aria-label*="reviews"]');

    if (ratingText && reviewCountText) {
      const ratingMatch = ratingText.textContent.match(/(\d+\.\d+)/);
      const countMatch = reviewCountText
        .getAttribute("aria-label")
        .match(/([\d,]+) reviews?/);

      if (ratingMatch && countMatch) {
        const avgRating = parseFloat(ratingMatch[1]);
        const totalCount = parseInt(countMatch[1].replace(/,/g, ""));

        // 平均評価から分布を推測（簡易版）
        this.estimateRatingDistribution(avgRating, totalCount);
      }
    }
  }

  estimateRatingDistribution(avgRating, totalCount) {
    // 平均評価に基づく分布の推測（実際のデータではより複雑）
    this.reviewData.totalReviews = totalCount;

    if (avgRating >= 4.5) {
      this.reviewData.ratings[5] = Math.round(totalCount * 0.7);
      this.reviewData.ratings[4] = Math.round(totalCount * 0.2);
      this.reviewData.ratings[3] = Math.round(totalCount * 0.05);
      this.reviewData.ratings[2] = Math.round(totalCount * 0.03);
      this.reviewData.ratings[1] = Math.round(totalCount * 0.02);
    } else if (avgRating >= 4.0) {
      this.reviewData.ratings[5] = Math.round(totalCount * 0.5);
      this.reviewData.ratings[4] = Math.round(totalCount * 0.3);
      this.reviewData.ratings[3] = Math.round(totalCount * 0.1);
      this.reviewData.ratings[2] = Math.round(totalCount * 0.05);
      this.reviewData.ratings[1] = Math.round(totalCount * 0.05);
    }
    // 他の評価範囲も同様に設定...
  }

  extractIndividualReviews() {
    const reviewElements = document.querySelectorAll("[data-review-id]");

    reviewElements.forEach((element) => {
      const review = this.parseReviewElement(element);
      if (review) {
        this.reviewData.recentReviews.push(review);
      }
    });
  }

  parseReviewElement(element) {
    try {
      // 評価（星の数）
      const ratingElement = element.querySelector('[aria-label*="stars"]');
      const rating = ratingElement
        ? parseInt(
            ratingElement.getAttribute("aria-label").match(/(\d+) stars?/)[1]
          )
        : null;

      // レビュー文章
      const textSelectors = ["[data-expandable-section]", ".MyEned", ".wiI7pd"];

      let text = "";
      for (const selector of textSelectors) {
        const textElement = element.querySelector(selector);
        if (textElement) {
          text = textElement.textContent.trim();
          break;
        }
      }

      // 投稿者名
      const authorSelectors = ['[aria-label*="Photo"]', ".d4r55"];

      let author = "";
      for (const selector of authorSelectors) {
        const authorElement = element.querySelector(selector);
        if (authorElement) {
          const ariaLabel = authorElement.getAttribute("aria-label");
          author = ariaLabel
            ? ariaLabel.replace("Photo of ", "")
            : authorElement.textContent.trim();
          break;
        }
      }

      // 投稿日時
      const dateSelectors = [".rsqaWe", ".DU9Pgb"];

      let dateText = "";
      for (const selector of dateSelectors) {
        const dateElement = element.querySelector(selector);
        if (dateElement) {
          dateText = dateElement.textContent.trim();
          break;
        }
      }

      // レビュー写真の有無
      const hasPhotos =
        element.querySelectorAll("[data-photo-index]").length > 0 ||
        element.querySelectorAll('img[src*="googleusercontent"]').length > 0;

      return {
        rating,
        text,
        author,
        dateText,
        hasPhotos,
        textLength: text.length,
        element,
      };
    } catch (error) {
      console.error("Failed to parse review:", error);
      return null;
    }
  }

  detectSuspiciousPatterns() {
    this.detectPolarizedRatings();
    this.detectBurstPosting();
    this.detectShortReviews();
    this.detectDuplicatePatterns();
    this.detectNewAccounts();
  }

  detectPolarizedRatings() {
    const { ratings, totalReviews } = this.reviewData;

    if (totalReviews < this.settings.minimumReviewsForAnalysis) return;

    const extremeRatings = ratings[1] + ratings[5];
    const middleRatings = ratings[2] + ratings[3] + ratings[4];

    const extremeRatio = extremeRatings / totalReviews;
    const middleRatio = middleRatings / totalReviews;

    // 分析モードに応じて閾値を調整
    let threshold = 0.7;
    if (this.settings.analysisMode === "strict") threshold = 0.6;
    if (this.settings.analysisMode === "lenient") threshold = 0.8;

    if (extremeRatio > threshold && middleRatio < 0.2) {
      this.suspicionFactors.polarizedRatings = Math.min(extremeRatio * 100, 90);
      this.reviewData.suspiciousPatterns.push({
        type: "polarized_ratings",
        description: `極端な評価が${(extremeRatio * 100).toFixed(
          1
        )}%を占めています`,
        severity: "high",
      });
    }
  }

  detectBurstPosting() {
    const recentReviews = this.reviewData.recentReviews.filter(
      (r) =>
        r.dateText.includes("日前") ||
        r.dateText.includes("週間前") ||
        r.dateText.includes("day ago") ||
        r.dateText.includes("week ago") ||
        r.dateText.includes("時間前") ||
        r.dateText.includes("hour ago")
    );

    if (recentReviews.length > 5) {
      const burstRatio =
        recentReviews.length /
        Math.max(
          this.reviewData.totalReviews,
          this.reviewData.recentReviews.length
        );
      if (burstRatio > 0.3) {
        this.suspicionFactors.burstPosting = burstRatio * 80;
        this.reviewData.suspiciousPatterns.push({
          type: "burst_posting",
          description: `最近${recentReviews.length}件の集中投稿があります`,
          severity: "medium",
        });
      }
    }
  }

  detectShortReviews() {
    if (this.reviewData.recentReviews.length === 0) return;

    const shortReviews = this.reviewData.recentReviews.filter(
      (r) => r.textLength < 10 && r.textLength > 0
    );

    const shortRatio =
      shortReviews.length / this.reviewData.recentReviews.length;
    if (shortRatio > 0.4) {
      this.suspicionFactors.shortReviews = shortRatio * 60;
      this.reviewData.suspiciousPatterns.push({
        type: "short_reviews",
        description: `極端に短いレビューが${(shortRatio * 100).toFixed(
          1
        )}%含まれています`,
        severity: "low",
      });
    }
  }

  detectDuplicatePatterns() {
    const reviewTexts = this.reviewData.recentReviews
      .map((r) => r.text)
      .filter((text) => text.length > 5);

    if (reviewTexts.length < 3) return;

    const similarities = this.findSimilarTexts(reviewTexts);
    if (similarities.length > 0) {
      this.suspicionFactors.duplicatePatterns = similarities.length * 15;
      this.reviewData.suspiciousPatterns.push({
        type: "duplicate_patterns",
        description: `${similarities.length}組の類似レビューが見つかりました`,
        severity: "high",
      });
    }
  }

  detectNewAccounts() {
    if (this.reviewData.recentReviews.length === 0) return;

    const suspiciousAuthors = this.reviewData.recentReviews.filter(
      (r) => !r.hasPhotos && r.textLength < 20 && r.textLength > 0
    );

    const suspiciousRatio =
      suspiciousAuthors.length / this.reviewData.recentReviews.length;
    if (suspiciousRatio > 0.3) {
      this.suspicionFactors.newAccounts = suspiciousRatio * 50;
      this.reviewData.suspiciousPatterns.push({
        type: "new_accounts",
        description: `新規アカウントからの投稿が${(
          suspiciousRatio * 100
        ).toFixed(1)}%含まれています`,
        severity: "medium",
      });
    }
  }

  findSimilarTexts(texts) {
    const similarities = [];

    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const similarity = this.calculateTextSimilarity(texts[i], texts[j]);
        if (similarity > 0.8) {
          similarities.push({ text1: texts[i], text2: texts[j], similarity });
        }
      }
    }

    return similarities;
  }

  calculateTextSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  calculateTrustScore() {
    const maxSuspicion = Object.values(this.suspicionFactors).reduce(
      (sum, value) => sum + value,
      0
    );

    this.trustScore = Math.max(10, 100 - maxSuspicion);
  }

  async saveAnalysisResult() {
    try {
      const analysisData = {
        url: window.location.href,
        placeName: this.placeName,
        trustScore: this.trustScore,
        totalReviews: this.reviewData.totalReviews,
        suspiciousPatterns: this.reviewData.suspiciousPatterns,
      };

      await this.sendMessageToBackground({
        type: "SAVE_ANALYSIS_RESULT",
        data: analysisData,
      });

      console.log("Analysis result saved successfully");
    } catch (error) {
      console.error("Failed to save analysis result:", error);
    }
  }

  displayTrustScore() {
    this.removeExistingScore();
    const scoreElement = this.createScoreElement();
    const insertTarget = this.findInsertLocation();

    if (insertTarget) {
      insertTarget.appendChild(scoreElement);
    }
  }

  displayInsufficientDataMessage() {
    this.removeExistingScore();
    const messageElement = this.createInsufficientDataElement();
    const insertTarget = this.findInsertLocation();

    if (insertTarget) {
      insertTarget.appendChild(messageElement);
    }
  }

  displayErrorMessage() {
    this.removeExistingScore();
    const errorElement = this.createErrorElement();
    const insertTarget = this.findInsertLocation();

    if (insertTarget) {
      insertTarget.appendChild(errorElement);
    }
  }

  findInsertLocation() {
    // 複数の挿入位置を試行
    const selectors = [
      '[data-value="Reviews"]',
      '.m6QErb.DxyBCb.kA9KIf.dS8AEf.ecceSd',
      '.TIHn2',
      '.m6QErb',
      '.DxyBCb',
      '[role="main"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.parentElement || element;
      }
    }

    return document.body;
  }

  removeExistingScore() {
    const existingScore = document.getElementById("review-trust-score");
    if (existingScore) existingScore.remove();
  }

  createScoreElement() {
    const container = document.createElement("div");
    container.id = "review-trust-score";
    container.style.cssText = `
      background: white;
      border: 2px solid #1976d2;
      border-radius: 8px;
      padding: 12px;
      margin: 8px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      font-family: Roboto, Arial, sans-serif;
      position: relative;
      z-index: 1000;
      max-width: 400px;
    `;

    const scoreColor = this.getScoreColor(this.trustScore);
    const scoreText = this.getScoreText(this.trustScore);

    container.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <div style="
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: ${scoreColor};
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          margin-right: 12px;
        ">${Math.round(this.trustScore)}</div>
        <div>
          <div style="font-weight: 500; color: #333; font-size: 14px;">レビュー信頼度スコア</div>
          <div style="font-size: 12px; color: #666;">${scoreText}</div>
        </div>
      </div>
      ${this.createAnalysisDetails()}
      <div style="font-size: 11px; color: #999; margin-top: 8px;">
        ※ 分析結果は参考値です。最終的な判断はご自身でお願いします。
      </div>
    `;

    return container;
  }

  createAnalysisDetails() {
    if (!this.settings.showDetailedAnalysis) {
      return "";
    }

    if (this.reviewData.suspiciousPatterns.length === 0) {
      return '<div style="font-size: 12px; color: #4caf50; margin-top: 8px;">✓ 特に問題のあるパターンは検出されませんでした</div>';
    }

    const patterns = this.reviewData.suspiciousPatterns
      .map((pattern) => {
        const icon =
          pattern.severity === "high"
            ? "⚠️"
            : pattern.severity === "medium"
            ? "⚡"
            : "ℹ️";
        return `<div style="font-size: 12px; margin: 4px 0; color: #666;">${icon} ${pattern.description}</div>`;
      })
      .join("");

    return `
      <div style="margin-top: 8px; padding: 8px; background: #f5f5f5; border-radius: 4px;">
        <div style="font-size: 12px; font-weight: 500; color: #333; margin-bottom: 4px;">
          検出された注意点 (${this.reviewData.suspiciousPatterns.length}件)
        </div>
        ${patterns}
      </div>
    `;
  }

  createInsufficientDataElement() {
    const container = document.createElement("div");
    container.id = "review-trust-score";
    container.style.cssText = `
      background: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 8px;
      padding: 12px;
      margin: 8px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      font-family: Roboto, Arial, sans-serif;
      position: relative;
      z-index: 1000;
      max-width: 400px;
    `;

    container.innerHTML = `
      <div style="display: flex; align-items: center;">
        <div style="font-size: 20px; margin-right: 8px;">ℹ️</div>
        <div>
          <div style="font-weight: 500; color: #856404; font-size: 14px;">データ不足</div>
          <div style="font-size: 12px; color: #856404;">
            レビュー数が少ないため、信頼性分析を実行できません。
          </div>
        </div>
      </div>
    `;

    return container;
  }

  createErrorElement() {
    const container = document.createElement("div");
    container.id = "review-trust-score";
    container.style.cssText = `
      background: #ffebee;
      border: 2px solid #f44336;
      border-radius: 8px;
      padding: 12px;
      margin: 8px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      font-family: Roboto, Arial, sans-serif;
      position: relative;
      z-index: 1000;
      max-width: 400px;
    `;

    container.innerHTML = `
      <div style="display: flex; align-items: center;">
        <div style="font-size: 20px; margin-right: 8px;">❌</div>
        <div>
          <div style="font-weight: 500; color: #c62828; font-size: 14px;">分析エラー</div>
          <div style="font-size: 12px; color: #c62828;">
            レビューの分析中にエラーが発生しました。
          </div>
        </div>
      </div>
    `;

    return container;
  }

  getScoreColor(score) {
    if (score >= 80) return "#4caf50";
    if (score >= 60) return "#ff9800";
    if (score >= 40) return "#f44336";
    return "#9c27b0";
  }

  getScoreText(score) {
    if (score >= 80) return "信頼度が高いです";
    if (score >= 60) return "概ね信頼できます";
    if (score >= 40) return "注意が必要です";
    return "疑わしい要素があります";
  }

  /**
   * クリーンアップ処理
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    if (this.reanalysisTimeout) {
      clearTimeout(this.reanalysisTimeout);
    }
    
    this.removeExistingScore();
  }
}

// インスタンス生成とグローバル参照の保持
let mapsReviewAnalyzer;

// ページ読み込み完了時に初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    mapsReviewAnalyzer = new MapsReviewAnalyzer();
  });
} else {
  mapsReviewAnalyzer = new MapsReviewAnalyzer();
}

// ページ離脱時のクリーンアップ
window.addEventListener('beforeunload', () => {
  if (mapsReviewAnalyzer) {
    mapsReviewAnalyzer.destroy();
  }
});
