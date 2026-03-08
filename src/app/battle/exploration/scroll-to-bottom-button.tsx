"use client";

/**
 * 探索画面用: 画面最下部へスクロールするオーバレイボタン。
 * 固定表示で、押すと window を最下部へスクロールする。
 */
export function ScrollToBottomButton() {
  const scrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollToBottom}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-base-elevated border border-base-border text-text-primary shadow-lg hover:bg-base hover:border-brass focus:outline-none focus:ring-2 focus:ring-brass"
      aria-label="一番下へ"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-7 h-7"
      >
        <path d="M12 5v14M19 12l-7 7-7-7" />
      </svg>
    </button>
  );
}
