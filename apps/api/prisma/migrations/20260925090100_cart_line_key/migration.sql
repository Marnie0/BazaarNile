-- Step 2 of 2: run after the release that writes lineKey is live.
UPDATE "CartItem" SET "lineKey" = COALESCE("productId" || ':' || "variantId", "productId") WHERE "lineKey" IS NULL;
ALTER TABLE "CartItem" ALTER COLUMN "lineKey" SET NOT NULL;
DROP INDEX "CartItem_cartId_productId_key";
