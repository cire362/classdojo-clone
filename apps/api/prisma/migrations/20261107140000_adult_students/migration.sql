-- Родители в группе: существующие группы как раньше, с родителями
ALTER TABLE "Group" ADD COLUMN "parentsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Переписка с администрацией: автор — вход (родитель или студент), а не только родитель
ALTER TABLE "SchoolThread" ADD COLUMN "accountId" TEXT;
UPDATE "SchoolThread" t SET "accountId" = p."accountId" FROM "Parent" p WHERE p."id" = t."parentId";
ALTER TABLE "SchoolThread" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "SchoolThread" RENAME COLUMN "parentReadAt" TO "readerReadAt";

ALTER TABLE "SchoolThread" DROP CONSTRAINT "SchoolThread_parentId_fkey";
DROP INDEX "SchoolThread_parentId_idx";
DROP INDEX "SchoolThread_schoolId_parentId_key";
ALTER TABLE "SchoolThread" DROP COLUMN "parentId";

CREATE INDEX "SchoolThread_accountId_idx" ON "SchoolThread"("accountId");
CREATE UNIQUE INDEX "SchoolThread_schoolId_accountId_key" ON "SchoolThread"("schoolId", "accountId");
ALTER TABLE "SchoolThread" ADD CONSTRAINT "SchoolThread_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
