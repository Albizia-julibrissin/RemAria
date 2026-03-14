// spec/035, 036, 047 - 工業・全設備一括受け取り・建設・解体

import Link from "next/link";
import { getIndustrial } from "@/server/actions/initial-area";
import { getUnlockedFacilityTypes } from "@/server/actions/facilities-placement";
import { MenuPageHeaderClient } from "../menu-page-header-client";
import { ReceiveAllForm } from "./receive-all-form";
import { PlaceFacilityForm } from "./place-facility-form";
import { FacilityRow } from "./facility-row";

const FACILITIES_DESCRIPTION =
  "設備配置と生産の管理。設備の確認・生産の受け取り（全設備一括・最大24時間分）。";

export default async function FacilitiesPage() {
  const [data, unlockedTypes] = await Promise.all([
    getIndustrial(),
    getUnlockedFacilityTypes(),
  ]);

  if (!data) {
    return (
      <main className="min-h-screen bg-base p-8">
        <MenuPageHeaderClient
          title="機工区"
          description={FACILITIES_DESCRIPTION}
          currentPath="/dashboard/facilities"
        />
        <p className="text-text-muted">ログインしてください。</p>
        <Link href="/login" className="mt-4 inline-block text-brass hover:underline">
          ログインへ
        </Link>
        <footer className="mt-8 pt-4 border-t border-base-border">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-brass hover:bg-base focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          >
            ← 開拓拠点に戻る
          </Link>
        </footer>
      </main>
    );
  }

  const { maxSlots, maxCost, usedSlots, usedCost, facilities } = data;
  const hasReceivable = facilities.some((f) => f.receivableCycles > 0);

  return (
    <main className="min-h-screen bg-base p-8">
      <MenuPageHeaderClient
        title="機工区"
        description={FACILITIES_DESCRIPTION}
        currentPath="/dashboard/facilities"
      />

      <section id="operating-facilities" className="rounded-lg border border-base-border bg-base-elevated p-6 max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-text-primary">
              稼働設備
              <a href="#facility-build" className="ml-2 text-sm text-brass hover:text-brass-hover">
                設備建造へ →
              </a>
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              稼働中コスト <span className="text-success">{usedCost}</span> / <span className="text-success">{maxCost}</span>
              {"　"}
              稼働設備数 <span className="text-success">{usedSlots}</span> / <span className="text-success">{maxSlots}</span>
            </p>
          </div>
          <ReceiveAllForm hasReceivable={hasReceivable} />
        </div>

        {facilities.length === 0 ? (
          <p className="mt-6 text-text-muted">稼働設備がありません。</p>
        ) : (
          <ul className="mt-6 space-y-2">
            {facilities.map((f) => (
              <FacilityRow key={f.id} facility={f} />
            ))}
          </ul>
        )}
      </section>

      <PlaceFacilityForm
        unlockedTypes={unlockedTypes ?? []}
        usedSlots={usedSlots}
        maxSlots={maxSlots}
        usedCost={usedCost}
        maxCost={maxCost}
      />

      <footer className="mt-8 pt-4 border-t border-base-border">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-brass hover:bg-base focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          ← 開拓拠点に戻る
        </Link>
      </footer>
    </main>
  );
}
