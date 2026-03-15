// docs/090_terms_of_service.md - RE:mAria 利用規約（表示正本）

import Link from "next/link";

export const metadata = {
  title: "利用規約 | RE:mAria",
  description: "RE:mAria 利用規約",
};

export default function TermsPage() {
  return (
    <main className="flex-1 max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-text-primary mb-2">RE:mAria 利用規約</h1>
      <p className="text-sm text-text-muted mb-8">最終更新：2025年3月（施行日は初回公開日とします）</p>

      <article className="prose prose-invert max-w-none text-text-primary space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-text-primary mt-6 mb-2">第1条（適用）</h2>
          <p className="text-text-primary/90">
            本利用規約（以下「本規約」）は、RE:mAria（以下「本サービス」）の利用条件を定めるものです。
            ユーザーは、本規約に同意した上で本サービスを利用するものとします。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mt-6 mb-2">第2条（アカウント）</h2>
          <p className="text-text-primary/90">
            ユーザーは、自己の責任においてアカウントを管理するものとします。
            アカウントの貸与・譲渡・共有は禁止します。
            運営が不適切と判断した場合、アカウントの利用を停止することがあります。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mt-6 mb-2">第3条（禁止事項）</h2>
          <p className="text-text-primary/90 mb-2">ユーザーは以下の行為を行ってはなりません。</p>
          <ul className="list-disc pl-6 space-y-1 text-text-primary/90">
            <li>不正ツール、BOT、マクロ等による自動操作</li>
            <li>ゲームの不具合（バグ）を意図的に利用する行為</li>
            <li>サーバーやシステムに過度な負荷を与える行為</li>
            <li>他プレイヤーへの嫌がらせや迷惑行為</li>
            <li>リアルマネートレード（RMT）</li>
            <li>運営が不適切と判断する行為</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mt-6 mb-2">第4条（ゲームデータ）</h2>
          <p className="text-text-primary/90">
            ゲーム内データ、アイテム、キャラクター、通貨などのすべてのデータの権利は運営に帰属します。
            ユーザーはそれらを利用する権利のみを持ち、所有権を有するものではありません。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mt-6 mb-2">第5条（サービス内容の変更）</h2>
          <p className="text-text-primary/90">
            運営は、本サービスの内容を予告なく変更、追加、削除することができます。
            ゲームバランス調整や機能変更が行われる場合があります。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mt-6 mb-2">第6条（データの消失）</h2>
          <p className="text-text-primary/90">
            サーバー障害、バグ、メンテナンス、その他の理由によりゲームデータが消失する可能性があります。
            運営はデータの完全な保存を保証するものではありません。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mt-6 mb-2">第7条（アカウント停止）</h2>
          <p className="text-text-primary/90">
            ユーザーが本規約に違反した場合、運営は事前の通知なくアカウントの停止または削除を行うことができます。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mt-6 mb-2">第8条（課金要素）</h2>
          <p className="text-text-primary/90">
            ゲーム内で購入されたデジタルコンテンツは、法令に基づく場合を除き返金できません。
            購入されたコンテンツはアカウントに紐づく利用権です。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mt-6 mb-2">第9条（プレイヤー間取引）</h2>
          <p className="text-text-primary/90">
            プレイヤー間取引や市場機能による取引について、運営はその結果を保証するものではありません。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mt-6 mb-2">第10条（テストサービス）</h2>
          <p className="text-text-primary/90">
            本サービスはテスト段階で提供される場合があります。
            その場合、ゲームデータの削除やリセットが行われる可能性があります。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mt-6 mb-2">第11条（知的財産権）</h2>
          <p className="text-text-primary/90">
            本サービスに関するすべての著作権および知的財産権は運営に帰属します。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mt-6 mb-2">第12条（規約変更）</h2>
          <p className="text-text-primary/90">
            運営は必要に応じて本規約を変更することができます。
            重要な変更の場合は、サービス内で通知することがあります。
            変更後にユーザーがサービスを利用した場合、変更後の規約に同意したものとみなします。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mt-6 mb-2">お問い合わせ</h2>
          <p className="text-text-primary/90">
            本規約に関するお問い合わせは、運営が指定する方法で受け付けます。
          </p>
        </section>
      </article>

      <p className="mt-10 text-center">
        <Link href="/" className="text-brass hover:text-brass-hover underline text-sm">
          トップへ戻る
        </Link>
      </p>
    </main>
  );
}
