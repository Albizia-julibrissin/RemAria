// 人材局廃止。仲間作成は居住区から。spec/030

import { redirect } from "next/navigation";

export default function RecruitCreatePage() {
  redirect("/dashboard/characters/create");
}
