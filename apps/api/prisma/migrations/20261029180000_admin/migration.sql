ALTER TYPE "Role" ADD VALUE 'ADMIN';

CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Admin_accountId_key" ON "Admin"("accountId");
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
