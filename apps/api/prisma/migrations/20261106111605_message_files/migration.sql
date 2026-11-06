-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "broadcastId" TEXT;

-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "messageId" TEXT,
ADD COLUMN     "broadcastId" TEXT;

-- CreateIndex
CREATE INDEX "Message_broadcastId_idx" ON "Message"("broadcastId");

-- CreateIndex
CREATE INDEX "StoredFile_messageId_idx" ON "StoredFile"("messageId");

-- CreateIndex
CREATE INDEX "StoredFile_broadcastId_idx" ON "StoredFile"("broadcastId");

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
