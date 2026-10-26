import test from "node:test";
import assert from "node:assert/strict";
import { snapshot, quantities, validateCatalog } from "./formula.js";
const catalog = {
  ingredients: [
    { id: "a", name: "Rose", active: true },
    { id: "b", name: "Cedar", active: true },
  ],
  strengths: [{ id: "edp", name: "EDP", percent: 20 }],
  sizes: [{ id: "small", ml: 50, price: 65, active: true }],
  sampleMl: 2,
};
const input = {
  name: "Test",
  ingredients: [
    { id: "a", percent: 60 },
    { id: "b", percent: 40 },
  ],
  strengthId: "edp",
};
test("quantities preserve total volume at sample and bottle sizes", () => {
  const r = snapshot(input, catalog);
  for (const ml of [2, 10, 50, 100]) {
    const q = quantities(r, ml);
    assert.ok(
      Math.abs(q.ingredients.reduce((s, i) => s + i.ml, 0) + q.baseMl - ml) <
        1e-10,
    );
  }
  assert.equal(quantities(r, 50).ingredients[0].ml, 6);
});
test("reject invalid totals, duplicates, unavailable ingredients and strength", () => {
  for (const changes of [
    { ingredients: [{ id: "a", percent: 99 }] },
    {
      ingredients: [
        { id: "a", percent: 50 },
        { id: "a", percent: 50 },
      ],
    },
    { ingredients: [{ id: "missing", percent: 100 }] },
    { strengthId: "unknown" },
    {
      ingredients: [
        { id: "a", percent: -10 },
        { id: "b", percent: 110 },
      ],
    },
  ])
    assert.throws(() => snapshot({ ...input, ...changes }, catalog));
});
test("catalog edits cannot mutate a serialized approved snapshot", () => {
  const saved = JSON.stringify(snapshot(input, catalog));
  const changed = structuredClone(catalog);
  changed.ingredients[0].name = "Changed";
  changed.strengths[0].percent = 30;
  assert.equal(JSON.parse(saved).ingredients[0].name, "Rose");
  assert.equal(JSON.parse(saved).strength.percent, 20);
});
test("catalog rejects negative prices and strengths over 100%", () => {
  const c = structuredClone(catalog);
  c.sizes[0].price = -1;
  assert.throws(() => validateCatalog(c));
  c.sizes[0].price = 1;
  c.strengths[0].percent = 101;
  assert.throws(() => validateCatalog(c));
});
