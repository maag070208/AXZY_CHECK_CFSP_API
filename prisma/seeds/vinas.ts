import { PrismaClient } from "@prisma/client";
import { hackerLog } from "./logger";
import bcrypt from "bcryptjs";

export const vinasDelMarSeed = async (prisma: PrismaClient) => {
    hackerLog.info('CLIENT', 'Seeding Vinas del mar Client, Zones and Locations');

    // 1. Create Client
    const client = await prisma.client.upsert({
        where: { name: "Vinas del mar" },
        update: {},
        create: { 
            name: "Vinas del mar",
            address: "Vinas del Mar, Tijuana",
            contactName: "Administrador Vinas",
            contactPhone: "6640000000"
        }
    });

    // 2. Create Zones
    const zones = [
        { name: "SECCION 1" },
        { name: "SECCION 2" },
        { name: "PARQUE" }
    ];

    const zoneRecords: any = {};

    for (const z of zones) {
        zoneRecords[z.name] = await prisma.zone.upsert({
            where: { name_clientId: { name: z.name, clientId: client.id } },
            update: {},
            create: { name: z.name, clientId: client.id }
        });
    }

    // 3. Create App User (Resident Role)
    const role = await prisma.role.findUnique({ where: { name: 'RESDN' } });
    if (role) {
        const hashedPassword = await bcrypt.hash("123123", 10);
        await prisma.user.upsert({
            where: { username: "vinasdelmar" },
            update: {
                clientId: client.id,
                roleId: role.id
            },
            create: {
                name: "Vinas del mar",
                lastName: "RESIDENTE",
                username: "vinasdelmar",
                password: hashedPassword,
                roleId: role.id,
                clientId: client.id
            }
        });
        hackerLog.success('CLIENT', 'App User "vinasdelmar" created/synced');
    }

    // 4. Create Locations
    // 10 Houses in SECCION 1
    for (let i = 1; i <= 10; i++) {
        const locName = `Vinas - SECCION 1 - CASA ${i}`;
        const zone = zoneRecords["SECCION 1"];
        await prisma.location.upsert({
            where: { name_zoneId: { name: locName, zoneId: zone.id } },
            update: { clientId: client.id },
            create: {
                name: locName,
                clientId: client.id,
                zoneId: zone.id
            }
        });
    }

    // 10 Houses in SECCION 2
    for (let i = 1; i <= 10; i++) {
        const locName = `Vinas - SECCION 2 - CASA ${i}`;
        const zone = zoneRecords["SECCION 2"];
        await prisma.location.upsert({
            where: { name_zoneId: { name: locName, zoneId: zone.id } },
            update: { clientId: client.id },
            create: {
                name: locName,
                clientId: client.id,
                zoneId: zone.id
            }
        });
    }

    // 5 Points in PARQUE
    const parquePoints = ["ENTRADA", "AREA JUEGOS", "CANCHA", "KOSKO", "SALIDA"];
    for (const point of parquePoints) {
        const locName = `Vinas - PARQUE - ${point}`;
        const zone = zoneRecords["PARQUE"];
        await prisma.location.upsert({
            where: { name_zoneId: { name: locName, zoneId: zone.id } },
            update: { clientId: client.id },
            create: {
                name: locName,
                clientId: client.id,
                zoneId: zone.id
            }
        });
    }

    hackerLog.success('CLIENT', `Seeded zones and locations for Vinas del mar`);
};
