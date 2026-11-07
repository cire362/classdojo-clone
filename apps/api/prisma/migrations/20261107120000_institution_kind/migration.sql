-- CreateEnum
CREATE TYPE "InstitutionKind" AS ENUM ('SCHOOL', 'COLLEGE', 'UNIVERSITY');

-- Существующие учреждения — школы
ALTER TABLE "School" ADD COLUMN "kind" "InstitutionKind" NOT NULL DEFAULT 'SCHOOL';
