export function snapshot(input, c) {
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 100
  )
    throw Error("Enter a product name (maximum 100 characters).");
  if (!Array.isArray(input.ingredients) || !input.ingredients.length)
    throw Error("Choose ingredients.");
  const seen = new Set();
  const ingredients = input.ingredients.map((r) => {
    const i = c.ingredients.find((i) => i.id === r.id && i.active);
    if (
      !i ||
      seen.has(r.id) ||
      typeof r.percent !== "number" ||
      !Number.isFinite(r.percent) ||
      r.percent <= 0 ||
      r.percent > 100
    )
      throw Error("Invalid ingredient or percentage.");
    seen.add(r.id);
    return { ...i, percent: r.percent };
  });
  if (Math.abs(ingredients.reduce((s, i) => s + i.percent, 0) - 100) > 0.00001)
    throw Error("Ingredient percentages must total 100%.");
  const strength = c.strengths.find((s) => s.id === input.strengthId);
  if (!strength) throw Error("Choose an available strength.");
  return { ingredients, strength, sampleMl: c.sampleMl };
}
export function quantities(r, ml) {
  return {
    ingredients: r.ingredients.map((i) => ({
      name: i.name,
      ml: (((ml * r.strength.percent) / 100) * i.percent) / 100,
    })),
    baseMl: ml * (1 - r.strength.percent / 100),
  };
}
export function validateCatalog(c) {
  if (
    !c ||
    !Array.isArray(c.ingredients) ||
    !Array.isArray(c.sizes) ||
    !Array.isArray(c.strengths) ||
    !c.ingredients.length ||
    !c.sizes.length ||
    !c.strengths.length ||
    !Number.isFinite(c.sampleMl) ||
    c.sampleMl <= 0
  )
    throw Error("Invalid catalog.");
  for (const [key, rows] of Object.entries({
    ingredients: c.ingredients,
    sizes: c.sizes,
    strengths: c.strengths,
  })) {
    const ids = new Set();
    for (const r of rows) {
      if (typeof r.id !== "string" || !r.id || ids.has(r.id))
        throw Error("Catalog IDs must be unique.");
      ids.add(r.id);
      if (key === "sizes") {
        if (
          !Number.isFinite(r.ml) ||
          r.ml <= 0 ||
          !Number.isFinite(r.price) ||
          r.price < 0
        )
          throw Error("Invalid size or price.");
      } else if (typeof r.name !== "string" || !r.name.trim())
        throw Error("Names are required.");
      if (
        key === "strengths" &&
        (!Number.isFinite(r.percent) || r.percent <= 0 || r.percent > 100)
      )
        throw Error("Invalid strength.");
    }
  }
  return c;
}
