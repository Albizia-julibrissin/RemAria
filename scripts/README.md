# スクリプト

## fix-test-mech-stats.ts（一時・1回のみ）

テストユーザー(test1)のメカの基礎ステを CAP560・オール80 に揃える。過去のテストでずれた場合の修正用。

```bash
npx tsx scripts/fix-test-mech-stats.ts
```

## git-init-commit.ps1

初回の Git コミットを実行するスクリプト。

**使い方**（Cursor のターミナルで、プロジェクトフォルダが開いている状態）:

```powershell
.\scripts\git-init-commit.ps1
```

または、手動で:

```powershell
git init
git add .
git commit -m "Initial commit: 開発環境構築・DB準備・認証spec"
```
