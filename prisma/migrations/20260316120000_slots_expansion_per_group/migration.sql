-- spec/089: 設備設置上限拡張をグループごとに変更。グローバル設定を廃止。

-- ResearchGroup にスロット拡張用3カラム追加
ALTER TABLE "ResearchGroup" ADD COLUMN     "facilitySlotsExpansionLimit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "facilitySlotsExpansionAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "facilitySlotsExpansionResearchPoint" INTEGER NOT NULL DEFAULT 0;

-- ユーザーごと・グループごとの設置上限拡張回数
CREATE TABLE "UserResearchGroupSlotsExpansion" (
    "userId" TEXT NOT NULL,
    "researchGroupId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserResearchGroupSlotsExpansion_pkey" PRIMARY KEY ("userId","researchGroupId")
);

CREATE INDEX "UserResearchGroupSlotsExpansion_userId_idx" ON "UserResearchGroupSlotsExpansion"("userId");

ALTER TABLE "UserResearchGroupSlotsExpansion" ADD CONSTRAINT "UserResearchGroupSlotsExpansion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserResearchGroupSlotsExpansion" ADD CONSTRAINT "UserResearchGroupSlotsExpansion_researchGroupId_fkey" FOREIGN KEY ("researchGroupId") REFERENCES "ResearchGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- User のグローバル拡張回数カラムを削除（枠数は industrialMaxSlots に既に反映済みのためデータ移行不要）
ALTER TABLE "User" DROP COLUMN IF EXISTS "industrialSlotsExpansionCount";

-- グローバル設定テーブルを削除
DROP TABLE IF EXISTS "FacilitySlotsExpansionSetting";
