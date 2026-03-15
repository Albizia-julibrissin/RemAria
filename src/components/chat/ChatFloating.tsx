"use client";

// spec/037, 094 - 常駐チャット（右下フロート・開閉可能・システムメッセージ表示・表示設定反映）

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getRecentChatMessages,
  sendChatMessage,
  type ChatMessageItem,
} from "@/server/actions/chat";
import { GameIcon } from "@/components/icons/game-icon";
import {
  getChatSettingsFromStorage,
  CHAT_SIZE_PRESET_DIMENSIONS,
  CHAT_FONT_SIZE_CLASS,
  type ChatSettings,
} from "@/lib/chat-settings";

const STORAGE_KEY_OPEN = "remaeria-chat-open";
const POLL_INTERVAL_MS = 15000;
const MESSAGE_LIMIT = 50;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

interface ChatFloatingProps {
  isLoggedIn: boolean;
}

function getPanelSizeStyle(settings: ChatSettings): { width: string; height: string; minHeight: string } {
  if (settings.sizeMode === "preset") {
    const d = CHAT_SIZE_PRESET_DIMENSIONS[settings.sizePreset];
    return { width: d.width, height: d.height, minHeight: "200px" };
  }
  const w = Math.min(90, Math.max(25, settings.widthPercent));
  const h = Math.min(70, Math.max(25, settings.heightPercent));
  return {
    width: `min(90vw, max(260px, ${w}vw))`,
    height: `min(70vh, max(200px, ${h}vh))`,
    minHeight: "200px",
  };
}

export function ChatFloating({ isLoggedIn }: ChatFloatingProps) {
  const [chatSettings, setChatSettings] = useState<ChatSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  const loadMessages = useCallback(async () => {
    const res = await getRecentChatMessages(MESSAGE_LIMIT);
    if (res.success) setMessages(res.messages);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const settings = getChatSettingsFromStorage();
    setChatSettings(settings);
    if (settings.openByDefault) {
      setOpen(true);
      try {
        localStorage.setItem(STORAGE_KEY_OPEN, "true");
      } catch {
        // ignore
      }
    } else {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_OPEN);
        if (stored === "true") setOpen(true);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setChatSettings(getChatSettingsFromStorage());
    window.addEventListener("storage", handler);
    window.addEventListener("remaeria-chat-settings-saved", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("remaeria-chat-settings-saved", handler);
    };
  }, []);

  useEffect(() => {
    if (!open || !isLoggedIn) return;
    setLoading(true);
    loadMessages().finally(() => setLoading(false));
    const t = setInterval(loadMessages, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [open, isLoggedIn, loadMessages]);

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_OPEN, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSendError(null);
    const body = inputValue.trim();
    if (!body || body.length > 500) return;

    const formData = new FormData();
    formData.set("body", body);

    const res = await sendChatMessage(formData);
    if (res.success) {
      setMessages((prev) => [res.message, ...prev]);
      setInputValue("");
    } else {
      setSendError(res.message);
    }
  };

  if (!isLoggedIn) return null;

  const settings = chatSettings ?? getChatSettingsFromStorage();
  const sizeStyle = getPanelSizeStyle(settings);
  const fontClass = CHAT_FONT_SIZE_CLASS[settings.fontSize];
  const displayMessages = settings.showSystemMessages
    ? messages
    : messages.filter((m) => m.kind !== "system");

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-0">
      {open && (
        <div
          className="flex flex-col rounded-t-lg border border-base-border bg-base-elevated shadow-lg"
          style={{
            width: sizeStyle.width,
            height: sizeStyle.height,
            minHeight: sizeStyle.minHeight,
          }}
        >
          <div className="flex items-center justify-between border-b border-base-border px-3 py-2">
            <span className="text-sm font-medium text-text-primary">全体チャット</span>
            <button
              type="button"
              onClick={handleToggle}
              className="text-text-muted hover:text-brass focus:outline-none focus:ring-2 focus:ring-brass rounded p-1"
              aria-label="チャットを閉じる"
            >
              ×
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex gap-2 border-b border-base-border bg-base-elevated p-2"
          >
            <input
              type="text"
              name="body"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="メッセージを入力…"
              maxLength={500}
              className="flex-1 rounded border border-base-border bg-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brass"
              aria-label="チャットメッセージ"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="rounded bg-brass px-3 py-2 text-sm font-medium text-text-primary hover:bg-brass-hover disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brass"
            >
              送信
            </button>
          </form>

          {sendError && (
            <p className="px-3 py-1 text-xs text-error border-b border-base-border bg-base-elevated">
              {sendError}
            </p>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto bg-base">
            {loading && messages.length === 0 ? (
              <p className="p-3 text-sm text-text-muted">読み込み中…</p>
            ) : displayMessages.length === 0 ? (
              <p className="p-3 text-sm text-text-muted">まだメッセージはありません。</p>
            ) : (
              <ul className={`p-3 space-y-2 font-sans text-text-primary ${fontClass}`}>
                {displayMessages.map((m) => (
                  <li
                    key={m.id}
                    className={`break-words flex gap-2 ${
                      m.kind === "system" ? "rounded px-2 py-1 bg-brass/10 text-text-muted" : ""
                    }`}
                  >
                    {m.kind === "system" && m.systemKind === "quest_clear" && (
                      <span className="flex-shrink-0 mt-0.5" aria-hidden>
                        <GameIcon name="flag" className="w-4 h-4 text-brass" />
                      </span>
                    )}
                    {m.protagonistIconFilename && (
                      <span className="flex-shrink-0">
                        <img
                          src={`/icons/${m.protagonistIconFilename}`}
                          alt=""
                          className="w-6 h-6 object-contain rounded"
                          width={24}
                          height={24}
                        />
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="text-text-muted text-xs mr-2">
                        {formatTime(m.createdAt)}{" "}
                        {m.kind === "user" &&
                          (m.accountId ? (
                            <Link
                              href={`/dashboard/profile/${encodeURIComponent(m.accountId)}`}
                              className="text-brass hover:text-brass-hover hover:underline"
                            >
                              {m.senderName}
                            </Link>
                          ) : (
                            m.senderName
                          ))}
                      </span>
                      {m.kind === "user" && <span>{m.body}</span>}
                      {m.kind === "system" && m.systemKind === "quest_clear" && m.accountId && (
                        <>
                          <Link
                            href={`/dashboard/profile/${encodeURIComponent(m.accountId)}`}
                            className="text-brass hover:text-brass-hover hover:underline"
                          >
                            {m.subjectName ?? "冒険者"}
                          </Link>
                          <span>が任務「{m.payload?.questName ?? ""}」を達成しました。</span>
                        </>
                      )}
                      {m.kind === "system" && m.systemKind !== "quest_clear" && (
                        <span>{m.body}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        className="rounded-full border border-base-border bg-base-elevated px-4 py-2 text-sm text-text-primary hover:border-brass hover:text-brass focus:outline-none focus:ring-2 focus:ring-brass"
        aria-label={open ? "チャットを閉じる" : "チャットを開く"}
      >
        💬 チャット
      </button>
    </div>
  );
}
