// Girish Bhawan site API. Storage is injected so the same code runs on Netlify (Blobs) and in local tests.
// Everything the admin may want to change later (sizes, prices, events, sections, groups, links) is data, not code.
import crypto from "node:crypto";
import { createGoogle } from "./google.mjs";

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
// Folders and playlist created for Durga Puja 2026 before the site managed them.
const LEGACY_MEDIA = { driveFolder: "17uyZW7mpq9OWtCDH6z4ASNNCOf4PxmcD", driveImages: "1-zwvetofASAQcKXL9aceB05HDmeVea5b", driveVideos: "1PUWLhX_Ll9Be-sGWHLb97coM77bfieAK", playlist: "PLE4jPQpbQERs" };
const DEFAULT_SITE = {
  links: { facebook: "https://www.facebook.com/girishbhawan", instagram: "https://www.instagram.com/girishbhawan/", youtube: "https://www.youtube.com/@GirishBhawan" },
  groups: [{ id: "girish-bhawan", name: "Girish Bhawan Group" }, { id: "padmarani", name: "Padmarani Group" }],
  sections: [
    { id: "pujo-accounts", title: "Pujo Accounts", desc: "Accounts of the Pujo.", access: "admin", groups: [], memberUpload: false },
    { id: "bhog-accounts", title: "Bhog Accounts", desc: "Accounts of the Bhog.", access: "admin", groups: [], memberUpload: false },
  ],
  events: [{ id: LEGACY, year: 2026, occasion: "Durga Puja", sub: "Photos, links and greetings from the family.", schedule: true, access: "public", groups: [], post: "anyone", autoApprove: false }],
  drive: { root: "1juT3cDBFY1BNy96pyLfhbsjc51wwVrr2" },
};
const DEFAULT_ITEMS = [{ id: "tshirt", name: "T-shirt" }, { id: "kurti", name: "Kurti" }];
function cleanItems(v) {
  const out = [], taken = new Set();
  for (const it of Array.isArray(v) ? v.slice(0, 12) : []) {
    const name = txt(it?.name, 40);
    if (name) out.push({ id: uniqueId(it?.id, name, taken, "item"), name, desc: multiline(it?.desc, 300), available: it?.available !== false, image: Number(it?.image) || 0 });
  }
  return out.length ? out : DEFAULT_ITEMS.map((x) => ({ ...x, desc: "", available: true, image: 0 }));
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
const driveId = (v) => { const m = /(?:folders\/|id=)?([A-Za-z0-9_-]{10,80})/.exec(String(v ?? "").trim()); return m && /^[A-Za-z0-9_-]{10,80}$/.test(m[1]) ? m[1] : ""; };
const playlistId = (v) => { const t = String(v ?? "").trim(); const m = /[?&]list=([A-Za-z0-9_-]{8,64})/.exec(t) || /^([A-Za-z0-9_-]{8,64})$/.exec(t); return m ? m[1] : ""; };
const folderPrefix = (ev) => ev.occasion.replace(/[^A-Za-z0-9]+/g, "") + ev.year;
const utf8cut = (v, bytes) => { let t = String(v ?? ""); while (Buffer.byteLength(t) > bytes) t = t.slice(0, -1); return t; };
function uniqueId(wanted, title, taken, fallback) {
  let base = /^[a-z0-9-]{1,40}$/.test(String(wanted || "")) ? wanted : slug(title) || fallback, id = base, n = 2;
  while (taken.has(id)) id = (base.slice(0, 36) + "-" + n++);
  taken.add(id);
  return id;
}
function cleanSite(input) {
  const src = input && typeof input === "object" ? input : {};
  const d = { links: { facebook: httpsUrl(src.links?.facebook), instagram: httpsUrl(src.links?.instagram), youtube: httpsUrl(src.links?.youtube) }, groups: [], sections: [], events: [],
    drive: { root: driveId(src.drive?.root) || DEFAULT_SITE.drive.root } };
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
  for (const e of Array.isArray(src.events) ? src.events.slice(0, 60) : []) {
    // An event is a year plus an occasion ("Durga Puja", "Jagaddhatri Puja"); older saves only had a title like "Durga Puja 2026".
    const oldTitle = txt(e?.title, 60), yearIn = Math.floor(Number(e?.year));
    const year = yearIn >= 1900 && yearIn <= 2100 ? yearIn : Number((/\b(19|20)\d{2}\b/.exec(oldTitle) || [])[0]) || new Date().getFullYear();
    const occasion = txt(e?.occasion, 50) || txt(oldTitle.replace(/\b(19|20)\d{2}\b/, ""), 50);
    if (!occasion) continue;
    const title = occasion + " " + year, legacy = e?.id === LEGACY ? LEGACY_MEDIA : {};
    d.events.push({ id: uniqueId(e?.id, title, taken, "event"), year, occasion, title, sub: txt(e?.sub, 200), schedule: !!e?.schedule, access: access(e?.access, "public"), groups: groupsOf(e?.groups),
      post: e?.post === "members" ? "members" : "anyone", autoApprove: !!e?.autoApprove,
      driveFolder: driveId(e?.driveFolder) || legacy.driveFolder || "", driveImages: driveId(e?.driveImages) || legacy.driveImages || "", driveVideos: driveId(e?.driveVideos) || legacy.driveVideos || "",
      playlist: playlistId(e?.playlist) || (e?.playlist === undefined ? legacy.playlist || "" : "") });
  }
  return d;
}
function csv(rows) {
  const cell = (v) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s) && typeof v !== "number") s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
const isBinaryKey = (k) => /^(photo\/|pending-photo\/|file\/|item-img\/|storyimg\/|dthumb\/)/.test(k) || /^album\/[^/]+\/(orig|prev|thumb)\//.test(k) || k === "schedule-image" || /^wall\/[^/]+\/(photo|pending)\//.test(k) || /^sched\/[^/]+\/image$/.test(k);
function imgType(buf) {
  const b = new Uint8Array(buf, 0, Math.min(12, buf.byteLength));
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  return null;
}
const SOCIAL_HOSTS = /(^|\.)(instagram\.com|facebook\.com|fb\.watch|youtube\.com|youtu\.be)$/i;
const IMAGE_HOSTS = /(^|\.)(cdninstagram\.com|fbcdn\.net|ytimg\.com|ggpht\.com|googleusercontent\.com)$/i;
const youtubeId = (link) => { try { const u = new URL(link); if (/youtu\.be$/i.test(u.hostname)) return u.pathname.slice(1, 12); if (/youtube\.com$/i.test(u.hostname)) return u.searchParams.get("v") || (/\/(shorts|embed|live)\/([\w-]{11})/.exec(u.pathname) || [])[2] || ""; } catch {} return ""; };
async function fetchImage(href) {
  try {
    const u = new URL(href);
    if (u.protocol !== "https:" || !IMAGE_HOSTS.test(u.hostname)) return null;
    const r = await fetch(u.href, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    return buf.byteLength > 500 && buf.byteLength < 2500000 && imgType(buf) ? buf : null;
  } catch { return null; }
}
// Picture shown on a post that links to Instagram, Facebook or YouTube. Returns null when the site will not share one.
async function fetchPreview(link) {
  try {
    const u = new URL(link);
    if (u.protocol !== "https:" || !SOCIAL_HOSTS.test(u.hostname)) return null;
    const yt = youtubeId(link);
    if (yt && /^[\w-]{11}$/.test(yt)) return await fetchImage(`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`);
    const r = await fetch(u.href, { headers: { "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", accept: "text/html" }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const html = (await r.text()).slice(0, 800000);
    const m = /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i.exec(html) || /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i.exec(html);
    return m ? await fetchImage(m[1].replace(/&amp;/g, "&")) : null;
  } catch { return null; }
}
// Left out of backups: counters, caches, and the Google connection key (reconnect after a restore instead).
const isTransientKey = (k) => /^(rate|fails|dthumb|albumcache|oauthstate|google)\//.test(k);
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
  const g = createGoogle(env, store, env.__fetch);
  const gCookie = (value, maxAge) => `gbg=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
  async function guestOf(req) {
    const m = /(?:^|;\s*)gbg=([A-Za-z0-9_-]+)\.([0-9a-f]{64})/.exec(req.headers.get("cookie") || "");
    if (!m) return null;
    const a = Buffer.from(m[2], "hex"), b = Buffer.from(sign("g|" + m[1]), "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    let p; try { p = JSON.parse(Buffer.from(m[1], "base64url").toString()); } catch { return null; }
    if (!p || p.exp < Date.now() || !/^[0-9a-f]{24}$/.test(String(p.g))) return null;
    const gu = await store().get("guest/" + p.g, { type: "json" });
    return gu && !gu.blocked ? gu : null;
  }
  // Who is voting or asking: the admin, an approved family account, or someone signed in with Google.
  const voterOf = (who) => (who.admin ? "admin" : active(who) ? "u-" + who.user.id : who.guest ? "g-" + who.guest.id : "");
  const personOf = (who) => (who.admin ? { name: "Admin", email: "", kind: "Family" } : active(who) ? { name: who.user.name, email: who.user.login, kind: "Family" } : who.guest ? { name: who.guest.name, email: who.guest.email, kind: who.guest.kind || "Not said" } : null);
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
      who.guest = await guestOf(req);
      const origin = url.origin;
      const deny = () => json(who.admin || who.user ? 403 : 401, { error: "login required" });

      /* ---------- who am I, what can I see ---------- */
      if (route === "site" && GET) {
        const site = await getSite();
        return json(200, {
          me: { admin, user: who.user ? publicUser(who.user) : null, guest: who.guest ? { name: who.guest.name, email: who.guest.email, kind: who.guest.kind || "" } : null },
          googleSignIn: g.configured(),
          links: site.links, groups: site.groups,
          events: site.events.filter((e) => canSee(e, who)).map((e) => ({ id: e.id, title: e.title, year: e.year, occasion: e.occasion, sub: e.sub, schedule: e.schedule, post: e.post })),
          sections: site.sections.filter((x) => canSee(x, who)).map((x) => ({ id: x.id, title: x.title, desc: x.desc })),
        });
      }

      /* ---------- Google: admin connects Drive and YouTube; visitors sign in to vote and ask for photos ---------- */
      if (route === "google") {
        const act = seg[1] || "";
        const back = (path) => new Response(null, { status: 302, headers: { location: path, "cache-control": "no-store" } });
        if ((act === "connect" || act === "signin") && GET) {
          if (!g.configured()) return back(act === "connect" ? "/admin/?google=notset" : "/?google=notset");
          if (act === "connect" && !admin) return back("/account/");
          let next = url.searchParams.get("next") || "/";
          if (!/^\/[A-Za-z0-9/_?=&.%-]*$/.test(next) || next.startsWith("//")) next = "/";
          const state = crypto.randomBytes(18).toString("hex");
          await s.setJSON("oauthstate/" + state, { kind: act, next: act === "connect" ? "/admin/" : next, exp: Date.now() + 15 * 60000 });
          return back(g.authUrl(origin, state, act));
        }
        if (act === "callback" && GET) {
          const state = url.searchParams.get("state") || "", code = url.searchParams.get("code") || "";
          const st = /^[0-9a-f]{36}$/.test(state) ? await s.get("oauthstate/" + state, { type: "json" }) : null;
          if (st) await s.delete("oauthstate/" + state);
          if (!st || st.exp < Date.now()) return back("/?google=expired");
          if (!code) return back(st.next + (st.next.includes("?") ? "&" : "?") + "google=cancelled");
          const tok = await g.exchange(code, origin), info = g.idInfo(tok.id_token) || {};
          if (st.kind === "connect") {
            if (!tok.refresh_token) return back("/admin/?google=norefresh");
            await s.setJSON("google/conn", { refresh: tok.refresh_token, email: info.email || "", scope: tok.scope || "", ts: Date.now() });
            for (const k of await keys("albumcache/")) await s.delete(k); // albums read Drive again straight away
            return back("/admin/?google=connected");
          }
          if (!info.sub || !info.email || info.email_verified === false) return back(st.next);
          const gid = sha("guest|" + info.sub).toString("hex").slice(0, 24), old = (await s.get("guest/" + gid, { type: "json" })) || {};
          await s.setJSON("guest/" + gid, { ...old, id: gid, name: txt(info.name || old.name || info.email.split("@")[0], 60), email: txt(info.email, 120), kind: old.kind || "", created: old.created || Date.now(), seen: Date.now() });
          const pl = Buffer.from(JSON.stringify({ g: gid, exp: Date.now() + 60 * 86400000 })).toString("base64url");
          return new Response(null, { status: 302, headers: { location: st.next, "set-cookie": gCookie(pl + "." + sign("g|" + pl), 60 * 86400), "cache-control": "no-store" } });
        }
        if (act === "status" && GET) {
          if (!admin) return deny();
          const c = await g.connection();
          return json(200, { configured: g.configured(), connected: !!(c && c.refresh), email: c ? c.email : "", since: c ? c.ts : 0 });
        }
        if (act === "disconnect" && POST) {
          if (!(await body(req))) return json(400, { error: "bad request" });
          if (!admin) return deny();
          await s.delete("google/conn");
          return json(200, { ok: true });
        }
      }
      if (route === "guest" && POST) {
        const b = await body(req);
        if (!b) return json(400, { error: "bad request" });
        if (seg[1] === "logout") return json(200, { ok: true }, { "set-cookie": gCookie("x", 0) });
        if (!who.guest) return deny();
        const kind = b.kind === "Family" ? "Family" : b.kind === "Guest" ? "Guest" : "";
        if (!kind) return json(400, { error: "kind" });
        await s.setJSON("guest/" + who.guest.id, { ...who.guest, kind, name: txt(b.name, 60) || who.guest.name });
        return json(200, { ok: true });
      }

      /* ---------- Our story: a timeline anyone can add to, shown once the admin approves ---------- */
      if (route === "story") {
        const act = seg[1] || "", list = async () => (await Promise.all((await keys("story/")).map((k) => s.get(k, { type: "json" })))).filter(Boolean);
        if (!act && GET) {
          const all = (await list()).filter((x) => admin || x.status === "approved");
          all.sort((a, b) => a.year - b.year || (a.month || 0) - (b.month || 0) || (a.day || 0) - (b.day || 0) || a.ts - b.ts);
          return json(200, { entries: all });
        }
        if (act === "img" && GET) {
          const id = seg[2] || "";
          if (!/^[0-9a-f]{16}$/.test(id)) return new Response("Not found", { status: 404 });
          const meta = await s.get("story/" + id, { type: "json" });
          if (!meta || (meta.status !== "approved" && !admin)) return new Response("Not found", { status: 404 });
          const img = await s.get("storyimg/" + id, { type: "arrayBuffer" });
          return img ? new Response(img, { status: 200, headers: { "content-type": "image/jpeg", "x-content-type-options": "nosniff", "cache-control": meta.status === "approved" ? "public, max-age=86400" : "no-store" } }) : new Response("Not found", { status: 404 });
        }
        if (!POST) return json(404, { error: "not found" });
        const b = await body(req);
        if (!b) return json(400, { error: "bad request" });
        const clean = (x, prev) => {
          const year = Math.floor(Number(x.year)), month = Math.floor(Number(x.month)) || 0, day = Math.floor(Number(x.day)) || 0;
          if (!(year >= 1700 && year <= new Date().getFullYear() + 1)) return null;
          if (month < 0 || month > 12 || day < 0 || day > 31 || (day && !month)) return null;
          const title = txt(x.title, 120), text = multiline(x.text, 3000);
          if (!title && !text) return null;
          return { ...prev, year, month, day, title, text, name: txt(x.name, 60) || (prev && prev.name) || "" };
        };
        if (!act) {
          if (txt(b.website, 10)) return json(200, { ok: true });
          const person = personOf(who), entry = clean(b, {});
          if (!entry) return json(400, { error: "fields" });
          if (!entry.name && person) entry.name = person.name;
          if (!entry.name) return json(400, { error: "name" });
          let img = null;
          if (b.photo) { img = jpeg(b.photo, 1048576); if (!img) return json(400, { error: "photo" }); }
          if (!admin && (await overLimit("rate/story-" + ipKey(req, ctx), 5, 3600000, true))) return json(429, { error: "too many" });
          const id = crypto.randomBytes(8).toString("hex");
          if (img) await s.set("storyimg/" + id, img);
          await s.setJSON("story/" + id, { id, ...entry, photo: !!img, ts: Date.now(), status: admin ? "approved" : "pending", email: person ? person.email : "" });
          return json(200, { ok: true, status: admin ? "approved" : "pending" });
        }
        if (act === "moderate") {
          if (!admin) return deny();
          const id = String(b.id || ""), meta = /^[0-9a-f]{16}$/.test(id) ? await s.get("story/" + id, { type: "json" }) : null;
          if (!meta) return json(404, { error: "not found" });
          if (b.action === "delete") { await s.delete("story/" + id); await s.delete("storyimg/" + id); return json(200, { ok: true }); }
          if (b.action === "approve") { await s.setJSON("story/" + id, { ...meta, status: "approved" }); return json(200, { ok: true }); }
          if (b.action === "edit") { const e2 = clean(b, meta); if (!e2) return json(400, { error: "fields" }); await s.setJSON("story/" + id, e2); return json(200, { ok: true }); }
          return json(400, { error: "action" });
        }
        return json(404, { error: "not found" });
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

      /* ---------- what is on offer: public list of dress types marked available ---------- */
      if (route === "catalog" && GET) {
        const items = cleanItems((await s.get("order-items", { type: "json" })) || DEFAULT_ITEMS), out = [];
        for (const it of items.filter((x) => x.available)) {
          const d = cleanOrders((await s.get(it.id === "tshirt" ? "orders" : "orders/" + it.id, { type: "json" })) || (it.id === "tshirt" ? DEFAULT_ORDERS : { price: it.id === "kurti" ? 525 : 0 }));
          out.push({ id: it.id, name: it.name, desc: it.desc, price: d.price, sizes: d.sizes, sizePrices: d.sizePrices,
            image: it.image ? `/api/item-image?i=${it.id}&v=${it.image}` : it.id === "tshirt" ? "/assets/design.jpg" : "" });
        }
        return json(200, { items: out });
      }
      if (route === "item-image" && GET) {
        const img = await s.get("item-img/" + (url.searchParams.get("i") || "").replace(/[^a-z0-9-]/g, ""), { type: "arrayBuffer" });
        if (!img) return new Response("Not found", { status: 404 });
        return new Response(img, { status: 200, headers: { "content-type": "image/jpeg", "x-content-type-options": "nosniff", "cache-control": "public, max-age=86400" } });
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
          if (!admin && !active(who)) return deny();
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
            if (b.action === "update") {
              const name = txt(b.name, 40);
              if (!name) return json(400, { error: "name" });
              target.name = name; target.desc = multiline(b.desc, 300); target.available = b.available !== false;
              await s.setJSON("order-items", items);
              return json(200, { ok: true });
            }
            if (b.action === "image") {
              if (b.remove) { await s.delete("item-img/" + target.id); target.image = 0; }
              else { const img = jpeg(b.photo, 1500000); if (!img) return json(400, { error: "photo" }); await s.set("item-img/" + target.id, img); target.image = Date.now(); }
              await s.setJSON("order-items", items);
              return json(200, { ok: true });
            }
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
      if (["posts", "photo", "schedule", "schedule-image", "album"].includes(route)) {
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
          let preview = false;
          if (!photo && link) { photo = await fetchPreview(link); preview = !!photo; }
          if (photo) await s.set(photoKey(e, id, status !== "approved"), photo);
          await s.setJSON(`${postPrefix(e)}${inv(ts)}-${id}`, { id, name, comment, link, photo: !!photo, preview, ts, status, by: who.user ? who.user.id : "" });
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
          else if (b.action === "preview" && p && p.link && !p.photo) {
            const img = await fetchPreview(p.link);
            if (!img) return json(422, { error: "no preview" });
            await s.set(photoKey(e, id, p.status !== "approved"), img); await s.setJSON(k, { ...p, photo: true, preview: true });
          }
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
          return new Response(img, { status: 200, headers: { "content-type": imgType(img) || "image/jpeg", "x-content-type-options": "nosniff", "cache-control": pub ? "public, max-age=3600" : "private, no-store" } });
        }

        /* ---------- album: photos from Drive, videos from YouTube; thumbnails only, votes, and requests to the admin ---------- */
        if (route === "album") {
          const act = seg[1] || "", voter = voterOf(who), prefix = folderPrefix(ev);
          const hideKey = `albumhide/${e}`, sumKey = `votesum/${e}`, cacheKey = `albumcache/${e}`;
          const numbered = new RegExp("^" + prefix + "_(\\d{4,})\\.", "i");
          const sortTs = (f) => {
            const m = /(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})(?:\((\d+)\))?/.exec(f.name);
            if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) + (+m[7] || 0);
            const t = f.imageMediaMetadata && /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(f.imageMediaMetadata.time || "");
            if (t) return Date.UTC(+t[1], +t[2] - 1, +t[3], +t[4], +t[5], +t[6]);
            return Date.parse(f.createdTime || "") || 0;
          };
          async function media(fresh) {
            const old = await s.get(cacheKey, { type: "json" });
            if (old && !fresh && Date.now() - old.ts < 5 * 60000) return old;
            const c = { ts: Date.now(), photos: old ? old.photos : [], videos: old ? old.videos : [], err: "" };
            if (g.configured() && (await g.connection())) {
              if (ev.driveImages) {
                try {
                  c.photos = (await g.listFolder(ev.driveImages)).filter((f) => /^image\//.test(f.mimeType)).map((f) => {
                    const ap = f.appProperties || {}, n = numbered.exec(f.name);
                    return { fid: f.id, name: f.name, n: n ? +n[1] : 0, ts: sortTs(f), st: ap.gbStatus || "approved", by: ap.gbBy || "", cap: ap.gbCaption || "" };
                  }).sort((a, b) => (a.n || 1e9) - (b.n || 1e9) || a.ts - b.ts);
                } catch (err) { c.err = err.message; }
              }
              if (ev.playlist) { try { c.videos = await g.playlist(ev.playlist); } catch (err) { c.err = c.err || err.message; } }
            } else c.err = "Google Drive is not connected yet.";
            await s.setJSON(cacheKey, c);
            return c;
          }
          const legacyItems = async () => (await Promise.all((await keys(`album/${e}/meta/`)).map((k) => s.get(k, { type: "json" })))).filter((m) => m && m.kind === "photo" && m.thumb);

          if (!act && GET) {
            const c = await media(admin && url.searchParams.get("fresh") === "1"), hidden = (await s.get(hideKey, { type: "json" })) || {};
            const sum = (await s.get(sumKey, { type: "json" })) || {}, mine = voter ? (await s.get(`myvotes/${e}/${voter}`, { type: "json" })) || {} : {};
            const items = [];
            for (const p of c.photos) {
              if (!admin && (p.st !== "approved" || hidden["d-" + p.fid])) continue;
              items.push({ id: "d-" + p.fid, kind: "photo", code: p.name.replace(/\.[^.]+$/, ""), cap: p.cap, by: p.by, ts: p.ts,
                thumb: `/api/album/dthumb/${p.fid}?e=${e}&s=400`, view: `/api/album/dthumb/${p.fid}?e=${e}&s=1000`,
                ...(admin ? { pending: p.st !== "approved", hidden: !!hidden["d-" + p.fid], drive: `https://drive.google.com/file/d/${p.fid}/view` } : {}) });
            }
            for (const m of await legacyItems()) {
              if (!admin && hidden["s-" + m.id]) continue;
              items.push({ id: "s-" + m.id, kind: "photo", code: "Site photo " + m.id.slice(0, 4).toUpperCase(), cap: m.caption || "", by: m.byName || "", ts: m.ts,
                thumb: `/api/album/thumb/${m.id}?e=${e}`, view: `/api/album/prev/${m.id}?e=${e}`, ...(admin ? { hidden: !!hidden["s-" + m.id] } : {}) });
            }
            const videos = [];
            for (const v of c.videos) {
              if (!admin && hidden["y-" + v.id]) continue;
              videos.push({ id: "y-" + v.id, kind: "video", yt: v.id, code: v.title, ts: v.ts, thumb: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`, ...(admin ? { hidden: !!hidden["y-" + v.id] } : {}) });
            }
            for (const it of items.concat(videos)) { const v = sum[it.id] || { u: 0, d: 0 }; it.up = v.u; it.down = v.d; it.mine = mine[it.id] || 0; }
            const person = personOf(who);
            return json(200, { photos: items, videos, me: voter ? { voter, name: person.name, kind: person.kind, guest: !!who.guest && !admin && !active(who) } : null,
              mayUpload: !!voter, uploadsNeedApproval: !admin && !active(who), driveReady: !!ev.driveImages, ...(admin ? { err: c.err, cachedAt: c.ts, playlist: ev.playlist } : {}) });
          }
          if (act === "dthumb" && GET) {
            const fid = seg[2] || "", size = url.searchParams.get("s") === "1000" ? 1000 : 400;
            if (!/^[A-Za-z0-9_-]{10,80}$/.test(fid)) return new Response("Not found", { status: 404 });
            // Only pictures listed in this event's Images folder can be fetched, so no other Drive file is reachable through here.
            const c = await media(false), p = c.photos.find((x) => x.fid === fid), hidden = (await s.get(hideKey, { type: "json" })) || {};
            if (!p || (!admin && (p.st !== "approved" || hidden["d-" + fid]))) return new Response("Not found", { status: 404 });
            const ck = `dthumb/${size}/${fid}`;
            let img = await s.get(ck, { type: "arrayBuffer" });
            if (!img) { img = await g.thumbnail(fid, size); if (!img) return new Response("Not ready", { status: 404 }); await s.set(ck, img); }
            return new Response(img, { status: 200, headers: { "content-type": imgType(img) || "image/jpeg", "x-content-type-options": "nosniff", "cache-control": ev.access === "public" && p.st === "approved" ? "public, max-age=86400" : "private, no-store" } });
          }
          if (["thumb", "prev"].includes(act) && GET) {
            const id = seg[2] || "";
            if (!/^[0-9a-f]{16}$/.test(id)) return new Response("Not found", { status: 404 });
            const img = await s.get(`album/${e}/${act}/${id}`, { type: "arrayBuffer" });
            if (!img) return new Response("Not found", { status: 404 });
            return new Response(img, { status: 200, headers: { "content-type": imgType(img) || "image/jpeg", "x-content-type-options": "nosniff", "cache-control": ev.access !== "public" ? "private, no-store" : "public, max-age=86400" } });
          }
          if (!POST) return json(404, { error: "not found" });
          const b = await body(req);
          if (!b) return json(400, { error: "bad request" });
          const item = String(b.item || "");
          const validItem = /^(d-[A-Za-z0-9_-]{10,80}|s-[0-9a-f]{16}|y-[A-Za-z0-9_-]{11})$/.test(item);

          if (act === "vote") {
            if (!voter) return json(401, { error: "sign in" });
            if (!validItem) return json(400, { error: "item" });
            const v = b.v === 1 || b.v === -1 ? b.v : 0;
            if (!admin && (await overLimit("rate/vote-" + voter, 300, 3600000, true))) return json(429, { error: "too many" });
            const mk = `myvotes/${e}/${voter}`, mine = (await s.get(mk, { type: "json" })) || {}, old = mine[item] || 0;
            if (old === v) return json(200, { ok: true });
            if (v) mine[item] = v; else delete mine[item];
            await s.setJSON(mk, mine);
            const sum = (await s.get(sumKey, { type: "json" })) || {}, cnt = sum[item] || { u: 0, d: 0 };
            if (old === 1) cnt.u--; if (old === -1) cnt.d--; if (v === 1) cnt.u++; if (v === -1) cnt.d++;
            cnt.u = Math.max(0, cnt.u); cnt.d = Math.max(0, cnt.d); sum[item] = cnt;
            await s.setJSON(sumKey, sum);
            return json(200, { ok: true, up: cnt.u, down: cnt.d });
          }
          if (act === "request") {
            if (!voter) return json(401, { error: "sign in" });
            if (!validItem) return json(400, { error: "item" });
            if (!admin && (await overLimit("rate/req-" + voter, 30, 3600000, true))) return json(429, { error: "too many" });
            const person = personOf(who), id = crypto.randomBytes(8).toString("hex"), ts = Date.now();
            await s.setJSON(`preq/${inv(ts)}-${id}`, { id, e, item, code: txt(b.code, 120), note: txt(b.note, 300), name: person.name, email: person.email, kind: person.kind, ts, status: "open" });
            return json(200, { ok: true });
          }
          if (act === "upload") {
            if (!voter) return json(401, { error: "sign in" });
            if (!ev.driveImages) return json(409, { error: "no folder" });
            const img = jpeg(b.photo, 4000000);
            if (!img) return json(400, { error: "photo" });
            if (!admin && (await overLimit("rate/up-" + voter, 300, 3600000, true))) return json(429, { error: "too many" });
            const person = personOf(who), now = new Date(), stamp = now.toISOString().slice(0, 19).replace(/[T:]/g, "-");
            const appProperties = { gbStatus: admin || active(who) ? "approved" : "pending", gbBy: utf8cut(person.name, 100), gbCaption: utf8cut(txt(b.caption, 100), 100) };
            await g.uploadSmall(`UPLOAD-${stamp}-${crypto.randomBytes(2).toString("hex")}.jpg`, "image/jpeg", img, ev.driveImages, appProperties);
            await s.delete(cacheKey);
            return json(200, { ok: true, status: appProperties.gbStatus });
          }
          if (act === "video-start") {
            if (!voter) return json(401, { error: "sign in" });
            if (!ev.driveVideos) return json(409, { error: "no folder" });
            const mime = /^video\/[a-z0-9.+-]{1,40}$/i.test(String(b.mime || "")) ? b.mime : "video/mp4", size = Math.floor(Number(b.size));
            if (!(size > 0 && size < 10 * 1024 ** 3)) return json(400, { error: "size" });
            const person = personOf(who), ext = (/\.([A-Za-z0-9]{2,5})$/.exec(String(b.name || "")) || [])[1] || "mp4";
            const name = `VIDEO-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}-${utf8cut(person.name.replace(/[^A-Za-z0-9]+/g, ""), 30)}.${ext.toLowerCase()}`;
            const upload = await g.resumableStart(name, mime, size, ev.driveVideos, origin, { gbBy: utf8cut(person.name, 100), gbCaption: utf8cut(txt(b.caption, 100), 100) });
            if (!upload) return json(502, { error: "drive" });
            return json(200, { ok: true, upload });
          }
          if (!admin) return deny();
          if (act === "moderate") {
            if (!validItem) return json(400, { error: "item" });
            const hidden = (await s.get(hideKey, { type: "json" })) || {};
            if (b.action === "hide" || b.action === "unhide") { if (b.action === "hide") hidden[item] = true; else delete hidden[item]; await s.setJSON(hideKey, hidden); return json(200, { ok: true }); }
            if (b.action === "keep") { const ack = (await s.get(`flagack/${e}`, { type: "json" })) || {}, sum = (await s.get(sumKey, { type: "json" })) || {}; ack[item] = (sum[item] || {}).d || 0; await s.setJSON(`flagack/${e}`, ack); return json(200, { ok: true }); }
            if (b.action === "approve" && item.startsWith("d-")) { await g.update(item.slice(2), { appProperties: { gbStatus: "approved" } }); await s.delete(cacheKey); return json(200, { ok: true }); }
            if (b.action === "trash") {
              if (item.startsWith("d-")) { await g.trash(item.slice(2)); await s.delete(cacheKey); }
              else if (item.startsWith("s-")) { const id = item.slice(2), k = (await keys(`album/${e}/meta/`)).find((x) => x.endsWith("-" + id)); if (k) await s.delete(k); for (const part of ["thumb", "prev", "orig"]) await s.delete(`album/${e}/${part}/${id}`); }
              else return json(400, { error: "Remove YouTube videos from the playlist on YouTube." });
              return json(200, { ok: true });
            }
            return json(400, { error: "action" });
          }
          if (act === "number") {
            // Gives every photo in the Images folder a short name in date order: DurgaPuja2026_0001.jpg, _0002 ...
            const c = await media(true);
            let max = c.photos.reduce((m, p) => Math.max(m, p.n), 0), done = 0;
            const todo = c.photos.filter((p) => !p.n).sort((a, b) => a.ts - b.ts);
            for (const p of todo.slice(0, 25)) {
              const ext = ((/\.([A-Za-z0-9]{2,5})$/.exec(p.name) || [])[1] || "jpg").toLowerCase();
              await g.update(p.fid, { name: `${prefix}_${String(++max).padStart(4, "0")}.${ext}` }); done++;
            }
            await s.delete(cacheKey);
            return json(200, { ok: true, done, remaining: Math.max(0, todo.length - done) });
          }
          if (act === "refresh") { await s.delete(cacheKey); return json(200, { ok: true }); }
          return json(404, { error: "not found" });
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
          const yr = Math.floor(Number(b.year));
          await s.setJSON(`fmeta/${sid}/${inv(ts)}-${id}`, { id, name, ext, size: buf.length, note: txt(b.note, 200), year: yr >= 1900 && yr <= 2100 ? yr : new Date(ts).getFullYear(), ts, by: admin ? "Admin" : who.user.name });
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
          const site = await getSite();
          const preqs = (await Promise.all((await keys("preq/")).slice(0, 300).map((k) => s.get(k, { type: "json" })))).filter(Boolean);
          // Photos and videos with five or more thumbs down that the admin has not yet reviewed
          const flagged = [];
          for (const ev2 of site.events) {
            const sum = (await s.get(`votesum/${ev2.id}`, { type: "json" })) || {}, ack = (await s.get(`flagack/${ev2.id}`, { type: "json" })) || {};
            const hidden = (await s.get(`albumhide/${ev2.id}`, { type: "json" })) || {};
            for (const [item, c] of Object.entries(sum)) if (c.d >= 5 && c.d > (ack[item] || 0)) flagged.push({ e: ev2.id, event: ev2.title, item, up: c.u, down: c.d, hidden: !!hidden[item] });
          }
          const stories = (await Promise.all((await keys("story/")).map((k) => s.get(k, { type: "json" })))).filter((x) => x && x.status !== "approved").length;
          const conn = await g.connection();
          return json(200, { site, users: users.map(publicUser), preqs, flagged, pendingStories: stories,
            google: { configured: g.configured(), connected: !!(conn && conn.refresh), email: conn ? conn.email : "" } });
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
        if (act === "site") {
          const d = cleanSite(b), problems = [];
          if (g.configured() && (await g.connection())) {
            for (const ev2 of d.events) {
              if (ev2.driveImages && ev2.driveVideos) continue;
              try {
                const prefix = folderPrefix(ev2);
                ev2.driveFolder = ev2.driveFolder || (await g.ensureFolder(prefix, d.drive.root));
                ev2.driveImages = ev2.driveImages || (await g.ensureFolder(prefix + "_Images", ev2.driveFolder));
                ev2.driveVideos = ev2.driveVideos || (await g.ensureFolder(prefix + "_Videos", ev2.driveFolder));
              } catch (err) { problems.push(ev2.title + ": " + err.message); }
            }
          }
          await s.setJSON("site", d);
          for (const k of await keys("albumcache/")) await s.delete(k); // a changed playlist or folder shows at once
          return json(200, { ok: true, site: d, problems });
        }
        if (act === "preq") {
          const id = String(b.id || "");
          if (!/^[0-9a-f]{16}$/.test(id)) return json(400, { error: "id" });
          const k = (await keys("preq/")).find((x) => x.endsWith("-" + id)), r = k ? await s.get(k, { type: "json" }) : null;
          if (!r) return json(404, { error: "not found" });
          if (b.action === "delete") await s.delete(k); else await s.setJSON(k, { ...r, status: b.action === "done" ? "shared" : "open" });
          return json(200, { ok: true });
        }
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
