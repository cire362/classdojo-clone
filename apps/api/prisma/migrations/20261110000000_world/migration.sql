-- CreateTable
CREATE TABLE "WorldProgress" (
    "studentId" TEXT NOT NULL,
    "completed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "WorldProgress_pkey" PRIMARY KEY ("studentId")
);

-- AddForeignKey
ALTER TABLE "WorldProgress" ADD CONSTRAINT "WorldProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
