-- Reconciliación: la tabla NotificationLog existe en la DB pero no
-- tenía migración previa. Esta migración declara su estructura real
-- (con FK ON DELETE NO ACTION, sin cascade) usando IF NOT EXISTS
-- para ser idempotente.

CREATE TABLE IF NOT EXISTS "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NotificationLog_userId_read_idx" ON "NotificationLog"("userId", "read");

CREATE INDEX IF NOT EXISTS "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- FK con ON DELETE RESTRICT (que es como Prisma traduce el default
-- NO ACTION del schema). NO usar CASCADE porque causa drift con Prisma.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'NotificationLog_userId_fkey'
    ) THEN
        ALTER TABLE "NotificationLog"
        ADD CONSTRAINT "NotificationLog_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
