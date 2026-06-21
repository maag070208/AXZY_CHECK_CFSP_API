-- CreateTable
CREATE TABLE "ScheduledNotification" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "channel" TEXT NOT NULL DEFAULT 'global',
    "persistent" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3),
    "cronExpression" TEXT,
    "frequency" TEXT,
    "timeOfDay" TEXT,
    "daysOfWeek" TEXT,
    "endsAt" TIMESTAMP(3),
    "maxSends" INTEGER,
    "userId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "nextSendAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ScheduledNotification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ScheduledNotification" ADD CONSTRAINT "ScheduledNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
