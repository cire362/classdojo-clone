-- CreateTable
CREATE TABLE "ClassCode" (
    "groupId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassCode_pkey" PRIMARY KEY ("groupId")
);

-- CreateTable
CREATE TABLE "LoginCard" (
    "studentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginCard_pkey" PRIMARY KEY ("studentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassCode_code_key" ON "ClassCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LoginCard_tokenHash_key" ON "LoginCard"("tokenHash");

-- AddForeignKey
ALTER TABLE "ClassCode" ADD CONSTRAINT "ClassCode_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginCard" ADD CONSTRAINT "LoginCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
