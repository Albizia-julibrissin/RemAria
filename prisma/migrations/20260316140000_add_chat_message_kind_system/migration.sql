-- spec/094: ChatMessage に kind, systemKind, payload を追加。userId を nullable に（system メッセージ用）。
ALTER TABLE "ChatMessage" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "ChatMessage" ADD COLUMN "systemKind" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "payload" JSONB;
ALTER TABLE "ChatMessage" ALTER COLUMN "userId" DROP NOT NULL;
