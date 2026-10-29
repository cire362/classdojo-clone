-- Прежние решения остаются в истории, но не становятся новыми уведомлениями при обновлении.
ALTER TABLE "Student" ADD COLUMN "rewardsReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "RewardRequest_studentId_status_decidedAt_idx" ON "RewardRequest"("studentId", "status", "decidedAt");
