/**
 * spec/094: チャット表示設定の localStorage キーとデフォルト値。
 * 設定ページと ChatFloating で共有する。
 */

export const CHAT_SETTINGS_KEYS = {
  SIZE_MODE: "remaeria-chat-size-mode",
  SIZE_PRESET: "remaeria-chat-size-preset",
  WIDTH_PERCENT: "remaeria-chat-width-percent",
  HEIGHT_PERCENT: "remaeria-chat-height-percent",
  OPEN_BY_DEFAULT: "remaeria-chat-open-by-default",
  FONT_SIZE: "remaeria-chat-font-size",
  SHOW_SYSTEM_MESSAGES: "remaeria-chat-show-system-messages",
} as const;

export type ChatSizePreset = "S" | "M" | "L";
export type ChatFontSize = "small" | "normal" | "large";

export const CHAT_SIZE_PRESET_DIMENSIONS: Record<
  ChatSizePreset,
  { width: string; height: string }
> = {
  S: { width: "280px", height: "30vh" },
  M: { width: "360px", height: "45vh" },
  L: { width: "440px", height: "55vh" },
};

export const CHAT_FONT_SIZE_CLASS: Record<ChatFontSize, string> = {
  small: "text-xs",
  normal: "text-sm",
  large: "text-base",
};

const WIDTH_PERCENT_MIN = 25;
const WIDTH_PERCENT_MAX = 85;
const HEIGHT_PERCENT_MIN = 25;
const HEIGHT_PERCENT_MAX = 70;

export const CHAT_SETTINGS_DEFAULTS = {
  sizeMode: "preset" as "preset" | "custom",
  sizePreset: "M" as ChatSizePreset,
  widthPercent: 35,
  heightPercent: 45,
  openByDefault: false,
  fontSize: "normal" as ChatFontSize,
  showSystemMessages: true,
} as const;

export type ChatSettings = {
  sizeMode: "preset" | "custom";
  sizePreset: ChatSizePreset;
  widthPercent: number;
  heightPercent: number;
  openByDefault: boolean;
  fontSize: ChatFontSize;
  showSystemMessages: boolean;
};

function clampPercent(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** クライアントのみ。localStorage からチャット設定を読み、デフォルトで補う。 */
export function getChatSettingsFromStorage(): ChatSettings {
  if (typeof window === "undefined") return { ...CHAT_SETTINGS_DEFAULTS };

  const sizeMode = (localStorage.getItem(CHAT_SETTINGS_KEYS.SIZE_MODE) ?? "preset") as
    | "preset"
    | "custom";
  const sizePreset = (localStorage.getItem(CHAT_SETTINGS_KEYS.SIZE_PRESET) ?? "M") as ChatSizePreset;
  const widthPercent = clampPercent(
    parseInt(localStorage.getItem(CHAT_SETTINGS_KEYS.WIDTH_PERCENT) ?? "35", 10),
    WIDTH_PERCENT_MIN,
    WIDTH_PERCENT_MAX
  );
  const heightPercent = clampPercent(
    parseInt(localStorage.getItem(CHAT_SETTINGS_KEYS.HEIGHT_PERCENT) ?? "45", 10),
    HEIGHT_PERCENT_MIN,
    HEIGHT_PERCENT_MAX
  );
  const openByDefault = localStorage.getItem(CHAT_SETTINGS_KEYS.OPEN_BY_DEFAULT) === "true";
  const fontSize = (localStorage.getItem(CHAT_SETTINGS_KEYS.FONT_SIZE) ?? "normal") as ChatFontSize;
  const showSystemMessages =
    localStorage.getItem(CHAT_SETTINGS_KEYS.SHOW_SYSTEM_MESSAGES) !== "false";

  return {
    sizeMode,
    sizePreset,
    widthPercent,
    heightPercent,
    openByDefault,
    fontSize,
    showSystemMessages,
  };
}

/** クライアントのみ。チャット設定を localStorage に保存し、storage イベントを発火して他タブ・ChatFloating に通知。 */
export function saveChatSettingsToStorage(settings: ChatSettings): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(CHAT_SETTINGS_KEYS.SIZE_MODE, settings.sizeMode);
  localStorage.setItem(CHAT_SETTINGS_KEYS.SIZE_PRESET, settings.sizePreset);
  localStorage.setItem(
    CHAT_SETTINGS_KEYS.WIDTH_PERCENT,
    String(clampPercent(settings.widthPercent, WIDTH_PERCENT_MIN, WIDTH_PERCENT_MAX))
  );
  localStorage.setItem(
    CHAT_SETTINGS_KEYS.HEIGHT_PERCENT,
    String(clampPercent(settings.heightPercent, HEIGHT_PERCENT_MIN, HEIGHT_PERCENT_MAX))
  );
  localStorage.setItem(CHAT_SETTINGS_KEYS.OPEN_BY_DEFAULT, String(settings.openByDefault));
  localStorage.setItem(CHAT_SETTINGS_KEYS.FONT_SIZE, settings.fontSize);
  localStorage.setItem(CHAT_SETTINGS_KEYS.SHOW_SYSTEM_MESSAGES, String(settings.showSystemMessages));

  window.dispatchEvent(new StorageEvent("storage", { key: CHAT_SETTINGS_KEYS.SIZE_MODE }));
  window.dispatchEvent(new CustomEvent("remaeria-chat-settings-saved"));
}

export { WIDTH_PERCENT_MIN, WIDTH_PERCENT_MAX, HEIGHT_PERCENT_MIN, HEIGHT_PERCENT_MAX };
