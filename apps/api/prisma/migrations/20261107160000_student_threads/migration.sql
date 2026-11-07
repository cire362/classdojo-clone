-- Ветка студента с преподавателями: сообщение без родителя
ALTER TABLE "Message" ALTER COLUMN "parentId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "StudentThreadRead" (
    "accountId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentThreadRead_pkey" PRIMARY KEY ("accountId","studentId")
);

-- CreateIndex
CREATE INDEX "StudentThreadRead_studentId_idx" ON "StudentThreadRead"("studentId");

-- AddForeignKey
ALTER TABLE "StudentThreadRead" ADD CONSTRAINT "StudentThreadRead_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentThreadRead" ADD CONSTRAINT "StudentThreadRead_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
