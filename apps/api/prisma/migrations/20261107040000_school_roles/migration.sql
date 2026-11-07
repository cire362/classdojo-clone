-- CreateEnum
CREATE TYPE "SchoolRole" AS ENUM ('DIRECTOR', 'DEPUTY', 'STAFF');

-- Существующие администраторы школ становятся директорами
ALTER TABLE "Admin" ADD COLUMN "role" "SchoolRole" NOT NULL DEFAULT 'DIRECTOR',
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "School" ADD COLUMN "joinCode" TEXT;

-- Существующие преподаватели уже подтверждены
ALTER TABLE "Teacher" ADD COLUMN "pendingSince" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "School_joinCode_key" ON "School"("joinCode");
