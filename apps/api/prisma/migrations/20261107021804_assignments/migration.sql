-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "assignmentId" TEXT;

-- AlterTable
ALTER TABLE "StudentWork" ADD COLUMN     "assignmentId" TEXT,
ADD COLUMN     "pointEventId" TEXT;

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "dueOn" DATE,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentStudent" (
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "AssignmentStudent_pkey" PRIMARY KEY ("assignmentId","studentId")
);

-- CreateIndex
CREATE INDEX "StoredFile_assignmentId_idx" ON "StoredFile"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentWork_pointEventId_key" ON "StudentWork"("pointEventId");

-- CreateIndex
CREATE INDEX "StudentWork_assignmentId_idx" ON "StudentWork"("assignmentId");

-- CreateIndex
CREATE INDEX "Assignment_groupId_createdAt_idx" ON "Assignment"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "AssignmentStudent_studentId_idx" ON "AssignmentStudent"("studentId");

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWork" ADD CONSTRAINT "StudentWork_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWork" ADD CONSTRAINT "StudentWork_pointEventId_fkey" FOREIGN KEY ("pointEventId") REFERENCES "PointEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentStudent" ADD CONSTRAINT "AssignmentStudent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentStudent" ADD CONSTRAINT "AssignmentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
