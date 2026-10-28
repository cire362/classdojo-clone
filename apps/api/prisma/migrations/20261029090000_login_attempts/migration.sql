-- Счётчик попыток входа в общей базе вместо памяти процесса
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "LoginAttempt_resetAt_idx" ON "LoginAttempt"("resetAt");
