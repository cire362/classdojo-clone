-- Работа адресуется конкретному преподавателю группы: дисциплина есть не всегда, а проверяют разные люди
ALTER TABLE "StudentWork" ADD COLUMN "recipientId" TEXT;

ALTER TABLE "StudentWork" ADD CONSTRAINT "StudentWork_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "StudentWork_recipientId_status_idx" ON "StudentWork"("recipientId", "status");

-- Уже отправленные работы: преподаватель выбранной дисциплины группы, иначе создатель группы (куратор)
UPDATE "StudentWork" w SET "recipientId" = COALESCE(
  (SELECT gs."teacherId" FROM "GroupSubject" gs JOIN "Student" s ON s."groupId" = gs."groupId"
    WHERE s."id" = w."studentId" AND gs."subjectId" = w."subjectId"),
  (SELECT g."teacherId" FROM "Group" g JOIN "Student" s ON s."groupId" = g."id" WHERE s."id" = w."studentId")
)
WHERE w."assignmentId" IS NULL;
