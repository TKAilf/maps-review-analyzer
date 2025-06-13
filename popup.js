// popup.js - ポップアップのJavaScript

class PopupController {
    constructor() {
        this.currentSettings = {};
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        await this.loadAnalysisHistory();
    }

    setupEventListeners() {
        // ボタンイベント
        document
            .getElementById("toggleBtn")
            .addEventListener("click", () => this.toggleExtension());
        document
            .getElementById("saveBtn")
            .addEventListener("click", () => this.saveSettings());
        document
            .getElementById("analyzeBtn")
            .addEventListener("click", () => this.requestManualAnalysis());

        // 設定変更イベント
        document
            .getElementById("analysisMode")
            .addEventListener("change", () => this.onSettingChange());
        document
            .getElementById("showDetailedAnalysis")
            .addEventListener("change", () => this.onSettingChange());
        document
            .getElementById("minimumReviews")
            .addEventListener("input", () => this.onSettingChange());
        document
            .getElementById("suspicionThreshold")
            .addEventListener("input", () => this.onSettingChange());
    }

    async loadSettings() {
        try {
            this.showLoading(true);

            const response = await this.sendMessage({ type: "GET_SETTINGS" });

            if (response.success) {
                this.currentSettings = response.data;
                this.updateUI();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.showError("設定の読み込みに失敗しました: " + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    updateUI() {
        const isEnabled = this.currentSettings.isEnabled ?? true;
        const settings = this.currentSettings.settings || {};

        // ステータス表示
        const statusIndicator = document.getElementById("statusIndicator");
        const statusText = document.getElementById("statusText");
        const toggleBtn = document.getElementById("toggleBtn");

        statusIndicator.className = `status-indicator ${
            isEnabled ? "enabled" : "disabled"
        }`;
        statusText.textContent = isEnabled ? "有効" : "無効";
        toggleBtn.textContent = isEnabled ? "無効にする" : "有効にする";
        toggleBtn.disabled = false;

        // 設定値の反映
        document.getElementById("analysisMode").value =
            settings.analysisMode || "standard";
        document.getElementById("showDetailedAnalysis").checked =
            settings.showDetailedAnalysis ?? true;
        document.getElementById("minimumReviews").value =
            settings.minimumReviewsForAnalysis || 5;
        document.getElementById("suspicionThreshold").value =
            settings.suspicionThreshold || 40;
    }

    async toggleExtension() {
        try {
            this.showLoading(true);
            const toggleBtn = document.getElementById("toggleBtn");
            toggleBtn.disabled = true;

            const newStatus = !this.currentSettings.isEnabled;

            const response = await this.sendMessage({
                type: "SET_STORAGE_DATA",
                data: { isEnabled: newStatus },
            });

            if (response.success) {
                this.currentSettings.isEnabled = newStatus;
                this.updateUI();
                this.showSuccess(
                    newStatus
                        ? "拡張機能を有効にしました"
                        : "拡張機能を無効にしました"
                );
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.showError("切り替えに失敗しました: " + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async saveSettings() {
        try {
            this.showLoading(true);
            this.hideMessages();

            const newSettings = {
                ...this.currentSettings,
                settings: {
                    analysisMode: document.getElementById("analysisMode").value,
                    showDetailedAnalysis: document.getElementById(
                        "showDetailedAnalysis"
                    ).checked,
                    minimumReviewsForAnalysis: parseInt(
                        document.getElementById("minimumReviews").value,
                        10
                    ),
                    suspicionThreshold: parseInt(
                        document.getElementById("suspicionThreshold").value,
                        10
                    ),
                },
            };

            const response = await this.sendMessage({
                type: "SET_STORAGE_DATA",
                data: newSettings,
            });

            if (response.success) {
                this.currentSettings = newSettings;
                this.showSuccess("設定を保存しました");
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.showError("設定の保存に失敗しました: " + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async requestManualAnalysis() {
        try {
            this.showLoading(true);

            // アクティブタブを取得
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });

            if (!tab || !tab.url || !tab.url.includes("google.com/maps")) {
                throw new Error("Google Mapsページで実行してください");
            }

            // Content scriptに手動分析を要求
            await chrome.tabs.sendMessage(tab.id, {
                type: "MANUAL_ANALYSIS_REQUEST",
            });

            this.showSuccess("分析を開始しました");

            // 少し待ってから履歴を更新
            setTimeout(() => {
                this.loadAnalysisHistory();
            }, 2000);
        } catch (error) {
            this.showError("分析の実行に失敗しました: " + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async loadAnalysisHistory() {
        try {
            const response = await this.sendMessage({
                type: "GET_ANALYSIS_HISTORY",
            });

            if (response.success) {
                this.displayAnalysisHistory(response.data);
            }
        } catch (error) {
            console.error("Failed to load analysis history:", error);
        }
    }

    displayAnalysisHistory(history) {
        const historyList = document.getElementById("historyList");

        if (!history || history.length === 0) {
            historyList.innerHTML =
                '<div class="empty-history">履歴はまだありません</div>';
            return;
        }

        const historyHTML = history
            .slice(0, 5)
            .map((item) => {
                const date = new Date(item.timestamp).toLocaleString("ja-JP", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                });

                const scoreColor = this.getScoreColor(item.trustScore);

                return `
        <div class="history-item">
          <div class="place-name">${this.escapeHtml(item.placeName)}</div>
          <div class="score">
            <span class="date">${date}</span>
            <span class="score-value" style="background: ${scoreColor}">
              ${Math.round(item.trustScore)}
            </span>
          </div>
        </div>
      `;
            })
            .join("");

        historyList.innerHTML = historyHTML;
    }

    getScoreColor(score) {
        if (score >= 80) return "#4caf50";
        if (score >= 60) return "#ff9800";
        if (score >= 40) return "#f44336";
        return "#9c27b0";
    }

    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    onSettingChange() {
        // 設定が変更されたことを視覚的に示す
        const saveBtn = document.getElementById("saveBtn");
        saveBtn.style.background = "#FF9800";
        saveBtn.textContent = "保存 (未保存)";

        setTimeout(() => {
            saveBtn.style.background = "#2196F3";
            saveBtn.textContent = "設定保存";
        }, 3000);
    }

    sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    }

    showLoading(show) {
        document.getElementById("loading").style.display = show
            ? "block"
            : "none";
    }

    showError(message) {
        const errorElement = document.getElementById("errorMessage");
        errorElement.textContent = message;
        errorElement.style.display = "block";

        // 5秒後に自動で隠す
        setTimeout(() => {
            errorElement.style.display = "none";
        }, 5000);
    }

    showSuccess(message) {
        const successElement = document.getElementById("successMessage");
        successElement.textContent = message;
        successElement.style.display = "block";

        // 3秒後に自動で隠す
        setTimeout(() => {
            successElement.style.display = "none";
        }, 3000);
    }

    hideMessages() {
        document.getElementById("errorMessage").style.display = "none";
        document.getElementById("successMessage").style.display = "none";
    }
}

// ポップアップ初期化
document.addEventListener("DOMContentLoaded", () => {
    new PopupController();
});

// キーボードショートカット
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        window.close();
    } else if (event.ctrlKey && event.key === "s") {
        event.preventDefault();
        document.getElementById("saveBtn").click();
    }
});
