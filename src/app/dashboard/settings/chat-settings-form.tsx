"use client";

// spec/094: チャット表示設定フォーム。localStorage に保存。

import { useEffect, useState } from "react";
import {
  getChatSettingsFromStorage,
  saveChatSettingsToStorage,
  CHAT_SETTINGS_DEFAULTS,
  CHAT_SIZE_PRESET_DIMENSIONS,
  WIDTH_PERCENT_MIN,
  WIDTH_PERCENT_MAX,
  HEIGHT_PERCENT_MIN,
  HEIGHT_PERCENT_MAX,
  type ChatSettings,
  type ChatSizePreset,
  type ChatFontSize,
} from "@/lib/chat-settings";

export function ChatSettingsForm() {
  const [settings, setSettings] = useState<ChatSettings>(CHAT_SETTINGS_DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(getChatSettingsFromStorage());
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveChatSettingsToStorage(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-md">
      <div>
        <span className="block text-sm font-medium text-text-muted mb-2">パネルサイズ</span>
        <div className="flex flex-wrap gap-4">
          {(["S", "M", "L"] as ChatSizePreset[]).map((preset) => (
            <label key={preset} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="sizeMode"
                checked={settings.sizeMode === "preset" && settings.sizePreset === preset}
                onChange={() =>
                  setSettings((s) => ({ ...s, sizeMode: "preset", sizePreset: preset }))
                }
                className="rounded border-base-border text-brass focus:ring-brass"
              />
              <span className="text-sm text-text-primary">
                {preset}（{CHAT_SIZE_PRESET_DIMENSIONS[preset].width} ×{" "}
                {CHAT_SIZE_PRESET_DIMENSIONS[preset].height}）
              </span>
            </label>
          ))}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="sizeMode"
              checked={settings.sizeMode === "custom"}
              onChange={() => setSettings((s) => ({ ...s, sizeMode: "custom" }))}
              className="rounded border-base-border text-brass focus:ring-brass"
            />
            <span className="text-sm text-text-primary">カスタム</span>
          </label>
        </div>
        {settings.sizeMode === "custom" && (
          <div className="mt-3 flex flex-col gap-2">
            <label className="text-xs text-text-muted">
              幅（vw）: {settings.widthPercent}
              <input
                type="range"
                min={WIDTH_PERCENT_MIN}
                max={WIDTH_PERCENT_MAX}
                value={settings.widthPercent}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, widthPercent: parseInt(e.target.value, 10) }))
                }
                className="ml-2 w-32 align-middle"
              />
            </label>
            <label className="text-xs text-text-muted">
              高さ（vh）: {settings.heightPercent}
              <input
                type="range"
                min={HEIGHT_PERCENT_MIN}
                max={HEIGHT_PERCENT_MAX}
                value={settings.heightPercent}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, heightPercent: parseInt(e.target.value, 10) }))
                }
                className="ml-2 w-32 align-middle"
              />
            </label>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="chatOpenByDefault"
          checked={settings.openByDefault}
          onChange={(e) =>
            setSettings((s) => ({ ...s, openByDefault: e.target.checked }))
          }
          className="rounded border-base-border text-brass focus:ring-brass"
        />
        <label htmlFor="chatOpenByDefault" className="text-sm text-text-primary">
          起動時にチャットを開く
        </label>
      </div>

      <div>
        <span className="block text-sm font-medium text-text-muted mb-2">
          メッセージの文字サイズ
        </span>
        <div className="flex gap-4">
          {(["small", "normal", "large"] as ChatFontSize[]).map((size) => (
            <label key={size} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="fontSize"
                checked={settings.fontSize === size}
                onChange={() => setSettings((s) => ({ ...s, fontSize: size }))}
                className="rounded border-base-border text-brass focus:ring-brass"
              />
              <span className="text-sm text-text-primary">
                {size === "small" ? "小" : size === "normal" ? "標準" : "大"}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="chatShowSystemMessages"
          checked={settings.showSystemMessages}
          onChange={(e) =>
            setSettings((s) => ({ ...s, showSystemMessages: e.target.checked }))
          }
          className="rounded border-base-border text-brass focus:ring-brass"
        />
        <label htmlFor="chatShowSystemMessages" className="text-sm text-text-primary">
          システムメッセージを表示する（任務達成通知など）
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-text-primary hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass"
        >
          保存
        </button>
        {saved && (
          <span className="text-sm text-success">保存しました。チャットパネルで反映されます。</span>
        )}
      </div>

      <p className="text-xs text-text-muted">
        設定はこのブラウザにのみ保存されます。チャットを開き直すと反映されます。
      </p>
    </form>
  );
}
