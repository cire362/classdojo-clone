-- AlterTable
ALTER TABLE "BehaviorReason" ADD COLUMN "schoolReasonId" TEXT;

-- CreateTable
CREATE TABLE "SchoolReason" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolGoal" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolReason_schoolId_idx" ON "SchoolReason"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolGoal_schoolId_key" ON "SchoolGoal"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "BehaviorReason_groupId_schoolReasonId_key" ON "BehaviorReason"("groupId", "schoolReasonId");

-- AddForeignKey
ALTER TABLE "BehaviorReason" ADD CONSTRAINT "BehaviorReason_schoolReasonId_fkey" FOREIGN KEY ("schoolReasonId") REFERENCES "SchoolReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolReason" ADD CONSTRAINT "SchoolReason_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolGoal" ADD CONSTRAINT "SchoolGoal_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
