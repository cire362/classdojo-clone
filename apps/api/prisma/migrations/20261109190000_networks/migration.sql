-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'NETWORK';

-- CreateTable
CREATE TABLE "Network" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Network_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkAdmin" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkAdmin_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "School" ADD COLUMN "networkId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "NetworkAdmin_accountId_key" ON "NetworkAdmin"("accountId");
CREATE INDEX "NetworkAdmin_networkId_idx" ON "NetworkAdmin"("networkId");

-- AddForeignKey
ALTER TABLE "NetworkAdmin" ADD CONSTRAINT "NetworkAdmin_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NetworkAdmin" ADD CONSTRAINT "NetworkAdmin_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "School" ADD CONSTRAINT "School_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE SET NULL ON UPDATE CASCADE;
