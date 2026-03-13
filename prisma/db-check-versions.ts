/**
 * バックアップ・復元で使う pg_dump / pg_restore のバージョンを表示する。
 * 実行: npm run db:check-versions
 *
 * ルール: pg_restore は「同じか新しい」pg_dump で作ったダンプしか読めない。
 * 例: ホストの pg_dump 18 で取ったダンプは、Docker の pg_restore 16 では復元できない。
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

function run(cmd: string): { ok: boolean; out?: string } {
  try {
    const out = execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }) as string;
    return { ok: true, out: (out || "").trim() };
  } catch {
    return { ok: false };
  }
}

function main(): void {
  loadEnv();
  const execOpts: ExecSyncOptions = {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"] as const,
  };

  console.log("=== バックアップ・復元で使う Postgres クライアントのバージョン ===\n");

  const hostDump = run("pg_dump --version");
  const hostRestore = run("pg_restore --version");
  console.log("【ホスト（PC に直接入っているもの）】");
  console.log("  pg_dump:   ", hostDump.ok ? hostDump.out : "(見つからない or 失敗)");
  console.log("  pg_restore:", hostRestore.ok ? hostRestore.out : "(見つからない or 失敗)");
  console.log("");

  let dockerRestore = { ok: false as boolean, out: undefined as string | undefined };
  try {
    const out = execSync("docker exec remaria-db pg_restore --version", execOpts) as string;
    dockerRestore = { ok: true, out: (out || "").trim() };
  } catch {
    // コンテナが止まっているなど
  }
  let dockerDump = { ok: false as boolean, out: undefined as string | undefined };
  try {
    const out = execSync("docker exec remaria-db pg_dump --version", execOpts) as string;
    dockerDump = { ok: true, out: (out || "").trim() };
  } catch {
    // ignore
  }
  console.log("【Docker (remaria-db) の中】");
  console.log("  pg_dump:   ", dockerDump.ok ? dockerDump.out : "(コンテナ内で取得失敗)");
  console.log("  pg_restore:", dockerRestore.ok ? dockerRestore.out : "(コンテナ内で取得失敗)");
  console.log("");

  const url = process.env.DATABASE_URL;
  const isLocalhost =
    url &&
    (() => {
      try {
        const h = new URL(url).hostname;
        return h === "localhost" || h === "127.0.0.1";
      } catch {
        return false;
      }
    })();

  console.log("【いまの .env の DATABASE_URL】");
  if (url) {
    try {
      const u = new URL(url);
      console.log("  ホスト名:", u.hostname, isLocalhost ? "→ localhost なのでバックアップ・復元は Docker を優先" : "");
    } catch {
      console.log("  (パースできず)");
    }
  } else {
    console.log("  (未設定)");
  }
  console.log("");
  console.log("【互換ルール】");
  console.log("  pg_restore は「同じか新しい」pg_dump で作ったダンプしか読めない。");
  console.log("  例: pg_dump 18 で取ったダンプ → pg_restore 16 では復元できない。");
  console.log("  localhost のときはスクリプトが Docker を優先するので、新規バックアップは Docker のバージョンで揃う。");
}

main();
