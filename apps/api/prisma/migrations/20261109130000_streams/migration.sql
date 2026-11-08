-- CreateTable
CREATE TABLE "Stream" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamGroup" (
    "streamId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "StreamGroup_pkey" PRIMARY KEY ("streamId","groupId")
);

-- CreateIndex
CREATE INDEX "Stream_teacherId_idx" ON "Stream"("teacherId");
CREATE INDEX "StreamGroup_groupId_idx" ON "StreamGroup"("groupId");

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StreamGroup" ADD CONSTRAINT "StreamGroup_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StreamGroup" ADD CONSTRAINT "StreamGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
