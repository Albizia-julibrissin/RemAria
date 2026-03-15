// docs/088_profile_screen_draft.md - 自分のプロフィールへリダイレクト（他プレイヤーは /dashboard/profile/[accountId] で閲覧）

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { userRepository } from "@/server/repositories/user-repository";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const me = await userRepository.findById(session.userId);
  if (!me) redirect("/login");

  redirect(`/dashboard/profile/${encodeURIComponent(me.accountId)}`);
}
