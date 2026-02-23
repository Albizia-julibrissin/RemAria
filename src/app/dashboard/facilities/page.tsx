// spec/035, docs/019 - 工業エリア・設置エリア選択と受け取り

import Link from "next/link";
import { getFacilitiesPageData } from "@/server/actions/initial-area";
import { receiveProduction } from "@/server/actions/receive-production";
import { AreaSelect } from "./area-select";
import { FacilitiesReceiveForm } from "./facilities-receive-form";

type Props = { searchParams: Promise<{ area?: string }> };

export default async function FacilitiesPage({ searchParams }: Props) {
  const { area: areaParam } = await searchParams;
  const data = await getFacilitiesPageData(areaParam ?? undefined);

  if (!data) {
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">工業エリア</h1>
        <p className="mt-4 text-text-muted">ログインしてください。</p>
        <Link href="/login" className="mt-4 inline-block text-brass hover:underline">
          ログインへ
        </Link>
      </main>
    );
  }

  const { availableAreas, selectedAreaCode, currentArea } = data;
  const { placementArea, facilities, usedCost, usedSlots } = currentArea;
  const isInitialArea = selectedAreaCode === "initial";

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
      <h1 className="text-2xl font-bold text-text-primary">工業エリア</h1>
      <p className="mt-2 text-text-muted">
        設置エリアを選んで設備の確認・受け取りができます。受け取りは最大24時間分まで（docs/019）。
        <Link href="/dashboard/warehouse" className="ml-2 text-brass hover:underline">
          倉庫で所持数を確認
        </Link>
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <AreaSelect availableAreas={availableAreas} currentCode={selectedAreaCode} />
      </div>

      <section className="mt-8 rounded-lg border border-base-border bg-base-elevated p-6 max-w-2xl">
        <h2 className="text-lg font-medium text-text-primary">{placementArea.name}</h2>
        <p className="mt-2 text-sm text-text-muted">
          コスト {usedCost} / {placementArea.maxCost} ・ 配置 {usedSlots} / {placementArea.maxSlots}
        </p>
        {facilities.length === 0 ? (
          <p className="mt-6 text-text-muted">このエリアにはまだ設備がありません。</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {facilities.map((f) => (
              <li
                key={f.id}
                className="rounded border border-base-border bg-base p-4"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-text-primary">{f.facilityName}</span>
                    <span className="ml-2 text-sm text-text-muted">コスト {f.cost}</span>
                  </div>
                  <FacilitiesReceiveForm
                    facilityInstanceId={f.id}
                    facilityName={f.facilityName}
                    receivableCycles={f.receivableCycles}
                    receivableOutputAmount={f.receivableOutputAmount}
                    outputItemName={f.recipe?.outputItemName}
                    receiveAction={receiveProduction}
                  />
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
                    {f.receivableCycles > 0 && (
                      <span className="ml-2 text-brass">
                        ・ 受け取り可能: {f.receivableOutputAmount}個（{f.receivableCycles}サイクル）
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {isInitialArea && (
          <p className="mt-4 text-xs text-text-muted">
            生産チェーン: 川→水 / 浄水→飲料水 / 小麦畑→小麦 / 製粉→小麦粉 / 包装→携帯食料（1時間で100個）
          </p>
        )}
      </section>
    </main>
  );
}
