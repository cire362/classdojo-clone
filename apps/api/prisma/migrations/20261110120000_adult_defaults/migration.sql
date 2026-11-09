-- Колледж и вуз: стартовые причины и награды группы — словами студентов, а не школьников.
-- Меняются только нетронутые школьные названия; свои причины и награды преподавателей остаются как есть.
-- В истории начислений сохраняются прежние названия: это снимок на момент начисления.
UPDATE "BehaviorReason" r SET "name" = v.new_name, "emoji" = v.emoji
FROM (VALUES
  ('Работал на уроке', 'Активная работа на занятии', '💪'),
  ('Помог другу', 'Помощь одногруппнику', '🤝'),
  ('Командная работа', 'Работа в команде', '🧩'),
  ('Аккуратность', 'Задание сдано в срок', '📅'),
  ('Отличная работа', 'Отличный проект', '⭐'),
  ('Опоздал', 'Опоздание', '⏰'),
  ('Отвлекался', 'Посторонние дела на занятии', '📵'),
  ('Не выполнил задание', 'Задание не сдано', '📕'),
  ('Шумел', 'Шум на занятии', '📢')
) AS v(old_name, new_name, emoji)
WHERE r."name" = v.old_name AND r."kind" = 'MANUAL' AND r."schoolReasonId" IS NULL
  AND r."groupId" IN (SELECT g."id" FROM "Group" g JOIN "Teacher" t ON t."id" = g."teacherId" JOIN "School" s ON s."id" = t."schoolId" WHERE s."kind" <> 'SCHOOL')
  AND NOT EXISTS (SELECT 1 FROM "BehaviorReason" x WHERE x."groupId" = r."groupId" AND x."name" = v.new_name);

UPDATE "Reward" w SET "title" = v.new_title, "emoji" = v.emoji
FROM (VALUES
  ('Отсрочка домашнего задания', 'Сдать задание на день позже', '⏰')
) AS v(old_title, new_title, emoji)
WHERE w."title" = v.old_title AND w."groupId" IN (SELECT g."id" FROM "Group" g JOIN "Teacher" t ON t."id" = g."teacherId" JOIN "School" s ON s."id" = t."schoolId" WHERE s."kind" <> 'SCHOOL');

-- Школьные награды студентам не подходят: в архив, преподаватель может вернуть
UPDATE "Reward" SET "archived" = true
WHERE "title" IN ('Выбрать место на уроке', 'Музыка на перемене', 'Помощник учителя на урок') AND "groupId" IN (SELECT g."id" FROM "Group" g JOIN "Teacher" t ON t."id" = g."teacherId" JOIN "School" s ON s."id" = t."schoolId" WHERE s."kind" <> 'SCHOOL');
