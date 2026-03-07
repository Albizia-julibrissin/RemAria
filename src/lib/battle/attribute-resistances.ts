/**
 * spec/051: 遺物（および将来の装備）の属性耐性を集約する純粋関数。
 * 戦闘用。run-battle-with-party の AttributeResistances 型を使用。
 */

import type { AttributeResistances } from "./run-battle-with-party";

/**
 * パーティメンバー順の「装着遺物の耐性リスト」から、メンバーごとに属性耐性を乗算で集約する。
 * 戻り値の i 番目は partyMembers[i] の AttributeResistances。
 */
export function mergeAttributeResistancesFromRelics(
  relicsPerMember: { attributeResistances: AttributeResistances | null }[][]
): AttributeResistances[] {
  return relicsPerMember.map((relics) => {
    const merged: AttributeResistances = {};
    for (const r of relics) {
      const ar = r.attributeResistances;
      if (!ar) continue;
      for (const [attr, rate] of Object.entries(ar)) {
        const num = typeof rate === "number" ? rate : 1;
        merged[attr] = (merged[attr] ?? 1) * num;
      }
    }
    return merged;
  });
}
