/*
  Warnings:

  - You are about to drop the column `passwordEnc` on the `coreusers` table. All the data in the column will be lost.
  - You are about to drop the column `passwordIv` on the `coreusers` table. All the data in the column will be lost.
  - You are about to drop the column `passwordTag` on the `coreusers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."coreusers" DROP COLUMN "passwordEnc",
DROP COLUMN "passwordIv",
DROP COLUMN "passwordTag";
