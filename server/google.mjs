// Google connection: Drive (photos, video archive), YouTube (playlist), and "Sign in with Google" for visitors.
// The admin connects abhi@wenpower.in once; its refresh token is kept in the site's storage, never sent to browsers.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const YT = "https://www.googleapis.com/youtube/v3";
export const CONNECT_SCOPES = "openid email https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/youtube.readonly";
export const SIGNIN_SCOPES = "openid email profile";

function fail(message, status) { const e = new Error(message); e.code = "google"; e.status = status || 0; return e; }

export function createGoogle(env, store, fetchImpl) {
  const f = fetchImpl || ((...a) => fetch(...a));
  const clientId = () => String(env.GOOGLE_CLIENT_ID || "");
  const secret = () => String(env.GOOGLE_CLIENT_SECRET || "");
  let cached = null; // access token for this function instance

  const g = {
    configured: () => !!(clientId() && secret()),

    authUrl(origin, state, kind) {
      const p = new URLSearchParams({
        client_id: clientId(), redirect_uri: origin + "/api/google/callback", response_type: "code", state,
        scope: kind === "connect" ? CONNECT_SCOPES : SIGNIN_SCOPES,
        access_type: kind === "connect" ? "offline" : "online",
        prompt: kind === "connect" ? "consent" : "select_account",
        include_granted_scopes: "true",
      });
      return "https://accounts.google.com/o/oauth2/v2/auth?" + p;
    },

    async exchange(code, origin) {
      const r = await f(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: clientId(), client_secret: secret(), redirect_uri: origin + "/api/google/callback", grant_type: "authorization_code" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw fail("token exchange " + (j.error || r.status), r.status);
      return j;
    },

    // The ID token comes straight from Google's token endpoint over HTTPS, so its contents can be read without re-checking the signature.
    idInfo(idToken) {
      try { return JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString()); } catch { return null; }
    },

    async connection() { return await store().get("google/conn", { type: "json" }); },

    async token() {
      if (cached && cached.exp > Date.now() + 60000) return cached.token;
      const c = await g.connection();
      if (!c || !c.refresh) throw fail("Google Drive is not connected yet", 412);
      const r = await f(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId(), client_secret: secret(), refresh_token: c.refresh, grant_type: "refresh_token" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw fail("Google refused the saved connection (" + (j.error || r.status) + "). Connect Google again on the admin page.", 412);
      cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3000) * 1000 };
      return cached.token;
    },

    async call(url, opts = {}) {
      const t = await g.token();
      return f(url, { ...opts, headers: { ...(opts.headers || {}), authorization: "Bearer " + t } });
    },
    async json(url, opts) {
      const r = await g.call(url, opts);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw fail("Google " + r.status + ": " + ((j.error && (j.error.message || j.error)) || ""), r.status);
      return j;
    },

    /* ---------- Drive ---------- */
    async listFolder(folderId) {
      const out = []; let page = "";
      do {
        const q = new URLSearchParams({ q: `'${folderId}' in parents and trashed = false`, pageSize: "1000", supportsAllDrives: "true", includeItemsFromAllDrives: "true",
          fields: "nextPageToken,files(id,name,mimeType,createdTime,size,imageMediaMetadata(time),videoMediaMetadata(durationMillis),appProperties)" });
        if (page) q.set("pageToken", page);
        const j = await g.json(`${DRIVE}/files?${q}`);
        out.push(...(j.files || [])); page = j.nextPageToken || "";
      } while (page && out.length < 5000);
      return out;
    },
    async createFolder(name, parent) {
      const j = await g.json(`${DRIVE}/files?supportsAllDrives=true&fields=id`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: parent ? [parent] : undefined }) });
      return j.id;
    },
    async findFolder(name, parent) {
      const q = new URLSearchParams({ q: `name = '${name.replace(/'/g, "\\'")}' and '${parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: "files(id)", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
      const j = await g.json(`${DRIVE}/files?${q}`);
      return (j.files && j.files[0] && j.files[0].id) || "";
    },
    async ensureFolder(name, parent) { return (await g.findFolder(name, parent)) || (await g.createFolder(name, parent)); },
    async update(id, meta) {
      return g.json(`${DRIVE}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,name,appProperties`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(meta) });
    },
    async trash(id) { return g.update(id, { trashed: true }); },
    async uploadSmall(name, mime, buf, parent, appProperties) {
      const boundary = "gb" + Date.now().toString(36);
      const head = Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parent], appProperties })}\r\n--${boundary}\r\ncontent-type: ${mime}\r\n\r\n`);
      const tail = Buffer.from(`\r\n--${boundary}--`);
      return g.json(`${UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id,name`, { method: "POST", headers: { "content-type": `multipart/related; boundary=${boundary}` }, body: Buffer.concat([head, Buffer.from(buf), tail]) });
    },
    // Large videos go from the visitor's browser straight to Drive; the site only opens the upload session.
    async resumableStart(name, mime, size, parent, origin, appProperties) {
      const r = await g.call(`${UPLOAD}?uploadType=resumable&supportsAllDrives=true&fields=id,name`, { method: "POST",
        headers: { "content-type": "application/json; charset=UTF-8", "x-upload-content-type": mime, "x-upload-content-length": String(size), origin },
        body: JSON.stringify({ name, parents: [parent], appProperties }) });
      if (!r.ok) throw fail("Drive upload session " + r.status, r.status);
      return r.headers.get("location");
    },
    async thumbnail(fileId, size) {
      const j = await g.json(`${DRIVE}/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`);
      if (!j.thumbnailLink) return null;
      const link = j.thumbnailLink.replace(/=s\d+(-[a-z])?$/, "") + "=s" + size;
      let r = await g.call(link);
      if (!r.ok) r = await f(link);
      if (!r.ok) return null;
      return await r.arrayBuffer();
    },

    /* ---------- YouTube ---------- */
    async playlist(listId) {
      const out = []; let page = "";
      do {
        const q = new URLSearchParams({ part: "snippet,contentDetails,status", maxResults: "50", playlistId: listId });
        if (page) q.set("pageToken", page);
        const j = await g.json(`${YT}/playlistItems?${q}`);
        for (const it of j.items || []) {
          const s = it.snippet || {}, vid = (it.contentDetails && it.contentDetails.videoId) || (s.resourceId && s.resourceId.videoId);
          const priv = it.status && it.status.privacyStatus === "private";
          if (!vid || priv || s.title === "Private video" || s.title === "Deleted video") continue;
          out.push({ id: vid, title: s.title || "", ts: Date.parse((it.contentDetails && it.contentDetails.videoPublishedAt) || s.publishedAt || "") || 0, pos: s.position || 0 });
        }
        page = j.nextPageToken || "";
      } while (page && out.length < 1000);
      return out;
    },
  };
  return g;
}
