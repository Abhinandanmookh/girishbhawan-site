(function () {
  var $ = GB.$, el = GB.el, flash = GB.flash, E = GB.qs("e") || "durga-puja-2026", Q = "?e=" + encodeURIComponent(E);
  var items = [], mayUpload = false, canDownload = false, requested = false, me = "", admin = false, loaded = false, blocked = false, current = null;

  /* ---------- pictures are prepared in the browser: a small thumbnail, a marked preview, and the full-size original ---------- */
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { resolve({ src: img, w: img.naturalWidth, h: img.naturalHeight, done: function () { URL.revokeObjectURL(url); } }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("read")); };
      img.src = url;
    });
  }
  function posterFrame(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), v = document.createElement("video"), timer = setTimeout(function () { reject(new Error("video")); }, 15000);
      v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
      v.onloadeddata = function () { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
      v.onseeked = function () { clearTimeout(timer); resolve({ src: v, w: v.videoWidth, h: v.videoHeight, done: function () { URL.revokeObjectURL(url); } }); };
      v.onerror = function () { clearTimeout(timer); URL.revokeObjectURL(url); reject(new Error("video")); };
    });
  }
  function draw(pic, max, quality, mark) {
    var k = Math.min(1, max / Math.max(pic.w, pic.h)), c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(pic.w * k)); c.height = Math.max(1, Math.round(pic.h * k));
    var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(pic.src, 0, 0, c.width, c.height);
    if (mark) {
      var size = Math.max(12, Math.round(c.width * 0.032));
      ctx.font = "600 " + size + "px system-ui, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
      ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = size / 3; ctx.fillStyle = "rgba(255,255,255,.82)";
      ctx.fillText("Girish Bhawan", c.width - size * 0.8, c.height - size * 0.6);
    }
    return c.toDataURL("image/jpeg", quality);
  }
  function fit(pic, tries, maxChars, mark) {
    for (var i = 0; i < tries.length; i++) { var d = draw(pic, tries[i][0], tries[i][1], mark); if (d.length < maxChars) return d; }
    return null;
  }

  /* ---------- page ---------- */
  function renderBanner() {
    var b = $("dlState"); b.textContent = ""; b.hidden = blocked || admin;
    if (b.hidden) return;
    if (canDownload) { b.textContent = "You can download the full-size photos in this album."; return; }
    if (!GB.member()) { b.appendChild(document.createTextNode("Full-size photos can be downloaded by family members the admin has approved. ")); var a = el("a", null, "Log in to ask for access."); a.href = "/account/"; b.appendChild(a); return; }
    if (requested) { b.textContent = "You have asked to download the full-size photos. The admin will approve it."; return; }
    b.appendChild(document.createTextNode("Previews only. Want the full-size photos? "));
    var btn = el("button", "linkbtn", "Ask the admin for download access"); btn.type = "button"; btn.addEventListener("click", ask); b.appendChild(btn);
  }
  function ask() {
    GB.api("album/request" + Q, {}).then(function () { requested = true; renderBanner(); if (current) openItem(current); }, function () { flash($("pageMsg"), "Could not send the request. Try again.", true); });
  }
  function render() {
    var grid = $("grid"); grid.textContent = "";
    $("upSec").hidden = !mayUpload || blocked;
    renderBanner();
    if (blocked) { grid.appendChild(el("p", "empty", "This album is for family members. Log in with an approved account to see it.")); return; }
    if (!loaded) { grid.appendChild(el("p", "empty", "Loading the album…")); return; }
    if (!items.length) { grid.appendChild(el("p", "empty", mayUpload ? "No photos or videos yet. Add the first ones above." : "No photos or videos yet.")); return; }
    items.forEach(function (m) {
      var t = el("button", "tile" + (m.kind === "video" ? " video" : "")); t.type = "button";
      t.setAttribute("aria-label", (m.kind === "video" ? "Video" : "Photo") + (m.caption ? ": " + m.caption : "") + ", added by " + m.byName);
      if (m.thumb) { var im = el("img"); im.src = "/api/album/thumb/" + m.id + Q; im.alt = ""; im.loading = "lazy"; im.draggable = false; t.appendChild(im); }
      else t.appendChild(el("span", "tile-ph", "Video"));
      if (m.kind === "video") t.appendChild(el("span", "play", "▶"));
      t.addEventListener("click", function () { openItem(m); });
      grid.appendChild(t);
    });
  }
  function openItem(m) {
    current = m;
    var box = $("lbMedia"); box.textContent = "";
    if (m.thumb) { var im = el("img"); im.src = "/api/album/prev/" + m.id + Q; im.alt = m.caption || (m.kind === "video" ? "Video thumbnail" : "Photo"); im.draggable = false; box.appendChild(im); }
    else box.appendChild(el("div", "tile-ph big", "Video"));
    $("lbCap").textContent = m.caption || ""; $("lbCap").hidden = !m.caption;
    $("lbMeta").textContent = "Added by " + m.byName + " · " + GB.when(m.ts);
    var act = $("lbAct"); act.textContent = "";
    if (m.kind === "video") { var v = el("a", "btnlink primary", "Open the video"); v.href = m.link; v.target = "_blank"; v.rel = "noopener"; act.appendChild(v); }
    else if (m.orig && canDownload) { var d = el("a", "btnlink primary", "Download full size"); d.href = "/api/album/orig/" + m.id + Q; act.appendChild(d); }
    else if (m.kind === "photo" && GB.member() && !canDownload && !requested) { var r = el("button", "primary", "Ask for download access"); r.type = "button"; r.addEventListener("click", ask); act.appendChild(r); }
    if (admin || (me && m.by === me)) {
      var armed = false, del = el("button", "danger", "Delete"); del.type = "button";
      del.addEventListener("click", function () {
        if (!armed) { armed = true; del.textContent = "Confirm delete"; return; }
        GB.api("album/delete" + Q, { id: m.id }).then(function () { close(); load(); }, function () { flash($("lbMsg"), "Could not delete. Try again.", true); });
      });
      act.appendChild(del);
    }
    flash($("lbMsg"), "");
    var dlg = $("lb"); if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
  }
  function close() { current = null; var dlg = $("lb"); if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); }
  $("lbClose").addEventListener("click", close);
  $("lb").addEventListener("click", function (ev) { if (ev.target === this) close(); });
  document.addEventListener("contextmenu", function (ev) { if (ev.target.closest && ev.target.closest(".no-save")) ev.preventDefault(); });

  function load() {
    return GB.api("album" + Q).then(function (j) { items = j.items; mayUpload = j.mayUpload; canDownload = j.canDownload; requested = j.requested; me = j.me; loaded = true; blocked = false; render(); },
      function (e) { loaded = true; blocked = e.status === 401 || e.status === 403 || e.status === 404; render(); if (!blocked) flash($("pageMsg"), "Could not load the album. Reload the page to try again.", true); });
  }

  /* ---------- uploads ---------- */
  var busy = false;
  $("phForm").addEventListener("submit", function (ev) {
    ev.preventDefault(); if (busy) return;
    var files = Array.prototype.slice.call($("phFiles").files || []), cap = $("phCap").value, i = 0, failed = 0;
    if (!files.length) { flash($("phMsg"), "Choose one or more photos first.", true); return; }
    busy = true;
    function next() {
      if (i >= files.length) {
        busy = false; $("phFiles").value = ""; $("phCap").value = "";
        flash($("phMsg"), failed ? (files.length - failed) + " uploaded, " + failed + " could not be read (try JPG or PNG)." : files.length === 1 ? "Photo added." : files.length + " photos added.", !!failed);
        return load();
      }
      var f = files[i++]; flash($("phMsg"), "Uploading " + i + " of " + files.length + "…");
      return loadImage(f).then(function (pic) {
        var thumb = fit(pic, [[480, 0.75], [400, 0.7]], 380000, false), prev = fit(pic, [[1280, 0.8], [1100, 0.75]], 1150000, true);
        var orig = fit(pic, [[4000, 0.92], [3200, 0.9], [2600, 0.88], [2000, 0.85]], 5300000, false); pic.done();
        return GB.api("album" + Q, { kind: "photo", thumb: thumb, prev: prev, caption: cap }).then(function (j) { return orig ? GB.api("album/orig" + Q, { id: j.id, orig: orig }) : null; });
      }).then(next, function (e) { if (e && e.status === 401) { busy = false; flash($("phMsg"), "Log in again to upload.", true); return; } failed++; return next(); });
    }
    next();
  });
  $("vdForm").addEventListener("submit", function (ev) {
    ev.preventDefault(); if (busy) return;
    var link = $("vdLink").value.trim(), f = $("vdFile").files && $("vdFile").files[0];
    if (!/^https:\/\//i.test(link)) { flash($("vdMsg"), "Paste the full link to the video, starting with https://", true); return; }
    busy = true; flash($("vdMsg"), f ? "Making the thumbnail…" : "Adding…");
    (f ? posterFrame(f).then(function (pic) { var r = { thumb: fit(pic, [[480, 0.75]], 380000, false), prev: fit(pic, [[1280, 0.8]], 1150000, true) }; pic.done(); return r; }, function () { return {}; }) : Promise.resolve({}))
      .then(function (p) { return GB.api("album" + Q, { kind: "video", link: link, thumb: p.thumb || null, prev: p.prev || null, caption: $("vdCap").value }); })
      .then(function () { busy = false; $("vdLink").value = ""; $("vdFile").value = ""; $("vdCap").value = ""; flash($("vdMsg"), "Video added."); load(); },
        function (e) { busy = false; flash($("vdMsg"), e.code === "link" ? "That link does not look right. Paste the full https:// link." : e.status === 401 || e.status === 403 ? "Log in with an approved account to add videos." : "Could not add the video. Try again.", true); });
  });

  render();
  GB.ready.then(function (site) {
    var ev = GB.eventTabs(E, "album");
    if (ev) { $("evTitle").textContent = ev.title + ": photos and videos"; document.title = ev.title + " photos and videos · Girish Bhawan"; }
    admin = !!(site && site.me.admin);
    load();
  });
})();
