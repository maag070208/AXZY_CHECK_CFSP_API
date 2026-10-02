-- CreateTable
CREATE TABLE "ShiftPlan" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "requireHandover" BOOLEAN NOT NULL DEFAULT true,
    "requireUniform" BOOLEAN NOT NULL DEFAULT true,
    "toleranceMinutes" INTEGER NOT NULL DEFAULT 30,
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShiftPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftHandover" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "shiftDate" DATE NOT NULL,
    "credentialsCount" INTEGER,
    "tarjetonesCount" INTEGER,
    "novedades" TEXT,
    "checklist" JSONB NOT NULL,
    "reportedToAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShiftHandover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftHandoverElement" (
    "id" TEXT NOT NULL,
    "shiftHandoverId" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "entryTime" TEXT NOT NULL,
    "punctual" BOOLEAN NOT NULL DEFAULT true,
    "observations" TEXT,

    CONSTRAINT "ShiftHandoverElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniformCheck" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "clientId" TEXT,
    "scheduleId" TEXT,
    "shiftDate" DATE NOT NULL,
    "evaluatedById" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "compliant" BOOLEAN NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UniformCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftPlan_clientId_idx" ON "ShiftPlan"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftPlan_clientId_scheduleId_key" ON "ShiftPlan"("clientId", "scheduleId");

-- CreateIndex
CREATE INDEX "ShiftHandover_clientId_scheduleId_shiftDate_idx" ON "ShiftHandover"("clientId", "scheduleId", "shiftDate");

-- CreateIndex
CREATE INDEX "ShiftHandover_shiftDate_idx" ON "ShiftHandover"("shiftDate");

-- CreateIndex
CREATE INDEX "ShiftHandoverElement_shiftHandoverId_idx" ON "ShiftHandoverElement"("shiftHandoverId");

-- CreateIndex
CREATE INDEX "ShiftHandoverElement_guardId_idx" ON "ShiftHandoverElement"("guardId");

-- CreateIndex
CREATE INDEX "UniformCheck_guardId_shiftDate_idx" ON "UniformCheck"("guardId", "shiftDate");

-- CreateIndex
CREATE INDEX "UniformCheck_clientId_shiftDate_idx" ON "UniformCheck"("clientId", "shiftDate");

-- CreateIndex
CREATE INDEX "UniformCheck_createdAt_idx" ON "UniformCheck"("createdAt");

-- AddForeignKey
ALTER TABLE "ShiftPlan" ADD CONSTRAINT "ShiftPlan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPlan" ADD CONSTRAINT "ShiftPlan_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandoverElement" ADD CONSTRAINT "ShiftHandoverElement_shiftHandoverId_fkey" FOREIGN KEY ("shiftHandoverId") REFERENCES "ShiftHandover"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandoverElement" ADD CONSTRAINT "ShiftHandoverElement_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniformCheck" ADD CONSTRAINT "UniformCheck_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniformCheck" ADD CONSTRAINT "UniformCheck_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniformCheck" ADD CONSTRAINT "UniformCheck_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniformCheck" ADD CONSTRAINT "UniformCheck_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

