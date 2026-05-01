import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding Plaza 2000 data...");

    // 1. Create or get Client
    const client = await prisma.client.upsert({
        where: { id: 1 }, // Assuming ID 1 or just find by name
        update: { name: "Plaza 2000" },
        create: { name: "Plaza 2000" }
    });

    // 2. Create or get Zone (Recurrente)
    const zone = await prisma.zone.upsert({
        where: { id: 1 },
        update: { name: "BAJA", clientId: client.id },
        create: { name: "BAJA", clientId: client.id }
    });

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
            where: { 
                name_zoneId: {
                    name: fullName,
                    zoneId: zone.id
                }
            },
            update: {
                clientId: client.id,
                zoneId: zone.id,
                name: fullName
            },
            create: {
                clientId: client.id,
                zoneId: zone.id,
                name: fullName
            }
        });
    }

    console.log(`Seeded ${locations.length} locations for Plaza 2000.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
