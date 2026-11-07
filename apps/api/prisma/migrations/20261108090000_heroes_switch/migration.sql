-- Герои в учреждении и группе: всё, что было, остаётся с героями
ALTER TABLE "School" ADD COLUMN "heroes" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Group" ADD COLUMN "heroes" BOOLEAN NOT NULL DEFAULT true;
