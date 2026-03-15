// docs/088_profile_screen_draft.md - 開拓者証（他プレイヤーも閲覧可能）。名前・戦闘力・HP・MP・称号。本人のみ称号脱着。

import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTitleList } from "@/server/actions/titles";
import { userRepository } from "@/server/repositories/user-repository";
import { getCharacterBattleStats } from "@/server/lib/character-battle-stats";
import { MenuPageHeaderClient } from "../../menu-page-header-client";
import { ProfileTitleSection } from "./profile-title-section";

const footerLinkClass =
  "inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-brass hover:bg-base focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base";

export default async function ProfileByAccountIdPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const session = await getSession();
  const profile = await userRepository.findPublicProfileByAccountId(accountId);
  if (!profile) notFound();

  const isOwnProfile = session?.userId !== undefined && profile.id === session.userId;
  const equippedTitleName = profile.selectedTitle?.name ?? null;

  const battleStats =
    profile.protagonistCharacterId != null
      ? await getCharacterBattleStats(profile.protagonistCharacterId, profile.id)
      : null;

  let titleListResult: Awaited<ReturnType<typeof getTitleList>> | null = null;
  if (isOwnProfile) {
    titleListResult = await getTitleList();
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <MenuPageHeaderClient
        title={isOwnProfile ? "開拓者証（あなた）" : `${profile.name} の開拓者証`}
        description="表示名・称号などのアカウント情報"
        currentPath="/dashboard/profile"
      />
      <section className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded border border-base-border bg-base">
            {profile.protagonistCharacter?.iconFilename ? (
              <img
                src={`/icons/${profile.protagonistCharacter.iconFilename}`}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="h-full w-full bg-base-border" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-text-primary">{profile.name}</p>
            <p className="text-sm text-text-muted">@{profile.accountId}</p>
            {battleStats && (
              <div className="mt-3">
                <p className="text-sm font-medium text-text-primary tabular-nums">
                  戦闘力 {battleStats.combatPower.toLocaleString()}
                </p>
                <p className="mt-1 text-sm tabular-nums">
                  <span className="text-text-muted">HP </span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {battleStats.derived.HP.toLocaleString()}
                  </span>
                  <span className="text-text-muted"> MP </span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {battleStats.derived.MP.toLocaleString()}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
        <ProfileTitleSection
          equippedTitleName={equippedTitleName}
          isOwnProfile={isOwnProfile}
          titles={titleListResult?.success ? titleListResult.titles : undefined}
          equippedTitleId={titleListResult?.success ? titleListResult.equippedTitleId : undefined}
        />
      </section>
      <footer className="mt-8 border-t border-base-border pt-4">
        <Link href="/dashboard" className={footerLinkClass}>
          ← 開拓拠点に戻る
        </Link>
      </footer>
    </main>
  );
}
