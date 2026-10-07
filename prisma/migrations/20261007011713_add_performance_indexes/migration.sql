-- CreateIndex
CREATE INDEX "AssignmentLog_guardId_idx" ON "AssignmentLog"("guardId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "Client_softDelete_active_idx" ON "Client"("softDelete", "active");

-- CreateIndex
CREATE INDEX "LocationTask_locationId_idx" ON "LocationTask"("locationId");

-- CreateIndex
CREATE INDEX "RecurringLocation_recurringConfigurationId_idx" ON "RecurringLocation"("recurringConfigurationId");

-- CreateIndex
CREATE INDEX "RecurringTask_recurringLocationId_idx" ON "RecurringTask"("recurringLocationId");

-- CreateIndex
CREATE INDEX "ReportConfiguration_clientId_idx" ON "ReportConfiguration"("clientId");

-- CreateIndex
CREATE INDEX "ReportConfiguration_softDelete_active_idx" ON "ReportConfiguration"("softDelete", "active");

-- CreateIndex
CREATE INDEX "ScheduledNotification_active_nextSendAt_idx" ON "ScheduledNotification"("active", "nextSendAt");

-- CreateIndex
CREATE INDEX "User_clientId_idx" ON "User"("clientId");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_softDelete_active_idx" ON "User"("softDelete", "active");
