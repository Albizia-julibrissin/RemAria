-- docs/15: 設備タグ・設備種別・工業スキル効果
-- 1. Tag, FacilityType, FacilityTypeTag を新規作成
-- 2. Skill, CharacterSkill が未作成のためここで CREATE（spec/030 で追加されたがマイグレーションがなかった）
-- 3. Skill は効果カラム込みで作成（effectType, effectValue, targetTagId）

-- CreateTable Tag
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tag_code_key" ON "Tag"("code");
CREATE INDEX "Tag_code_idx" ON "Tag"("code");

-- CreateTable FacilityType
CREATE TABLE "FacilityType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FacilityType_name_key" ON "FacilityType"("name");
CREATE INDEX "FacilityType_name_idx" ON "FacilityType"("name");

-- CreateTable FacilityTypeTag
CREATE TABLE "FacilityTypeTag" (
    "id" TEXT NOT NULL,
    "facilityTypeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacilityTypeTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FacilityTypeTag_facilityTypeId_tagId_key" ON "FacilityTypeTag"("facilityTypeId", "tagId");
CREATE INDEX "FacilityTypeTag_facilityTypeId_idx" ON "FacilityTypeTag"("facilityTypeId");
CREATE INDEX "FacilityTypeTag_tagId_idx" ON "FacilityTypeTag"("tagId");

ALTER TABLE "FacilityTypeTag" ADD CONSTRAINT "FacilityTypeTag_facilityTypeId_fkey" FOREIGN KEY ("facilityTypeId") REFERENCES "FacilityType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacilityTypeTag" ADD CONSTRAINT "FacilityTypeTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable Skill（spec/030 で追加。既存 DB に Skill がある場合は手動でスキップするか、IF NOT EXISTS は使わず本マイグレーションを 1 回だけ適用する想定）
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "effectType" TEXT,
    "effectValue" INTEGER,
    "targetTagId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Skill_name_category_key" ON "Skill"("name", "category");
CREATE INDEX "Skill_category_idx" ON "Skill"("category");
CREATE INDEX "Skill_targetTagId_idx" ON "Skill"("targetTagId");

ALTER TABLE "Skill" ADD CONSTRAINT "Skill_targetTagId_fkey" FOREIGN KEY ("targetTagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable CharacterSkill
CREATE TABLE "CharacterSkill" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterSkill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterSkill_characterId_skillId_key" ON "CharacterSkill"("characterId", "skillId");
CREATE INDEX "CharacterSkill_characterId_idx" ON "CharacterSkill"("characterId");
CREATE INDEX "CharacterSkill_skillId_idx" ON "CharacterSkill"("skillId");

ALTER TABLE "CharacterSkill" ADD CONSTRAINT "CharacterSkill_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterSkill" ADD CONSTRAINT "CharacterSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
