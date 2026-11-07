-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN "schoolMessageId" TEXT;

-- CreateTable
CREATE TABLE "SchoolThread" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "waitingSince" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentReadAt" TIMESTAMP(3),

    CONSTRAINT "SchoolThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT,
    "authorName" TEXT NOT NULL DEFAULT '',
    "fromSchool" BOOLEAN NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolThread_schoolId_lastMessageAt_idx" ON "SchoolThread"("schoolId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "SchoolThread_parentId_idx" ON "SchoolThread"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolThread_schoolId_parentId_key" ON "SchoolThread"("schoolId", "parentId");

-- CreateIndex
CREATE INDEX "SchoolMessage_threadId_createdAt_idx" ON "SchoolMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "StoredFile_schoolMessageId_idx" ON "StoredFile"("schoolMessageId");

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_schoolMessageId_fkey" FOREIGN KEY ("schoolMessageId") REFERENCES "SchoolMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolThread" ADD CONSTRAINT "SchoolThread_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolThread" ADD CONSTRAINT "SchoolThread_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolMessage" ADD CONSTRAINT "SchoolMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "SchoolThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolMessage" ADD CONSTRAINT "SchoolMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- У файла ровно один владелец: группа, ученик, запись ленты школы или сообщение школе
ALTER TABLE "StoredFile" DROP CONSTRAINT "StoredFile_one_owner";
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_one_owner" CHECK (num_nonnulls("groupId", "studentId", "schoolPostId", "schoolMessageId") = 1);
