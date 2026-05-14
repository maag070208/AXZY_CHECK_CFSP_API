-- CreateIndex
CREATE INDEX "Incident_guardId_idx" ON "Incident"("guardId");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE INDEX "Incident_createdAt_idx" ON "Incident"("createdAt");

-- CreateIndex
CREATE INDEX "Incident_clientId_idx" ON "Incident"("clientId");

-- CreateIndex
CREATE INDEX "Kardex_scanType_idx" ON "Kardex"("scanType");

-- CreateIndex
CREATE INDEX "Maintenance_guardId_idx" ON "Maintenance"("guardId");

-- CreateIndex
CREATE INDEX "Maintenance_status_idx" ON "Maintenance"("status");

-- CreateIndex
CREATE INDEX "Maintenance_createdAt_idx" ON "Maintenance"("createdAt");

-- CreateIndex
CREATE INDEX "Maintenance_clientId_idx" ON "Maintenance"("clientId");

-- CreateIndex
CREATE INDEX "Round_guardId_idx" ON "Round"("guardId");

-- CreateIndex
CREATE INDEX "Round_status_idx" ON "Round"("status");

-- CreateIndex
CREATE INDEX "Round_createdAt_idx" ON "Round"("createdAt");

-- CreateIndex
CREATE INDEX "Round_clientId_idx" ON "Round"("clientId");
