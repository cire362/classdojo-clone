-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN "disabledAt" TIMESTAMP(3);

-- Достижения в портфолио остаются после удаления преподавателя
ALTER TABLE "PortfolioItem" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "PortfolioItem" DROP CONSTRAINT "PortfolioItem_createdById_fkey";
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
