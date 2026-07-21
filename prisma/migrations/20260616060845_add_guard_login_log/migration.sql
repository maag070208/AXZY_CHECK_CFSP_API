-- CreateTable
CREATE TABLE "GuardLoginLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardLoginLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportConfiguration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "reportType" TEXT NOT NULL,
    "clientId" TEXT,
    "configuration" JSONB NOT NULL,
    "cronExpression" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "softDelete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ReportConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardLoginLog_userId_idx" ON "GuardLoginLog"("userId");

-- CreateIndex
CREATE INDEX "GuardLoginLog_loginAt_idx" ON "GuardLoginLog"("loginAt");

-- CreateIndex
CREATE INDEX "GuardLoginLog_logoutAt_idx" ON "GuardLoginLog"("logoutAt");

-- AddForeignKey
ALTER TABLE "GuardLoginLog" ADD CONSTRAINT "GuardLoginLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportConfiguration" ADD CONSTRAINT "ReportConfiguration_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
