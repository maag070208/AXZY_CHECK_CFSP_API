-- CreateEnum
CREATE TYPE "GuardDisciplineStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "DisciplineCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DisciplineCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplineType" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DisciplineType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardDiscipline" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" TEXT,
    "typeId" TEXT,
    "description" TEXT,
    "status" "GuardDisciplineStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GuardDiscipline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DisciplineCategory_name_key" ON "DisciplineCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DisciplineType_name_key" ON "DisciplineType"("name");

-- CreateIndex
CREATE INDEX "GuardDiscipline_guardId_idx" ON "GuardDiscipline"("guardId");

-- CreateIndex
CREATE INDEX "GuardDiscipline_clientId_idx" ON "GuardDiscipline"("clientId");

-- CreateIndex
CREATE INDEX "GuardDiscipline_status_idx" ON "GuardDiscipline"("status");

-- CreateIndex
CREATE INDEX "GuardDiscipline_createdAt_idx" ON "GuardDiscipline"("createdAt");

-- AddForeignKey
ALTER TABLE "DisciplineType" ADD CONSTRAINT "DisciplineType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DisciplineCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardDiscipline" ADD CONSTRAINT "GuardDiscipline_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardDiscipline" ADD CONSTRAINT "GuardDiscipline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardDiscipline" ADD CONSTRAINT "GuardDiscipline_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DisciplineCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardDiscipline" ADD CONSTRAINT "GuardDiscipline_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "DisciplineType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardDiscipline" ADD CONSTRAINT "GuardDiscipline_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
