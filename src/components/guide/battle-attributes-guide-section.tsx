// 戦闘の属性とコンボのグラフィカル説明（遊び方ガイド用）
// 元のHTML: public/battle-attributes-guide.html

const ATTRIBUTES = ["圧縮", "切創", "穿孔", "焼損", "凍傷", "侵食"] as const;
const R = 90; // 円の半径（px）。480px以上で 110 にしたい場合は親で --r を上書き可能

function getAttrTransform(index: number): string {
  const angle = -90 + index * 60;
  return `translate(-50%, -50%) rotate(${angle}deg) translateY(-${R}px) rotate(${-angle}deg)`;
}

export function BattleAttributesGuideSection() {
  return (
    <div className="rounded-lg border border-base-border bg-base-elevated p-4 md:p-5 mt-4">
      <h3 className="text-lg font-semibold text-text-primary border-b border-base-border pb-2">
        戦闘の属性とコンボ
      </h3>
      <p className="mt-2 text-sm text-text-muted">
        属性状態を付与して、別スキルで起爆する
      </p>

      <h4 className="text-sm font-medium text-text-primary mt-4 mb-1">基本の6属性</h4>
      <p className="text-sm text-text-muted mb-2">
        攻撃には属性がついています。命中すると相手にその属性の「状態」が付きます。
      </p>

      {/* 6属性を円状に配置（上余白で円のはみ出しが説明文にかからないように） */}
      <div className="flex justify-center pt-8 pb-2">
        <div
          className="relative shrink-0"
          style={{ width: 200, height: 200 }}
        >
          {/* 点線の円 */}
          <div
            className="absolute rounded-full border border-dashed border-base-border opacity-60"
            style={{
              left: "50%",
              top: "50%",
              width: R * 2,
              height: R * 2,
              marginLeft: -R,
              marginTop: -R,
            }}
          />
          {ATTRIBUTES.map((name, i) => (
            <span
              key={name}
              className="absolute left-1/2 top-1/2 flex h-16 w-16 items-center justify-center rounded-full border-2 border-base-border bg-base px-1 text-center text-xs font-semibold text-text-primary shadow-md"
              style={{
                marginLeft: -32,
                marginTop: -32,
                transform: getAttrTransform(i),
              }}
            >
              {name}
            </span>
          ))}
          <span
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-xs text-text-muted"
          >
            6属性
          </span>
        </div>
      </div>

      {/* ステップ1: 付与 */}
      <div className="rounded-lg bg-base border border-base-border p-3 mb-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-xs text-white">
            1
          </span>
          付与
        </h4>
        <p className="text-sm text-text-primary">
          属性付きのスキルを当てると、相手にその属性の<strong>状態</strong>が付与されます。
          例：圧縮属性の攻撃を当てる → 相手は<strong>圧縮状態</strong>に。
        </p>
      </div>

      {/* ステップ2: 起爆 */}
      <div className="rounded-lg bg-base border border-base-border p-3 mb-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-error text-xs text-white">
            2
          </span>
          起爆
        </h4>
        <p className="text-sm text-text-primary mb-3">
          別のスキルで「〇〇状態のとき」にだけ発動する効果を使います。
          倍率アップ・デバフ付与・直撃100%など。状態は消費されるものもあります。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg bg-base-border/30 p-3">
          <span className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white">
            付与
          </span>
          <span className="text-xl text-brass">→</span>
          <span className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white">
            起爆！
          </span>
          <p className="w-full text-center text-xs text-text-muted mt-1">
            例：圧縮付与 → 閃槍で圧縮状態の敵に大ダメージ＋消費
          </p>
        </div>
      </div>

      <p className="text-xs text-text-muted pt-2 border-t border-base-border">
        ※ 極性は7属性目として存在しますが、ここでは基本6種で説明しています。
      </p>
    </div>
  );
}
