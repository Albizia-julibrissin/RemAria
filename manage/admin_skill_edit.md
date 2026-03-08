# スキル編集（管理者用）

Skill の名前・表示用項目・戦闘スキル用項目と、**既存の effectType に限定した**スキル効果の編集。spec/038、docs/042。

- **実装**: `src/server/actions/admin.ts`、`src/lib/constants/skill-effect-types.ts`（効果の説明）、`src/app/dashboard/admin/skills/`。

---

## 1. 目的・前提

- **目的**: スキルの名前・category・戦闘用パラメータ（powerMultiplier, targetScope 等）を運用で変更できるようにする。効果（SkillEffect）は**既に DB に存在する effectType だけ**を選択可能とし、新規 effectType の追加はコード・042 に任せる。
- **前提**: テストユーザー1のみ。

---

## 2. 画面・操作

| 項目 | 内容 |
|------|------|
| **一覧** | `/dashboard/admin/skills`。name / category / battleSkillType。「編集」で編集画面へ。 |
| **編集** | `/dashboard/admin/skills/[id]`。基本・戦闘用項目・スキル効果（effectType 選択＋param JSON）。「効果タイプの説明一覧」で docs/042 ベースの説明を表示。 |
| **入口** | コンテンツ管理のスキルセクション「スキル編集」リンク。 |

---

## 3. 効果タイプの制限

- **選択できる effectType**: DB の `SkillEffect` に 1 件以上存在する `effectType` のみ。新規 effectType は選べない。
- **効果の説明**: `src/lib/constants/skill-effect-types.ts` に effectType ごとの短いラベル・説明を定義。編集画面で選択時に説明を表示し、「効果タイプの説明一覧」で全件参照可能。新規 effectType をコードで追加したときはここにも 1 行追加する。

---

## 4. API（Server Actions）

| 関数名 | 役割 |
|--------|------|
| `getAdminSkillList()` | 一覧（id, name, category, battleSkillType）。 |
| `getExistingSkillEffectTypes()` | 選択可能な効果タイプ（DB に存在する effectType ＋ ラベル・説明）。 |
| `getAdminSkillEditData(skillId)` | 編集用（skill, skillEffects, effectTypeOptions, effectTypeInfo）。 |
| `updateAdminSkill(skillId, input)` | スキル更新＋効果の一括置き換え。effectType は既存のみ受け付ける。 |

---

## 5. 運用メモ

- 効果の param は JSON で編集。不正な JSON の場合は保存時にエラー。
- 新規 effectType を追加する場合は、docs/042 の手順に従い、`skill-effect-types.ts` と run-battle-with-party を更新したうえで、seed 等で一度その effectType を DB に登録すると、管理画面の選択肢に出現する。
