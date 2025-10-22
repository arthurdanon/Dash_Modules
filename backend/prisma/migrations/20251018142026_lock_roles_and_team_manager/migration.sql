/*
  Warnings:

  - You are about to drop the column `originRoleName` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `roleId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Role` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."RoleName" AS ENUM ('ADMIN', 'OWNER', 'MANAGER', 'USER');

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_roleId_fkey";

-- AlterTable
ALTER TABLE "public"."Task" DROP COLUMN "originRoleName",
ADD COLUMN     "originRole" "public"."RoleName";

-- AlterTable
ALTER TABLE "public"."Team" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "roleId",
ADD COLUMN     "role" "public"."RoleName" NOT NULL DEFAULT 'USER';

-- DropTable
DROP TABLE "public"."Role";

-- AddForeignKey
ALTER TABLE "public"."Team" ADD CONSTRAINT "Team_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
