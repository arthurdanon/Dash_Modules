/*
  Warnings:

  - You are about to drop the `Option` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Site` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Task` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Team` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Option" DROP CONSTRAINT "Option_siteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Task" DROP CONSTRAINT "Task_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Task" DROP CONSTRAINT "Task_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."Task" DROP CONSTRAINT "Task_siteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Team" DROP CONSTRAINT "Team_managerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Team" DROP CONSTRAINT "Team_siteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_managedSiteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_siteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_teamId_fkey";

-- DropTable
DROP TABLE "public"."Option";

-- DropTable
DROP TABLE "public"."Site";

-- DropTable
DROP TABLE "public"."Task";

-- DropTable
DROP TABLE "public"."Team";

-- DropTable
DROP TABLE "public"."User";

-- CreateTable
CREATE TABLE "public"."coresetting" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxSites" INTEGER,
    "maxOwners" INTEGER,
    "maxManagers" INTEGER,
    "maxUsers" INTEGER,
    "modules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coresetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."corssite" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corssite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."corsteam" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" "public"."TeamName" NOT NULL,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corsteam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."corsuser" (
    "id" TEXT NOT NULL,
    "siteId" TEXT,
    "managedSiteId" TEXT,
    "role" "public"."RoleName" NOT NULL DEFAULT 'USER',
    "teamId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordEnc" BYTEA,
    "passwordIv" BYTEA,
    "passwordTag" BYTEA,
    "mustChangePwd" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corsuser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."corsoption" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corsoption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."corstask" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdById" TEXT NOT NULL,
    "assignedTeam" "public"."TeamName" NOT NULL,
    "assignedToId" TEXT,
    "options" JSONB,
    "originRole" "public"."RoleName",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "corstask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coresetting_name_key" ON "public"."coresetting"("name");

-- CreateIndex
CREATE UNIQUE INDEX "corssite_name_key" ON "public"."corssite"("name");

-- CreateIndex
CREATE UNIQUE INDEX "corsuser_username_key" ON "public"."corsuser"("username");

-- AddForeignKey
ALTER TABLE "public"."corssite" ADD CONSTRAINT "corssite_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "public"."coresetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."corsteam" ADD CONSTRAINT "corsteam_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."corssite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."corsteam" ADD CONSTRAINT "corsteam_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."corsuser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."corsuser" ADD CONSTRAINT "corsuser_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."corssite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."corsuser" ADD CONSTRAINT "corsuser_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "public"."corssite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."corsuser" ADD CONSTRAINT "corsuser_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."corsteam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."corsoption" ADD CONSTRAINT "corsoption_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."corssite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."corstask" ADD CONSTRAINT "corstask_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."corssite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."corstask" ADD CONSTRAINT "corstask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."corsuser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."corstask" ADD CONSTRAINT "corstask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."corsuser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
