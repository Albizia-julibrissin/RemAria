// エリア別ドロップテーブル編集（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminBackButton } from "../admin-back-button";
import {
  getAdminAreaList,
  getAreaDropEditData,
  getAdminItemsForDrop,
} from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AreaDropEditClient } from "./area-drop-edit-client";

const DROP_KIND_LABELS: Record<string, string> = {
  base: "基本ドロップ",
  battle_bonus: "戦闘ボーナス",
  skill: "技能イベント枠",
  strong_enemy: "強敵",
  area_lord_special: "領域主専用",
};

export default async function AdminDropsPage({
  searchParams,
}: {
  searchParams: Promise<{ areaId?: string }>;
}) {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const areaId = params.areaId ?? null;

  const [areas, items] = await Promise.all([
    getAdminAreaList(),
    getAdminItemsForDrop(),
  ]);

  if (!areas || !items) {
    redirect("/dashboard");
  }

  const data = areaId ? await getAreaDropEditData(areaId) : null;
  if (areaId && !data) {
    redirect("/dashboard/admin/drops");
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <AdminBackButton />
        <Link
          href="/dashboard/admin/content"
          className="text-sm text-text-muted hover:text-brass"
        >
          実装済み一覧
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-text-primary">
        エリア別ドロップ編集
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        探索エリアごとのドロップテーブル（基本／戦闘／技能／強敵／領域主）のアイテムと重みを編集します。テストユーザー1のみ表示。
      </p>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-text-primary border-b border-base-border pb-2">
          エリアを選択
        </h2>
        <ul className="mt-2 space-y-1">
          {areas.map((a) => (
            <li key={a.id}>
              <Link
                href={`/dashboard/admin/drops?areaId=${encodeURIComponent(a.id)}`}
                className={`block rounded px-3 py-2 text-sm transition-colors ${
                  areaId === a.id
                    ? "bg-brass/20 text-brass font-medium"
                    : "text-text-primary hover:bg-base-elevated"
                }`}
              >
                <span className="font-mono text-xs text-text-muted">{a.code}</span> — {a.name}
                <span className="ml-2 text-xs text-text-muted">({a.themeName})</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {data && (
        <AreaDropEditClient
          data={data}
          items={items}
          kindLabels={DROP_KIND_LABELS}
          areas={areas.map((a) => ({ id: a.id, code: a.code, name: a.name }))}
        />
      )}
    </main>
  );
}
