import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );
async function api(url, options = {}) {
  const { staff, ...rest } = options;
  const r = await fetch("/api" + url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(staff
        ? {
            Authorization: `Bearer ${sessionStorage.getItem("staffKey") || ""}`,
          }
        : {}),
      ...rest.headers,
    },
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Request failed");
  return d;
}
const post = (url, body, staff = false) =>
  api(url, { method: "POST", body: JSON.stringify(body), staff });
function App() {
  const [config, setConfig] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("/catalog")
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);
  if (!config)
    return (
      <main className="loading">
        <span className="mark">a.</span>
        <p>{error || "Preparing your atelier…"}</p>
      </main>
    );
  const token = location.pathname.startsWith("/product/")
    ? location.pathname.split("/")[2]
    : null;
  return token ? (
    <Product token={token} />
  ) : location.pathname.startsWith("/staff") ? (
    <Staff config={config} setConfig={setConfig} />
  ) : (
    <Customer config={config} />
  );
}
function Brand() {
  return (
    <a className="brand" href="/">
      atelier<span>FORMULA STUDIO</span>
    </a>
  );
}
function Alert({ children }) {
  return children ? (
    <div className="alert" role="alert">
      {children}
    </div>
  ) : null;
}
function Blend({ config, rows, setRows, strengthId, setStrengthId }) {
  const total = rows.reduce((s, i) => s + Number(i.percent || 0), 0);
  function toggle(i) {
    setRows(
      rows.some((r) => r.id === i.id)
        ? rows.filter((r) => r.id !== i.id)
        : [...rows, { id: i.id, percent: 0 }],
    );
  }
  return (
    <>
      <div className="section-head">
        <div>
          <span className="eyebrow">THE PALETTE</span>
          <h2>Find your balance.</h2>
        </div>
        <span className="muted">{rows.length} selected</span>
      </div>
      <div className="ingredients">
        {config.ingredients
          .filter((i) => i.active)
          .map((i) => {
            const selected = rows.some((r) => r.id === i.id);
            return (
              <button
                type="button"
                key={i.id}
                className={"ingredient " + (selected ? "selected" : "")}
                aria-pressed={selected}
                onClick={() => toggle(i)}
              >
                <span
                  className="swatch"
                  style={{ background: i.color || "#a8b6a7" }}
                >
                  {i.name[0]}
                </span>
                <span>
                  <strong>{i.name}</strong>
                  <small>{i.family || "Ingredient"}</small>
                </span>
                <span className="check">{selected ? "✓" : "+"}</span>
              </button>
            );
          })}
      </div>
      {rows.length > 0 && (
        <div className="ratios">
          <div className="section-head">
            <h3>Your blend</h3>
            <strong
              className={Math.abs(total - 100) < 0.00001 ? "good" : "warm"}
            >
              {total.toFixed(1).replace(".0", "")} / 100%
            </strong>
          </div>
          <div className="meter">
            {rows.map((r) => (
              <span
                key={r.id}
                style={{
                  width: `${r.percent}%`,
                  background: config.ingredients.find((i) => i.id === r.id)
                    ?.color,
                }}
              />
            ))}
          </div>
          {rows.map((r) => (
            <label className="ratio" key={r.id}>
              <span>
                {config.ingredients.find((i) => i.id === r.id)?.name || r.id}
              </span>
              <input
                aria-label={`${r.id} percentage`}
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={r.percent}
                onChange={(e) =>
                  setRows(
                    rows.map((x) =>
                      x.id === r.id
                        ? { ...x, percent: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
              <span>%</span>
            </label>
          ))}
          <small className="muted">
            Each ingredient must be above 0%. Together, they must total 100%.
          </small>
        </div>
      )}
      <div className="section-head space">
        <div>
          <span className="eyebrow">THE INTENSITY</span>
          <h2>Make your impression.</h2>
        </div>
      </div>
      <div className="strengths">
        {config.strengths.map((s) => (
          <button
            type="button"
            key={s.id}
            aria-pressed={s.id === strengthId}
            className={s.id === strengthId ? "active" : ""}
            onClick={() => setStrengthId(s.id)}
          >
            <strong>{s.percent}%</strong>
            <span>{s.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}
function Customer({ config }) {
  const [rows, setRows] = useState([]),
    [strengthId, setStrengthId] = useState(
      config.strengths[1]?.id || config.strengths[0].id,
    ),
    [name, setName] = useState(""),
    [customer, setCustomer] = useState({ name: "", phone: "", email: "" }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await post("/submissions", {
        name,
        customer,
        ingredients: rows,
        strengthId,
      });
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="topbar">
        <Brand />
        <a href="/staff" className="text-link">
          Staff workspace ↗
        </a>
      </header>
      <main className="customer-layout">
        <aside className="story">
          <span className="eyebrow">PERSONAL BY NATURE</span>
          <h1>
            A little instinct.
            <br />A little alchemy.
            <br />
            <em>Entirely you.</em>
          </h1>
          <p>
            Choose the notes that feel like you. We’ll turn them into a scent
            with your name on it.
          </p>
          <div className="bottle-art" aria-hidden="true">
            <div className="bottle-cap" />
            <div className="bottle">
              <div className="bottle-label">
                atelier
                <br />
                <span>YOUR SIGNATURE SCENT</span>
                <i>№ 01</i>
              </div>
            </div>
            <div className="orbit" />
          </div>
          <div className="story-foot">
            <span>01 / CREATE</span>
            <span>02 / REFINE</span>
            <span>03 / MAKE IT YOURS</span>
          </div>
        </aside>
        <section className="creation">
          {done ? (
            <div className="success">
              <span className="success-icon">✓</span>
              <span className="eyebrow">YOUR NEXT SIGNATURE</span>
              <h2>Your formula is with us.</h2>
              <p>
                Our team will refine <strong>{name}</strong> and prepare your
                sample. After approval, we’ll email your saved product and
                reorder link to <strong>{customer.email}</strong>.
              </p>
              <button
                onClick={() => {
                  setDone(false);
                  setRows([]);
                  setName("");
                }}
              >
                Create another formula
              </button>
              <a href="/staff">Explore the staff demo ↗</a>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="section-head">
                <span className="eyebrow">CREATE YOUR SIGNATURE</span>
                <span className="pill">Made with you</span>
              </div>
              <h2 className="intro-title">Good things start with you.</h2>
              <p className="muted">
                A few details, a few favourite notes. Let’s begin.
              </p>
              <div className="contact">
                <label>
                  Your name
                  <input
                    required
                    maxLength="100"
                    autoComplete="name"
                    value={customer.name}
                    onChange={(e) =>
                      setCustomer({ ...customer, name: e.target.value })
                    }
                    placeholder="Alex Morgan"
                  />
                </label>
                <div className="two">
                  <label>
                    Phone
                    <input
                      required
                      type="tel"
                      autoComplete="tel"
                      minLength="5"
                      maxLength="40"
                      value={customer.phone}
                      onChange={(e) =>
                        setCustomer({ ...customer, phone: e.target.value })
                      }
                      placeholder="Your phone number"
                    />
                  </label>
                  <label>
                    Email
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={customer.email}
                      onChange={(e) =>
                        setCustomer({ ...customer, email: e.target.value })
                      }
                      placeholder="you@example.com"
                    />
                  </label>
                </div>
              </div>
              <Blend
                {...{ config, rows, setRows, strengthId, setStrengthId }}
              />
              <label className="space">
                Give your creation a name
                <input
                  required
                  maxLength="100"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sunday in Neroli"
                />
              </label>
              <Alert>{error}</Alert>
              <button className="primary wide" disabled={busy}>
                {busy ? "Sending…" : "Send my formula"} <span>↗</span>
              </button>
              <p className="fine">
                Your details are used to save your formula and send product
                updates. Demo only — use fictional contact details.
              </p>
            </form>
          )}
        </section>
      </main>
      <footer>
        ATELIER FORMULA STUDIO <span>A signature worth keeping.</span>
      </footer>
    </>
  );
}
function Product({ token }) {
  const [data, setData] = useState(null),
    [sizeId, setSizeId] = useState(""),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/product/" + token)
      .then((d) => {
        setData(d);
        setSizeId(d.sizes[0]?.id || "");
      })
      .catch((e) => setError(e.message));
  }, [token]);
  return (
    <>
      <header className="topbar">
        <Brand />
        <span className="eyebrow">YOUR PERSONAL COLLECTION</span>
      </header>
      <main className="product-page">
        <span className="eyebrow">SAVED, JUST FOR YOU</span>
        <h1>{data?.name || "Your signature"}</h1>
        <Alert>{error}</Alert>
        {data && (
          <>
            <p className="muted">
              {data.snapshot.strength.name} · {data.snapshot.strength.percent}%
              concentration
            </p>
            <div className="note-list">
              {data.snapshot.ingredients.map((i) => (
                <div key={i.id}>
                  <span className="dot" style={{ background: i.color }} />
                  {i.name}
                  <strong>{i.percent}%</strong>
                </div>
              ))}
            </div>
            <h2>A familiar feeling. A fresh bottle.</h2>
            {!data.available ? (
              <Alert>
                One of your ingredients is currently unavailable. Please contact
                the studio.
              </Alert>
            ) : done ? (
              <div className="notice" role="status">
                Your reorder request is with the studio. Staff will arrange
                fulfilment with you.
              </div>
            ) : (
              <>
                <label>
                  Bottle size
                  <select
                    value={sizeId}
                    onChange={(e) => setSizeId(e.target.value)}
                  >
                    {data.sizes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.ml} ml — {money(s.price)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={busy || !sizeId}
                  className="primary wide"
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await post(`/product/${token}/reorders`, { sizeId });
                      setDone(true);
                    } catch (e) {
                      setError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Sending…" : "Request another bottle ↗"}
                </button>
                <p className="fine">
                  This creates a request only. No payment is taken.
                </p>
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
function Staff({ config, setConfig }) {
  const [logged, setLogged] = useState(!!sessionStorage.getItem("staffKey")),
    [key, setKey] = useState(""),
    [tab, setTab] = useState("Formulas"),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(null);
  async function load() {
    try {
      const d = await api("/staff/overview", { staff: true });
      setData(d);
      setError("");
    } catch (e) {
      setError(e.message);
      if (e.message.includes("key")) {
        setLogged(false);
        sessionStorage.removeItem("staffKey");
      }
    }
  }
  useEffect(() => {
    if (!logged) return;
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [logged]);
  if (!logged)
    return (
      <>
        <header className="topbar">
          <Brand />
          <a href="/">Customer view ↗</a>
        </header>
        <main className="login">
          <span className="eyebrow">BEHIND THE FORMULA</span>
          <h1>Staff workspace.</h1>
          <p className="muted">
            Local demo key: <code>demo-staff</code>. A configured STAFF_KEY
            replaces it.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sessionStorage.setItem("staffKey", key);
              setLogged(true);
            }}
          >
            <label>
              Staff access key
              <input
                type="password"
                required
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </label>
            <Alert>{error}</Alert>
            <button className="primary wide">Open workspace ↗</button>
          </form>
        </main>
      </>
    );
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Brand />
        <span className="eyebrow nav-label">WORKSPACE</span>
        <nav>
          {[
            "Formulas",
            "Reorders",
            "Customers",
            "Administration",
            "Email outbox",
          ].map((t) => (
            <button
              key={t}
              className={tab === t ? "current" : ""}
              onClick={() => {
                setTab(t);
                setSelected(null);
                setSearch("");
              }}
            >
              <span>
                {
                  {
                    Formulas: "◈",
                    Reorders: "↻",
                    Customers: "◎",
                    Administration: "⚙",
                    "Email outbox": "✉",
                  }[t]
                }
              </span>
              {t}
              {t === "Reorders" &&
                data?.reorders.some((r) => r.status === "NEW") && (
                  <b className="nav-dot" />
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="/">Open customer view ↗</a>
          <button
            onClick={() => {
              sessionStorage.removeItem("staffKey");
              setLogged(false);
            }}
          >
            Sign out
          </button>
          <small>ATELIER · DEMO WORKSPACE</small>
        </div>
      </aside>
      <main className="staff-main">
        <div className="staff-header">
          <div>
            <span className="eyebrow">ATELIER / WORKSPACE</span>
            <h1>{tab === "Formulas" ? "Every signature starts here." : tab}</h1>
          </div>
          <span className="pill">● Live workspace</span>
        </div>
        <Alert>{error}</Alert>
        {data && (
          <>
            <div className="stats">
              <div>
                <span>Awaiting refinement</span>
                <strong>
                  {data.formulas
                    .filter((f) => f.status === "PENDING")
                    .length.toString()
                    .padStart(2, "0")}
                </strong>
              </div>
              <div>
                <span>Saved signatures</span>
                <strong>
                  {data.formulas
                    .filter((f) => f.status === "APPROVED")
                    .length.toString()
                    .padStart(2, "0")}
                </strong>
              </div>
              <div>
                <span>Open reorder requests</span>
                <strong>
                  {data.reorders
                    .filter((r) => r.status !== "COMPLETED")
                    .length.toString()
                    .padStart(2, "0")}
                </strong>
              </div>
            </div>
            {tab === "Formulas" &&
              (selected ? (
                <Editor
                  key={selected.id}
                  formula={selected}
                  config={config}
                  onClose={() => setSelected(null)}
                  onSaved={async () => {
                    setSelected(null);
                    await load();
                  }}
                />
              ) : (
                <section className="panel">
                  <div className="section-head">
                    <div>
                      <h2>Your formula desk</h2>
                      <p className="muted">
                        Review, refine and save something personal.
                      </p>
                    </div>
                    <input
                      className="search"
                      aria-label="Search formulas"
                      placeholder="Search name, customer or email…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>PRODUCT / CUSTOMER</th>
                          <th>BLEND</th>
                          <th>STRENGTH</th>
                          <th>STATUS</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {data.formulas
                          .filter((f) =>
                            (
                              f.name +
                              " " +
                              f.customer.name +
                              " " +
                              f.customer.email
                            )
                              .toLowerCase()
                              .includes(search.toLowerCase()),
                          )
                          .map((f) => (
                            <tr key={f.id}>
                              <td>
                                <strong>{f.name}</strong>
                                <small>
                                  {f.customer.name} ·{" "}
                                  {new Date(f.createdAt).toLocaleDateString()}
                                </small>
                              </td>
                              <td>
                                {f.snapshot.ingredients.length} ingredients
                              </td>
                              <td>{f.snapshot.strength.percent}%</td>
                              <td>
                                <span
                                  className={"badge " + f.status.toLowerCase()}
                                >
                                  {f.status === "PENDING"
                                    ? "Needs review"
                                    : "Approved"}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="text-link"
                                  onClick={() => setSelected(f)}
                                >
                                  {f.status === "PENDING" ? "Refine" : "View"}{" "}
                                  ↗
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {!data.formulas.length && (
                    <p>
                      No formulas yet. Open the customer view to create one.
                    </p>
                  )}
                </section>
              ))}
            {tab === "Reorders" && (
              <section className="panel">
                <h2>Another bottle, same signature.</h2>
                {!data.reorders.length && (
                  <p className="muted">
                    Reorder requests will appear here when customers use their
                    saved product link.
                  </p>
                )}
                {data.reorders.map((r) => (
                  <div className="order-row" key={r.id}>
                    <div>
                      <strong>{r.formula.name}</strong>
                      <small>
                        {r.formula.customer.name} · {r.formula.customer.phone} ·{" "}
                        {r.formula.customer.email}
                      </small>
                    </div>
                    <span>
                      {r.sizeMl} ml · {money(r.price)}
                    </span>
                    <select
                      aria-label="Request status"
                      value={r.status}
                      onChange={async (e) => {
                        try {
                          await api("/staff/reorders/" + r.id, {
                            staff: true,
                            method: "PATCH",
                            body: JSON.stringify({ status: e.target.value }),
                          });
                          load();
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      {["NEW", "IN_PROGRESS", "COMPLETED"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </section>
            )}
            {tab === "Customers" && (
              <section className="panel">
                <div className="section-head">
                  <h2>Your customer book</h2>
                  <input
                    aria-label="Search customers"
                    placeholder="Search name, email or phone…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {data.customers
                  .filter((c) =>
                    (c.name + c.email + c.phone)
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((c) => (
                    <div key={c.id} className="customer-row">
                      <div className="avatar">{c.name[0]}</div>
                      <div>
                        <strong>{c.name}</strong>
                        <small>
                          {c.email} · {c.phone}
                        </small>
                        <div className="customer-formulas">
                          {data.formulas
                            .filter((f) => f.customerId === c.id)
                            .map((f) => (
                              <button
                                key={f.id}
                                onClick={() => {
                                  setTab("Formulas");
                                  setSelected(f);
                                }}
                              >
                                {f.name} ↗
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  ))}
              </section>
            )}
            {tab === "Administration" && (
              <Admin config={config} onSave={setConfig} />
            )}{" "}
            {tab === "Email outbox" && (
              <section className="panel">
                <h2>Messages from the atelier</h2>
                <p className="muted">
                  Without SMTP, messages are captured here without being sent.
                  Failed SMTP messages remain visible for manual follow-up.
                </p>
                {!data.emails.length && (
                  <p>Approve a formula to create its thank-you email.</p>
                )}
                {data.emails.map((e) => (
                  <details className="email" key={e.id}>
                    <summary>
                      <strong>{e.subject}</strong>
                      <span className="badge">{e.status}</span>
                      <small>To: {e.recipient}</small>
                    </summary>
                    <pre>{e.body}</pre>
                  </details>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
function Editor({ formula: f, config, onClose, onSaved }) {
  const [name, setName] = useState(f.name),
    [rows, setRows] = useState(
      f.snapshot.ingredients.map((i) => ({ id: i.id, percent: i.percent })),
    ),
    [strengthId, setStrengthId] = useState(f.snapshot.strength.id),
    [size, setSize] = useState(config.sizes.find((s) => s.active)?.ml || 50),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false);
  const approved = f.status === "APPROVED",
    recipe = approved
      ? f.snapshot
      : {
          ingredients: rows.map((r) => ({
            ...config.ingredients.find((i) => i.id === r.id),
            percent: r.percent,
          })),
          strength: config.strengths.find((s) => s.id === strengthId),
          sampleMl: config.sampleMl,
        };
  const link = location.origin + "/product/" + f.token;
  async function approve() {
    setBusy(true);
    setError("");
    try {
      await post(
        `/staff/formulas/${f.id}/approve`,
        { name, ingredients: rows, strengthId },
        true,
      );
      await onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="back" onClick={onClose}>
        ← All formulas
      </button>
      <div className="editor-grid">
        <section className="panel">
          <div className="section-head">
            <span className="eyebrow">
              {approved ? "SAVED SIGNATURE" : "FORMULA REFINEMENT"}
            </span>
            <span className={"badge " + f.status.toLowerCase()}>
              {f.status}
            </span>
          </div>
          <h2>{f.name}</h2>
          <p className="muted">
            For {f.customer.name} · {f.customer.email} · {f.customer.phone}
          </p>
          {approved ? (
            <>
              <div className="notice">
                This approved formula is a permanent snapshot. Catalog changes
                will not alter it.
              </div>
              <div className="note-list">
                {recipe.ingredients.map((i) => (
                  <div key={i.id}>
                    {i.name}
                    <strong>{i.percent}%</strong>
                  </div>
                ))}
              </div>
              <p>
                {recipe.strength.name} · {recipe.strength.percent}%
              </p>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(f.name);
                    setCopied(true);
                  } catch {
                    setError(
                      "Copy unavailable. Select the product name above and copy it manually.",
                    );
                  }
                }}
              >
                {copied ? "Copied ✓" : "Copy name for label"}
              </button>
              <div className="card-preview" id="print-card">
                <Brand />
                <h2>{f.name}</h2>
                <p>
                  {recipe.strength.name} · {recipe.strength.percent}%
                </p>
                <img
                  src={"/api/qr?token=" + f.token}
                  width="150"
                  height="150"
                  alt="QR code to reorder this product"
                />
                <p>YOUR SIGNATURE. READY WHEN YOU ARE.</p>
                <small>{link}</small>
              </div>
              <div className="actions">
                <button className="primary" onClick={() => window.print()}>
                  Print product card
                </button>
                <a href={link} target="_blank" rel="noreferrer">
                  Open reorder page ↗
                </a>
              </div>
            </>
          ) : (
            <>
              <label>
                Product name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength="100"
                />
              </label>
              <Blend
                {...{ config, rows, setRows, strengthId, setStrengthId }}
              />
              <Alert>{error}</Alert>
              <button
                className="primary wide"
                disabled={busy}
                onClick={approve}
              >
                {busy ? "Saving…" : "Approve & save formula ↗"}
              </button>
              <p className="fine">
                Approval locks the recipe and creates the customer thank-you
                email.
              </p>
            </>
          )}
          <Alert>{approved && error}</Alert>
        </section>
        <aside className="panel calculation">
          <span className="eyebrow">THE MEASURE OF IT</span>
          <h2>From notes to numbers.</h2>
          <label>
            Full-size bottle
            <select
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            >
              {config.sizes.map((s) => (
                <option key={s.id} value={s.ml}>
                  {s.ml} ml
                </option>
              ))}
            </select>
          </label>
          <table>
            <thead>
              <tr>
                <th>COMPONENT</th>
                <th>{recipe.sampleMl} ML TEST</th>
                <th>{size} ML</th>
              </tr>
            </thead>
            <tbody>
              {recipe.ingredients.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>
                    {(
                      (((recipe.sampleMl * (recipe.strength?.percent || 0)) /
                        100) *
                        i.percent) /
                      100
                    ).toFixed(3)}
                  </td>
                  <td>
                    {(
                      (((size * (recipe.strength?.percent || 0)) / 100) *
                        i.percent) /
                      100
                    ).toFixed(3)}
                  </td>
                </tr>
              ))}
              <tr>
                <td>Base / diluent</td>
                <td>
                  {(
                    recipe.sampleMl *
                    (1 - (recipe.strength?.percent || 0) / 100)
                  ).toFixed(3)}
                </td>
                <td>
                  {(size * (1 - (recipe.strength?.percent || 0) / 100)).toFixed(
                    3,
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="fine">
            All quantities in ml. Strength determines the concentrate
            proportion; your ingredient percentages divide that concentrate.
            Display rounded to 0.001 ml; not a validated production recipe.
          </p>
        </aside>
      </div>
    </>
  );
}
function Admin({ config, onSave }) {
  const [draft, setDraft] = useState(structuredClone(config)),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function update(key, index, field, value) {
    setDraft({
      ...draft,
      [key]: draft[key].map((r, i) =>
        i === index ? { ...r, [field]: value } : r,
      ),
    });
    setMessage("");
  }
  function add(key) {
    const id = crypto.randomUUID();
    setDraft({
      ...draft,
      [key]: [
        ...draft[key],
        key === "ingredients"
          ? {
              id,
              name: "New ingredient",
              family: "Other",
              color: "#a8b6a7",
              active: true,
            }
          : key === "sizes"
            ? { id, ml: 30, price: 40, active: true }
            : { id, name: "New strength", percent: 15 },
      ],
    });
  }
  return (
    <section className="panel">
      <h2>The studio essentials</h2>
      <p className="muted">
        Changes apply to new formulas. Approved recipes keep their original
        names, percentages and strength.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setMessage("");
          setBusy(true);
          try {
            const c = await api("/staff/catalog", {
              staff: true,
              method: "PUT",
              body: JSON.stringify(draft),
            });
            onSave(c);
            setMessage(
              "Catalog saved. Existing approved formulas are unchanged.",
            );
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {["ingredients", "sizes", "strengths"].map((key) => (
          <section className="admin-section" key={key}>
            <div className="section-head">
              <h3>{key[0].toUpperCase() + key.slice(1)}</h3>
              <button type="button" onClick={() => add(key)}>
                + Add{" "}
                {key === "sizes"
                  ? "size"
                  : key === "strengths"
                    ? "strength"
                    : "ingredient"}
              </button>
            </div>
            {draft[key].map((r, i) => (
              <div className="admin-row" key={r.id}>
                {key === "sizes" ? (
                  <>
                    <label>
                      Volume (ml)
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        required
                        value={r.ml}
                        onChange={(e) =>
                          update(key, i, "ml", Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      Price (USD)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={r.price}
                        onChange={(e) =>
                          update(key, i, "price", Number(e.target.value))
                        }
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      Name
                      <input
                        required
                        value={r.name}
                        onChange={(e) => update(key, i, "name", e.target.value)}
                      />
                    </label>
                    {key === "ingredients" ? (
                      <>
                        <label>
                          Family
                          <input
                            value={r.family}
                            onChange={(e) =>
                              update(key, i, "family", e.target.value)
                            }
                          />
                        </label>
                        <label>
                          Colour
                          <input
                            type="color"
                            value={r.color}
                            onChange={(e) =>
                              update(key, i, "color", e.target.value)
                            }
                          />
                        </label>
                      </>
                    ) : (
                      <label>
                        Concentration (%)
                        <input
                          type="number"
                          min="0.1"
                          max="100"
                          step="0.1"
                          required
                          value={r.percent}
                          onChange={(e) =>
                            update(key, i, "percent", Number(e.target.value))
                          }
                        />
                      </label>
                    )}
                  </>
                )}
                {"active" in r && (
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={r.active}
                      onChange={(e) =>
                        update(key, i, "active", e.target.checked)
                      }
                    />
                    Available
                  </label>
                )}
              </div>
            ))}
          </section>
        ))}
        <label>
          Test sample volume (ml)
          <input
            type="number"
            required
            min="0.1"
            step="0.1"
            value={draft.sampleMl}
            onChange={(e) =>
              setDraft({ ...draft, sampleMl: Number(e.target.value) })
            }
          />
        </label>
        <Alert>{error}</Alert>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <button disabled={busy} className="primary space">
          {busy ? "Saving…" : "Save catalog changes"}
        </button>
      </form>
      <div className="qr-entry">
        <img
          src="/api/qr"
          width="120"
          height="120"
          alt="QR code for customer creation form"
        />
        <div>
          <h3>Start at the counter.</h3>
          <p className="muted">Customers scan this code to create a formula.</p>
          <small>
            Configure APP_URL with a reachable address before scanning on
            another device.
          </small>
        </div>
      </div>
    </section>
  );
}
createRoot(document.getElementById("root")).render(<App />);
