// spec/035, 036, docs/019 - 工業（単一プール）・全設備一括受け取り

import Link from "next/link";
import { getIndustrial } from "@/server/actions/initial-area";
import { ReceiveAllForm } from "./receive-all-form";

export default async function FacilitiesPage() {
  const data = await getIndustrial();

  if (!data) {
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">工業</h1>
        <p className="mt-4 text-text-muted">ログインしてください。</p>
        <Link href="/login" className="mt-4 inline-block text-brass hover:underline">
          ログインへ
        </Link>
      </main>
    );
  }

  const { maxSlots, maxCost, usedSlots, usedCost, facilities } = data;
  const hasReceivable = facilities.some((f) => f.receivableCycles > 0);

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← ダッシュボード
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">工業</h1>
      <p className="mt-2 text-text-muted">
        設備の確認・生産の受け取りができます。受け取りは全設備一括で、最大24時間分まで（docs/019）。
        <Link href="/dashboard/warehouse" className="ml-2 text-brass hover:underline">
          倉庫で所持数を確認
        </Link>
      </p>

      <section className="mt-8 rounded-lg border border-base-border bg-base-elevated p-6 max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-text-primary">設備</h2>
            <p className="mt-2 text-sm text-text-muted">
              コスト {usedCost} / {maxCost} ・ 配置 {usedSlots} / {maxSlots}
            </p>
          </div>
          <ReceiveAllForm hasReceivable={hasReceivable} />
        </div>

        {facilities.length === 0 ? (
          <p className="mt-6 text-text-muted">設備がありません。</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {facilities.map((f) => (
              <li key={f.id} className="rounded border border-base-border bg-base p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-text-primary">{f.facilityName}</span>
                    <span className="ml-2 text-sm text-text-muted">コスト {f.cost}</span>
                  </div>
                  {f.receivableCycles > 0 && (
                    <span className="text-sm text-brass">
                      受け取り可能: {f.receivableOutputAmount}個（{f.receivableCycles}サイクル）
                    </span>
                  )}
                </div>
                {f.recipe && (
                  <div className="mt-2 text-sm text-text-muted">
                    <span>{f.recipe.cycleMinutes}分ごと</span>
                    {f.recipe.inputs.length > 0 && (
                      <span>
                        {" "}
                        ・ 消費: {f.recipe.inputs.map((i) => `${i.itemName} ${i.amount}`).join(" + ")}
                      </span>
                    )}
                    <span> → {f.recipe.outputItemName} {f.recipe.outputAmount}個</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-text-muted">
          生産チェーン: 川→水 / 浄水→飲料水 / 小麦畑→小麦 / 製粉→小麦粉 / 包装→携帯食料（1時間で100個）
        </p>
      </section>
    </main>
  );
}
