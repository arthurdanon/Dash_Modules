/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `coreusers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."CoreAuthTokenType" AS ENUM ('INVITE', 'RESET');

-- AlterTable
ALTER TABLE "public"."coreusers" ADD COLUMN     "email" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."coreauthtokens" (
    "id" TEXT NOT NULL,
    "type" "public"."CoreAuthTokenType" NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coreauthtokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coreauthtokens_tokenHash_key" ON "public"."coreauthtokens"("tokenHash");

-- CreateIndex
CREATE INDEX "coreauthtokens_userId_type_idx" ON "public"."coreauthtokens"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "coreusers_email_key" ON "public"."coreusers"("email");

-- AddForeignKey
ALTER TABLE "public"."coreauthtokens" ADD CONSTRAINT "coreauthtokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."coreusers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
