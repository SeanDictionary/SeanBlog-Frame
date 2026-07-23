ALTER TABLE "User" ADD COLUMN "username" TEXT;

UPDATE "User" SET "username" = 'admin' WHERE "username" IS NULL;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "User" DROP COLUMN "name";
ALTER TABLE "User" DROP COLUMN "email";

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
