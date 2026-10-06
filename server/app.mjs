// Girish Bhawan site API. Storage is injected so the same code runs on Netlify (Blobs) and in local tests.
import crypto from "node:crypto";

const SIZES = ["S", "M", "L", "XL", "XXL"];
const ADMIN_USER = "admin";
const DEFAULT_ORDERS = {
  price: 325, gpay: "9176521583", upi: "9176521583@upi",
  orders: [
    { name: "Sunny (Abhinandan)", note: "", S: 1, M: 1, L: 0, XL: 0, XXL: 0, received: 650, paidOn: "2026-10-06" },
    { name: "Bubul (Prabal)", note: "", S: 0, M: 0, L: 0, XL: 1, XXL: 1, received: 650, paidOn: "2026-10-06" },
    { name: "Didi (Munai)", note: "", S: 1, M: 0, L: 0, XL: 1, XXL: 0, received: 0, paidOn: "" },
    { name: "Babul", note: "Paid for 1 of 4 T-shirts so far", S: 0, M: 0, L: 0, XL: 0, XXL: 4, received: 325, paidOn: "2026-10-06" },
  ],
};
const DEFAULT_SCHEDULE = {
  note: "",
  days: ["Maha Sashthi", "Maha Saptami", "Maha Ashtami", "Maha Navami", "Bijaya Dashami"].map((name) => ({ name, date: "", items: [] })),
};

const num = (v, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0; };
const txt = (v, len) => String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, len);
const multiline = (v, len) => String(v ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, len);
function jpeg(dataUrl, maxBytes) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) return null;
  const b = Buffer.from(m[1], "base64");
  if (b.length > maxBytes || b.length < 100 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null;
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
const sha = (s) => crypto.createHash("sha256").update(s).digest();

function cleanOrders(input) {
  const d = { price: num(input?.price, 100000), gpay: txt(input?.gpay, 20), upi: txt(input?.upi, 60), orders: [] };
  for (const o of Array.isArray(input?.orders) ? input.orders.slice(0, 500) : []) {
    const name = txt(o?.name, 60);
    if (!name) continue;
    const row = { name, note: txt(o?.note, 120) };
    for (const s of SIZES) row[s] = num(o?.[s], 999);
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
    for (const it of Array.isArray(day?.items) ? day.items.slice(0, 40) : []) {
      const what = txt(it?.what, 200);
      if (what) items.push({ time: txt(it?.time, 40), what });
    }
    d.days.push({ name, date: txt(day?.date, 60), items });
  }
  return d;
}
function csv(rows) {
  const cell = (v) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s) && typeof v !== "number") s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export function createApp(getStore, env) {
  const store = () => getStore({ name: "girish-bhawan", consistency: "strong" });
  const password = () => String(env.ADMIN_PASSWORD || "");
  const key = () => sha("gb-session|" + (env.SESSION_SECRET || "") + "|" + password());
  const sign = (exp) => crypto.createHmac("sha256", key()).update(String(exp)).digest("hex");

  const json = (status, body, headers = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers } });

  function isAdmin(req) {
    if (!password()) return false;
    const m = /(?:^|;\s*)gbs=(\d+)\.([0-9a-f]{64})/.exec(req.headers.get("cookie") || "");
    if (!m || Number(m[1]) < Date.now()) return false;
    const a = Buffer.from(m[2], "hex"), b = Buffer.from(sign(m[1]), "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const cookie = (value, maxAge) => `gbs=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
  const ipKey = (req, ctx) => sha("ip|" + (ctx?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown")).toString("hex").slice(0, 24);

  async function body(req) {
    if (req.headers.get("x-requested-with") !== "gb") return null;
    try { const j = await req.json(); return j && typeof j === "object" ? j : null; } catch { return null; }
  }
  // Sliding-window counter kept in the store. Returns true when the caller is over the limit.
  async function overLimit(k, max, windowMs, add) {
    const s = store(), now = Date.now();
    const list = ((await s.get(k, { type: "json" })) || []).filter((t) => t > now - windowMs);
    if (list.length >= max) return true;
    if (add) { list.push(now); await s.setJSON(k, list); }
    return false;
  }
  async function postKeys() {
    const { blobs } = await store().list({ prefix: "post/" });
    return blobs.map((b) => b.key).sort();
  }

  return async function handle(req, ctx) {
    try {
      const url = new URL(req.url);
      const seg = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
      const route = seg[0] || "", GET = req.method === "GET", POST = req.method === "POST";
      const admin = isAdmin(req), s = store();

      if (route === "me" && GET) return json(200, { admin });

      if (route === "login" && POST) {
        const b = await body(req);
        if (!b) return json(400, { error: "bad request" });
        if (!password()) return json(503, { error: "ADMIN_PASSWORD is not set in Netlify" });
        const fk = "fails/" + ipKey(req, ctx);
        if (await overLimit(fk, 8, 15 * 60000, false)) return json(429, { error: "too many attempts" });
        const ok = String(b.user || "").trim().toLowerCase() === ADMIN_USER && crypto.timingSafeEqual(sha("p|" + String(b.pass || "")), sha("p|" + password()));
        if (!ok) { await overLimit(fk, 8, 15 * 60000, true); await new Promise((r) => setTimeout(r, 600)); return json(401, { error: "wrong login" }); }
        const exp = Date.now() + 12 * 3600 * 1000;
        return json(200, { admin: true }, { "set-cookie": cookie(exp + "." + sign(exp), 12 * 3600) });
      }
      if (route === "logout" && POST) return json(200, { admin: false }, { "set-cookie": cookie("x", 0) });

      if (route === "orders" && GET) return json(200, cleanOrders((await s.get("orders", { type: "json" })) || DEFAULT_ORDERS));
      if (route === "orders" && POST) {
        const b = await body(req);
        if (!b) return json(400, { error: "bad request" });
        if (!admin) return json(401, { error: "login required" });
        const d = cleanOrders(b);
        await s.setJSON("orders", d);
        return json(200, { ok: true, data: d });
      }
      if (route === "report" && GET) {
        if (!admin) return new Response("Admin login required.", { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } });
        const d = cleanOrders((await s.get("orders", { type: "json" })) || DEFAULT_ORDERS);
        const rows = [["Name", ...SIZES, "Pieces", "Amount due", "Received", "Balance", "Status", "Paid on", "Note"]];
        const tot = Object.fromEntries(SIZES.map((z) => [z, 0])); let tp = 0, td = 0, tr = 0;
        for (const o of d.orders) {
          const p = SIZES.reduce((t, z) => t + o[z], 0), due = p * d.price, r = o.received;
          SIZES.forEach((z) => (tot[z] += o[z])); tp += p; td += due; tr += r;
          rows.push([o.name, ...SIZES.map((z) => o[z]), p, due, r, due - r, due > 0 && r >= due ? "Paid" : r > 0 ? "Part paid" : "Pending", o.paidOn, o.note]);
        }
        rows.push(["TOTAL", ...SIZES.map((z) => tot[z]), tp, td, tr, td - tr, "", "", ""]);
        const day = new Date().toISOString().slice(0, 10);
        return new Response(csv(rows), { status: 200, headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="GB-TShirt-Orders-${day}.csv"`, "cache-control": "no-store" } });
      }

      if (route === "schedule" && GET) {
        const d = cleanSchedule((await s.get("schedule", { type: "json" })) || DEFAULT_SCHEDULE);
        d.image = Number(await s.get("schedule-image-v", { type: "json" })) || 0; // 0 = no image yet
        return json(200, d);
      }
      if (route === "schedule" && POST && seg[1] === "image") {
        const b = await body(req);
        if (!b) return json(400, { error: "bad request" });
        if (!admin) return json(401, { error: "login required" });
        if (b.remove) { await s.delete("schedule-image"); await s.delete("schedule-image-v"); return json(200, { ok: true, image: 0 }); }
        const img = jpeg(b.photo, 3000000);
        if (!img) return json(400, { error: "photo" });
        const v = Date.now();
        await s.set("schedule-image", img); await s.setJSON("schedule-image-v", v);
        return json(200, { ok: true, image: v });
      }
      if (route === "schedule-image" && GET) {
        const img = await s.get("schedule-image", { type: "arrayBuffer" });
        if (!img) return new Response("Not found", { status: 404 });
        return new Response(img, { status: 200, headers: { "content-type": "image/jpeg", "x-content-type-options": "nosniff", "cache-control": "public, max-age=86400" } });
      }
      if (route === "schedule" && POST && !seg[1]) {
        const b = await body(req);
        if (!b) return json(400, { error: "bad request" });
        if (!admin) return json(401, { error: "login required" });
        const d = cleanSchedule(b);
        await s.setJSON("schedule", d);
        d.image = Number(await s.get("schedule-image-v", { type: "json" })) || 0;
        return json(200, { ok: true, data: d });
      }

      if (route === "posts" && GET) {
        const wall = (await s.get("wall", { type: "json" })) || {};
        const keys = (await postKeys()).slice(0, 300);
        const all = (await Promise.all(keys.map((k) => s.get(k, { type: "json" })))).filter(Boolean);
        const posts = all.filter((p) => admin || p.status === "approved").slice(0, 200);
        return json(200, admin ? { posts, autoApprove: !!wall.autoApprove } : { posts });
      }
      if (route === "posts" && POST && !seg[1]) {
        const b = await body(req);
        if (!b) return json(400, { error: "bad request" });
        if (txt(b.website, 10)) return json(200, { ok: true, status: "pending" }); // hidden field only bots fill in
        const name = txt(b.name, 40), comment = multiline(b.comment, 500);
        let link = txt(b.link, 300);
        if (link) { try { const u = new URL(link); if (u.protocol !== "https:" && u.protocol !== "http:") throw 0; link = u.href; } catch { return json(400, { error: "link" }); } }
        let photo = null;
        if (b.photo) {
          photo = jpeg(b.photo, 1500000);
          if (!photo) return json(400, { error: "photo" });
        }
        if (!name) return json(400, { error: "name" });
        if (!link && !photo) return json(400, { error: "empty" });
        if (!admin && (await overLimit("rate/" + ipKey(req, ctx), 6, 3600000, true))) return json(429, { error: "too many posts" });
        const wall = (await s.get("wall", { type: "json" })) || {};
        const status = admin || wall.autoApprove ? "approved" : "pending";
        const id = crypto.randomBytes(8).toString("hex"), ts = Date.now();
        if (photo) await s.set((status === "approved" ? "photo/" : "pending-photo/") + id, photo);
        await s.setJSON(`post/${String(9999999999999 - ts)}-${id}`, { id, name, comment, link, photo: !!photo, ts, status });
        return json(200, { ok: true, status });
      }
      if (route === "posts" && POST && (seg[1] === "moderate" || seg[1] === "settings")) {
        const b = await body(req);
        if (!b) return json(400, { error: "bad request" });
        if (!admin) return json(401, { error: "login required" });
        if (seg[1] === "settings") { await s.setJSON("wall", { autoApprove: !!b.autoApprove }); return json(200, { ok: true }); }
        const id = String(b.id || "");
        if (!/^[0-9a-f]{16}$/.test(id)) return json(400, { error: "id" });
        const k = (await postKeys()).find((x) => x.endsWith("-" + id));
        if (!k) return json(404, { error: "not found" });
        const p = await s.get(k, { type: "json" });
        if (b.action === "delete") {
          await s.delete(k); await s.delete("photo/" + id); await s.delete("pending-photo/" + id);
        } else if (b.action === "approve" && p && p.status !== "approved") {
          if (p.photo) { const img = await s.get("pending-photo/" + id, { type: "arrayBuffer" }); if (img) { await s.set("photo/" + id, img); await s.delete("pending-photo/" + id); } }
          await s.setJSON(k, { ...p, status: "approved" });
        }
        return json(200, { ok: true });
      }
      if (route === "photo" && GET && /^[0-9a-f]{16}$/.test(seg[1] || "")) {
        let img = await s.get("photo/" + seg[1], { type: "arrayBuffer" }), pub = true;
        if (!img && admin) { img = await s.get("pending-photo/" + seg[1], { type: "arrayBuffer" }); pub = false; }
        if (!img) return new Response("Not found", { status: 404 });
        return new Response(img, { status: 200, headers: { "content-type": "image/jpeg", "x-content-type-options": "nosniff", "cache-control": pub ? "public, max-age=3600" : "no-store" } });
      }

      return json(404, { error: "not found" });
    } catch (e) {
      console.error(e);
      return json(500, { error: "server error" });
    }
  };
}
