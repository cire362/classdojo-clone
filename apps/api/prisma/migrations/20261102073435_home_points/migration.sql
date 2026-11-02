-- CreateTable
CREATE TABLE "HomeGoal" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomePoint" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "goalId" TEXT,
    "reason" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomePoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeGoal_studentId_idx" ON "HomeGoal"("studentId");

-- CreateIndex
CREATE INDEX "HomePoint_studentId_createdAt_idx" ON "HomePoint"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "HomePoint_goalId_idx" ON "HomePoint"("goalId");

-- AddForeignKey
ALTER TABLE "HomeGoal" ADD CONSTRAINT "HomeGoal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePoint" ADD CONSTRAINT "HomePoint_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePoint" ADD CONSTRAINT "HomePoint_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "HomeGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
