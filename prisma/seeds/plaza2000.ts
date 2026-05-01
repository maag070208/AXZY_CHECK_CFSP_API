import { PrismaClient } from "@prisma/client";
import { hackerLog } from "./logger";
import bcrypt from "bcryptjs";

export const plaza2000Seed = async (prisma: PrismaClient) => {
    hackerLog.info('CLIENT', 'Seeding Plaza 2000 Client, Locations and App User');

    // 1. Create Client
    const client = await prisma.client.upsert({
        where: { name: "Plaza 2000" },
        update: { 
            address: "Blvd. Paseo 2000",
            rfc: "AAGM020708EL5",
            contactName: "MARTIN AMARO",
            contactPhone: "6645102632"
        },
        create: { 
            name: "Plaza 2000",
            address: "Blvd. Paseo 2000",
            rfc: "AAGM020708EL5",
            contactName: "MARTIN AMARO",
            contactPhone: "6645102632"
        }
    });

    // 2. Create Zone (Recurrente)
    const zone = await prisma.zone.upsert({
        where: { name_clientId: { name: "BAJA", clientId: client.id } },
        update: {},
        create: { name: "BAJA", clientId: client.id }
    });

    // 3. Create App User
    const role = await prisma.role.findUnique({ where: { name: 'RESDN' } });
    if (role) {
        const hashedPassword = await bcrypt.hash("plaza2000", 10);
        await prisma.user.upsert({
            where: { username: "plaza2000" },
            update: {
                clientId: client.id,
                roleId: role.id
            },
            create: {
                name: "Plaza 2000",
                lastName: "CLIENTE",
                username: "plaza2000",
                password: hashedPassword,
                roleId: role.id,
                clientId: client.id
            }
        });
        hackerLog.success('CLIENT', 'App User "plaza2000" created/synced');
    }

    const locations = [
        "Casa musical", "Administracion", "Altagama", "Carlos", "Fashion", "Guero", "Flexi", "Thrify", "Bocarosa", "Cinepolis",
        "Worldshoes", "Converse", "Bissu", "Elarca", "Macropay", "Puntoeste", "Gerzon", "Fraiche", "Telcel", "NovedadesKere",
        "JoyasAilyn", "OpticaJireh", "Vitulia", "Comedor", "ComedorK4you", "TortasCorona", "FUYO", "BURRITOLOCO", "BIRRIERIACARMELITA",
        "ASADEROHERMOSILLO", "UMAMI", "BURGERKING", "MONKKOK", "LAMARISQUERIA", "GORDITASPEREZ", "YOKOMYSUSHI", "BANOHOMBRES", "BANOMUJERES",
        "BeautySupply", "DbcDulceria", "Apachurro", "Cesca", "CambiarioFundadores", "AlexRelogeria", "Calzapato", "FinalStore", "Parisina",
        "664", "Urban tijuana", "Movistar", "Mona ", "He comunicaciónes", "La tiendita", "TelcelDistribuidor", "Banco hsbc", "Reaplay",
        "Elegance", "Bella", "Via", "Perfume place", "Todo para sus pies", "Coppel"
    ];

    for (const locName of locations) {
        const fullName = `Plaza 2000-BAJA-${locName}`;
        await prisma.location.upsert({
            where: { name_zoneId: { name: fullName, zoneId: zone.id } },
            update: {
                clientId: client.id,
                name: fullName
            },
            create: {
                clientId: client.id,
                zoneId: zone.id,
                name: fullName
            }
        });
    }

    hackerLog.success('CLIENT', `Seeded ${locations.length} locations for Plaza 2000`);
};
