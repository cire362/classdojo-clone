-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "shared" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "fileKey" TEXT NOT NULL,
    "convert" TEXT,
    "previewKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Material_schoolId_createdAt_idx" ON "Material"("schoolId", "createdAt");
CREATE INDEX "Material_teacherId_idx" ON "Material"("teacherId");

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
