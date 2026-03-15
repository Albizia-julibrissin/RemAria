-- spec/094: 任務ごとにクリア時にチャット通知するか設定可能に
ALTER TABLE "Quest" ADD COLUMN "notifyChatOnClear" BOOLEAN NOT NULL DEFAULT false;
