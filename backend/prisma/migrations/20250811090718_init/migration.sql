-- CreateEnum (on garde seulement ce qui est encore utile)
CREATE TYPE "public"."TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE');
CREATE TYPE "public"."TeamName" AS ENUM ('HOUSEMAN', 'ROOM_ATTENDANT');

-- CreateTable Site
CREATE TABLE "public"."Site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable Team
CREATE TABLE "public"."Team" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" "public"."TeamName" NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable Role (nouveau)
CREATE TABLE "public"."Role" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isManager" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- CreateTable User (remplace l'ancien ENUM Role par roleId FK)
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "siteId" TEXT,
    "managedSiteId" TEXT,
    "roleId" TEXT NOT NULL,
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
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable Option
CREATE TABLE "public"."Option" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable Task (remplace originRole ENUM par originRoleName text)
CREATE TABLE "public"."Task" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdById" TEXT NOT NULL,
    "assignedTeam" "public"."TeamName" NOT NULL,
    "assignedToId" TEXT,
    "options" JSONB,
    "originRoleName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "Site_name_key" ON "public"."Site"("name");
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- ForeignKeys
ALTER TABLE "public"."Team"
  ADD CONSTRAINT "Team_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."User"
  ADD CONSTRAINT "User_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."User"
  ADD CONSTRAINT "User_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "public"."Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."User"
  ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."User"
  ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."Option"
  ADD CONSTRAINT "Option_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."Task"
  ADD CONSTRAINT "Task_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."Task"
  ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."Task"
  ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
