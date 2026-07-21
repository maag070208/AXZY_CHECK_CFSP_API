import { prismaClient as prisma } from "@src/core/config/database";

export const getConfig = async () => {
  const config = await prisma.subscriptionConfig.findFirst();
  return config || null;
};

export const updateConfig = async (data: {
  paid?: boolean;
  trialDaysRemaining?: number;
  showTrialWatermark?: boolean;
  showTrialBadge?: boolean;
}) => {
  const existing = await prisma.subscriptionConfig.findFirst();
  if (existing) {
    return prisma.subscriptionConfig.update({
      where: { id: existing.id },
      data,
    });
  }
  return prisma.subscriptionConfig.create({ data });
};
