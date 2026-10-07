import { prismaClient as prisma } from "@src/core/config/database";
import { createAuditLog } from "../audit/audit.service";
import { IUpdateSubscriptionConfig } from "./schemas/subscription.schema";

export const getConfig = async () => {
  const config = await prisma.subscriptionConfig.findFirst();
  return config || null;
};

export const updateConfig = async (data: IUpdateSubscriptionConfig, userId: string) => {
  const existing = await prisma.subscriptionConfig.findFirst();

  const config = existing
    ? await prisma.subscriptionConfig.update({ where: { id: existing.id }, data })
    : await prisma.subscriptionConfig.create({ data });

  await createAuditLog({
    userId,
    module: "SUBSCRIPTION",
    action: "UPDATE_CONFIG",
    resourceId: config.id,
    details: data,
  });

  return config;
};
