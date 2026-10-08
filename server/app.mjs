// Girish Bhawan site API. Storage is injected so the same code runs on Netlify (Blobs) and in local tests.
// Everything the admin may want to change later (sizes, prices, events, sections, groups, links) is data, not code.
import crypto from "node:crypto";

const LEGACY = "durga-puja-2026"; // first event; its data lives under the original storage keys
const ADMIN_USER = "admin";
const DEFAULT_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL"];
const DEFAULT_ORDERS = {
  price: 325, gpay: "9176521583", upi: "9176521583@upi", sizes: DEFAULT_SIZES, sizePrices: {},
  orders: [
    { name: "Sunny (Abhinandan)", note: "", S: 1, M: 1, received: 650, paidOn: "2026-10-06" },
    { name: "Bubul (Prabal)", note: "", XL: 1, XXL: 1, received: 650, paidOn: "2026-10-06" },
  ],
};
const DEFAULT_SITE = {
  links: { facebook: "https://www.facebook.com/girishbhawan", instagram: "https://www.instagram.com/girishbhawan/" },
  groups: [{ id: "girish-bhawan", name: "Girish Bhawan Group" }, { id: "padmarani", name: "Padmarani Group" }],
  sections: [
    { id: "pujo-accounts", title: "Pujo Accounts", desc: "Accounts of the Pujo.", access: "admin", groups: [], memberUpload: false },
    { id: "bhog-accounts", title: "Bhog Accounts", desc: "Accounts of the Bhog.", access: "admin", groups: [], memberUpload: false },
  ],
  events: [{ id: LEGACY, title: "Durga Puja 2026", sub: "Photos, links and greetings from the family.", schedule: true, access: "public", groups: [], post: "anyone", autoApprove: false }],
};
const DEFAULT_ITEMS = [{ id: "tshirt", name: "T-shirt" }, { id: "kurti", name: "Kurti" }];
function cleanItems(v) {
  const out = [], taken = new Set();
  for (const it of Array.isArray(v) ? v.slice(0, 12) : []) { const name = txt(it?.name, 40); if (name) out.push({ id: uniqueId(it?.id, name, taken, "item"), name }); }
  return out.length ? out : DEFAULT_ITEMS.map((x) => ({ ...x }));
}
const FILE_TYPES = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", csv: "text/csv", txt: "text/plain",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", doc: "application/msword",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const MAX_FILE = 4 * 1024 * 1024;

const num = (v, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0; };
const txt = (v, len) => String(v ?? "").replace(/[\u0000-\u001f\u007f​-‏⁠﻿]+/g, " ").trim().slice(0, len);
const multiline = (v, len) => String(v ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, len);
const sha = (s) => crypto.createHash("sha256").update(s).digest();
const slug = (v) => String(v ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
// Phone numbers lose spaces, dashes and brackets; emails are only lower-cased.
const normLogin = (v) => { const t = txt(v, 80).toLowerCase(); return /^[+\d\s()-]+$/.test(t) ? t.replace(/[\s()-]+/g, "") : t.replace(/\s+/g, ""); };
const inv = (ts) => String(9999999999999 - ts);
const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const httpsUrl = (v) => { try { const u = new URL(txt(v, 300)); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };

function jpeg(dataUrl, maxBytes) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) return null;
  const b = Buffer.from(m[1], "base64");
  if (b.length > maxBytes || b.length < 100 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null;
  return ab(b);
}
function cleanSizes(v) {
  const out = [];
  for (const raw of Array.isArray(v) ? v : []) {
    const s = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (s && !out.includes(s) && out.length < 12) out.push(s);
  }
  return out.length ? out : DEFAULT_SIZES.slice();
}
function cleanOrders(input) {
  const sizes = cleanSizes(input?.sizes);
  const d = { price: num(input?.price, 100000), gpay: txt(input?.gpay, 20), upi: txt(input?.upi, 60), sizes, sizePrices: {}, orders: [] };
  for (const s of sizes) { const p = num(input?.sizePrices?.[s], 100000); if (p) d.sizePrices[s] = p; }
  for (const o of Array.isArray(input?.orders) ? input.orders.slice(0, 500) : []) {
    const name = txt(o?.name, 60);
    if (!name) continue;
    const row = { name, note: txt(o?.note, 120) };
    for (const s of sizes) row[s] = num(o?.[s], 999);
    row.received = num(o?.received, 10000000);
    row.paidOn = /^\d{4}-\d{2}-\d{2}$/.test(String(o?.paidOn ?? "")) ? o.paidOn : "";
    d.orders.push(row);
  }
  return d;
}
function cleanSchedule(input) {
  const d = { note: multiline(input?.note, 600), days: [] };
  for (const day of Array.isArray(input?.days) ? input.days.slice(0, 15) : []) {
    const name = txt(day?.name, 80);
    if (!name) continue;
    const items = [];
    for (const it of Array.isArray(day?.items) ? day.items.slice(0, 40) : []) { const what = txt(it?.what, 200); if (what) items.push({ time: txt(it?.time, 40), what }); }
    d.days.push({ name, date: txt(day?.date, 60), items });
  }
  return d;
}
function uniqueId(wanted, title, taken, fallback) {
  let base = /^[a-z0-9-]{1,40}$/.test(String(wanted || "")) ? wanted : slug(title) || fallback, id = base, n = 2;
  while (taken.has(id)) id = (base.slice(0, 36) + "-" + n++);
  taken.add(id);
  return id;
}
function cleanSite(input) {
  const src = input && typeof input === "object" ? input : {};
  const d = { links: { facebook: httpsUrl(src.links?.facebook), instagram: httpsUrl(src.links?.instagram) }, groups: [], sections: [], events: [] };
  let taken = new Set();
  for (const g of Array.isArray(src.groups) ? src.groups.slice(0, 20) : []) { const name = txt(g?.name, 60); if (name) d.groups.push({ id: uniqueId(g?.id, name, taken, "group"), name }); }
  const gids = new Set(d.groups.map((g) => g.id));
  const access = (v, def) => (["public", "members", "groups", "admin"].includes(v) ? v : def);
  const groupsOf = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => gids.has(x)))] : []);
  taken = new Set();
  for (const s of Array.isArray(src.sections) ? src.sections.slice(0, 30) : []) {
    const title = txt(s?.title, 60);
    if (title) d.sections.push({ id: uniqueId(s?.id, title, taken, "section"), title, desc: txt(s?.desc, 200), access: access(s?.access, "admin"), groups: groupsOf(s?.groups), memberUpload: !!s?.memberUpload });
  }
  taken = new Set();
  for (const e of Array.isArray(src.events) ? src.events.slice(0, 30) : []) {
    const title = txt(e?.title, 60);
    if (title) d.events.push({ id: uniqueId(e?.id, title, taken, "event"), title, sub: txt(e?.sub, 200), schedule: !!e?.schedule, access: access(e?.access, "public"), groups: groupsOf(e?.groups), post: e?.post === "members" ? "members" : "anyone", autoApprove: !!e?.autoApprove });
  }
  return d;
}
function csv(rows) {
  const cell = (v) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s) && typeof v !== "number") s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
const isBinaryKey = (k) => /^(photo\/|pending-photo\/|file\/)/.test(k) || k === "schedule-image" || /^wall\/[^/]+\/(photo|pending)\//.test(k) || /^sched\/[^/]+\/image$/.test(k);
const isTransientKey = (k) => /^(rate|fails)\//.test(k);
const validKey = (k) => typeof k === "string" && k.length < 200 && /^[A-Za-z0-9._\/-]+$/.test(k) && !k.includes("..");

export function createApp(getStore, env) {
  const store = () => getStore({ name: "girish-bhawan", consistency: "strong" });
  const password = () => String(env.ADMIN_PASSWORD || "");
  const key = () => sha("gb-session|" + (env.SESSION_SECRET || "") + "|" + password());
  const sign = (payload) => crypto.createHmac("sha256", key()).update(payload).digest("hex");
  const json = (status, body, headers = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers } });
  const cookie = (value, maxAge) => `gbs=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
  const session = (u, pv) => { const p = Buffer.from(JSON.stringify({ u, pv, exp: Date.now() + 14 * 86400000 })).toString("base64url"); return cookie(p + "." + sign(p), 14 * 86400); };
  const ipKey = (req, ctx) => sha("ip|" + (ctx?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown")).toString("hex").slice(0, 24);
  const loginKey = (login) => "login/" + sha("login|" + login).toString("hex").slice(0, 32);
  const hashPass = (pass, salt) => crypto.scryptSync(String(pass), salt, 32).toString("hex");
  const publicUser = (u) => ({ id: u.id, name: u.name, login: u.login, status: u.status, groups: u.groups || [], wants: u.wants || "", note: u.note || "", created: u.created });

  const postPrefix = (e) => (e === LEGACY ? "post/" : `wall/${e}/post/`);
  const photoKey = (e, id, pending) => (e === LEGACY ? (pending ? "pending-photo/" : "photo/") + id : `wall/${e}/${pending ? "pending" : "photo"}/${id}`);
  const schedKey = (e) => (e === LEGACY ? "schedule" : `sched/${e}/data`);
  const schedImg = (e) => (e === LEGACY ? "schedule-image" : `sched/${e}/image`);

  async function body(req) {
    if (req.headers.get("x-requested-with") !== "gb") return null;
    try { const j = await req.json(); return j && typeof j === "object" ? j : null; } catch { return null; }
  }
  async function overLimit(k, max, windowMs, add) {
    const s = store(), now = Date.now();
    const list = ((await s.get(k, { type: "json" })) || []).filter((t) => t > now - windowMs);
    if (list.length >= max) return true;
    if (add) { list.push(now); await s.setJSON(k, list); }
    return false;
  }
  async function keys(prefix) { const { blobs } = await store().list({ prefix }); return blobs.map((b) => b.key).sort(); }
  async function getSite() { return cleanSite((await store().get("site", { type: "json" })) || DEFAULT_SITE); }
  async function whoIs(req) {
    const m = /(?:^|;\s*)gbs=([A-Za-z0-9_-]+)\.([0-9a-f]{64})/.exec(req.headers.get("cookie") || "");
    const none = { admin: false, user: null };
    if (!m) return none;
    const a = Buffer.from(m[2], "hex"), b = Buffer.from(sign(m[1]), "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return none;
    let p; try { p = JSON.parse(Buffer.from(m[1], "base64url").toString()); } catch { return none; }
    if (!p || p.exp < Date.now()) return none;
    if (p.u === ADMIN_USER) return password() ? { admin: true, user: null } : none;
    if (!/^[0-9a-f]{16}$/.test(String(p.u))) return none;
    const u = await store().get("user/" + p.u, { type: "json" });
    if (!u || u.pv !== p.pv || u.status === "blocked") return none;
    return { admin: false, user: u };
  }
  const active = (who) => !!who.user && who.user.status === "active";
  function canSee(item, who) {
    if (!item) return false;
    if (item.access === "public" || who.admin) return true;
    if (!active(who)) return false;
    if (item.access === "members") return true;
    if (item.access === "groups") return (who.user.groups || []).some((g) => item.groups.includes(g));
    return false;
  }

  return async function handle(req, ctx) {
    try {
      const url = new URL(req.url);
      const seg = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
      const route = seg[0] || "", GET = req.method === "GET", POST = req.method === "POST";
      const s = store(), who = await whoIs(req), admin = who.admin;
      const deny = () => json(who.admin || who.user ? 403 : 401, { error: "login required" });

      /* ---------- who am I, what can I see ---------- */
      if (route === "site" && GET) {
        const site = await getSite();
        return json(200, {
          me: { admin, user: who.user ? publicUser(who.user) : null },
          links: site.links, groups: site.groups,
          events: site.events.filter((e) => canSee(e, who)).map((e) => ({ id: e.id, title: e.title, sub: e.sub, schedule: e.schedule, post: e.post })),
          sections: site.sections.filter((x) => canSee(x, who)).map((x) => ({ id: x.id, title: x.title, desc: x.desc })),
        });
      }

      /* ---------- accounts ---------- */
      if (route === "login" && POST) {
        const b = await body(req);
        if (!b) return json(400, { error: "bad request" });
        const fk = "fails/" + ipKey(req, ctx);
        if (await overLimit(fk, 8, 15 * 60000, false)) return json(429, { error: "too many attempts" });
        const login = normLogin(b.user), pass = String(b.pass || "");
        const fail = async () => { await overLimit(fk, 8, 15 * 60000, true); await new Promise((r) => setTimeout(r, 600)); return json(401, { error: "wrong login" }); };
        if (login === ADMIN_USER) {
          if (!password()) return json(503, { error: "ADMIN_PASSWORD is not set in Netlify" });
          if (!crypto.timingSafeEqual(sha("p|" + pass), sha("p|" + password()))) return fail();
          return json(200, { admin: true }, { "set-cookie": session(ADMIN_USER, 0) });
        }
        const ref = await s.get(loginKey(login), { type: "json" });
        const u = ref ? await s.get("user/" + ref.id, { type: "json" }) : null;
        const given = Buffer.from(hashPass(pass, u ? u.salt : "x"), "hex");
        if (!u || !crypto.timingSafeEqual(given, Buffer.from(u.hash, "hex"))) return fail();
        if (u.status === "blocked") return json(403, { error: "blocked" });
        return json(200, { admin: false, user: publicUser(u) }, { "set-cookie": session(u.id, u.pv) });
      }
      if (route === "logout" && POST) return json(200, { ok: true }, { "set-cookie": cookie("x", 0) });
      if (route === "register" && POST) {
        const b = await body(req);
        if (!b) return json(400, { error: "bad request" });
        if (txt(b.website, 10)) return json(200, { ok: true });
        const name = txt(b.name, 60), login = normLogin(b.login), pass = String(b.pass || "");
        if (!name) return json(400, { error: "name" });
        if (login === ADMIN_USER || !(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(login) || /^\+?\d{8,15}$/.test(login))) return json(400, { error: "login" });
        if (pass.length < 8 || pass.length > 200) return json(400, { error: "password" });
        if (await overLimit("rate/reg-" + ipKey(req, ctx), 5, 3600000, true)) return json(429, { error: "too many" });
        if (await s.get(loginKey(login), { type: "json" })) return json(409, { error: "exists" });
        const site = await getSite(), id = crypto.randomBytes(8).toString("hex"), salt = crypto.randomBytes(16).toString("hex");
        const wants = site.groups.some((g) => g.id === b.wants) ? b.wants : "";
        const u = { id, name, login, salt, hash: hashPass(pass, salt), pv: 1, status: "pending", groups: [], wants, note: txt(b.note, 200), created: Date.now() };
        await s.setJSON("user/" + id, u); await s.setJSON(loginKey(login), { id });
        return json(200, { ok: true, user: publicUser(u) }, { "set-cookie": session(id, 1) });
      }
      if (route === "password" && POST) {
        const b = await body(req);
        if (!b) return json(400, { error: "bad request" });
        if (!who.user) return deny();
        const u = who.user, pass = String(b.new || "");
        if (!crypto.timingSafeEqual(Buffer.from(hashPass(String(b.old || ""), u.salt), "hex"), Buffer.from(u.hash, "hex"))) { await new Promise((r) => setTimeout(r, 600)); return json(403, { error: "wrong password" }); }
        if (pass.length < 8 || pass.length > 200) return json(400, { error: "password" });
        u.salt = crypto.randomBytes(16).toString("hex"); u.hash = hashPass(pass, u.salt); u.pv = (u.pv || 1) + 1;
        await s.setJSON("user/" + u.id, u);
        return json(200, { ok: true }, { "set-cookie": session(u.id, u.pv) });
      }

      /* ---------- dress orders: one tracker per dress type (T-shirt, Kurti, ...) ---------- */
      if (route === "orders" || route === "report") {
        const items = cleanItems((await s.get("order-items", { type: "json" })) || DEFAULT_ITEMS);
        const ordersKey = (id) => (id === "tshirt" ? "orders" : "orders/" + id);
        const getOrders = async (id) => {
          const raw = await s.get(ordersKey(id), { type: "json" });
          if (raw) return cleanOrders(raw);
          if (id === "tshirt") return cleanOrders(DEFAULT_ORDERS);
          const base = cleanOrders((await s.get("orders", { type: "json" })) || DEFAULT_ORDERS); // new types start with the same payment details
          return cleanOrders({ price: id === "kurti" ? 525 : 0, gpay: base.gpay, upi: base.upi, sizes: DEFAULT_SIZES, orders: [] });
        };
        const statusOf = (due, r) => (due > 0 && r >= due ? "Paid" : r > 0 ? "Part paid" : "Pending");
        const dueOf = (d, o) => d.sizes.reduce((t, z) => t + o[z] * (d.sizePrices[z] || d.price), 0);
        const piecesOf = (d, o) => d.sizes.reduce((t, z) => t + o[z], 0);
        const id = url.searchParams.get("i") || items[0].id, item = items.find((x) => x.id === id);

        if (route === "orders" && GET) {
          if (!item) return json(404, { error: "no such item" });
          return json(200, { ...(await getOrders(id)), items, item });
        }
        if (route === "orders" && POST) {
          const b = await body(req);
          if (!b) return json(400, { error: "bad request" });
          if (!admin) return deny();
          if (seg[1] === "items") {
            if (b.action === "add") {
              const name = txt(b.name, 40);
              if (!name) return json(400, { error: "name" });
              if (items.length >= 12) return json(400, { error: "too many" });
              const nid = uniqueId("", name, new Set(items.map((x) => x.id)), "item");
              const base = await getOrders(items[0].id);
              await s.setJSON(ordersKey(nid), cleanOrders({ price: b.price, gpay: base.gpay, upi: base.upi, sizes: DEFAULT_SIZES, orders: [] }));
              await s.setJSON("order-items", items.concat([{ id: nid, name }]));
              return json(200, { ok: true, id: nid });
            }
            const target = items.find((x) => x.id === b.id);
            if (!target) return json(404, { error: "no such item" });
            if (b.action === "rename") {
              const name = txt(b.name, 40);
              if (!name) return json(400, { error: "name" });
              target.name = name; await s.setJSON("order-items", items);
              return json(200, { ok: true });
            }
            if (b.action === "remove") {
              if (items.length < 2) return json(400, { error: "last" });
              if ((await getOrders(target.id)).orders.length) return json(409, { error: "has orders" });
              await s.setJSON("order-items", items.filter((x) => x.id !== target.id));
              return json(200, { ok: true });
            }
            return json(400, { error: "action" });
          }
          if (!item) return json(404, { error: "no such item" });
          const d = cleanOrders(b);
          await s.setJSON(ordersKey(id), d);
          return json(200, { ok: true, data: { ...d, items, item } });
        }
        if (route === "report" && GET) {
          if (!admin) return new Response("Admin login required.", { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } });
          const day = new Date().toISOString().slice(0, 10);
          const send = (rows, name) => new Response(csv(rows), { status: 200, headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="GB-${name}-Orders-${day}.csv"`, "cache-control": "no-store" } });
          if (id === "all") {
            // One row per person across every dress type, matched on the name as typed (ignoring case and spaces).
            // "Sunny" and "Sunny (Abhinandan)" count as one person; "Didi (Munai)" and "Didi (Tuli)" stay separate.
            const docs = await Promise.all(items.map((x) => getOrders(x.id))), list = [];
            const norm = (v) => v.toLowerCase().replace(/\s+/g, "");
            docs.forEach((d, n) => d.orders.forEach((o) => {
              const full = norm(o.name), base = norm(o.name.replace(/\(.*?\)/g, ""));
              let r = list.find((x) => x.full === full) || list.find((x) => x.base === base && (x.full === x.base || full === base));
              if (!r) { r = { name: o.name, full, base, p: items.map(() => 0), due: items.map(() => 0), rec: 0 }; list.push(r); }
              else if (o.name.length > r.name.length) { r.name = o.name; r.full = full; }
              r.p[n] += piecesOf(d, o); r.due[n] += dueOf(d, o); r.rec += o.received;
            }));
            const people = { values: () => list };
            const rows = [["Name", ...items.flatMap((x) => [x.name + " pieces", x.name + " amount"]), "Total pieces", "Total due", "Received", "Balance", "Status"]];
            const T = { p: items.map(() => 0), due: items.map(() => 0), rec: 0 };
            for (const r of people.values()) {
              const tp = r.p.reduce((a, c) => a + c, 0), td = r.due.reduce((a, c) => a + c, 0);
              items.forEach((_, n) => { T.p[n] += r.p[n]; T.due[n] += r.due[n]; }); T.rec += r.rec;
              rows.push([r.name, ...items.flatMap((_, n) => [r.p[n], r.due[n]]), tp, td, r.rec, td - r.rec, statusOf(td, r.rec)]);
            }
            const gp = T.p.reduce((a, c) => a + c, 0), gd = T.due.reduce((a, c) => a + c, 0);
            rows.push(["TOTAL", ...items.flatMap((_, n) => [T.p[n], T.due[n]]), gp, gd, T.rec, gd - T.rec, ""]);
            return send(rows, "All");
          }
          if (!item) return json(404, { error: "no such item" });
          const d = await getOrders(id), Z = d.sizes;
          const rows = [["Name", ...Z, "Pieces", "Amount due", "Received", "Balance", "Status", "Paid on", "Note"]];
          const tot = Object.fromEntries(Z.map((z) => [z, 0])); let tp = 0, td = 0, tr = 0;
          for (const o of d.orders) {
            const pc = piecesOf(d, o), due = dueOf(d, o), r = o.received;
            Z.forEach((z) => (tot[z] += o[z])); tp += pc; td += due; tr += r;
            rows.push([o.name, ...Z.map((z) => o[z]), pc, due, r, due - r, statusOf(due, r), o.paidOn, o.note]);
          }
          rows.push(["TOTAL", ...Z.map((z) => tot[z]), tp, td, tr, td - tr, "", "", ""]);
          return send(rows, item.name.replace(/[^A-Za-z0-9]+/g, "") || "Dress");
        }
      }

      /* ---------- events: photo wall and Nirghonto ---------- */
      if (["posts", "photo", "schedule", "schedule-image"].includes(route)) {
        const site = await getSite(), e = url.searchParams.get("e") || LEGACY, ev = site.events.find((x) => x.id === e);
        if (!ev) return json(404, { error: "no such event" });
        if (!canSee(ev, who)) return route === "photo" || route === "schedule-image" ? new Response("Not found", { status: 404 }) : deny();
        const mayPost = admin || ev.post === "anyone" || active(who);

        if (route === "schedule" && GET) {
          const d = cleanSchedule((await s.get(schedKey(e), { type: "json" })) || { days: [] });
          d.image = Number(await s.get(schedImg(e) + "-v", { type: "json" })) || 0;
          return json(200, d);
        }
        if (route === "schedule" && POST) {
          const b = await body(req);
          if (!b) return json(400, { error: "bad request" });
          if (!admin) return deny();
          if (seg[1] === "image") {
            if (b.remove) { await s.delete(schedImg(e)); await s.delete(schedImg(e) + "-v"); return json(200, { ok: true, image: 0 }); }
            const img = jpeg(b.photo, 3000000);
            if (!img) return json(400, { error: "photo" });
            const v = Date.now();
            await s.set(schedImg(e), img); await s.setJSON(schedImg(e) + "-v", v);
            return json(200, { ok: true, image: v });
          }
          const d = cleanSchedule(b);
          await s.setJSON(schedKey(e), d);
          d.image = Number(await s.get(schedImg(e) + "-v", { type: "json" })) || 0;
          return json(200, { ok: true, data: d });
        }
        if (route === "schedule-image" && GET) {
          const img = await s.get(schedImg(e), { type: "arrayBuffer" });
          if (!img) return new Response("Not found", { status: 404 });
          return new Response(img, { status: 200, headers: { "content-type": "image/jpeg", "x-content-type-options": "nosniff", "cache-control": ev.access === "public" ? "public, max-age=86400" : "private, no-store" } });
        }
        if (route === "posts" && GET) {
          const all = (await Promise.all((await keys(postPrefix(e))).slice(0, 300).map((k) => s.get(k, { type: "json" })))).filter(Boolean);
          return json(200, { posts: all.filter((p) => admin || p.status === "approved").slice(0, 200), mayPost, needsApproval: !admin && !ev.autoApprove });
        }
        if (route === "posts" && POST && !seg[1]) {
          const b = await body(req);
          if (!b) return json(400, { error: "bad request" });
          if (!mayPost) return deny();
          if (txt(b.website, 10)) return json(200, { ok: true, status: "pending" }); // hidden field only bots fill in
          const name = active(who) ? who.user.name : txt(b.name, 40), comment = multiline(b.comment, 500);
          let link = txt(b.link, 300);
          if (link) { try { const u = new URL(link); if (u.protocol !== "https:" && u.protocol !== "http:") throw 0; link = u.href; } catch { return json(400, { error: "link" }); } }
          let photo = null;
          if (b.photo) { photo = jpeg(b.photo, 1500000); if (!photo) return json(400, { error: "photo" }); }
          if (!name) return json(400, { error: "name" });
          if (!link && !photo) return json(400, { error: "empty" });
          if (!admin && (await overLimit("rate/" + ipKey(req, ctx), 6, 3600000, true))) return json(429, { error: "too many posts" });
          const status = admin || ev.autoApprove ? "approved" : "pending";
          const id = crypto.randomBytes(8).toString("hex"), ts = Date.now();
          if (photo) await s.set(photoKey(e, id, status !== "approved"), photo);
          await s.setJSON(`${postPrefix(e)}${inv(ts)}-${id}`, { id, name, comment, link, photo: !!photo, ts, status, by: who.user ? who.user.id : "" });
          return json(200, { ok: true, status });
        }
        if (route === "posts" && POST && seg[1] === "moderate") {
          const b = await body(req);
          if (!b) return json(400, { error: "bad request" });
          if (!admin) return deny();
          const id = String(b.id || "");
          if (!/^[0-9a-f]{16}$/.test(id)) return json(400, { error: "id" });
          const k = (await keys(postPrefix(e))).find((x) => x.endsWith("-" + id));
          if (!k) return json(404, { error: "not found" });
          const p = await s.get(k, { type: "json" });
          if (b.action === "delete") { await s.delete(k); await s.delete(photoKey(e, id, false)); await s.delete(photoKey(e, id, true)); }
          else if (b.action === "approve" && p && p.status !== "approved") {
            if (p.photo) { const img = await s.get(photoKey(e, id, true), { type: "arrayBuffer" }); if (img) { await s.set(photoKey(e, id, false), img); await s.delete(photoKey(e, id, true)); } }
            await s.setJSON(k, { ...p, status: "approved" });
          }
          return json(200, { ok: true });
        }
        if (route === "photo" && GET && /^[0-9a-f]{16}$/.test(seg[1] || "")) {
          let img = await s.get(photoKey(e, seg[1], false), { type: "arrayBuffer" }), pub = ev.access === "public";
          if (!img && admin) { img = await s.get(photoKey(e, seg[1], true), { type: "arrayBuffer" }); pub = false; }
          if (!img) return new Response("Not found", { status: 404 });
          return new Response(img, { status: 200, headers: { "content-type": "image/jpeg", "x-content-type-options": "nosniff", "cache-control": pub ? "public, max-age=3600" : "private, no-store" } });
        }
      }

      /* ---------- sections: files with controlled access ---------- */
      if (route === "files" || route === "file") {
        const site = await getSite(), sid = route === "file" ? seg[1] : url.searchParams.get("s"), sec = site.sections.find((x) => x.id === sid);
        if (!sec || !canSee(sec, who)) return route === "file" ? new Response("Not found", { status: 404 }) : (sec ? deny() : json(404, { error: "no such section" }));
        const mayUpload = admin || (sec.memberUpload && active(who));
        if (route === "files" && GET) {
          const files = (await Promise.all((await keys(`fmeta/${sid}/`)).slice(0, 500).map((k) => s.get(k, { type: "json" })))).filter(Boolean);
          return json(200, { section: { id: sec.id, title: sec.title, desc: sec.desc, access: sec.access }, files, mayUpload });
        }
        if (route === "files" && POST && !seg[1]) {
          const b = await body(req);
          if (!b) return json(400, { error: "bad request" });
          if (!mayUpload) return deny();
          const name = txt(b.name, 120).replace(/[\\/:*?"<>|]+/g, "_"), ext = (/\.([A-Za-z0-9]{1,5})$/.exec(name) || [])[1]?.toLowerCase();
          if (!name || !FILE_TYPES[ext]) return json(400, { error: "type" });
          if (typeof b.data !== "string" || !/^[A-Za-z0-9+/=]+$/.test(b.data)) return json(400, { error: "data" });
          const buf = Buffer.from(b.data, "base64");
          if (!buf.length || buf.length > MAX_FILE) return json(400, { error: "size" });
          const id = crypto.randomBytes(8).toString("hex"), ts = Date.now();
          await s.set(`file/${sid}/${id}`, ab(buf));
          await s.setJSON(`fmeta/${sid}/${inv(ts)}-${id}`, { id, name, ext, size: buf.length, note: txt(b.note, 200), ts, by: admin ? "Admin" : who.user.name });
          return json(200, { ok: true });
        }
        if (route === "files" && POST && seg[1] === "delete") {
          const b = await body(req);
          if (!b) return json(400, { error: "bad request" });
          if (!admin) return deny();
          const id = String(b.id || "");
          if (!/^[0-9a-f]{16}$/.test(id)) return json(400, { error: "id" });
          const k = (await keys(`fmeta/${sid}/`)).find((x) => x.endsWith("-" + id));
          if (k) await s.delete(k);
          await s.delete(`file/${sid}/${id}`);
          return json(200, { ok: true });
        }
        if (route === "file" && GET && /^[0-9a-f]{16}$/.test(seg[2] || "")) {
          const k = (await keys(`fmeta/${sid}/`)).find((x) => x.endsWith("-" + seg[2]));
          const meta = k ? await s.get(k, { type: "json" }) : null, data = meta ? await s.get(`file/${sid}/${seg[2]}`, { type: "arrayBuffer" }) : null;
          if (!data) return new Response("Not found", { status: 404 });
          return new Response(data, { status: 200, headers: { "content-type": FILE_TYPES[meta.ext] || "application/octet-stream", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`, "x-content-type-options": "nosniff", "cache-control": "private, no-store" } });
        }
      }

      /* ---------- admin ---------- */
      if (route === "admin") {
        if (!admin) return deny();
        const act = seg[1] || "";
        if (act === "state" && GET) {
          const users = (await Promise.all((await keys("user/")).map((k) => s.get(k, { type: "json" })))).filter(Boolean).sort((a, b) => b.created - a.created);
          return json(200, { site: await getSite(), users: users.map(publicUser) });
        }
        if (act === "blob" && GET) {
          const k = url.searchParams.get("key");
          if (!validKey(k) || !isBinaryKey(k)) return json(400, { error: "key" });
          const data = await s.get(k, { type: "arrayBuffer" });
          return data ? new Response(data, { status: 200, headers: { "content-type": "application/octet-stream", "cache-control": "no-store" } }) : new Response("Not found", { status: 404 });
        }
        if (act === "backup" && GET) {
          const all = (await keys("")).filter((k) => !isTransientKey(k)), out = { app: "girish-bhawan", version: 1, made: new Date().toISOString(), json: {}, blobs: [] };
          for (const k of all) { if (isBinaryKey(k)) out.blobs.push(k); else out.json[k] = await s.get(k, { type: "json" }); }
          return json(200, out);
        }
        if (!POST) return json(404, { error: "not found" });
        const b = await body(req);
        if (!b) return json(400, { error: "bad request" });
        if (act === "site") { const d = cleanSite(b); await s.setJSON("site", d); return json(200, { ok: true, site: d }); }
        if (act === "user") {
          const id = String(b.id || "");
          if (!/^[0-9a-f]{16}$/.test(id)) return json(400, { error: "id" });
          const u = await s.get("user/" + id, { type: "json" });
          if (!u) return json(404, { error: "not found" });
          if (b.action === "delete") { await s.delete("user/" + id); await s.delete(loginKey(u.login)); return json(200, { ok: true }); }
          if (b.action === "approve" || b.action === "unblock") u.status = "active";
          else if (b.action === "block") u.status = "blocked";
          else if (b.action === "reset") {
            const pass = String(b.pass || "");
            if (pass.length < 8 || pass.length > 200) return json(400, { error: "password" });
            u.salt = crypto.randomBytes(16).toString("hex"); u.hash = hashPass(pass, u.salt); u.pv = (u.pv || 1) + 1;
          } else if (b.action !== "groups") return json(400, { error: "action" });
          if (Array.isArray(b.groups)) { const site = await getSite(); u.groups = [...new Set(b.groups.filter((g) => site.groups.some((x) => x.id === g)))]; }
          await s.setJSON("user/" + id, u);
          return json(200, { ok: true, user: publicUser(u) });
        }
        if (act === "restore") {
          if (b.app !== "girish-bhawan" || !b.json || typeof b.json !== "object") return json(400, { error: "not a backup" });
          let n = 0;
          for (const [k, v] of Object.entries(b.json)) { if (validKey(k) && !isBinaryKey(k) && !isTransientKey(k) && v !== null && v !== undefined) { await s.setJSON(k, v); n++; } }
          return json(200, { ok: true, restored: n });
        }
        if (act === "blob") {
          const k = String(b.key || "");
          if (!validKey(k) || !isBinaryKey(k) || typeof b.data !== "string" || !/^[A-Za-z0-9+/=]*$/.test(b.data)) return json(400, { error: "key" });
          await s.set(k, ab(Buffer.from(b.data, "base64")));
          return json(200, { ok: true });
        }
      }

      if (route === "me" && GET) return json(200, { admin });
      return json(404, { error: "not found" });
    } catch (e) {
      console.error(e);
      return json(500, { error: "server error" });
    }
  };
}
