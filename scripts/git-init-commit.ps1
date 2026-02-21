# 初回 Git コミット用スクリプト
# Cursor のターミナルで、プロジェクトフォルダを開いた状態で実行:
#   .\scripts\git-init-commit.ps1

# プロジェクトルートに移動（スクリプトは scripts/ 内にある）
Set-Location (Split-Path $PSScriptRoot -Parent)

# まだ初期化していない場合
if (-not (Test-Path .git)) {
    git init
}

git add .
git status
git commit -m "Initial commit: 開発環境構築・DB準備・認証spec"

Write-Host "`n完了しました。" -ForegroundColor Green
