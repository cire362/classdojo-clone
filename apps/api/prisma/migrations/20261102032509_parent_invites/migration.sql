-- CreateTable
CREATE TABLE "ParentInvite" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentInvite_codeHash_key" ON "ParentInvite"("codeHash");

-- CreateIndex
CREATE INDEX "ParentInvite_studentId_idx" ON "ParentInvite"("studentId");

-- AddForeignKey
ALTER TABLE "ParentInvite" ADD CONSTRAINT "ParentInvite_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
