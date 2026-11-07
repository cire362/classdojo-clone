-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN "schoolPostId" TEXT;

-- CreateTable
CREATE TABLE "SchoolPost" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "important" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolFeedRead" (
    "accountId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolFeedRead_pkey" PRIMARY KEY ("accountId","schoolId")
);

-- CreateIndex
CREATE INDEX "SchoolPost_schoolId_createdAt_idx" ON "SchoolPost"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "SchoolFeedRead_schoolId_idx" ON "SchoolFeedRead"("schoolId");

-- CreateIndex
CREATE INDEX "StoredFile_schoolPostId_idx" ON "StoredFile"("schoolPostId");

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_schoolPostId_fkey" FOREIGN KEY ("schoolPostId") REFERENCES "SchoolPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPost" ADD CONSTRAINT "SchoolPost_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPost" ADD CONSTRAINT "SchoolPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeedRead" ADD CONSTRAINT "SchoolFeedRead_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolFeedRead" ADD CONSTRAINT "SchoolFeedRead_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- У файла ровно один владелец: группа, ученик или запись ленты школы
ALTER TABLE "StoredFile" DROP CONSTRAINT "StoredFile_one_owner";
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_one_owner" CHECK (num_nonnulls("groupId", "studentId", "schoolPostId") = 1);
