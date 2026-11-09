-- Кому адресована работа: дисциплина группы и её преподаватель; без дисциплины — куратору группы
ALTER TABLE "StudentWork" ADD COLUMN "subjectId" TEXT;

ALTER TABLE "StudentWork" ADD CONSTRAINT "StudentWork_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
