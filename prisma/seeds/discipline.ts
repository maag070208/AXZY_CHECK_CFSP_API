import { PrismaClient } from "@prisma/client";
import { hackerLog } from "./logger";

const CATEGORIES = [
  { name: "FALTA", value: "Falta del guardia a su puesto" },
  { name: "RETARDO", value: "Retardo en la entrada al turno" },
  { name: "UNIFORME", value: "Incumplimiento del uniforme reglamentario" },
  { name: "CONDUCTA", value: "Mala conducta o comportamiento inapropiado" },
  { name: "RONDAS", value: "Incumplimiento en recorridos programados" },
];

const TYPES: { categoryName: string; types: { name: string; value: string }[] }[] = [
  {
    categoryName: "FALTA",
    types: [
      { name: "FALTA_JUSTIFICADA", value: "Falta Justificada" },
      { name: "FALTA_INJUSTIFICADA", value: "Falta Injustificada" },
    ],
  },
  {
    categoryName: "RETARDO",
    types: [
      { name: "RETARDO_LEVE", value: "Retardo menor a 15 min" },
      { name: "RETARDO_GRAVE", value: "Retardo mayor a 15 min" },
    ],
  },
  {
    categoryName: "UNIFORME",
    types: [
      { name: "SIN_UNIFORME", value: "Sin uniforme completo" },
      { name: "MAL_PRESENTADO", value: "Mala presentación" },
    ],
  },
  {
    categoryName: "CONDUCTA",
    types: [
      { name: "QUEJA_CLIENTE", value: "Queja del cliente" },
      { name: "CONDUCTA_INAPROPIADA", value: "Conducta inapropiada" },
    ],
  },
  {
    categoryName: "RONDAS",
    types: [
      { name: "RONDA_NO_REALIZADA", value: "Ronda no realizada" },
      { name: "CHECK_OMITIDO", value: "Checkpoint omitido" },
    ],
  },
];

export async function disciplineCatalogsSeed(prisma: PrismaClient) {
  hackerLog.header("Discipline Catalogs");

  for (const cat of CATEGORIES) {
    const existing = await prisma.incidentCategory.findUnique({
      where: { name: cat.name },
    });
    if (existing) {
      hackerLog.info("SKIP", `Category "${cat.name}" already exists`);
      continue;
    }

    const category = await prisma.incidentCategory.create({ data: { ...cat, type: "DISCIPLINE" } });
    hackerLog.success("CAT", `Created category: ${cat.name}`);

    const typesDef = TYPES.find((t) => t.categoryName === cat.name);
    if (typesDef) {
      for (const t of typesDef.types) {
        const existingType = await prisma.incidentType.findUnique({
          where: { name: t.name },
        });
        if (existingType) {
          hackerLog.info("SKIP", `Type "${t.name}" already exists`);
          continue;
        }
        await prisma.incidentType.create({
          data: { name: t.name, value: t.value, categoryId: category.id },
        });
        hackerLog.success("TYPE", `Created type: ${t.name}`);
      }
    }
  }

  hackerLog.success("DONE", "Discipline catalogs seeded");
}
