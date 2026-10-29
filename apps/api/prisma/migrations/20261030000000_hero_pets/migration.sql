-- Новый слот не меняет вид существующих героев и не заменяет уже выбранные детали.
UPDATE "Hero" SET "parts" = jsonb_set("parts", '{pet}', '"pet.none"'::jsonb)
WHERE jsonb_typeof("parts") = 'object' AND NOT ("parts" ? 'pet');
