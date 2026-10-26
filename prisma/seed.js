import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
const db = new PrismaClient();
const config = {
  ingredients: [
    {
      id: "bergamot",
      name: "Bergamot",
      family: "Citrus",
      color: "#d4ae4c",
      active: true,
    },
    {
      id: "neroli",
      name: "Neroli",
      family: "Floral",
      color: "#d69771",
      active: true,
    },
    {
      id: "rose",
      name: "Rose absolute",
      family: "Floral",
      color: "#bb6b82",
      active: true,
    },
    {
      id: "cedar",
      name: "Cedarwood",
      family: "Woody",
      color: "#9d7857",
      active: true,
    },
    {
      id: "sandalwood",
      name: "Sandalwood",
      family: "Woody",
      color: "#b49c78",
      active: true,
    },
    {
      id: "musk",
      name: "White musk",
      family: "Musk",
      color: "#8f9e92",
      active: true,
    },
  ],
  sizes: [
    { id: "travel", ml: 10, price: 18, active: true },
    { id: "signature", ml: 50, price: 65, active: true },
    { id: "collection", ml: 100, price: 110, active: true },
  ],
  strengths: [
    { id: "light", name: "Eau de toilette", percent: 10 },
    { id: "signature", name: "Eau de parfum", percent: 20 },
    { id: "intense", name: "Extrait", percent: 30 },
  ],
  sampleMl: 2,
};
await db.setting.upsert({
  where: { id: "catalog" },
  update: {},
  create: { id: "catalog", data: JSON.stringify(config) },
});
if (!(await db.customer.count())) {
  const c = await db.customer.create({
    data: {
      name: "Alex Morgan",
      phone: "+1 555 010 2040",
      email: "alex@example.com",
    },
  });
  await db.formula.create({
    data: {
      customerId: c.id,
      token: randomBytes(24).toString("hex"),
      name: "Sunday in Neroli",
      snapshot: JSON.stringify({
        ingredients: [
          { ...config.ingredients[0], percent: 35 },
          { ...config.ingredients[1], percent: 40 },
          { ...config.ingredients[3], percent: 25 },
        ],
        strength: config.strengths[1],
        sampleMl: 2,
      }),
      status: "PENDING",
    },
  });
}
await db.$disconnect();
