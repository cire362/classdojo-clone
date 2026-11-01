-- CreateTable
CREATE TABLE "ClassEvent" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "date" DATE NOT NULL,
    "time" TEXT,
    "remindDays" INTEGER,
    "reminderPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassEvent_reminderPostId_key" ON "ClassEvent"("reminderPostId");

-- CreateIndex
CREATE INDEX "ClassEvent_groupId_date_idx" ON "ClassEvent"("groupId", "date");

-- AddForeignKey
ALTER TABLE "ClassEvent" ADD CONSTRAINT "ClassEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassEvent" ADD CONSTRAINT "ClassEvent_reminderPostId_fkey" FOREIGN KEY ("reminderPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
