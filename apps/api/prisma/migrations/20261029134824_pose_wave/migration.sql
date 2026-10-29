-- Поза «Туда!» (pose.point) заменена на «Привет!» (pose.wave), тот же 7-й уровень.
-- Сохранённые герои переходят на новую позу, а не сбрасываются на позу по умолчанию.
UPDATE "Hero" SET "parts" = jsonb_set("parts", '{pose}', '"pose.wave"') WHERE "parts"->>'pose' = 'pose.point';
DELETE FROM "HeroPart" WHERE "id" = 'pose.point';
