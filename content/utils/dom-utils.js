// src/content/ui/dom-utils.js

/**
 * DOM操作関連のユーティリティクラス
 */
class DOMUtils {
    /**
     * 要素が表示されているかチェック
     * @param {Element} element - チェックする要素
     * @returns {boolean} 表示されているかどうか
     */
    static isVisible(element) {
        if (!element) return false;

        const style = window.getComputedStyle(element);
        return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            element.offsetWidth > 0 &&
            element.offsetHeight > 0
        );
    }

    /**
     * 要素がビューポート内にあるかチェック
     * @param {Element} element - チェックする要素
     * @returns {boolean} ビューポート内にあるかどうか
     */
    static isInViewport(element) {
        if (!element) return false;

        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <=
                (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <=
                (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * 要素を安全に削除
     * @param {Element|string} elementOrSelector - 削除する要素またはセレクター
     */
    static safeRemove(elementOrSelector) {
        try {
            let element;
            if (typeof elementOrSelector === "string") {
                element = document.querySelector(elementOrSelector);
            } else {
                element = elementOrSelector;
            }

            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        } catch (error) {
            console.warn("Failed to remove element:", error);
        }
    }

    /**
     * 要素の作成（安全版）
     * @param {string} tagName - タグ名
     * @param {Object} attributes - 属性オブジェクト
     * @param {string} textContent - テキストコンテンツ
     * @returns {Element} 作成された要素
     */
    static createElement(tagName, attributes = {}, textContent = "") {
        try {
            const element = document.createElement(tagName);

            // 属性を設定
            Object.keys(attributes).forEach((key) => {
                if (attributes[key] !== null && attributes[key] !== undefined) {
                    element.setAttribute(key, attributes[key]);
                }
            });

            // テキストコンテンツを設定
            if (textContent) {
                element.textContent = textContent;
            }

            return element;
        } catch (error) {
            console.error("Failed to create element:", error);
            return document.createElement("div"); // フォールバック
        }
    }

    /**
     * セレクターで要素を待機
     * @param {string} selector - 待機するセレクター
     * @param {number} timeout - タイムアウト時間（ミリ秒）
     * @param {Element} parent - 親要素（デフォルトはdocument）
     * @returns {Promise<Element>} 見つかった要素
     */
    static waitForElement(selector, timeout = 10000, parent = document) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                observer.disconnect();
                reject(
                    new Error(
                        `Element ${selector} not found within ${timeout}ms`
                    )
                );
            }, timeout);

            // 既に存在するかチェック
            const existingElement = parent.querySelector(selector);
            if (existingElement) {
                clearTimeout(timeoutId);
                resolve(existingElement);
                return;
            }

            // MutationObserverで監視
            const observer = new MutationObserver((mutations) => {
                const element = parent.querySelector(selector);
                if (element) {
                    clearTimeout(timeoutId);
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(parent, {
                childList: true,
                subtree: true,
            });
        });
    }

    /**
     * 要素の存在を待機（複数セレクター対応）
     * @param {Array<string>} selectors - セレクター配列
     * @param {number} timeout - タイムアウト時間
     * @returns {Promise<Element>} 最初に見つかった要素
     */
    static waitForAnyElement(selectors, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                observer.disconnect();
                reject(
                    new Error(`None of the elements found within ${timeout}ms`)
                );
            }, timeout);

            // 既に存在するかチェック
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    clearTimeout(timeoutId);
                    resolve(element);
                    return;
                }
            }

            // MutationObserverで監視
            const observer = new MutationObserver(() => {
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        clearTimeout(timeoutId);
                        observer.disconnect();
                        resolve(element);
                        return;
                    }
                }
            });

            observer.observe(document, {
                childList: true,
                subtree: true,
            });
        });
    }

    /**
     * 要素にクラスを安全に追加
     * @param {Element} element - 対象要素
     * @param {string|Array<string>} classes - 追加するクラス
     */
    static addClasses(element, classes) {
        if (!element) return;

        try {
            const classArray = Array.isArray(classes) ? classes : [classes];
            classArray.forEach((className) => {
                if (className && typeof className === "string") {
                    element.classList.add(className);
                }
            });
        } catch (error) {
            console.warn("Failed to add classes:", error);
        }
    }

    /**
     * 要素からクラスを安全に削除
     * @param {Element} element - 対象要素
     * @param {string|Array<string>} classes - 削除するクラス
     */
    static removeClasses(element, classes) {
        if (!element) return;

        try {
            const classArray = Array.isArray(classes) ? classes : [classes];
            classArray.forEach((className) => {
                if (className && typeof className === "string") {
                    element.classList.remove(className);
                }
            });
        } catch (error) {
            console.warn("Failed to remove classes:", error);
        }
    }

    /**
     * 要素のスタイルを安全に設定
     * @param {Element} element - 対象要素
     * @param {Object} styles - スタイルオブジェクト
     */
    static setStyles(element, styles) {
        if (!element || !styles) return;

        try {
            Object.keys(styles).forEach((property) => {
                if (
                    styles[property] !== null &&
                    styles[property] !== undefined
                ) {
                    element.style[property] = styles[property];
                }
            });
        } catch (error) {
            console.warn("Failed to set styles:", error);
        }
    }

    /**
     * 要素を画面中央にスクロール
     * @param {Element} element - スクロール先の要素
     * @param {Object} options - スクロールオプション
     */
    static scrollToCenter(element, options = {}) {
        if (!element) return;

        try {
            const defaultOptions = {
                behavior: "smooth",
                block: "center",
                inline: "center",
            };

            element.scrollIntoView({ ...defaultOptions, ...options });
        } catch (error) {
            console.warn("Failed to scroll to element:", error);
            // フォールバック
            try {
                element.scrollIntoView();
            } catch (fallbackError) {
                console.warn("Fallback scroll also failed:", fallbackError);
            }
        }
    }

    /**
     * 要素の位置情報を取得
     * @param {Element} element - 対象要素
     * @returns {Object} 位置情報
     */
    static getElementPosition(element) {
        if (!element) return null;

        try {
            const rect = element.getBoundingClientRect();
            const scrollTop =
                window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft =
                window.pageXOffset || document.documentElement.scrollLeft;

            return {
                top: rect.top + scrollTop,
                left: rect.left + scrollLeft,
                bottom: rect.bottom + scrollTop,
                right: rect.right + scrollLeft,
                width: rect.width,
                height: rect.height,
                centerX: rect.left + scrollLeft + rect.width / 2,
                centerY: rect.top + scrollTop + rect.height / 2,
            };
        } catch (error) {
            console.warn("Failed to get element position:", error);
            return null;
        }
    }

    /**
     * 要素のテキストコンテンツを安全に取得
     * @param {Element} element - 対象要素
     * @param {boolean} trim - トリムするかどうか
     * @returns {string} テキストコンテンツ
     */
    static getTextContent(element, trim = true) {
        if (!element) return "";

        try {
            const text = element.textContent || element.innerText || "";
            return trim ? text.trim() : text;
        } catch (error) {
            console.warn("Failed to get text content:", error);
            return "";
        }
    }

    /**
     * 要素の階層を取得（デバッグ用）
     * @param {Element} element - 対象要素
     * @returns {Array<string>} 要素の階層配列
     */
    static getElementPath(element) {
        if (!element) return [];

        const path = [];
        let current = element;

        try {
            while (current && current !== document.body) {
                let selector = current.tagName.toLowerCase();

                if (current.id) {
                    selector += `#${current.id}`;
                } else if (current.className) {
                    const classes = current.className
                        .toString()
                        .trim()
                        .split(/\s+/);
                    if (classes.length > 0 && classes[0]) {
                        selector += `.${classes.slice(0, 3).join(".")}`;
                    }
                }

                path.unshift(selector);
                current = current.parentElement;
            }
        } catch (error) {
            console.warn("Failed to get element path:", error);
        }

        return path;
    }

    /**
     * 要素が特定の親要素の子かチェック
     * @param {Element} child - 子要素
     * @param {Element} parent - 親要素
     * @returns {boolean} 親子関係があるかどうか
     */
    static isChildOf(child, parent) {
        if (!child || !parent) return false;

        try {
            return parent.contains(child);
        } catch (error) {
            console.warn("Failed to check parent-child relationship:", error);
            return false;
        }
    }

    /**
     * 要素のサイズを取得
     * @param {Element} element - 対象要素
     * @returns {Object} サイズ情報
     */
    static getElementSize(element) {
        if (!element) return null;

        try {
            return {
                width: element.offsetWidth,
                height: element.offsetHeight,
                clientWidth: element.clientWidth,
                clientHeight: element.clientHeight,
                scrollWidth: element.scrollWidth,
                scrollHeight: element.scrollHeight,
            };
        } catch (error) {
            console.warn("Failed to get element size:", error);
            return null;
        }
    }

    /**
     * DOM変更を監視
     * @param {Element} target - 監視対象要素
     * @param {Function} callback - コールバック関数
     * @param {Object} options - MutationObserverオプション
     * @returns {MutationObserver} オブザーバー
     */
    static observeChanges(target, callback, options = {}) {
        try {
            const defaultOptions = {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false,
            };

            const observer = new MutationObserver(callback);
            observer.observe(target, { ...defaultOptions, ...options });
            return observer;
        } catch (error) {
            console.error("Failed to create mutation observer:", error);
            return null;
        }
    }

    /**
     * デバウンス付きのサイズ変更監視
     * @param {Function} callback - コールバック関数
     * @param {number} delay - デバウンス遅延時間
     * @returns {Function} クリーンアップ関数
     */
    static observeResize(callback, delay = 250) {
        let timeoutId;

        const debouncedCallback = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(callback, delay);
        };

        window.addEventListener("resize", debouncedCallback);

        // クリーンアップ関数を返す
        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener("resize", debouncedCallback);
        };
    }
}

// グローバルスコープに公開
if (typeof window !== "undefined") {
    window.DOMUtils = DOMUtils;
}
