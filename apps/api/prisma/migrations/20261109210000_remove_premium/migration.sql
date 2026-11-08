-- Сервис бесплатный: тематические коллекции героя открыты всем по уровню
ALTER TABLE "Teacher" DROP COLUMN "premiumUntil";
ALTER TABLE "HeroPart" DROP COLUMN "isPremium";
