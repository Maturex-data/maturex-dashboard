-- Rebrand Flowa to ECOMBIUS and organize 7 active Etsy shops
-- 1. Upsert exactly 7 active shops for ECOMBIUS
INSERT INTO "etsy_shops" ("id", "code", "name", "active", "created_at", "updated_at")
VALUES
  (CONCAT('shop_', LOWER('EVERNEST')), 'EVERNEST', 'Evernest', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (CONCAT('shop_', LOWER('ORIVIA')), 'ORIVIA', 'Orivia', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (CONCAT('shop_', LOWER('TIMOND')), 'TIMOND', 'Timond', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (CONCAT('shop_', LOWER('ARTISANHAND')), 'ARTISANHAND', 'Artisan', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (CONCAT('shop_', LOWER('97DECOR')), '97DECOR', '97Decor', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (CONCAT('shop_', LOWER('KINDLORA')), 'KINDLORA', 'Kindlora', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (CONCAT('shop_', LOWER('EVERMIRTH')), 'EVERMIRTH', 'Evermirth', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "active" = true,
  "updated_at" = CURRENT_TIMESTAMP;

-- 2. Deactivate Pocdy without deleting or altering foreign key relations of historical data
UPDATE "etsy_shops"
SET
  "active" = false,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'POCDY';
