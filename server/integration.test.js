import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const base = process.env.TEST_URL || "http://localhost:3001";
const key = process.env.STAFF_KEY || "demo-staff";
const email = `test-${Date.now()}@example.com`;
let original;
async function request(
  route,
  { method = "GET", body, staff = false, status = 200 } = {},
) {
  const response = await fetch(base + "/api" + route, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(staff ? { Authorization: `Bearer ${key}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(
    response.status,
    status,
    `${method} ${route}: ${await response.clone().text()}`,
  );
  return response.json();
}
try {
  original = await request("/catalog");
  await request("/staff/overview", { status: 401 });
  const payload = {
    customer: { name: "Integration Test", phone: "555 010 2000", email },
    name: "Integration signature",
    ingredients: [
      { id: original.ingredients[0].id, percent: 60 },
      { id: original.ingredients[1].id, percent: 40 },
    ],
    strengthId: original.strengths[0].id,
  };
  await request("/submissions", {
    method: "POST",
    body: {
      ...payload,
      ingredients: [{ id: original.ingredients[0].id, percent: 99 }],
    },
    status: 400,
  });
  const submission = await request("/submissions", {
    method: "POST",
    body: payload,
    status: 201,
  });
  let overview = await request("/staff/overview", { staff: true });
  const formula = overview.formulas.find((f) => f.id === submission.id);
  assert.ok(formula);
  await request("/product/" + formula.token, { status: 404 });
  await request(`/staff/formulas/${formula.id}/approve`, {
    method: "POST",
    body: payload,
    staff: true,
  });
  await request(`/staff/formulas/${formula.id}/approve`, {
    method: "POST",
    body: payload,
    staff: true,
    status: 400,
  });
  const before = await request("/product/" + formula.token);
  const edited = structuredClone(original);
  edited.ingredients[0].name = "Catalog renamed";
  edited.strengths[0].percent = 25;
  await request("/staff/catalog", { method: "PUT", body: edited, staff: true });
  const after = await request("/product/" + formula.token);
  assert.deepEqual(
    after.snapshot,
    before.snapshot,
    "Approved recipe must not change with catalog",
  );
  const size = original.sizes.find((s) => s.active);
  const reorder = await request(`/product/${formula.token}/reorders`, {
    method: "POST",
    body: { sizeId: size.id },
    status: 201,
  });
  await request("/staff/reorders/" + reorder.id, {
    method: "PATCH",
    staff: true,
    body: { status: "COMPLETED" },
  });
  overview = await request("/staff/overview", { staff: true });
  assert.ok(
    overview.reorders.some(
      (r) => r.id === reorder.id && r.status === "COMPLETED",
    ),
  );
  assert.ok(
    overview.emails.some(
      (e) => e.recipient === email && e.body.includes(formula.token),
    ),
  );
  edited.ingredients[0].active = false;
  await request("/staff/catalog", { method: "PUT", body: edited, staff: true });
  assert.equal((await request("/product/" + formula.token)).available, false);
  await request(`/product/${formula.token}/reorders`, {
    method: "POST",
    body: { sizeId: size.id },
    status: 400,
  });
  const qr = await fetch(base + "/api/qr?token=" + formula.token);
  assert.equal(qr.status, 200);
  assert.match(await qr.text(), /<svg/);
  console.log(
    "PASS: validation, authentication, submission, approval, immutable snapshots, outbox, QR, reorder status and unavailable-ingredient protection.",
  );
} finally {
  if (original)
    await db.setting.update({
      where: { id: "catalog" },
      data: { data: JSON.stringify(original) },
    });
  const customer = await db.customer.findUnique({ where: { email } });
  if (customer) {
    const formulas = await db.formula.findMany({
      where: { customerId: customer.id },
    });
    await db.reorder.deleteMany({
      where: { formulaId: { in: formulas.map((f) => f.id) } },
    });
    await db.formula.deleteMany({ where: { customerId: customer.id } });
    await db.customer.delete({ where: { id: customer.id } });
  }
  await db.email.deleteMany({ where: { recipient: email } });
  await db.$disconnect();
}
