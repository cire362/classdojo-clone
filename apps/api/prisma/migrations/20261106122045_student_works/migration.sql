-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('PENDING', 'APPROVED', 'RETURNED');

-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "workId" TEXT;

-- CreateTable
CREATE TABLE "StudentWork" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "status" "WorkStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "StudentWork_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoredFile_workId_idx" ON "StoredFile"("workId");

-- CreateIndex
CREATE INDEX "StudentWork_studentId_createdAt_idx" ON "StudentWork"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentWork_status_idx" ON "StudentWork"("status");

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_workId_fkey" FOREIGN KEY ("workId") REFERENCES "StudentWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWork" ADD CONSTRAINT "StudentWork_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWork" ADD CONSTRAINT "StudentWork_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
