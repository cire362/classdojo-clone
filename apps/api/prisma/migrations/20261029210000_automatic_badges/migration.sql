ALTER TABLE "BehaviorReason" ADD COLUMN "countsForHelpBadge" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PointEvent" ADD COLUMN "helpBadge" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PointEvent" ADD COLUMN "awardedGroupId" TEXT;
CREATE INDEX "PointEvent_awardedGroupId_createdAt_idx" ON "PointEvent"("awardedGroupId", "createdAt");
ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_awardedGroupId_fkey" FOREIGN KEY ("awardedGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Group" ADD COLUMN "badgeTrackingStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Старую помощь можно надёжно определить по сохранённому названию события.
UPDATE "BehaviorReason" SET "countsForHelpBadge" = true WHERE lower(trim("name")) = 'помог другу' AND "kind" = 'MANUAL';
UPDATE "PointEvent" SET "helpBadge" = true WHERE lower(trim("reasonName")) = 'помог другу' AND "value" > 0;
-- Группы старых ручных начислений не угадываем: ученики могли переводиться.
