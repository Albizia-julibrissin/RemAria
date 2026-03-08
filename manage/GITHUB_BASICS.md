# GitHub を「初めて」使う人のための手順（RemAria と Railway 用）

**前提**: ローカルにはすでに Git で管理されている RemAria のフォルダがある。  
**ゴール**: そのコードを GitHub に「上げる」までやって、Railway が「GitHub のこのリポジトリを見てデプロイする」と言えるようにする。

用語は最小限にし、「何をしているか」が分かるように書く。

---

## 1. GitHub って何？ なぜ使うの？

- **GitHub** = コードを置いておく Web 上の場所（クラウドの倉庫のようなもの）。
- **リポジトリ（repo）** = 1 つのプロジェクト用の「入れ物」。RemAria なら「RemAria 用のリポジトリ」が 1 つある、というイメージ。
- **push（プッシュ）** = ローカル（自分の PC）のコードを、GitHub のリポジトリに「送る」こと。
- **なぜ Railway で使うか** = Railway は「GitHub のこのリポジトリの、このブランチを見て、中身を取ってきてビルド・デプロイする」という動きができる。だから「GitHub にコードを push しておく」と、**push するたびに自動でデプロイ**できる。

つまりやることは次の 2 つだけ。

1. **GitHub に「RemAria 用のリポジトリ」を 1 つ作る**
2. **ローカルから「そのリポジトリに push する」**

---

## 2. 用意するもの

- **GitHub のアカウント**  
  - まだなら [github.com](https://github.com) で **Sign up** して無料で作る。
- **ローカルに Git が入っていること**  
  - RemAria がすでに Git で管理されているなら、Git は入っている。
- **ターミナル（コマンドを打つ画面）**  
  - VS Code のターミナル、または PowerShell など。

---

## 3. 手順の流れ（3 ステップ）

```
[GitHub の画面] でリポジトリを 1 つ作る（空でよい）
        ↓
[ローカル] で「このフォルダの先は、その GitHub のリポジトリだよ」と 1 回だけ教える
        ↓
[ローカル] で push する（コードを GitHub に送る）
```

---

## 4. ステップ 1: GitHub でリポジトリを 1 つ作る

1. [github.com](https://github.com) にログインする。
2. 画面右上の **+** をクリック → **New repository** を選ぶ。
3. 次のように入力・選択する。
   - **Repository name**: `RemAria`（ほかの名前でもよい。あとで Railway で「このリポジトリ」を選べばよい）
   - **Description**: 空でよい。
   - **Public** を選ぶ（無料で使うなら Public で問題ない）。
   - **「Add a README file」にチェックを入れない**（ローカルにすでにコードがあるので、空のリポジトリでよい）。
   - **Create repository** をクリックする。
4. 次の画面に **「…or push an existing repository from the command line」** という枠が出る。  
   - ここに書いてある **2 行のコマンド** が、あとで使う「リモートの追加」と「push」の例。  
   - いったんこの画面は開いたままにしておく（または URL をメモする。例: `https://github.com/あなたのユーザー名/RemAria.git`）。

**ここまでで「GitHub に RemAria 用の空の入れ物」ができた状態。**

---

## 5. ステップ 2: ローカルで「先はこの GitHub のリポジトリ」と教える（1 回だけ）

ローカルの RemAria フォルダは、すでに「自分の PC 上の Git リポジトリ」。  
ここに「送り先 = GitHub のあのリポジトリ」を登録する。

1. **RemAria のフォルダを開いた状態で** ターミナルを開く（VS Code なら「ターミナル」メニュー → 「新しいターミナル」など）。
2. 次のコマンドを **1 行ずつ** 打つ（`あなたのユーザー名` と `RemAria` は、GitHub で作ったリポジトリの URL に合わせて書き換える）。

   ```bash
   git remote add origin https://github.com/あなたのユーザー名/RemAria.git
   ```

   - **意味**: 「このプロジェクトの“送り先”の名前を `origin` にして、その中身はこの GitHub の URL だよ」と登録する。
   - すでに `origin` があると言われた場合は、  
     `git remote set-url origin https://github.com/あなたのユーザー名/RemAria.git`  
     に書き換えて実行する。

**これで「push の行き先」の設定は完了。** 次は実際に送る。

---

## 6. ステップ 3: ローカルから GitHub に push する

1. 同じく **RemAria のフォルダで** ターミナルを開いている状態にする。
2. いまのブランチ名を確認する（RemAria では多くの場合 **master** か **main**）。

   ```bash
   git branch
   ```

   - `* master` のように **master** と出たら、次のコマンドは `master` を使う。
   - `* main` と出たら、次のコマンドは `main` を使う。

3. 次のコマンドで **GitHub に送る（push）**。

   **ブランチが master の場合:**

   ```bash
   git push -u origin master
   ```

   **ブランチが main の場合:**

   ```bash
   git push -u origin main
   ```

4. **初回だけ**、GitHub のユーザー名とパスワード（またはトークン）を聞かれることがある。
   - パスワードの代わりに **Personal Access Token** を使うよう言われた場合は、GitHub の **Settings** → **Developer settings** → **Personal access tokens** でトークンを作り、それをパスワードの代わりに入力する。
   - 最近は「パスワードでは push できない」ことが多いので、トークンを作る手順が公式に案内されている。迷ったら「GitHub personal access token 作成」で検索するとよい。

5. 成功すると、GitHub のリポジトリのページを開いたときに、**フォルダやファイルが並んでいる**はず。これで「ローカルのコードが GitHub に上がった」状態。

---

## 7. 2 回目以降の push（日常の流れ）

コードを直したあと、「GitHub にも反映したい」「Railway にデプロイしたい」ときは、次の 2 つをやる。

1. **変更をコミットする**（いつも通り）

   ```bash
   git add .
   git commit -m "〇〇を修正した"
   ```

2. **GitHub に送る（push）**

   ```bash
   git push
   ```

   - 初回で `-u origin master`（または `main`）を打っていれば、2 回目以降は **`git push` だけ** でよい。

Railway で「この GitHub のリポジトリ」を連携しておけば、**push するたびに自動でデプロイ**される。

---

## 8. Railway とのつなぎ方（思い出し用）

1. [railway.com](https://railway.com) で **Sign in with GitHub** する。
2. **New Project** → **Deploy from GitHub repo** を選ぶ。
3. 一覧から **RemAria**（さっき push したリポジトリ）を選ぶ。
4. あとは [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) の「あなたがやること」のとおりに、PostgreSQL の追加・環境変数・マイグレーション・シード・ドメイン発行を進める。

---

## 9. よくあるつまずき

| 症状 | やること |
|------|----------|
| `git push` で「Permission denied」や「Authentication failed」 | GitHub の認証になっていない。**Personal Access Token** を作り、パスワードの代わりにそのトークンを入力する。 |
| `origin` を追加しようとしたら「already exists」 | すでに `origin` が登録されている。`git remote set-url origin https://github.com/あなたのユーザー名/RemAria.git` で URL を書き換える。 |
| ブランチ名が分からない | `git branch` で `*` が付いているのが今のブランチ。`* master` なら master、`* main` なら main で push する。 |
| 「Add a README」にチェックを入れてリポジトリを作ってしまった | そのままでもよい。最初の `git push` のときに「リモートに README だけあるので、まず pull してから push して」と言われることがある。そのときは `git pull origin master --allow-unrelated-histories`（または `main`）を実行してから、もう一度 `git push` する。 |

---

## 参照

- Railway でデプロイする手順（GitHub 連携の場合）: [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md)
- manage フォルダの一覧: [README.md](./README.md)
