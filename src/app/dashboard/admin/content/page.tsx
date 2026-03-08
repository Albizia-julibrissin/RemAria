// 実装済みコンテンツ一覧（テストユーザー1のみ表示）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContentLists } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";

export default async function AdminContentPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const data = await getAdminContentLists();
  if (!data) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← ダッシュボード
        </Link>
        <Link
          href="/dashboard/admin/drops"
          className="text-sm text-text-muted hover:text-brass"
        >
          エリアドロップ編集
        </Link>
        <Link
          href="/dashboard/admin/items"
          className="text-sm text-text-muted hover:text-brass"
        >
          アイテムマスタ編集
        </Link>
        <Link
          href="/dashboard/admin/craft-recipes"
          className="text-sm text-text-muted hover:text-brass"
        >
          クラフトレシピ編集
        </Link>
        <Link
          href="/dashboard/admin/facilities"
          className="text-sm text-text-muted hover:text-brass"
        >
          設備種別編集
        </Link>
        <Link
          href="/dashboard/admin/recipes"
          className="text-sm text-text-muted hover:text-brass"
        >
          設備生産レシピ編集
        </Link>
        <Link
          href="/dashboard/admin/relic-types"
          className="text-sm text-text-muted hover:text-brass"
        >
          遺物型編集
        </Link>
        <Link
          href="/dashboard/admin/relic-passive-effects"
          className="text-sm text-text-muted hover:text-brass"
        >
          遺物パッシブ効果編集
        </Link>
        <Link
          href="/dashboard/admin/relic-groups"
          className="text-sm text-text-muted hover:text-brass"
        >
          遺物グループ編集
        </Link>
        <Link
          href="/dashboard/admin/enemies"
          className="text-sm text-text-muted hover:text-brass"
        >
          敵マスタ編集
        </Link>
        <Link
          href="/dashboard/admin/enemy-groups"
          className="text-sm text-text-muted hover:text-brass"
        >
          敵グループ編集
        </Link>
        <Link
          href="/dashboard/admin/exploration-themes"
          className="text-sm text-text-muted hover:text-brass"
        >
          探索テーマ・エリア編集
        </Link>
        <Link
          href="/dashboard/admin/skills"
          className="text-sm text-text-muted hover:text-brass"
        >
          スキル編集
        </Link>
        <Link
          href="/dashboard/admin/research-groups"
          className="text-sm text-text-muted hover:text-brass"
        >
          研究グループ編集
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">コンテンツ管理</h1>
      <p className="mt-2 text-sm text-text-muted">
        実装済み一覧の参照と、ドロップ・アイテム・レシピ等の編集入口。テストユーザー1でログイン中のみ表示されます。
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary border-b border-base-border pb-2">
          アイテム（Item）
        </h2>
        <p className="mt-1 text-xs text-text-muted">code / name / category</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm border-collapse border border-base-border">
            <thead>
              <tr className="bg-base-elevated">
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                  code
                </th>
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                  name
                </th>
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                  category
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id} className="text-text-primary">
                  <td className="border border-base-border px-2 py-1.5 font-mono text-xs">
                    {row.code}
                  </td>
                  <td className="border border-base-border px-2 py-1.5">{row.name}</td>
                  <td className="border border-base-border px-2 py-1.5 text-text-muted">
                    {row.category}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-text-muted">計 {data.items.length} 件</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-text-primary border-b border-base-border pb-2">
          スキル（Skill）
        </h2>
        <p className="mt-1 text-xs text-text-muted">name / category / battleSkillType</p>
        <p className="mt-1">
          <Link
            href="/dashboard/admin/skills"
            className="text-sm text-brass hover:text-brass-hover"
          >
            スキル編集
          </Link>
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm border-collapse border border-base-border">
            <thead>
              <tr className="bg-base-elevated">
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                  name
                </th>
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                  category
                </th>
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                  battleSkillType
                </th>
              </tr>
            </thead>
            <tbody>
              {data.skills.map((row) => (
                <tr key={row.id} className="text-text-primary">
                  <td className="border border-base-border px-2 py-1.5">{row.name}</td>
                  <td className="border border-base-border px-2 py-1.5 text-text-muted">
                    {row.category}
                  </td>
                  <td className="border border-base-border px-2 py-1.5 text-text-muted">
                    {row.battleSkillType ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-text-muted">計 {data.skills.length} 件</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-text-primary border-b border-base-border pb-2">
          敵（Enemy）
        </h2>
        <p className="mt-1 text-xs text-text-muted">code / name</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[300px] text-sm border-collapse border border-base-border">
            <thead>
              <tr className="bg-base-elevated">
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                  code
                </th>
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                  name
                </th>
              </tr>
            </thead>
            <tbody>
              {data.enemies.map((row) => (
                <tr key={row.id} className="text-text-primary">
                  <td className="border border-base-border px-2 py-1.5 font-mono text-xs">
                    {row.code}
                  </td>
                  <td className="border border-base-border px-2 py-1.5">{row.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-text-muted">計 {data.enemies.length} 件</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-text-primary border-b border-base-border pb-2">
          遺物タイプ（RelicType）
        </h2>
        <p className="mt-1 text-xs text-text-muted">code / name / groupCode</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[300px] text-sm border-collapse border border-base-border">
            <thead>
              <tr className="bg-base-elevated">
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                  code
                </th>
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                  name
                </th>
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                  groupCode
                </th>
              </tr>
            </thead>
            <tbody>
              {data.relicTypes.map((row) => (
                <tr key={row.id} className="text-text-primary">
                  <td className="border border-base-border px-2 py-1.5 font-mono text-xs">
                    {row.code}
                  </td>
                  <td className="border border-base-border px-2 py-1.5">{row.name}</td>
                  <td className="border border-base-border px-2 py-1.5 text-text-muted">
                    {row.groupCode ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-text-muted">計 {data.relicTypes.length} 件</p>

        <h3 className="mt-6 text-base font-medium text-text-primary">
          グループ別：抽選される遺物型・パッシブ効果
        </h3>
        <p className="mt-1 text-xs text-text-muted">
          鑑定トークン（例: relic_group_a_token → group_a）で鑑定したとき、抽選される遺物型とパッシブ効果です。現状はパッシブはグループ共通で全件が対象です。
        </p>
        <div className="mt-3 space-y-4">
          {Array.from(
            new Set(data.relicTypes.map((t) => t.groupCode).filter(Boolean) as string[])
          )
            .sort((a, b) => a.localeCompare(b))
            .map((groupCode) => [
              groupCode,
              data.relicTypes.filter((t) => t.groupCode === groupCode),
            ] as const)
            .map(([groupCode, typesInGroup]) => {
            const groupLabel = groupCode === "group_a" ? "グループＡ" : groupCode;
            return (
              <div
                key={groupCode}
                className="rounded-lg border border-base-border bg-base-elevated p-4"
              >
                <p className="font-medium text-text-primary">
                  {groupLabel}（{groupCode}）
                </p>
                <p className="mt-2 text-sm text-text-muted">抽選される遺物型</p>
                <ul className="mt-1 list-inside list-disc text-sm text-text-primary">
                  {typesInGroup.length === 0 ? (
                    <li>—</li>
                  ) : (
                    typesInGroup.map((t) => (
                      <li key={t.id}>
                        <span className="font-mono text-xs">{t.code}</span> — {t.name}
                      </li>
                    ))
                  )}
                </ul>
                <p className="mt-3 text-sm text-text-muted">抽選されるパッシブ効果</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[320px] text-sm border-collapse border border-base-border">
                    <thead>
                      <tr className="bg-base">
                        <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                          code
                        </th>
                        <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                          name
                        </th>
                        <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                          description
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.relicPassiveEffects.map((row) => (
                        <tr key={row.id} className="text-text-primary">
                          <td className="border border-base-border px-2 py-1.5 font-mono text-xs">
                            {row.code}
                          </td>
                          <td className="border border-base-border px-2 py-1.5">{row.name}</td>
                          <td className="border border-base-border px-2 py-1.5 text-text-muted text-xs">
                            {row.description ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  パッシブ計 {data.relicPassiveEffects.length} 件
                </p>
              </div>
            );
          })}
        </div>
        {data.relicTypes.every((t) => !t.groupCode) && (
          <p className="mt-2 text-sm text-text-muted">登録されている鑑定グループがありません。</p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-text-primary border-b border-base-border pb-2">
          探索テーマ・エリア（ExplorationTheme / Area）
        </h2>
        <p className="mt-1 text-xs text-text-muted">テーマ名 → エリア code / name</p>
        <p className="mt-1">
          <Link
            href="/dashboard/admin/exploration-themes"
            className="text-sm text-brass hover:text-brass-hover"
          >
            探索テーマ・エリア編集
          </Link>
        </p>
        <ul className="mt-2 space-y-4">
          {data.explorationThemes.map((theme) => (
            <li key={theme.id} className="rounded border border-base-border bg-base-elevated p-3">
              <p className="font-medium text-text-primary">{theme.name}</p>
              <ul className="mt-2 ml-4 space-y-1 text-sm">
                {theme.areas.map((area) => (
                  <li key={area.id} className="text-text-muted">
                    <span className="font-mono text-xs">{area.code}</span> — {area.name}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-text-muted">
          テーマ {data.explorationThemes.length} 件
        </p>
      </section>
    </main>
  );
}
