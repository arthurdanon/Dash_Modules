/*
  Warnings:

  - You are about to drop the `coresetting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `corsoption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `corssite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `corstask` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `corsteam` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `corsuser` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."corsoption" DROP CONSTRAINT "corsoption_siteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."corssite" DROP CONSTRAINT "corssite_settingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."corstask" DROP CONSTRAINT "corstask_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "public"."corstask" DROP CONSTRAINT "corstask_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."corstask" DROP CONSTRAINT "corstask_siteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."corsteam" DROP CONSTRAINT "corsteam_managerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."corsteam" DROP CONSTRAINT "corsteam_siteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."corsuser" DROP CONSTRAINT "corsuser_managedSiteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."corsuser" DROP CONSTRAINT "corsuser_siteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."corsuser" DROP CONSTRAINT "corsuser_teamId_fkey";

-- DropTable
DROP TABLE "public"."coresetting";

-- DropTable
DROP TABLE "public"."corsoption";

-- DropTable
DROP TABLE "public"."corssite";

-- DropTable
DROP TABLE "public"."corstask";

-- DropTable
DROP TABLE "public"."corsteam";

-- DropTable
DROP TABLE "public"."corsuser";

-- DropEnum
DROP TYPE "public"."RoleName";

-- DropEnum
DROP TYPE "public"."TaskStatus";

-- DropEnum
DROP TYPE "public"."TeamName";

-- CreateTable
CREATE TABLE "public"."coreroles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "isManager" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coreroles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coresettings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxSites" INTEGER,
    "maxOwners" INTEGER,
    "maxManagers" INTEGER,
    "maxUsers" INTEGER,
    "availableModules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coresettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coresites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settingId" TEXT NOT NULL,
    "ownerId" TEXT,
    "modules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coresites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coreusers" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "primarySiteId" TEXT,
    "teamId" TEXT,
    "passwordHash" TEXT NOT NULL,
    "passwordEnc" BYTEA,
    "passwordIv" BYTEA,
    "passwordTag" BYTEA,
    "mustChangePwd" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coreusers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coresitemembers" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isManager" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coresitemembers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coreteams" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coreteams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coreroles_name_key" ON "public"."coreroles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "coresettings_name_key" ON "public"."coresettings"("name");

-- CreateIndex
CREATE UNIQUE INDEX "coresites_name_key" ON "public"."coresites"("name");

-- CreateIndex
CREATE UNIQUE INDEX "coreusers_username_key" ON "public"."coreusers"("username");

-- CreateIndex
CREATE UNIQUE INDEX "coresitemembers_siteId_userId_key" ON "public"."coresitemembers"("siteId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "coreteams_siteId_name_key" ON "public"."coreteams"("siteId", "name");

-- AddForeignKey
ALTER TABLE "public"."coresites" ADD CONSTRAINT "coresites_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "public"."coresettings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coresites" ADD CONSTRAINT "coresites_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."coreusers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coreusers" ADD CONSTRAINT "coreusers_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."coreroles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coreusers" ADD CONSTRAINT "coreusers_primarySiteId_fkey" FOREIGN KEY ("primarySiteId") REFERENCES "public"."coresites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coreusers" ADD CONSTRAINT "coreusers_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."coreteams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coresitemembers" ADD CONSTRAINT "coresitemembers_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."coresites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coresitemembers" ADD CONSTRAINT "coresitemembers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."coreusers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coreteams" ADD CONSTRAINT "coreteams_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."coresites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coreteams" ADD CONSTRAINT "coreteams_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."coreusers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
