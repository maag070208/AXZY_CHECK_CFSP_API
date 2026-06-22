-- CreateTable SubscriptionConfig
CREATE TABLE "SubscriptionConfig" (
    "id" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "trialDaysRemaining" INTEGER NOT NULL DEFAULT 0,
    "showTrialWatermark" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionConfig_pkey" PRIMARY KEY ("id")
);
