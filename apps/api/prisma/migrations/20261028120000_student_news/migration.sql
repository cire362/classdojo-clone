-- Отметки «ученик уже видел поздравление с уровнем / новые детали»
ALTER TABLE "Student" ADD COLUMN "celebratedLevel" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Student" ADD COLUMN "partsSeenLevel" INTEGER NOT NULL DEFAULT 1;
