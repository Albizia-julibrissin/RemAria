/**
 * バックアップから DB を復元する。
 *
 * 実行例:
 *   npm run db:restore
 *   npm run db:restore -- manage/backups/remaria_20250101.dump
 *   npm run db:restore -- --target "postgresql://user:pass@localhost:5432/remaria_restore"
 *   npm run db:restore -- --target "postgresql://..." manage/backups/remaria_20250101.dump
 *
 * --target <URL> を指定すると、その URL の DB にだけ復元する（上書きしない）。
 * 対象 DB はあらかじめ作成しておくこと。
 */
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

function loadEnv(): void {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

function parseArgs(): { dumpPath: string; targetUrl: string | null } {
  const args = process.argv.slice(2);
  let targetUrl: string | null = process.env.RESTORE_TARGET_URL ?? null;
  const fileArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--target" && args[i + 1]) {
      targetUrl = args[i + 1];
      i++;
    } else if (args[i] && !args[i].startsWith("--")) {
      if (args[i].startsWith("postgresql://") || args[i].startsWith("postgres://")) {
        targetUrl = args[i];
      } else if (fs.existsSync(args[i])) {
        fileArgs.push(args[i]);
      } else {
        const resolved = path.resolve(args[i]);
        if (fs.existsSync(resolved)) fileArgs.push(resolved);
      }
    }
  }

  let dumpPath: string;
  if (fileArgs.length > 0) {
    dumpPath = path.resolve(fileArgs[0]);
  } else {
    const backupsDir = path.join(__dirname, "..", "manage", "backups");
    if (!fs.existsSync(backupsDir)) {
      console.error("manage/backups が存在しません。先にバックアップを取ってください。");
      process.exit(1);
    }
    const files = fs.readdirSync(backupsDir)
      .filter((f) => f.endsWith(".dump"))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length === 0) {
      console.error("manage/backups に .dump ファイルがありません。");
      process.exit(1);
    }
    dumpPath = path.join(backupsDir, files[0].name);
    console.log(`Using latest backup: ${files[0].name}`);
  }
  return { dumpPath, targetUrl };
}

function main(): void {
  loadEnv();
  const defaultUrl = process.env.DATABASE_URL;
  if (!defaultUrl) {
    console.error("DATABASE_URL が設定されていません。.env を確認してください。");
    process.exit(1);
  }

  const { dumpPath, targetUrl } = parseArgs();
  const restoreUrl = targetUrl ?? defaultUrl;

  if (targetUrl) {
    console.log("別 DB に復元します（現在の DB は触りません）:", restoreUrl.replace(/:[^:@]+@/, ":****@"));
  } else {
    try {
      console.log("Dropping existing schema...");
      execSync(`psql "${defaultUrl}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`, {
        stdio: "inherit",
        shell: true,
      });
    } catch (e) {
      console.error("psql での DROP に失敗しました。DB が存在するか、接続情報を確認してください。");
      process.exit(1);
    }
  }

  const runRestore = (): boolean => {
    try {
      execSync(`pg_restore -d "${restoreUrl}" --no-owner --no-privileges "${dumpPath}"`, {
        stdio: "pipe",
        shell: true,
      });
      return true;
    } catch {
      return false;
    }
  };

  console.log("Restoring...");
  if (runRestore()) {
    console.log("Restore completed.");
    return;
  }

  // pg_restore がホストに無い場合: Docker 経由で復元（localhost の DB のみ）
  try {
    const u = new URL(restoreUrl);
    const dbName = u.pathname.replace(/^\//, "") || "remaria";
    const user = u.username || "remaria";
    const dumpBasename = path.basename(dumpPath);
    const containerPath = `/tmp/${dumpBasename}`;
    execSync(`docker cp "${dumpPath}" remaria-db:${containerPath}`, { stdio: "inherit", shell: true });
    execSync(
      `docker exec remaria-db pg_restore -U ${user} -d ${dbName} --no-owner --no-privileges ${containerPath}`,
      { stdio: "inherit", shell: true }
    );
    execSync(`docker exec remaria-db rm ${containerPath}`, { stdio: "pipe", shell: true });
    console.log("Restore completed (via Docker).");
  } catch (e) {
    console.error(
      "pg_restore に失敗しました。PostgreSQL クライアントをインストールするか、Docker で remaria-db が起動しているか確認してください。"
    );
    process.exit(1);
  }
}

main();
