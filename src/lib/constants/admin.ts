/**
 * 管理用アカウントのデフォルトメール（開発用）。
 * 本番では環境変数 ADMIN_EMAIL を設定して管理用アカウントを指定する。
 * 実アカウントは prisma/seed で「管理人」として作成する。
 */
export const DEFAULT_ADMIN_EMAIL = "test1@example.com";
