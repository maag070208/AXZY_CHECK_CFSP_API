import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { hackerLog } from "./logger";

export const securitySeed = async (prisma: PrismaClient) => {
  const password = await bcrypt.hash("123456", 10);
  hackerLog.info('SECURITY', 'Initializing Security Layer');

  // Get Roles
  const adminRole = await prisma.role.findUnique({ where: { name: "ADMIN" } });
  const guardRole = await prisma.role.findUnique({ where: { name: "GUARD" } });
  const shiftRole = await prisma.role.findUnique({ where: { name: "SHIFT" } });
  const maintRole = await prisma.role.findUnique({ where: { name: "MAINT" } });

  if (!adminRole || !guardRole || !shiftRole  || !maintRole) {
    hackerLog.error('SECURITY', 'Roles not found, check catalogs first');
    return;
  }

  // Get Schedules
  const matutino = await prisma.schedule.findUnique({ where: { name: "Matutino" } });
  const vespertino = await prisma.schedule.findUnique({ where: { name: "Vespertino" } });
  const nocturno = await prisma.schedule.findUnique({ where: { name: "Nocturno" } });

  // Get Clients
  const hotelPuertoNuevo = await prisma.client.findUnique({ where: { name: "Hotel Puerto Nuevo" } });

  // 1. ADMINS
  hackerLog.info('AUTH', 'Deploying Admin accounts');
  await prisma.user.upsert({
    where: { username: "admin" },
    update: { roleId: adminRole.id },
    create: {
      name: "Admin",
      lastName: "Principal",
      username: "admin",
      password,
      roleId: adminRole.id,
    },
  });

  await prisma.user.upsert({
    where: { username: "isabel" },
    update: { roleId: adminRole.id },
    create: {
      name: "Isabel",
      lastName: "Admin",
      username: "isabel",
      password,
      roleId: adminRole.id,
    },
  });

  // 2. GUARDS
  hackerLog.info('AUTH', 'Deploying Guard infrastructure');
  const guardUsers = [
    { username: "victor", name: "Victor", lastName: "Guardia", scheduleId: matutino?.id, clientId: hotelPuertoNuevo?.id },
    { username: "martin", name: "Martin", lastName: "Guardia", scheduleId: matutino?.id, clientId: hotelPuertoNuevo?.id },
    { username: "marco", name: "Marco", lastName: "Guardia", scheduleId: vespertino?.id, clientId: hotelPuertoNuevo?.id },
    { username: "asael", name: "Asael", lastName: "Guardia", scheduleId: nocturno?.id, clientId: hotelPuertoNuevo?.id },
  ];

  for (const u of guardUsers) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: { scheduleId: u.scheduleId, roleId: guardRole.id, clientId: u.clientId },
      create: {
        name: u.name,
        lastName: u.lastName,
        username: u.username,
        password,
        roleId: guardRole.id,
        scheduleId: u.scheduleId,
        clientId: u.clientId,
      },
    });

    if (u.clientId) {
      await prisma.assignmentLog.create({
        data: {
          guardId: user.id,
          clientId: u.clientId,
          type: "ASIGNADO",
          notes: "Asignado por script de inicialización"
        }
      });
    }
  }

  // 3. SHIFT GUARDS
  await prisma.user.upsert({
    where: { username: "ricardo" },
    update: { scheduleId: vespertino?.id, roleId: shiftRole.id, clientId: hotelPuertoNuevo?.id },
    create: {
      name: "Ricardo",
      lastName: "Shift",
      username: "ricardo",
      password,
      roleId: shiftRole.id,
      scheduleId: vespertino?.id,
      clientId: hotelPuertoNuevo?.id,
    },
  });

  // 4. MAINTENANCE
  hackerLog.info('AUTH', 'Deploying Maintenance personnel');
  await prisma.user.upsert({
    where: { username: "mario" },
    update: { roleId: maintRole.id, clientId: hotelPuertoNuevo?.id },
    create: {
      name: "Mario",
      lastName: "Mantenimiento",
      username: "mario",
      password,
      roleId: maintRole.id,
      clientId: hotelPuertoNuevo?.id,
    },
  });

  // 5. RESIDENT/CLIENT USER
  const resdnRole = await prisma.role.findUnique({ where: { name: "RESDN" } });
  if (resdnRole && hotelPuertoNuevo) {
    hackerLog.info('AUTH', 'Deploying Hotel Puerto Nuevo Resident account');
    await prisma.user.upsert({
      where: { username: "hotelpn" },
      update: { roleId: resdnRole.id, clientId: hotelPuertoNuevo.id },
      create: {
        name: "Hotel Puerto Nuevo",
        lastName: "CLIENTE",
        username: "hotelpn",
        password,
        roleId: resdnRole.id,
        clientId: hotelPuertoNuevo.id,
      },
    });
  }

  hackerLog.success('SECURITY', 'Security layer deployed');
};
