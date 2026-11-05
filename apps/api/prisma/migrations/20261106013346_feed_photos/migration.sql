-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "noPhotos" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "postId" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "visibleFrom" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "StoredFile_postId_idx" ON "StoredFile"("postId");

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
