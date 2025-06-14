// src/content/utils/text-utils.js

/**
 * テキスト処理関連のユーティリティ関数
 */
class TextUtils {
    /**
     * テキストを正規化する
     * @param {string} text - 正規化するテキスト
     * @returns {string} 正規化されたテキスト
     */
    static normalizeText(text) {
        if (!text || typeof text !== "string") {
            return "";
        }

        return text
            .trim()
            .replace(/\s+/g, " ") // 連続する空白を単一の空白に
            .replace(/[\r\n]+/g, " ") // 改行を空白に
            .normalize("NFKC"); // Unicode正規化
    }

    /**
     * HTMLタグを除去する
     * @param {string} html - HTMLテキスト
     * @returns {string} プレーンテキスト
     */
    static stripHtml(html) {
        if (!html || typeof html !== "string") {
            return "";
        }

        const div = document.createElement("div");
        div.innerHTML = html;
        return div.textContent || div.innerText || "";
    }

    /**
     * テキストの類似度を計算（Jaccard係数）
     * @param {string} text1 - テキスト1
     * @param {string} text2 - テキスト2
     * @returns {number} 類似度 (0-1)
     */
    static calculateSimilarity(text1, text2) {
        if (!text1 || !text2) return 0;

        const words1 = new Set(this.tokenize(text1.toLowerCase()));
        const words2 = new Set(this.tokenize(text2.toLowerCase()));

        const intersection = new Set(
            [...words1].filter((word) => words2.has(word))
        );
        const union = new Set([...words1, ...words2]);

        return union.size > 0 ? intersection.size / union.size : 0;
    }

    /**
     * テキストをトークン化する
     * @param {string} text - トークン化するテキスト
     * @returns {Array<string>} トークン配列
     */
    static tokenize(text) {
        if (!text || typeof text !== "string") {
            return [];
        }

        // 日本語と英語の両方に対応した分割
        return text
            .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, " ")
            .split(/\s+/)
            .filter((token) => token.length > 0);
    }

    /**
     * 文字数をカウント（絵文字対応）
     * @param {string} text - カウントするテキスト
     * @returns {number} 文字数
     */
    static countCharacters(text) {
        if (!text || typeof text !== "string") {
            return 0;
        }

        // Unicode surrogate pairを考慮
        return [...text].length;
    }

    /**
     * テキストが短すぎるかチェック
     * @param {string} text - チェックするテキスト
     * @param {number} minLength - 最小文字数
     * @returns {boolean} 短すぎるかどうか
     */
    static isTooShort(text, minLength = 10) {
        const normalized = this.normalizeText(text);
        return this.countCharacters(normalized) < minLength;
    }

    /**
     * 疑わしいキーワードを検出
     * @param {string} text - チェックするテキスト
     * @returns {Array<string>} 検出されたキーワード
     */
    static detectSuspiciousKeywords(text) {
        if (!text || typeof text !== "string") {
            return [];
        }

        const suspiciousPatterns = [
            // 日本語の疑わしいパターン
            /絶対[におすすめ]/,
            /間違いな[くし]/,
            /[★☆]{3,}/,
            /[！!]{2,}/,
            /最高[です！!]/,
            /完璧[です！!]/,
            /神[です！!]/,
            /やばい[です！!]/,

            // 英語の疑わしいパターン
            /amazing[!\s]*$/i,
            /perfect[!\s]*$/i,
            /awesome[!\s]*$/i,
            /incredible[!\s]*$/i,
            /fantastic[!\s]*$/i,
        ];

        const detectedKeywords = [];
        const normalizedText = text.toLowerCase();

        suspiciousPatterns.forEach((pattern) => {
            const matches = normalizedText.match(pattern);
            if (matches) {
                detectedKeywords.push(...matches);
            }
        });

        return detectedKeywords;
    }

    /**
     * 日付テキストを解析
     * @param {string} dateText - 日付テキスト
     * @returns {Object} 解析された日付情報
     */
    static parseDateText(dateText) {
        if (!dateText || typeof dateText !== "string") {
            return { isRecent: false, daysAgo: null, type: "unknown" };
        }

        const text = dateText.toLowerCase().trim();

        // 日本語パターン
        const jaPatterns = [
            { pattern: /(\d+)分前/, multiplier: 1 / 1440, type: "minutes" },
            { pattern: /(\d+)時間前/, multiplier: 1 / 24, type: "hours" },
            { pattern: /(\d+)日前/, multiplier: 1, type: "days" },
            { pattern: /(\d+)週間前/, multiplier: 7, type: "weeks" },
            { pattern: /(\d+)か?月前/, multiplier: 30, type: "months" },
            { pattern: /(\d+)年前/, multiplier: 365, type: "years" },
        ];

        // 英語パターン
        const enPatterns = [
            {
                pattern: /(\d+)\s*minutes?\s*ago/,
                multiplier: 1 / 1440,
                type: "minutes",
            },
            {
                pattern: /(\d+)\s*hours?\s*ago/,
                multiplier: 1 / 24,
                type: "hours",
            },
            { pattern: /(\d+)\s*days?\s*ago/, multiplier: 1, type: "days" },
            { pattern: /(\d+)\s*weeks?\s*ago/, multiplier: 7, type: "weeks" },
            {
                pattern: /(\d+)\s*months?\s*ago/,
                multiplier: 30,
                type: "months",
            },
            { pattern: /(\d+)\s*years?\s*ago/, multiplier: 365, type: "years" },
        ];

        const allPatterns = [...jaPatterns, ...enPatterns];

        for (const { pattern, multiplier, type } of allPatterns) {
            const match = text.match(pattern);
            if (match) {
                const number = parseInt(match[1]);
                const daysAgo = number * multiplier;
                return {
                    isRecent: daysAgo <= 30, // 30日以内を最近とする
                    daysAgo: daysAgo,
                    type: type,
                    originalText: dateText,
                };
            }
        }

        return {
            isRecent: false,
            daysAgo: null,
            type: "unknown",
            originalText: dateText,
        };
    }

    /**
     * テキストの感情を簡易分析
     * @param {string} text - 分析するテキスト
     * @returns {Object} 感情分析結果
     */
    static analyzeSentiment(text) {
        if (!text || typeof text !== "string") {
            return { score: 0, type: "neutral" };
        }

        const positiveWords = [
            // 日本語
            "良い",
            "いい",
            "素晴らしい",
            "最高",
            "完璧",
            "満足",
            "おすすめ",
            "美味しい",
            "おいしい",
            "快適",
            "綺麗",
            "きれい",
            "親切",
            "丁寧",
            // 英語
            "good",
            "great",
            "excellent",
            "amazing",
            "perfect",
            "wonderful",
            "fantastic",
            "awesome",
            "brilliant",
            "outstanding",
            "superb",
        ];

        const negativeWords = [
            // 日本語
            "悪い",
            "だめ",
            "ダメ",
            "最悪",
            "ひどい",
            "酷い",
            "不満",
            "嫌",
            "まずい",
            "マズイ",
            "汚い",
            "遅い",
            "高い",
            "不親切",
            "雑",
            // 英語
            "bad",
            "terrible",
            "awful",
            "horrible",
            "disgusting",
            "worst",
            "hate",
            "disappointing",
            "poor",
            "slow",
            "expensive",
            "rude",
        ];

        const normalizedText = text.toLowerCase();
        let score = 0;

        positiveWords.forEach((word) => {
            const count = (normalizedText.match(new RegExp(word, "g")) || [])
                .length;
            score += count;
        });

        negativeWords.forEach((word) => {
            const count = (normalizedText.match(new RegExp(word, "g")) || [])
                .length;
            score -= count;
        });

        let type = "neutral";
        if (score > 0) type = "positive";
        else if (score < 0) type = "negative";

        return { score, type };
    }

    /**
     * テキストが自動生成されたものかを推測
     * @param {string} text - チェックするテキスト
     * @returns {boolean} 自動生成の可能性
     */
    static isLikelyGenerated(text) {
        if (!text || typeof text !== "string") {
            return false;
        }

        const suspiciousPatterns = [
            // 極端に短い
            text.length < 5,

            // 句読点がない
            !/[。、.,!?]/.test(text),

            // 同じ文字の繰り返し
            /(.)\1{3,}/.test(text),

            // 過度に形式的
            /^(good|great|excellent|nice|amazing)\.?$/i.test(text.trim()),

            // 日本語で極端に短い定型文
            /^(いいです|よかった|おすすめ|最高|完璧)\.?$/.test(text.trim()),
        ];

        return suspiciousPatterns.some((pattern) => pattern === true);
    }

    /**
     * 文字列をハッシュ化（簡易版）
     * @param {string} str - ハッシュ化する文字列
     * @returns {string} ハッシュ値
     */
    static simpleHash(str) {
        if (!str || typeof str !== "string") {
            return "0";
        }

        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // 32bit integer に変換
        }

        return Math.abs(hash).toString(36);
    }
}

// グローバルスコープに公開
if (typeof window !== "undefined") {
    window.TextUtils = TextUtils;
}
