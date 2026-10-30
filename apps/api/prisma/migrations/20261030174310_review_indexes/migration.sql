-- DropIndex
DROP INDEX "RewardRequest_studentId_status_idx";

-- CreateIndex
CREATE INDEX "AttendanceSession_classGoalId_idx" ON "AttendanceSession"("classGoalId");
