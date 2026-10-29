CREATE TABLE "ClassGoal" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target" INTEGER NOT NULL CHECK ("target" > 0),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassGoal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassGoal_groupId_key" ON "ClassGoal"("groupId");
ALTER TABLE "ClassGoal" ADD CONSTRAINT "ClassGoal_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointEvent" ADD COLUMN "classGoalId" TEXT;
CREATE INDEX "PointEvent_classGoalId_idx" ON "PointEvent"("classGoalId");
ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_classGoalId_fkey" FOREIGN KEY ("classGoalId") REFERENCES "ClassGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD COLUMN "classGoalId" TEXT;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_classGoalId_fkey" FOREIGN KEY ("classGoalId") REFERENCES "ClassGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
