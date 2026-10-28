-- Несколько уроков у группы в один день
ALTER TABLE "AttendanceSession" ADD COLUMN "lessonNumber" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "AttendanceSession_groupId_date_key";
CREATE UNIQUE INDEX "AttendanceSession_groupId_date_lessonNumber_key" ON "AttendanceSession"("groupId", "date", "lessonNumber");
