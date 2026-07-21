-- CreateEnum
CREATE TYPE "PanicAlertStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "PanicAlert" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "clientId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'volume_button',
    "triggerLatitude" DOUBLE PRECISION,
    "triggerLongitude" DOUBLE PRECISION,
    "triggerAccuracy" DOUBLE PRECISION,
    "message" TEXT,
    "status" "PanicAlertStatus" NOT NULL DEFAULT 'PENDING',
    "resolutionComment" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PanicAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PanicAlert_guardId_idx" ON "PanicAlert"("guardId");

-- CreateIndex
CREATE INDEX "PanicAlert_clientId_idx" ON "PanicAlert"("clientId");

-- CreateIndex
CREATE INDEX "PanicAlert_status_idx" ON "PanicAlert"("status");

-- CreateIndex
CREATE INDEX "PanicAlert_createdAt_idx" ON "PanicAlert"("createdAt");

-- AddForeignKey
ALTER TABLE "PanicAlert" ADD CONSTRAINT "PanicAlert_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanicAlert" ADD CONSTRAINT "PanicAlert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanicAlert" ADD CONSTRAINT "PanicAlert_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
