/*
  Warnings:

  - The values [HOUSEMAN,ROOM_ATTENDANT] on the enum `TeamName` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."TeamName_new" AS ENUM ('HOUSEKEEPING', 'MAINTENANCE', 'FRONT_DESK', 'SECURITY', 'OTHER');
ALTER TABLE "public"."Team" ALTER COLUMN "name" TYPE "public"."TeamName_new" USING ("name"::text::"public"."TeamName_new");
ALTER TABLE "public"."Task" ALTER COLUMN "assignedTeam" TYPE "public"."TeamName_new" USING ("assignedTeam"::text::"public"."TeamName_new");
ALTER TYPE "public"."TeamName" RENAME TO "TeamName_old";
ALTER TYPE "public"."TeamName_new" RENAME TO "TeamName";
DROP TYPE "public"."TeamName_old";
COMMIT;
