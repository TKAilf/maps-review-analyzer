// src/popup/controllers/settings-controller.js
class SettingsController {
    constructor() {
        this.constants = window.MRA_CONSTANTS;
        this.config = window.MRA_CONFIG;
    }

    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: this.constants.MESSAGE_TYPES.GET_SETTINGS,
            });

            if (response && response.success) {
                this.updateUI(response.data);
                return response.data;
            }
        } catch (error) {
            console.error("Failed to load settings:", error);
        }

        // フォールバック
        const defaultSettings = this.config.DEFAULT_SETTINGS;
        this.updateUI(defaultSettings);
        return defaultSettings;
    }

    updateUI(settings) {
        const analysisMode = document.getElementById("analysisMode");
        const showDetailedAnalysis = document.getElementById(
            "showDetailedAnalysis"
        );
        const minimumReviews = document.getElementById("minimumReviews");
        const suspicionThreshold =
            document.getElementById("suspicionThreshold");

        if (analysisMode)
            analysisMode.value = settings.settings?.analysisMode || "standard";
        if (showDetailedAnalysis)
            showDetailedAnalysis.checked =
                settings.settings?.showDetailedAnalysis || false;
        if (minimumReviews)
            minimumReviews.value =
                settings.settings?.minimumReviewsForAnalysis || 5;
        if (suspicionThreshold)
            suspicionThreshold.value =
                settings.settings?.suspicionThreshold || 40;
    }

    async saveSettings() {
        const settings = this.collectSettings();

        try {
            const response = await chrome.runtime.sendMessage({
                type: this.constants.MESSAGE_TYPES.SET_STORAGE_DATA,
                data: settings,
            });

            if (response && response.success) {
                this.showMessage("success", "設定を保存しました");
                return true;
            }
        } catch (error) {
            console.error("Failed to save settings:", error);
            this.showMessage("error", "設定の保存に失敗しました");
        }

        return false;
    }

    collectSettings() {
        return {
            settings: {
                analysisMode:
                    document.getElementById("analysisMode")?.value ||
                    "standard",
                showDetailedAnalysis:
                    document.getElementById("showDetailedAnalysis")?.checked ||
                    false,
                minimumReviewsForAnalysis:
                    parseInt(
                        document.getElementById("minimumReviews")?.value
                    ) || 5,
                suspicionThreshold:
                    parseInt(
                        document.getElementById("suspicionThreshold")?.value
                    ) || 40,
            },
        };
    }

    async toggleExtension() {
        const currentSettings = await this.loadSettings();
        const newEnabled = !currentSettings.isEnabled;

        try {
            const response = await chrome.runtime.sendMessage({
                type: this.constants.MESSAGE_TYPES.SET_STORAGE_DATA,
                data: { isEnabled: newEnabled },
            });

            if (response && response.success) {
                this.updateToggleButton(newEnabled);
                this.showMessage(
                    "success",
                    newEnabled
                        ? "拡張機能を有効にしました"
                        : "拡張機能を無効にしました"
                );
            }
        } catch (error) {
            console.error("Failed to toggle extension:", error);
            this.showMessage("error", "切り替えに失敗しました");
        }
    }

    updateToggleButton(isEnabled) {
        const toggleBtn = document.getElementById("toggleBtn");
        const statusIndicator = document.getElementById("statusIndicator");
        const statusText = document.getElementById("statusText");

        if (toggleBtn) toggleBtn.textContent = isEnabled ? "無効化" : "有効化";
        if (statusIndicator)
            statusIndicator.className = `status-indicator ${
                isEnabled ? "enabled" : "disabled"
            }`;
        if (statusText) statusText.textContent = isEnabled ? "有効" : "無効";
    }

    showMessage(type, message) {
        const element = document.getElementById(
            type === "error" ? "errorMessage" : "successMessage"
        );
        if (element) {
            element.textContent = message;
            element.style.display = "block";
            setTimeout(() => {
                element.style.display = "none";
            }, 3000);
        }
    }

    onSettingChange(settingId, value) {
        // リアルタイム設定変更の処理
        console.log(`Setting ${settingId} changed to:`, value);
    }
}

window.SettingsController = SettingsController;

// src/popup/controllers/history-controller.js
class HistoryController {
    constructor() {
        this.constants = window.MRA_CONSTANTS;
    }

    async loadHistory() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: this.constants.MESSAGE_TYPES.GET_ANALYSIS_HISTORY,
                limit: 5,
            });

            if (response && response.success) {
                this.displayHistory(response.data);
                return response.data;
            }
        } catch (error) {
            console.error("Failed to load history:", error);
        }

        this.displayHistory([]);
        return [];
    }

    displayHistory(history) {
        const historyList = document.getElementById("historyList");
        if (!historyList) return;

        if (!history || history.length === 0) {
            historyList.className = "empty-history";
            historyList.textContent = "履歴はまだありません";
            return;
        }

        historyList.className = "";
        historyList.innerHTML = "";

        history.forEach((item) => {
            const historyItem = this.createHistoryItem(item);
            historyList.appendChild(historyItem);
        });
    }

    createHistoryItem(item) {
        const div = document.createElement("div");
        div.className = "history-item";

        const scoreColor = this.getScoreColor(item.trustScore);
        const date = new Date(item.timestamp).toLocaleDateString("ja-JP");

        div.innerHTML = `
            <div class="place-name">${this.escapeHtml(item.placeName)}</div>
            <div class="score">
                <span class="score-value" style="background-color: ${scoreColor}">
                    ${item.trustScore}
                </span>
                <span class="date">${date}</span>
            </div>
        `;

        return div;
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
}

window.HistoryController = HistoryController;

// src/popup/controllers/ui-controller.js
class UIController {
    constructor() {
        this.loadingElement = document.getElementById("loading");
        this.errorElement = document.getElementById("errorMessage");
        this.successElement = document.getElementById("successMessage");
    }

    showLoading(show = true) {
        if (this.loadingElement) {
            this.loadingElement.style.display = show ? "block" : "none";
        }
    }

    showError(message) {
        if (this.errorElement) {
            this.errorElement.textContent = message;
            this.errorElement.style.display = "block";
            setTimeout(() => {
                this.errorElement.style.display = "none";
            }, 5000);
        }
    }

    showSuccess(message) {
        if (this.successElement) {
            this.successElement.textContent = message;
            this.successElement.style.display = "block";
            setTimeout(() => {
                this.successElement.style.display = "none";
            }, 3000);
        }
    }

    updateDisplay() {
        // UI全体の更新処理
        console.log("UI display updated");
    }
}

window.UIController = UIController;

// src/popup/components/status-display.js
class StatusDisplay {
    constructor(indicatorElement, textElement) {
        this.indicator = indicatorElement;
        this.text = textElement;
    }

    update(isEnabled) {
        if (this.indicator) {
            this.indicator.className = `status-indicator ${
                isEnabled ? "enabled" : "disabled"
            }`;
        }
        if (this.text) {
            this.text.textContent = isEnabled ? "有効" : "無効";
        }
    }
}

window.StatusDisplay = StatusDisplay;

// src/popup/components/settings-panel.js
class SettingsPanel {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 設定変更イベントの処理
        const inputs = document.querySelectorAll(
            "#analysisMode, #showDetailedAnalysis, #minimumReviews, #suspicionThreshold"
        );
        inputs.forEach((input) => {
            input.addEventListener("change", this.onInputChange.bind(this));
        });
    }

    onInputChange(event) {
        const { id, value, checked, type } = event.target;
        const finalValue = type === "checkbox" ? checked : value;
        console.log(`Setting ${id} changed to:`, finalValue);
    }
}

window.SettingsPanel = SettingsPanel;

// src/popup/components/history-list.js
class HistoryList {
    constructor(containerElement) {
        this.container = containerElement;
    }

    render(historyData) {
        if (!this.container) return;

        if (!historyData || historyData.length === 0) {
            this.container.className = "empty-history";
            this.container.textContent = "履歴はまだありません";
            return;
        }

        this.container.className = "";
        this.container.innerHTML = "";

        historyData.forEach((item) => {
            const element = this.createHistoryElement(item);
            this.container.appendChild(element);
        });
    }

    createHistoryElement(item) {
        const div = document.createElement("div");
        div.className = "history-item";

        const scoreColor = this.getScoreColor(item.trustScore);
        const date = new Date(item.timestamp).toLocaleDateString("ja-JP");

        div.innerHTML = `
            <div class="place-name">${this.escapeHtml(item.placeName)}</div>
            <div class="score">
                <span class="score-value" style="background-color: ${scoreColor}">
                    ${item.trustScore}
                </span>
                <span class="date">${date}</span>
            </div>
        `;

        return div;
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
}

window.HistoryList = HistoryList;
