// spec/095: 本番マスタ更新。管理用アカウントのみ。layout で認可済み。

import { MasterProductionSyncClient } from "./master-production-sync-client";

export default function MasterProductionSyncPage() {
  return <MasterProductionSyncClient />;
}
