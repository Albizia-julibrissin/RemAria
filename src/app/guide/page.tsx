// 遊び方ガイド（プレイヤー向け）
// 文面の正本: docs/056_how_to_play_guide.md
// docs/07_ui_guidelines 準拠

import Link from "next/link";

const menuItems: { href: string; label: string; desc: string; wip?: boolean }[] = [
  { href: "/dashboard", label: "ダッシュボード", desc: "探索の開始・進行中探索の続き・メニューへの入口。作戦室へのショートカット。" },
  { href: "/dashboard/characters", label: "居住区", desc: "キャラクター一覧・詳細。ステータス割り振り・装備・遺物の装着・スキルレベル。" },
  { href: "/dashboard/recruit", label: "人材局", desc: "仲間の雇用・解雇。" },
  { href: "/dashboard/facilities", label: "機工区", desc: "設備の配置・製造一括受け取り・建設・解体。" },
  { href: "/dashboard/research", label: "研究局", desc: "設備やレシピの解放（研究グループ・研究ポイント）。" },
  { href: "/dashboard/craft", label: "工房", desc: "装備・消耗品・メカパーツの製作。" },
  { href: "/dashboard/bag", label: "物資庫", desc: "所持アイテムの確認（種別タブ：資源・装備・遺物・スキル分析書など）。" },
  { href: "/dashboard/quests", label: "開拓任務", desc: "ストーリー・研究クエストの進捗と達成。", wip: true },
  { href: "/dashboard/tactics", label: "作戦室", desc: "パーティプリセットの作成・編集。各プリセットの「作戦スロット」で、条件とスキルを設定。" },
];

const terms: { term: string; desc: string }[] = [
  { term: "アカウントキャラ（主人公）", desc: "プレイヤー本人のキャラ。1アカウント1体。" },
  { term: "仲間", desc: "人材局で雇うパーティ枠のキャラ。1体まで所持。" },
  { term: "メカ", desc: "追従する機械ユニット。パーツでスキル・性能が変わる。" },
  { term: "遺物", desc: "探索で入手するハクスラ系装備。4枠まで装着可。" },
  { term: "作戦 / 作戦スロット", desc: "戦闘時に「条件に合ったらこのスキルを使う」とあらかじめ設定するルール。" },
  { term: "パーティプリセット", desc: "探索に連れていく3体の組み合わせと、その作戦をまとめたもの。" },
  { term: "CAP", desc: "レベルに応じて増える総合ポイント。ステータス割り振りのもと。" },
];

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-base p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary">遊び方ガイド</h1>
        <p className="mt-2 text-sm text-text-muted">
          RE:mAria の基本の流れと画面の説明です。
        </p>

        <div className="mt-4 rounded-lg border border-base-border bg-base-elevated px-4 py-3 text-sm text-text-primary">
          <p className="font-medium text-text-muted mb-1">実装状況</p>
          <ul className="list-disc list-inside space-y-0.5 text-text-muted">
            <li><strong className="text-text-primary">クエスト</strong>：進捗・達成画面はありますが、<strong className="text-text-primary">実装途中</strong>です。仕様の拡張や表示の調整が行われる可能性があります。</li>
            <li><strong className="text-text-primary">チャット</strong>：投稿・閲覧は利用可能です。<strong className="text-text-primary">ミュート・ブロック・通報</strong>は<strong className="text-text-primary">未実装</strong>で、実装予定です。</li>
          </ul>
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-text-primary border-b border-base-border pb-2">1. このゲームについて</h2>
          <p className="mt-3 text-text-primary">
            <strong>RE:mAria</strong> は、スチームパンク × ハイファンタジーの世界で、
            <strong>あなた（アカウントキャラ）・仲間1体・追従メカ1体</strong> の三人で探索と育成・工業を回すゲームです。
          </p>
          <ul className="mt-3 list-disc list-inside space-y-1 text-text-primary text-sm">
            <li><strong>戦闘はログのみ</strong>：キャラは自動で戦います。プレイヤーは戦闘前に「作戦」を組み、結果をログで確認します。</li>
            <li><strong>操作より準備が主役</strong>：装備・作戦・設備を整えてから探索に出撃し、素材や遺物を集めてさらに強くするループが中心です。</li>
            <li><strong>チャット</strong>：画面下部のチャットで、他のプレイヤーと雑談や情報交換ができます（ゲーム進行には必須ではありません）。</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-text-primary border-b border-base-border pb-2">2. 1日の基本の流れ（推奨ループ）</h2>
          <ol className="mt-3 list-decimal list-inside space-y-2 text-text-primary text-sm">
            <li><strong>ログイン</strong> → ダッシュボードを開く。</li>
            <li><strong>製造の受け取り</strong>：機工区で、完了した製造を「一括受け取り」する。</li>
            <li><strong>探索に出撃</strong>：ダッシュボードの「探索」で、テーマ・エリア・パーティプリセット・持ち込み消耗品を選んで「探索を開始」。戦闘や技能イベントが発生したら、画面の指示に従って「次へ」を押して進める。</li>
            <li><strong>帰還</strong>：探索を終えたら「帰還」で報酬（素材・遺物・経験値など）を受け取る。</li>
            <li><strong>育成の見直し</strong>：レベルアップしている場合は「居住区」でキャラを選び、ステータス割り振りをする。装備や遺物の変更もここで。</li>
            <li><strong>作戦の確認</strong>：「作戦室」でパーティプリセットと作戦スロット（誰がどの条件でどのスキルを使うか）を設定する。</li>
            <li><strong>工業で次の製造を依頼</strong>：クラフトで装備・消耗品を、機工区で設備の建設・製造を依頼してからログアウト。</li>
          </ol>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-text-primary border-b border-base-border pb-2">3. 主な画面とメニュー</h2>
          <ul className="mt-3 space-y-2">
            {menuItems.map(({ href, label, desc, wip }) => (
              <li key={href} className="rounded-lg border border-base-border bg-base-elevated p-3">
                <span className="inline-flex items-center gap-2">
                  <Link href={href} className="font-medium text-brass hover:text-brass-hover">
                    {label}
                  </Link>
                  {wip && (
                    <span className="text-xs px-2 py-0.5 rounded bg-base-border text-text-muted">実装途中</span>
                  )}
                </span>
                <p className="mt-1 text-sm text-text-muted">{desc}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-text-primary border-b border-base-border pb-2">4. 探索の流れ（ざっくり）</h2>
          <ol className="mt-3 list-decimal list-inside space-y-2 text-text-primary text-sm">
            <li>ダッシュボードで <strong>テーマ・エリア</strong> を選び、<strong>パーティプリセット</strong>（誰を連れていくか）と <strong>持ち込み消耗品</strong> を選択して「探索を開始」。</li>
            <li>探索画面に移ったら、<strong>技能判定</strong>や<strong>戦闘</strong>が順に発生します。戦闘は自動で進行し、ログで経過を確認。HP/MP は戦闘をまたいで持ち越されます。</li>
            <li>規定回数の戦闘のあと、「強敵に挑む」→ 勝利すると「領域主に挑む」のチャンスが出る場合があります。</li>
            <li>「帰還」を選ぶと探索終了。<strong>報酬画面</strong>でドロップ（素材・遺物など）と経験値を確認し、受け取ってダッシュボードに戻ります。</li>
          </ol>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-text-primary border-b border-base-border pb-2">5. 戦闘と作戦</h2>
          <ul className="mt-3 list-disc list-inside space-y-1 text-text-primary text-sm">
            <li>戦闘中は<strong>操作できません</strong>。あらかじめ <Link href="/dashboard/tactics" className="text-brass hover:text-brass-hover">作戦室</Link> で設定した「作戦スロット」（例：HP50%以下なら回復スキル、そうでなければ攻撃スキル）に従って、キャラが自動で行動します。</li>
            <li>作戦は <strong>パーティプリセット</strong> ごとに設定します。探索開始時に選んだプリセットの作戦が、その探索の戦闘で使われます。</li>
            <li>スキルはキャラ・メカパーツごとに決まっています。装備やメカパーツを変えると使えるスキルも変わります。</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-text-primary border-b border-base-border pb-2">6. 育成のポイント</h2>
          <ul className="mt-3 list-disc list-inside space-y-1 text-text-primary text-sm">
            <li><strong>レベルアップ</strong>：探索やクエストで経験値を得るとレベルが上がり、<strong>CAP（総合ポイント）</strong> が増えます。増えた分の一部は自動でステータスに振られ、残りは <Link href="/dashboard/characters" className="text-brass hover:text-brass-hover">居住区 → キャラ詳細</Link> で手動で割り振れます（各ステには上限・下限あり）。</li>
            <li><strong>装備</strong>：クラフトで装備を製作し、居住区のキャラ詳細で装着。武器・防具など枠ごとに装備可能。</li>
            <li><strong>遺物</strong>：探索で手に入る「遺物」は最大4枠まで装着可能。鑑定後に装着し、戦闘での耐性などに影響します。</li>
            <li><strong>スキル分析書</strong>：倉庫の「スキル分析書」タブで使用し、対象キャラに渡すとスキル習得・スキルレベルアップに使えます。</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-text-primary border-b border-base-border pb-2">7. 用語の整理</h2>
          <dl className="mt-3 space-y-2">
            {terms.map(({ term, desc }) => (
              <div key={term} className="flex flex-col sm:flex-row sm:gap-3 border-b border-base-border pb-2 last:border-0">
                <dt className="font-medium text-text-primary shrink-0 sm:w-48">{term}</dt>
                <dd className="text-sm text-text-muted">{desc}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-text-primary border-b border-base-border pb-2">8. 困ったときは</h2>
          <ul className="mt-3 list-disc list-inside space-y-1 text-text-primary text-sm">
            <li><strong>進行中の探索をやめたい</strong>：ダッシュボードの「進行中の探索」から「探索を中止」を選べます（報酬は受け取れません）。</li>
            <li><strong>チャットのマナー</strong>：他プレイヤーへの誹謗中傷は控え、運営の注意に従ってください。ミュート・ブロック・通報機能は未実装です（実装予定）。</li>
            <li><strong>不具合や要望</strong>：運営の案内に従って問い合わせてください。</li>
          </ul>
        </section>

        <p className="mt-10 text-xs text-text-muted">
          このガイドはゲームの仕様に合わせて随時更新されます。
        </p>
      </div>
    </main>
  );
}
