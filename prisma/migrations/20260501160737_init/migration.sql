/*
  Warnings:

  - You are about to drop the column `description` on the `RecurringConfiguration` table. All the data in the column will be lost.
  - You are about to drop the column `active` on the `RecurringLocation` table. All the data in the column will be lost.
  - You are about to drop the column `configurationId` on the `RecurringLocation` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `RecurringLocation` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `RecurringLocation` table. All the data in the column will be lost.
  - You are about to drop the column `propertyId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `recurringConfigurationId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Invitation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InvitationType` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Property` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PropertyStatus` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PropertyType` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ResidentContact` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ResidentProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ResidentRelationship` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_RecurringAssignments` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name,zoneId]` on the table `Location` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `recurringConfigurationId` to the `RecurringLocation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_typeId_fkey";

-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_statusId_fkey";

-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_typeId_fkey";

-- DropForeignKey
ALTER TABLE "RecurringLocation" DROP CONSTRAINT "RecurringLocation_configurationId_fkey";

-- DropForeignKey
ALTER TABLE "ResidentContact" DROP CONSTRAINT "ResidentContact_userId_fkey";

-- DropForeignKey
ALTER TABLE "ResidentProfile" DROP CONSTRAINT "ResidentProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_recurringConfigurationId_fkey";

-- DropForeignKey
ALTER TABLE "_RecurringAssignments" DROP CONSTRAINT "_RecurringAssignments_A_fkey";

-- DropForeignKey
ALTER TABLE "_RecurringAssignments" DROP CONSTRAINT "_RecurringAssignments_B_fkey";

-- DropIndex
DROP INDEX "Location_name_key";

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "clientId" INTEGER,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "zoneId" INTEGER,
ALTER COLUMN "aisle" DROP NOT NULL,
ALTER COLUMN "spot" DROP NOT NULL,
ALTER COLUMN "number" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RecurringConfiguration" DROP COLUMN "description",
ADD COLUMN     "clientId" INTEGER,
ADD COLUMN     "softDelete" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RecurringLocation" DROP COLUMN "active",
DROP COLUMN "configurationId",
DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recurringConfigurationId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "clientId" INTEGER;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "propertyId",
DROP COLUMN "recurringConfigurationId",
ADD COLUMN     "clientId" INTEGER;

-- DropTable
DROP TABLE "Invitation";

-- DropTable
DROP TABLE "InvitationType";

-- DropTable
DROP TABLE "Property";

-- DropTable
DROP TABLE "PropertyStatus";

-- DropTable
DROP TABLE "PropertyType";

-- DropTable
DROP TABLE "ResidentContact";

-- DropTable
DROP TABLE "ResidentProfile";

-- DropTable
DROP TABLE "ResidentRelationship";

-- DropTable
DROP TABLE "_RecurringAssignments";

-- DropEnum
DROP TYPE "InvitationStatus";

-- CreateTable
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "rfc" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "softDelete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "softDelete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationTask" (
    "id" SERIAL NOT NULL,
    "locationId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "reqPhoto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LocationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RecurringConfigurationToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_name_key" ON "Client"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_name_clientId_key" ON "Zone"("name", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "_RecurringConfigurationToUser_AB_unique" ON "_RecurringConfigurationToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_RecurringConfigurationToUser_B_index" ON "_RecurringConfigurationToUser"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_zoneId_key" ON "Location"("name", "zoneId");

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationTask" ADD CONSTRAINT "LocationTask_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringConfiguration" ADD CONSTRAINT "RecurringConfiguration_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringLocation" ADD CONSTRAINT "RecurringLocation_recurringConfigurationId_fkey" FOREIGN KEY ("recurringConfigurationId") REFERENCES "RecurringConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RecurringConfigurationToUser" ADD CONSTRAINT "_RecurringConfigurationToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "RecurringConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RecurringConfigurationToUser" ADD CONSTRAINT "_RecurringConfigurationToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
