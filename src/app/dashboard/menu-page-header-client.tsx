"use client";

// 機工区用プロトタイプ：メニュー名＋(i)説明ボタン、一段下に開拓拠点に戻る＋移動先

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

const MENU_LINKS = [
  { href: "/dashboard/characters", label: "居住区" },
  { href: "/dashboard/recruit", label: "人材局" },
  { href: "/dashboard/facilities", label: "機工区" },
  { href: "/dashboard/research", label: "研究局" },
  { href: "/dashboard/craft", label: "工房" },
  { href: "/dashboard/bag", label: "物資庫" },
  { href: "/dashboard/quests", label: "開拓任務" },
  { href: "/dashboard/market", label: "市場" },
  { href: "/dashboard/tactics", label: "作戦室" },
] as const;

const buttonBase =
  "inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-brass hover:bg-base focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base";

export function MenuPageHeaderClient({
  title,
  description,
  currentPath,
}: {
  title: string;
  description: string;
  currentPath: string;
}) {
  const [showDescription, setShowDescription] = useState(false);
  const [showDestinations, setShowDestinations] = useState(false);
  const destRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelRect, setPanelRect] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!showDestinations || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelRect({ top: rect.bottom + 4, left: rect.left });
  }, [showDestinations]);

  useEffect(() => {
    if (!showDestinations) return;
    const handleClickOutside = (e: MouseEvent) => {
      const el = e.target as Node;
      if (destRef.current?.contains(el)) return;
      const portal = document.getElementById("menu-destinations-portal");
      if (portal?.contains(el)) return;
      setShowDestinations(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDestinations]);

  const otherMenus = MENU_LINKS.filter((m) => m.href !== currentPath);

  return (
    <div className="mb-6">
      {/* 一段目: メニュー名 + (i) 説明ボタン */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        <button
          type="button"
          onClick={() => setShowDescription((v) => !v)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-base-border bg-base-elevated text-sm text-text-muted transition-colors hover:border-brass hover:text-brass focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          aria-label="このメニューの説明を表示"
          title="説明"
        >
          !
        </button>
      </div>
      {showDescription && (
        <div className="mt-3 rounded-lg border border-base-border bg-base-elevated p-4 text-sm text-text-primary">
          {description}
        </div>
      )}

      {/* 二段目: 開拓拠点に戻る + 移動先 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href="/dashboard" className={buttonBase}>
          ← 開拓拠点に戻る
        </Link>
        <div className="relative" ref={destRef}>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setShowDestinations((v) => !v)}
            className={buttonBase}
            aria-expanded={showDestinations}
            aria-haspopup="true"
          >
            移動先
          </button>
          {showDestinations &&
            panelRect &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                id="menu-destinations-portal"
                className="fixed z-[100] w-[12rem] overflow-hidden rounded-lg border border-base-border bg-base-elevated shadow-lg"
                style={{ top: panelRect.top, left: panelRect.left }}
              >
                <div className="grid grid-cols-2 border-collapse">
                  {otherMenus.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="border border-base-border bg-base px-4 py-2.5 text-center text-sm text-text-primary transition-colors hover:bg-base-elevated hover:text-brass"
                      onClick={() => setShowDestinations(false)}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>,
              document.body
            )}
        </div>
      </div>
    </div>
  );
}
