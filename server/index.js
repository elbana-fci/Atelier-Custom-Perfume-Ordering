import "dotenv/config";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { randomBytes, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import path from "node:path";
import { snapshot, validateCatalog } from "./formula.js";
const app = express(),
  db = new PrismaClient(),
  port = Number(process.env.PORT || 3001);
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  next();
});
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const catalog = async () =>
  JSON.parse(
    (await db.setting.findUniqueOrThrow({ where: { id: "catalog" } })).data,
  );
const decode = (f) => ({ ...f, snapshot: JSON.parse(f.snapshot) });
const origin = () => process.env.APP_URL || `http://localhost:${port}`;
const staff = (req, res, next) => {
  const supplied = Buffer.from(
      req.headers.authorization?.replace(/^Bearer /, "") || "",
    ),
    expected = Buffer.from(process.env.STAFF_KEY || "demo-staff");
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return res.status(401).json({ error: "Incorrect staff key." });
  next();
};
const windows = new Map();
app.use("/api", (req, res, next) => {
  if (req.method === "GET") return next();
  const now = Date.now(),
    key = req.ip;
  let w = windows.get(key);
  if (!w || w.until < now) {
    w = { until: now + 60000, count: 0 };
    windows.set(key, w);
  }
  if (++w.count > 100)
    return res
      .status(429)
      .json({ error: "Please wait a minute before trying again." });
  if (windows.size > 10000)
    for (const [k, v] of windows) if (v.until < now) windows.delete(k);
  next();
});
app.get(
  "/api/catalog",
  wrap(async (req, res) => res.json(await catalog())),
);
app.get(
  "/api/qr",
  wrap(async (req, res) => {
    const token = req.query.token;
    if (token && !/^[a-f0-9]{48}$/.test(token)) throw Error("Invalid link.");
    const url = origin() + (token ? `/product/${token}` : "/");
    res
      .type("svg")
      .send(
        await QRCode.toString(url, {
          type: "svg",
          width: 220,
          margin: 2,
          color: { dark: "#183e37", light: "#ffffff" },
        }),
      );
  }),
);
app.post(
  "/api/submissions",
  wrap(async (req, res) => {
    const { customer, ...input } = req.body;
    if (
      !customer ||
      typeof customer.name !== "string" ||
      !customer.name.trim() ||
      customer.name.length > 100 ||
      typeof customer.phone !== "string" ||
      customer.phone.length < 5 ||
      customer.phone.length > 40 ||
      typeof customer.email !== "string" ||
      customer.email.length > 254 ||
      !/^\S+@\S+\.\S+$/.test(customer.email)
    )
      throw Error("Please enter a valid name, phone and email.");
    const recipe = snapshot(input, await catalog());
    const result = await db.$transaction(async (tx) => {
      const c = await tx.customer.upsert({
        where: { email: customer.email.trim().toLowerCase() },
        update: {},
        create: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          email: customer.email.trim().toLowerCase(),
        },
      });
      return tx.formula.create({
        data: {
          customerId: c.id,
          name: input.name.trim(),
          snapshot: JSON.stringify(recipe),
          token: randomBytes(24).toString("hex"),
        },
      });
    });
    res.status(201).json({ id: result.id, name: result.name });
  }),
);
app.get(
  "/api/product/:token",
  wrap(async (req, res) => {
    const f = await db.formula.findUnique({
      where: { token: req.params.token },
    });
    if (!f || f.status !== "APPROVED")
      return res.status(404).json({ error: "This product is not available." });
    const c = await catalog();
    res.json({
      name: f.name,
      snapshot: JSON.parse(f.snapshot),
      sizes: c.sizes.filter((s) => s.active),
      available: JSON.parse(f.snapshot).ingredients.every((i) =>
        c.ingredients.some((x) => x.id === i.id && x.active),
      ),
    });
  }),
);
app.post(
  "/api/product/:token/reorders",
  wrap(async (req, res) => {
    const f = await db.formula.findUnique({
      where: { token: req.params.token },
    });
    if (!f || f.status !== "APPROVED") throw Error("Product unavailable.");
    const c = await catalog();
    if (
      !JSON.parse(f.snapshot).ingredients.every((i) =>
        c.ingredients.some((x) => x.id === i.id && x.active),
      )
    )
      throw Error("An ingredient is unavailable. Please contact the studio.");
    const size = c.sizes.find((s) => s.id === req.body.sizeId && s.active);
    if (!size) throw Error("Choose an available size.");
    const order = await db.reorder.create({
      data: { formulaId: f.id, sizeMl: size.ml, price: size.price },
    });
    res.status(201).json({ id: order.id });
  }),
);
app.use("/api/staff", staff);
app.get(
  "/api/staff/overview",
  wrap(async (req, res) =>
    res.json({
      formulas: (
        await db.formula.findMany({
          include: { customer: true },
          orderBy: { createdAt: "desc" },
        })
      ).map(decode),
      customers: await db.customer.findMany({ include: { formulas: true } }),
      reorders: await db.reorder.findMany({
        include: { formula: { include: { customer: true } } },
        orderBy: { createdAt: "desc" },
      }),
      emails: await db.email.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    }),
  ),
);
app.put(
  "/api/staff/catalog",
  wrap(async (req, res) => {
    const c = validateCatalog(req.body);
    await db.setting.update({
      where: { id: "catalog" },
      data: { data: JSON.stringify(c) },
    });
    res.json(c);
  }),
);
app.post(
  "/api/staff/formulas/:id/approve",
  wrap(async (req, res) => {
    const f = await db.formula.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { customer: true },
    });
    if (f.status === "APPROVED")
      throw Error(
        "Approved formulas are immutable. Create a new submission for a revision.",
      );
    const recipe = snapshot(req.body, await catalog());
    const link = `${origin()}/product/${f.token}`;
    const body = `Thank you, ${f.customer.name}! Your product ${req.body.name.trim()} is ready.\nStrength: ${recipe.strength.name} (${recipe.strength.percent}%).\nBlend: ${recipe.ingredients.map((i) => `${i.name} ${i.percent}%`).join(", ")}.\nView your product and request another bottle: ${link}`;
    const email = await db.$transaction(async (tx) => {
      const updated = await tx.formula.updateMany({
        where: { id: f.id, status: "PENDING" },
        data: {
          name: req.body.name.trim(),
          snapshot: JSON.stringify(recipe),
          status: "APPROVED",
        },
      });
      if (!updated.count) throw Error("This formula was already approved.");
      return tx.email.create({
        data: {
          recipient: f.customer.email,
          subject: `Your personal formula: ${req.body.name.trim()}`,
          body,
          status: process.env.SMTP_HOST ? "QUEUED" : "DEMO",
        },
      });
    });
    if (process.env.SMTP_HOST) {
      try {
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_PORT === "465",
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        });
        await transport.sendMail({
          from: process.env.SMTP_FROM,
          to: email.recipient,
          subject: email.subject,
          text: email.body,
        });
        await db.email.update({
          where: { id: email.id },
          data: { status: "SENT" },
        });
      } catch {
        await db.email.update({
          where: { id: email.id },
          data: { status: "FAILED" },
        });
      }
    }
    res.json({ ok: true, link });
  }),
);
app.patch(
  "/api/staff/reorders/:id",
  wrap(async (req, res) => {
    if (!["NEW", "IN_PROGRESS", "COMPLETED"].includes(req.body.status))
      throw Error("Invalid status.");
    res.json(
      await db.reorder.update({
        where: { id: req.params.id },
        data: { status: req.body.status },
      }),
    );
  }),
);
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));
app.use(express.static(path.resolve("dist")));
app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
app.use((err, req, res, next) => {
  console.error(err.message);
  res
    .status(400)
    .json({
      error: err.code
        ? "The record could not be processed."
        : err.message || "Request failed.",
    });
});
app.listen(port, "0.0.0.0", () =>
  console.log(
    `Atelier API: http://localhost:${port}; ${process.env.STAFF_KEY ? "configured staff key" : "local demo key: demo-staff"}`,
  ),
);
