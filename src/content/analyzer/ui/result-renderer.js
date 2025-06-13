// src/content/ui/result-renderer.js

/**
 * 分析結果をレンダリングするクラス
 */
class ResultRenderer {
    constructor() {
        this.constants = window.MRA_CONSTANTS;
        this.config = window.MRA_CONFIG;
        this.currentElement = null;
    }

    /**
     * 信頼度スコアを表示
     * @param {Object} analysisResult - 分析結果
     * @param {Object} settings - 設定
     * @param {string} placeName - 店舗名
     */
    displayTrustScore(analysisResult, settings, placeName) {
        this.removeExisting();
        const element = this.createScoreElement(
            analysisResult,
            settings,
            placeName
        );
        const insertTarget = this.findInsertLocation();

        if (insertTarget) {
            insertTarget.appendChild(element);
            this.currentElement = element;

            // アニメーション開始
            requestAnimationFrame(() => {
                element.style.opacity = "1";
                element.style.transform = "translateY(0)";
            });
        }
    }

    /**
     * データ不足メッセージを表示
     * @param {string} placeName - 店舗名
     * @param {number} reviewCount - レビュー数
     */
    displayInsufficientData(placeName, reviewCount = 0) {
        this.removeExisting();
        const element = this.createInsufficientDataElement(
            placeName,
            reviewCount
        );
        const insertTarget = this.findInsertLocation();

        if (insertTarget) {
            insertTarget.appendChild(element);
            this.currentElement = element;
        }
    }

    /**
     * エラーメッセージを表示
     * @param {string} errorMessage - エラーメッセージ
     * @param {string} placeName - 店舗名
     */
    displayError(errorMessage, placeName) {
        this.removeExisting();
        const element = this.createErrorElement(errorMessage, placeName);
        const insertTarget = this.findInsertLocation();

        if (insertTarget) {
            insertTarget.appendChild(element);
            this.currentElement = element;
        }
    }

    /**
     * スコア表示要素を作成
     * @param {Object} analysisResult - 分析結果
     * @param {Object} settings - 設定
     * @param {string} placeName - 店舗名
     * @returns {HTMLElement} - 作成された要素
     */
    createScoreElement(analysisResult, settings, placeName) {
        const container = document.createElement("div");
        container.id = this.constants.UI_CONSTANTS.ELEMENT_IDS.TRUST_SCORE;
        container.setAttribute("role", "alert");
        container.setAttribute("aria-live", "polite");

        const { score, level, details } = analysisResult;
        const scoreColor = this.getScoreColor(score);
        const scoreText = this.getScoreText(score);

        container.innerHTML = `
      <div class="score-display">
        <div class="score-circle trust-level-${level}" style="background: ${scoreColor}">
          ${score}
        </div>
        <div class="score-info">
          <div class="score-title">レビュー信頼度スコア</div>
          <div class="score-description">${scoreText}</div>
        </div>
      </div>
      ${this.createAnalysisDetails(details, settings)}
      <div class="disclaimer">
        ※ 分析結果は参考値です。最終的な判断はご自身でお願いします。
      </div>
      <span class="sr-only">
        ${placeName}の信頼度スコア: ${score}点（${scoreText}）
      </span>
    `;

        // 展開・折りたたみ機能
        if (settings.showDetailedAnalysis && details.patternsDetected > 0) {
            this.addExpandableFeature(container);
        }

        return container;
    }

    /**
     * 詳細分析結果を作成
     * @param {Object} details - 詳細情報
     * @param {Object} settings - 設定
     * @returns {string} - HTML文字列
     */
    createAnalysisDetails(details, settings) {
        if (!settings.showDetailedAnalysis) {
            return "";
        }

        if (details.patternsDetected === 0) {
            return '<div class="positive-message">特に問題のあるパターンは検出されませんでした</div>';
        }

        const patterns = details.mainConcerns
            .map((concern) => {
                const icon = this.getSeverityIcon(concern.severity || "medium");
                return `
        <div class="pattern-item">
          <span class="pattern-icon">${icon}</span>
          <span class="pattern-description">${this.escapeHtml(
              concern.description
          )}</span>
        </div>
      `;
            })
            .join("");

        return `
      <div class="analysis-details">
        <div class="analysis-title">
          検出された注意点 (${details.patternsDetected}件)
          <span class="expand-icon">▼</span>
        </div>
        ${patterns}
        ${this.createRecommendations(details.recommendations)}
      </div>
    `;
    }

    /**
     * 推奨事項を作成
     * @param {Array} recommendations - 推奨事項
     * @returns {string} - HTML文字列
     */
    createRecommendations(recommendations) {
        if (!recommendations || recommendations.length === 0) {
            return "";
        }

        const items = recommendations
            .map(
                (rec) => `
      <div class="pattern-item">
        <span class="pattern-icon">💡</span>
        <span class="pattern-description">${this.escapeHtml(rec.text)}</span>
      </div>
    `
            )
            .join("");

        return `
      <div class="divider"></div>
      <div class="analysis-title">推奨事項</div>
      ${items}
    `;
    }

    /**
     * データ不足要素を作成
     * @param {string} placeName - 店舗名
     * @param {number} reviewCount - レビュー数
     * @returns {HTMLElement} - 作成された要素
     */
    createInsufficientDataElement(placeName, reviewCount) {
        const container = document.createElement("div");
        container.id = this.constants.UI_CONSTANTS.ELEMENT_IDS.TRUST_SCORE;
        container.className = "insufficient-data";
        container.setAttribute("role", "alert");

        container.innerHTML = `
      <div class="message-display">
        <div class="message-icon">ℹ️</div>
        <div class="message-content">
          <div class="message-title">データ不足</div>
          <div class="message-text">
            レビュー数が少ないため（${reviewCount}件）、信頼性分析を実行できません。
          </div>
        </div>
      </div>
      <span class="sr-only">
        ${placeName}: データ不足により分析できません
      </span>
    `;

        return container;
    }

    /**
     * エラー要素を作成
     * @param {string} errorMessage - エラーメッセージ
     * @param {string} placeName - 店舗名
     * @returns {HTMLElement} - 作成された要素
     */
    createErrorElement(errorMessage, placeName) {
        const container = document.createElement("div");
        container.id = this.constants.UI_CONSTANTS.ELEMENT_IDS.TRUST_SCORE;
        container.className = "error";
        container.setAttribute("role", "alert");

        container.innerHTML = `
      <div class="message-display">
        <div class="message-icon">❌</div>
        <div class="message-content">
          <div class="message-title">分析エラー</div>
          <div class="message-text">
            ${this.escapeHtml(errorMessage)}
          </div>
        </div>
      </div>
      <span class="sr-only">
        ${placeName}: 分析エラーが発生しました
      </span>
    `;

        return container;
    }

    /**
     * 展開・折りたたみ機能を追加
     * @param {HTMLElement} container - コンテナ要素
     */
    addExpandableFeature(container) {
        const analysisDetails = container.querySelector(".analysis-details");
        const title = container.querySelector(".analysis-title");

        if (!analysisDetails || !title) return;

        title.className += " expandable";
        title.setAttribute("tabindex", "0");
        title.setAttribute("role", "button");
        title.setAttribute("aria-expanded", "true");
        title.setAttribute("aria-controls", "analysis-details-content");

        const handleToggle = () => {
            const isCollapsed = analysisDetails.style.display === "none";
            analysisDetails.style.display = isCollapsed ? "block" : "none";
            title.setAttribute("aria-expanded", isCollapsed ? "true" : "false");
            title.classList.toggle("collapsed", !isCollapsed);
        };

        title.addEventListener("click", handleToggle);
        title.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleToggle();
            }
        });
    }

    /**
     * 挿入位置を見つける
     * @returns {HTMLElement|null} - 挿入位置
     */
    findInsertLocation() {
        const selectors = this.constants.SELECTORS.INSERT_LOCATIONS;

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element.parentElement || element;
            }
        }

        // フォールバック: レビューセクション付近に挿入
        const reviewSection = document.querySelector('[data-value="Reviews"]');
        if (reviewSection) {
            return (
                reviewSection.closest('[role="main"]') ||
                reviewSection.parentElement
            );
        }

        // 最終フォールバック
        return document.querySelector('[role="main"]') || document.body;
    }

    /**
     * 既存の表示を削除
     */
    removeExisting() {
        const existing = document.getElementById(
            this.constants.UI_CONSTANTS.ELEMENT_IDS.TRUST_SCORE
        );
        if (existing) {
            existing.remove();
        }
        this.currentElement = null;
    }

    /**
     * スコアに対応する色を取得
     * @param {number} score - スコア
     * @returns {string} - 色コード
     */
    getScoreColor(score) {
        const colors = this.constants.UI_CONSTANTS.COLORS;
        const thresholds = this.constants.TRUST_SCORE_THRESHOLDS;

        if (score >= thresholds.HIGH) return colors.HIGH_TRUST;
        if (score >= thresholds.MEDIUM) return colors.MEDIUM_TRUST;
        if (score >= thresholds.LOW) return colors.LOW_TRUST;
        return colors.VERY_LOW_TRUST;
    }

    /**
     * スコアに対応するテキストを取得
     * @param {number} score - スコア
     * @returns {string} - 説明テキスト
     */
    getScoreText(score) {
        const thresholds = this.constants.TRUST_SCORE_THRESHOLDS;

        if (score >= thresholds.HIGH) return "信頼度が高いです";
        if (score >= thresholds.MEDIUM) return "概ね信頼できます";
        if (score >= thresholds.LOW) return "注意が必要です";
        return "疑わしい要素があります";
    }

    /**
     * 重要度に対応するアイコンを取得
     * @param {string} severity - 重要度
     * @returns {string} - アイコン
     */
    getSeverityIcon(severity) {
        const icons = {
            [this.constants.SEVERITY_LEVELS.HIGH]: "⚠️",
            [this.constants.SEVERITY_LEVELS.MEDIUM]: "⚡",
            [this.constants.SEVERITY_LEVELS.LOW]: "ℹ️",
        };
        return icons[severity] || "ℹ️";
    }

    /**
     * HTMLエスケープ
     * @param {string} text - エスケープするテキスト
     * @returns {string} - エスケープされたテキスト
     */
    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text || "";
        return div.innerHTML;
    }

    /**
     * 現在の表示要素を取得
     * @returns {HTMLElement|null} - 現在の要素
     */
    getCurrentElement() {
        return this.currentElement;
    }

    /**
     * 表示状態をチェック
     * @returns {boolean} - 表示中かどうか
     */
    isDisplayed() {
        return this.currentElement && document.contains(this.currentElement);
    }

    /**
     * アニメーション付きで非表示
     * @returns {Promise<void>} - アニメーション完了のPromise
     */
    hideWithAnimation() {
        return new Promise((resolve) => {
            if (!this.currentElement) {
                resolve();
                return;
            }

            this.currentElement.style.transition =
                "opacity 0.3s ease, transform 0.3s ease";
            this.currentElement.style.opacity = "0";
            this.currentElement.style.transform = "translateY(-10px)";

            setTimeout(() => {
                this.removeExisting();
                resolve();
            }, 300);
        });
    }
}

// グローバルスコープに公開
if (typeof window !== "undefined") {
    window.ResultRenderer = ResultRenderer;
}
