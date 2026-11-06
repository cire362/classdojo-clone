-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- Первая школа установки: в неё переходят все существующие преподаватели и администраторы
INSERT INTO "School" ("id", "name") VALUES ('school-default', 'Моя школа');

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "schoolId" TEXT NOT NULL DEFAULT 'school-default';

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "schoolId" TEXT NOT NULL DEFAULT 'school-default';

-- CreateIndex
CREATE INDEX "Admin_schoolId_idx" ON "Admin"("schoolId");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_idx" ON "Teacher"("schoolId");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
