import { PrismaClient } from "@prisma/client";
import { hackerLog } from "./logger";

const OPERATIONAL_USERNAMES = ["victor", "martin", "marco", "asael", "ricardo", "mario"];

export const guardLogsSeed = async (prisma: PrismaClient) => {
  hackerLog.info("GUARD_LOGS", "Seeding prenomina records");

  const operationalRoles = ["GUARD", "SHIFT", "MAINT"];
  const users = await prisma.user.findMany({
    where: {
      username: { in: OPERATIONAL_USERNAMES },
      role: { name: { in: operationalRoles } },
    },
    include: { role: true },
  });

  if (users.length === 0) {
    hackerLog.info("GUARD_LOGS", "No operational users found, skipping");
    return;
  }

  const now = new Date();
  const records: Array<{
    userId: string;
    loginAt: Date;
    logoutAt: Date;
  }> = [];

  for (let dayOffset = 5; dayOffset >= 0; dayOffset--) {
    for (const user of users) {
      const day = new Date(now);
      day.setDate(day.getDate() - dayOffset);

      const isMatutino = user.username === "victor" || user.username === "martin";
      const hourIn = isMatutino ? 6 : user.role.name === "MAINT" ? 10 : 14;
      const hourOut = isMatutino ? 14 : user.role.name === "MAINT" ? 18 : 22;

      const loginAt = new Date(day);
      loginAt.setHours(hourIn, 0, 0, 0);

      const logoutAt = new Date(day);
      logoutAt.setHours(hourOut, 0, 0, 0);

      records.push({ userId: user.id, loginAt, logoutAt });
    }
  }

  // Today: only clock-in, no clock-out (open entry) for half the users
  for (let i = 0; i < Math.ceil(users.length / 2); i++) {
    const user = users[i];
    const today = new Date();
    today.setHours(i % 2 === 0 ? 6 : 14, 0, 0, 0);

    const exists = await prisma.guardLoginLog.findFirst({
      where: {
        userId: user.id,
        logoutAt: null,
      },
    });

    if (!exists) {
      await prisma.guardLoginLog.create({
        data: { userId: user.id, loginAt: today },
      });
    }
  }

  // Batch insert historical records
  for (const record of records) {
    const exists = await prisma.guardLoginLog.findFirst({
      where: {
        userId: record.userId,
        loginAt: record.loginAt,
      },
    });
    if (!exists) {
      await prisma.guardLoginLog.create({ data: record });
    }
  }

  const total = await prisma.guardLoginLog.count();
  hackerLog.success("GUARD_LOGS", `${total} prenomina records seeded`);
};
