import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLAZA_2000_DATA = {
  id: "bb2fda15-be33-4019-a11c-f9b1615b58cb",
  name: "Plaza 2000",
  zones: [
    {
      id: "bf0c6a52-936c-4bf8-bf40-8a1b1619fe0d",
      name: "BAJA",
      locations: [
        {
          id: "e212e851-8c4e-4037-9610-d78279e8ed22",
          name: "Plaza 2000-BAJA-Administracion",
        },
        {
          id: "5e7aedef-4f6d-4f2b-a5f5-7adebe0669f4",
          name: "Plaza 2000-BAJA-Altagama",
        },
        {
          id: "8da5fedd-123c-4bbd-b64f-5cd0a4d6f827",
          name: "Plaza 2000-BAJA-Carlos",
        },
        {
          id: "c54cfaa3-48d0-4f39-8049-e011310dc750",
          name: "Plaza 2000-BAJA-Fashion",
        },
        {
          id: "854583c0-6f80-44d1-af4d-e434951b3f55",
          name: "Plaza 2000-BAJA-Guero",
        },
        {
          id: "a5f15f6e-7180-4080-832a-a21c4863a5c6",
          name: "Plaza 2000-BAJA-Flexi",
        },
        {
          id: "092cd608-b5dd-4a80-943f-8088f663a7cb",
          name: "Plaza 2000-BAJA-Thrify",
        },
        {
          id: "194c9009-7da5-4127-821d-adf551c53710",
          name: "Plaza 2000-BAJA-Bocarosa",
        },
        {
          id: "c98052e5-0647-4160-88df-21cf59a8d291",
          name: "Plaza 2000-BAJA-Cinepolis",
        },
        {
          id: "b12955ee-7edb-4e7f-b1ac-9ab66478eb01",
          name: "Plaza 2000-BAJA-Worldshoes",
        },
        {
          id: "0efa69a4-5aa2-44e6-b31c-82ce1bb701bf",
          name: "Plaza 2000-BAJA-Converse",
        },
        {
          id: "7b0f10b3-cd3d-45c8-b0d8-e4e4197822b2",
          name: "Plaza 2000-BAJA-Bissu",
        },
        {
          id: "d0fbd629-a07c-4e00-a9f8-281aa61ab9c4",
          name: "Plaza 2000-BAJA-Elarca",
        },
        {
          id: "50196870-24b2-4de3-9683-89373da3f185",
          name: "Plaza 2000-BAJA-Macropay",
        },
        {
          id: "eb1d72a0-819c-4ee8-969b-1bcc47eb6236",
          name: "Plaza 2000-BAJA-Puntoeste",
        },
        {
          id: "514372fe-94d3-4b3d-b8b7-2daaa37d68c4",
          name: "Plaza 2000-BAJA-Gerzon",
        },
        {
          id: "89530e94-d2c2-4baa-88a5-5c2fd8ffb1ef",
          name: "Plaza 2000-BAJA-Fraiche",
        },
        {
          id: "d30c1e1b-2cd6-478d-a2b0-5d073e1624b2",
          name: "Plaza 2000-BAJA-Telcel",
        },
        {
          id: "498e6de1-78b7-4752-892b-494f242c6e39",
          name: "Plaza 2000-BAJA-NovedadesKere",
        },
        {
          id: "5345906e-af65-479e-bb5a-558313dfb0a2",
          name: "Plaza 2000-BAJA-JoyasAilyn",
        },
        {
          id: "a19a1c40-7718-417b-a8e9-f1cc602e8739",
          name: "Plaza 2000-BAJA-OpticaJireh",
        },
        {
          id: "4809cf99-dcfa-434d-b002-d2ed1ee695ca",
          name: "Plaza 2000-BAJA-Vitulia",
        },
        {
          id: "151e34d6-2fe0-4ef5-9805-bad27455b589",
          name: "Plaza 2000-BAJA-Comedor",
        },
        {
          id: "0dd047ff-6e1c-4c8a-ae8c-7131279367a8",
          name: "Plaza 2000-BAJA-ComedorK4you",
        },
        {
          id: "73091d32-dfd5-4eb1-a1a7-5f8b82873b7a",
          name: "Plaza 2000-BAJA-TortasCorona",
        },
        {
          id: "9c1624dc-4dc9-4dff-aeeb-5dd48a6e2bb6",
          name: "Plaza 2000-BAJA-FUYO",
        },
        {
          id: "3c52c91f-3a51-45e2-9ad9-a8cfbfe72664",
          name: "Plaza 2000-BAJA-BURRITOLOCO",
        },
        {
          id: "7e7feeba-5219-4823-8a04-f10e96615632",
          name: "Plaza 2000-BAJA-ASADEROHERMOSILLO",
        },
        {
          id: "adf234c6-657f-4907-bf69-a60e6b4bbb16",
          name: "Plaza 2000-BAJA-UMAMI",
        },
        {
          id: "1915f86f-4cdb-4703-b902-af9cab8724fc",
          name: "Plaza 2000-BAJA-BURGERKING",
        },
        {
          id: "f5f95564-6735-420c-8b85-9b6d54d43851",
          name: "Plaza 2000-BAJA-MONKKOK",
        },
        {
          id: "407fbdba-4937-4daa-a5c0-b758b2cc22c4",
          name: "Plaza 2000-BAJA-LAMARISQUERIA",
        },
        {
          id: "40092c5f-cbff-4743-9545-b1689fc025fa",
          name: "Plaza 2000-BAJA-GORDITASPEREZ",
        },
        {
          id: "41eda8ea-35ce-4f7b-9abb-704c1d68c9d1",
          name: "Plaza 2000-BAJA-YOKOMYSUSHI",
        },
        {
          id: "bd9034a3-1197-49ff-87b1-b4df78e0b69b",
          name: "Plaza 2000-BAJA-BANOHOMBRES",
        },
        {
          id: "aa173666-289b-4fdd-bb0b-565628cbcadf",
          name: "Plaza 2000-BAJA-BANOMUJERES",
        },
        {
          id: "0be31dd6-e39b-4077-96ee-00ec90c0f1bc",
          name: "Plaza 2000-BAJA-BeautySupply",
        },
        {
          id: "f3bd4de2-843c-4731-97b9-42d237bbfcb5",
          name: "Plaza 2000-BAJA-DbcDulceria",
        },
        {
          id: "d0b3983c-45ee-45ae-aed3-a42fa14669d2",
          name: "Plaza 2000-BAJA-Cesca",
        },
        {
          id: "9291426c-3b2f-42d1-89cc-15dd8835e55e",
          name: "Plaza 2000-BAJA-CambiarioFundadores",
        },
        {
          id: "63402f74-90e9-4afd-a8fb-62bfd0f9802a",
          name: "Plaza 2000-BAJA-AlexRelogeria",
        },
        {
          id: "a43ed58c-e43c-4f2f-801c-ad8da2567aa3",
          name: "Plaza 2000-BAJA-Calzapato",
        },
        {
          id: "abbf4cdc-ffaf-4e40-b596-e321faa06886",
          name: "Plaza 2000-BAJA-FinalStore",
        },
        {
          id: "8de78017-f95d-415e-9b67-1720a90b1c2a",
          name: "Plaza 2000-BAJA-Parisina",
        },
        {
          id: "6dbb30dd-c746-4999-a65d-52c1f6c70831",
          name: "Plaza 2000-BAJA-664",
        },
        {
          id: "46b278ba-acb5-4c56-9434-f096e7570e01",
          name: "Plaza 2000-BAJA-Urban tijuana",
        },
        {
          id: "c691c4d4-053b-4f97-af57-b034d90a90bf",
          name: "Plaza 2000-BAJA-Movistar",
        },
        {
          id: "8fe7aaf0-7e60-41b2-b9ff-0a278f0be8d4",
          name: "Plaza 2000-BAJA-Mona ",
        },
        {
          id: "b0fa2a16-e0a0-4574-9bd9-a631ad2fc18c",
          name: "Plaza 2000-BAJA-He comunicaciónes",
        },
        {
          id: "72deac09-c38b-45c8-8a0d-7b5f0198f980",
          name: "Plaza 2000-BAJA-La tiendita",
        },
        {
          id: "578d5666-bcb4-47e2-b460-d3841b532789",
          name: "Plaza 2000-BAJA-TelcelDistribuidor",
        },
        {
          id: "da0bd60b-21d1-4679-8f5c-79fd644cdd68",
          name: "Plaza 2000-BAJA-Banco hsbc",
        },
        {
          id: "92dd589f-f13a-43ad-ba51-fd286a30f98e",
          name: "Plaza 2000-BAJA-Reaplay",
        },
        {
          id: "3216603f-9921-4f59-9411-0add4e651b7b",
          name: "Plaza 2000-BAJA-Elegance",
        },
        {
          id: "cc9add62-e0b1-4f92-9ac6-4f75321683bd",
          name: "Plaza 2000-BAJA-Bella",
        },
        {
          id: "9006b0ac-0a47-4d63-8eb1-ce67eb89f912",
          name: "Plaza 2000-BAJA-Via",
        },
        {
          id: "20d9578a-be42-4949-bab7-3b5341b60cfa",
          name: "Plaza 2000-BAJA-Perfume place",
        },
        {
          id: "20a0faba-d15a-4bf9-a36b-c4d28f7dcd69",
          name: "Plaza 2000-BAJA-Todo para sus pies",
        },
        {
          id: "15fec785-499f-4250-ad71-0bc03c6faf8f",
          name: "Plaza 2000-BAJA-Casa musical",
        },
        {
          id: "8adfa129-b71d-4824-a9fe-af603abe2205",
          name: "Plaza 2000-BAJA-BIRRIERIACARMELITA",
        },
        {
          id: "0376c346-dc3c-40a2-be61-9b60a9329b82",
          name: "Plaza 2000-BAJA-Apachurro",
        },
        { id: "54989765-2058-4503-97cc-743e2fed56b0", name: "Contenedores" },
      ],
    },
    {
      id: "40d72f59-f36d-4207-bc70-84e8f422a66b",
      name: "ALTA",
      locations: [
        {
          id: "e3ba285b-9a9d-4938-a387-703f597db45e",
          name: "Plaza 2000-Alta-Promoda",
        },
        {
          id: "fc94d3a7-59bd-4fea-8940-4d9dde36839a",
          name: "Plaza 2000-Alta-Mugz",
        },
        {
          id: "24a5e771-e484-4756-982c-f392dff92f4a",
          name: "Plaza 2000-Alta-Baños",
        },
        {
          id: "9a923532-ff0d-4881-9ef2-ec8face82a22",
          name: "Plaza 2000-Alta-Escuela de corte de cabello",
        },
        {
          id: "a9eed196-40d4-4f92-83a6-189c8c434fa7",
          name: "Plaza 2000-Alta-Moldearte",
        },
        {
          id: "54b8a0b2-3526-41bd-acf2-838a855d0950",
          name: "Plaza 2000-Alta-Kzartir",
        },
        {
          id: "f2c53926-82b7-4d01-bba1-adf81edbc6a9",
          name: "Plaza 2000-Alta-Dominós pizza",
        },
        {
          id: "b85a4e5a-affe-40c7-9555-49e7e5801e97",
          name: "Plaza 2000-Alta-Chick in",
        },
        {
          id: "eeab88ed-b634-429a-bd4d-29fb3cd2ddd2",
          name: "Plaza 2000-Alta-Mi dentista",
        },
        {
          id: "5448ac90-6217-46cc-b050-5bb407146e9c",
          name: "Plaza 2000-Alta-Corazón toys",
        },
        {
          id: "68f34446-8e49-437f-88f9-25709a41121e",
          name: "Plaza 2000-Alta-Dolxezza",
        },
        {
          id: "50b52577-c074-4aa3-9c97-eb87704c4ecb",
          name: "Plaza 2000-Alta-Vsb",
        },
        {
          id: "eb639d3e-ee12-464b-a210-0b8ff961da55",
          name: "Plaza 2000-Alta-Inbursa",
        },
        {
          id: "a03fd61e-102c-444e-aa98-277ff8e5601d",
          name: "Plaza 2000-Alta-Sharon",
        },
        {
          id: "7ef80e0d-f66b-448b-bfe6-0980f82c784f",
          name: "Plaza 2000-Alta-El pozolito",
        },
        {
          id: "c4a826c5-757c-4d9b-928e-3d3e6435baf4",
          name: "Plaza 2000-Alta-Paci oytlet",
        },
        {
          id: "efb42932-cfba-4363-861f-4a5b268a0edc",
          name: "Plaza 2000-Alta-Guseppis",
        },
        {
          id: "cc990470-77a2-4f44-9d97-6eb34761bc7e",
          name: "Plaza 2000-Alta-D todo",
        },
        {
          id: "4e77fda2-21fb-4386-bb14-c5c44bfec56d",
          name: "Plaza 2000-Alta-Compartamos banco",
        },
        {
          id: "2bc3a724-bc97-4d9c-8fc9-cd5d8bc37952",
          name: "Plaza 2000-Alta-Kiosko telcel",
        },
        {
          id: "80ec594b-b60f-4eb7-8deb-cb09dd356b1f",
          name: "Plaza 2000-Alta-Tabú ",
        },
        {
          id: "3fe9cffb-09bc-4d9c-92c0-eeb31fb499b8",
          name: "Plaza 2000-Alta-Att",
        },
        {
          id: "4b10b1fb-3d39-4c37-91d9-edb5d633897b",
          name: "Plaza 2000-Alta-Fotoplus",
        },
        {
          id: "5fb31072-5a25-4973-ab4c-3a7436ebdaa8",
          name: "Plaza 2000-Alta-Papelia",
        },
        {
          id: "a344df1a-037f-45e3-8e09-d7ad4149a857",
          name: "Plaza 2000-Alta-Básica room",
        },
        {
          id: "2856fa2b-990f-47f7-b8e9-80741635dd62",
          name: "Plaza 2000-Alta-Pizza hut",
        },
        {
          id: "53552289-d6b4-4f54-9820-151ba3af1f60",
          name: "Plaza 2000-Alta-Holatea",
        },
        {
          id: "7cce5cc0-71f0-4d1e-a621-880798511582",
          name: "Plaza 2000-Alta-Na original ",
        },
        {
          id: "86dc2326-c486-454d-bc1f-d7cdc0227da9",
          name: "Plaza 2000-Alta-Coopel",
        },
        {
          id: "f6ff8db1-f444-400e-8873-b6bbeea74035",
          name: "Plaza 2000-Alta-axzydev",
        },
        {
          id: "0e69c67f-012f-44c3-bad6-cd34355eed58",
          name: "Plaza 2000-Alta-Tortaplaza",
        },
        {
          id: "4ade20c9-f104-4a60-981d-5b72a33c0cd6",
          name: "Plaza 2000-Alta-Cobranza coopel",
        },
        {
          id: "8882f3ff-6b5d-4019-bc04-e40f9d1965ee",
          name: "Plaza 2000-Alta-Panda",
        },
        {
          id: "7ec00d6f-885f-40da-b477-d7262aba8954",
          name: "Plaza 2000-Alta-Beauty  supply 2000",
        },
        {
          id: "3b1eb543-1acf-48c3-9fb9-325ab559b3be",
          name: "Plaza 2000-Alta-Vaga fashion",
        },
        {
          id: "bbb4982b-fa2a-47f8-8f22-c2ebaa964538",
          name: "Plaza 2000-Alta-Estrella",
        },
        {
          id: "d6652a6d-ab64-4e9f-895c-b3d9e5e199c6",
          name: "Plaza 2000-Alta-Pirma",
        },
        {
          id: "4b31a244-3ab3-46ce-8dad-bbbb0b0beb86",
          name: "Plaza 2000-Alta-Labcell",
        },
        {
          id: "ed2dbebf-ea1e-4f23-8a4d-19e922a4418e",
          name: "Plaza 2000-Alta-Llamas sport",
        },
        {
          id: "ceb68058-96d2-474d-b6e7-985ae78b63af",
          name: "Plaza 2000-Alta-Caffenio",
        },
        {
          id: "4c1c9e51-4b30-45ec-a54b-0438793afdf9",
          name: "Plaza 2000-Alta-Fraiche",
        },
        {
          id: "71e8834b-0367-412b-9beb-0dad6709fe2e",
          name: "Plaza 2000-Alta-La mexicana",
        },
        {
          id: "b98f251e-5481-4975-843a-0d7d34c3eb0d",
          name: "Plaza 2000-Alta-Kiosko telcel 2",
        },
        {
          id: "9263564c-f3a1-49b0-9773-6e61b3d50e60",
          name: "Plaza 2000-Alta-D volada",
        },
        {
          id: "60c4ac96-8906-43d5-a371-a4af0e0eea48",
          name: "Plaza 2000-Alta-Kiosko movistar",
        },
        {
          id: "423c4fc8-0bef-43a5-a94a-0ed547b77b57",
          name: "Plaza 2000-Alta-Little caesar",
        },
        {
          id: "34cfe261-6880-4406-b964-f53066557dcc",
          name: "Plaza 2000-Alta-Kiosko Burger king",
        },
        {
          id: "f6cfb53e-ae8f-4117-b6c6-edc265753c1f",
          name: "Plaza 2000-Alta-Mundo optico",
        },
        {
          id: "9ee27c5d-09a1-4983-867c-aec36a360271",
          name: "Plaza 2000-Alta-Calzzasport",
        },
        {
          id: "ffdb5dc9-5702-4d63-87d1-56ea741c4c3a",
          name: "Plaza 2000-Alta-La mejor empeños",
        },
        {
          id: "6dd6925e-0d51-4eab-8b3e-730c6071e057",
          name: "Plaza 2000-Alta-Telnor",
        },
        {
          id: "cc806fc8-93ba-4a11-966e-2b5075611edc",
          name: "Plaza 2000-Alta-Botanica",
        },
        {
          id: "0559075e-0888-418b-bd41-dd78678187b4",
          name: "Plaza 2000-Alta-Kiosko mundoloco",
        },
        {
          id: "d12ce0a9-3f79-4d1e-bdac-883eabf2d6f9",
          name: "Plaza 2000-Alta-The oye barber",
        },
        {
          id: "17a02d90-9e1e-4803-89e3-96d69c2c3485",
          name: "Plaza 2000-Alta-Mg wireless",
        },
        {
          id: "1baaa08c-cd34-478f-94c3-08c98effb269",
          name: "Plaza 2000-Alta-Bling bling",
        },
        {
          id: "d44746e8-c793-4ed7-8511-caff8b172ec5",
          name: "Plaza 2000-Alta-Gold dentista",
        },
        {
          id: "02a6d04a-0910-499d-957d-6b5534ae4f13",
          name: "Plaza 2000-Alta-Concord",
        },
        {
          id: "8897584d-eced-4e5f-baa8-b7af8e0b5fb1",
          name: "Plaza 2000-Alta-Perros y gatos",
        },
        {
          id: "a27395eb-e07e-41c8-a3d8-ceee901836f1",
          name: "Plaza 2000-Alta-Lagarde",
        },
        {
          id: "84df6407-8f23-434e-adbd-d97974ef7003",
          name: "Plaza 2000-Alta-Telcel distribuidor ",
        },
        {
          id: "0a84ace4-5e77-44e4-b5dc-b823dd09237d",
          name: "Plaza 2000-Alta-Kfc",
        },
        {
          id: "a4168d79-5450-4c18-ae57-8bd182190784",
          name: "Plaza 2000-Alta-Brokian",
        },
        {
          id: "1420584b-883d-40ca-81dc-f4302d841823",
          name: "Plaza 2000-Alta-Minizo",
        },
        {
          id: "01f4ddb8-8ecd-42ae-a76d-feb10b289adb",
          name: "Plaza 2000-Alta-FirstCash",
        },
        {
          id: "1d21f929-11a2-4e3f-bd82-22297f9b7fa9",
          name: "Plaza 2000-Alta-Contenedores",
        },
        {
          id: "a8f49cbf-1a05-4910-af4a-47dd2338a742",
          name: "Plaza 2000-Alta-Suburbia",
        },
        {
          id: "0e083707-1aa7-4cb4-8be6-546b132fc73f",
          name: "Plaza 2000-Alta-Beluna",
        },
        {
          id: "eb19abcb-ddc6-484e-b154-369a6c6e4d28",
          name: "Plaza 2000-Alta-Plaza alta gama",
        },
        {
          id: "14499372-5cff-470f-b8a7-3bef7e679c36",
          name: "Plaza 2000-Alta-Walmart",
        },
        {
          id: "1b27dd73-204f-49f1-bfa9-649c47411f89",
          name: "Plaza 2000-Alta-La favorita ",
        },
      ],
    },
  ],
};

export async function seedPlaza2000Full() {
  console.log("Seeding Plaza 2000 with Fixed IDs...");

  // 1. Client
  await prisma.client.upsert({
    where: { id: PLAZA_2000_DATA.id },
    update: { name: PLAZA_2000_DATA.name },
    create: {
      id: PLAZA_2000_DATA.id,
      name: PLAZA_2000_DATA.name,
    },
  });

  for (const zone of PLAZA_2000_DATA.zones) {
    // 2. Zone
    await prisma.zone.upsert({
      where: { id: zone.id },
      update: { name: zone.name, clientId: PLAZA_2000_DATA.id },
      create: {
        id: zone.id,
        name: zone.name,
        clientId: PLAZA_2000_DATA.id,
      },
    });

    // 3. Locations
    for (const loc of zone.locations) {
      await prisma.location.upsert({
        where: { id: loc.id },
        update: {
          name: loc.name,
          clientId: PLAZA_2000_DATA.id,
          zoneId: zone.id,
        },
        create: {
          id: loc.id,
          name: loc.name,
          clientId: PLAZA_2000_DATA.id,
          zoneId: zone.id,
        },
      });
    }
  }

  console.log(
    `Successfully seeded Plaza 2000 with ${PLAZA_2000_DATA.zones.reduce((acc, z) => acc + z.locations.length, 0)} locations.`,
  );
}
