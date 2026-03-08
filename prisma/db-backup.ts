/**
 * 現在の DB をバックアップする。
 * 実行: npm run db:backup
 * 出力: manage/backups/remaria_YYYYMMDD_HHmmss.dump
 *
 * pg_dump が PATH にない場合は、Docker の db コンテナ内の pg_dump を使用する。
 */
import * as fs from "fs";
import * as path from "path";
import { execSync, type ExecSyncOptions } from "child_process";

function loadEnv(): void {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

function parseDatabaseUrl(url: string): { user: string; db: string } | null {
  try {
    const u = new URL(url);
    const user = u.username || "remaria";
    const db = u.pathname?.replace(/^\//, "") || "remaria";
    return { user, db };
  } catch {
    return null;
  }
}

function main(): void {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL が設定されていません。.env を確認してください。");
    process.exit(1);
  }

  const backupsDir = path.join(__dirname, "..", "manage", "backups");
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .slice(0, 15);
  const outFile = path.join(backupsDir, `remaria_${timestamp}.dump`);

  // 1) ホストの pg_dump を試す（Node 型で shell が string のみの overload があるため unknown 経由でアサーション）
  const execOptsPipe = { stdio: "pipe" as const, shell: true } as unknown as ExecSyncOptions;
  try {
    execSync(`pg_dump "${url}" -Fc -f "${outFile}"`, execOptsPipe);
    console.log(`Backup written: ${outFile}`);
    return;
  } catch {
    // pg_dump が無い or 失敗 → Docker を試す
  }

  // 2) Docker コンテナ内の pg_dump を使う（compose またはコンテナ名で実行）
  const parsed = parseDatabaseUrl(url);
  if (!parsed) {
    console.error("DATABASE_URL の形式が不正です。");
    process.exit(1);
  }
  const { user, db } = parsed;
  const rootDir = path.join(__dirname, "..");
  const execOptsInherit = { stdio: "inherit" as const, shell: true } as unknown as ExecSyncOptions;
  const runInDocker = (composeCmd: string): boolean => {
    try {
      execSync(
        `${composeCmd} -T db pg_dump -U ${user} -Fc ${db} > "${outFile}"`,
        { ...execOptsInherit, cwd: rootDir }
      );
      return true;
    } catch {
      return false;
    }
  };
  if (runInDocker("docker compose exec") || runInDocker("docker-compose exec")) {
    console.log(`Backup written: ${outFile}`);
    return;
  }
  // 3) コンテナ名で直接実行（remaria-db は docker-compose.yml の container_name）
  try {
    execSync(
      `docker exec remaria-db pg_dump -U ${user} -Fc ${db} -f /tmp/remaria_backup.dump`,
      execOptsInherit
    );
    execSync(`docker cp remaria-db:/tmp/remaria_backup.dump "${outFile}"`, execOptsInherit);
    execSync("docker exec remaria-db rm /tmp/remaria_backup.dump", execOptsPipe);
    console.log(`Backup written: ${outFile}`);
  } catch (e) {
    console.error(
      "バックアップに失敗しました。PostgreSQL クライアント (pg_dump) をインストールするか、Docker で db コンテナ (remaria-db) が起動しているか確認してください。"
    );
    process.exit(1);
  }
}

main();
