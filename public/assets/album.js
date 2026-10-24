(function () {
  var $ = GB.$, el = GB.el, flash = GB.flash, E = GB.qs("e") || "durga-puja-2026", Q = "?e=" + encodeURIComponent(E);
  var data = { photos: [], videos: [], me: null }, admin = false, loaded = false, blocked = false, current = null, busy = false;

  /* ---------- grid ---------- */
  function counts(it) {
    var c = el("span", "votes");
    c.appendChild(el("span", it.mine === 1 ? "on" : "", "👍 " + it.up));
    c.appendChild(el("span", it.mine === -1 ? "on" : "", "👎 " + it.down));
    return c;
  }
  function tile(it) {
    var t = el("button", "tile" + (it.kind === "video" ? " video" : "") + (it.hidden ? " is-hidden" : "") + (it.pending ? " is-pending" : "")); t.type = "button";
    t.setAttribute("aria-label", (it.kind === "video" ? "Video: " : "Photo ") + it.code);
    var im = el("img"); im.src = it.thumb; im.alt = ""; im.loading = "lazy"; im.draggable = false; t.appendChild(im);
    if (it.kind === "video") t.appendChild(el("span", "play", "▶"));
    if (it.pending) t.appendChild(el("span", "flag", "Waiting for approval"));
    else if (it.hidden) t.appendChild(el("span", "flag", "Hidden"));
    var cap = el("span", "tile-cap"); cap.appendChild(el("span", "code", it.code)); cap.appendChild(counts(it)); t.appendChild(cap);
    t.addEventListener("click", function () { open(it); });
    return t;
  }
  function render() {
    $("upSec").hidden = blocked || !data.mayUpload; $("adminBar").hidden = !admin || blocked;
    $("upHint").textContent = data.uploadsNeedApproval ? "Your photos go to the admin for approval before they appear." : "Your photos appear in the album straight away.";
    var who = $("whoBar"); who.textContent = "";
    if (!blocked && loaded) {
      if (data.me) who.textContent = "Signed in as " + data.me.name + ". Tap a photo to like it or ask for a copy.";
      else {
        who.appendChild(document.createTextNode("Sign in to like photos and ask the admin for a copy. "));
        if (GB.site() && GB.site().googleSignIn) { var b = el("button", "small primary", "Sign in with Google"); b.type = "button"; b.addEventListener("click", function () { GB.googleSignIn(); }); who.appendChild(b); }
        else { var a = el("a", null, "Log in"); a.href = "/account/"; who.appendChild(a); }
      }
    }
    who.hidden = blocked || !loaded;
    if (admin) { $("adminErr").textContent = data.err ? "Google: " + data.err : ""; $("adminErr").hidden = !data.err; $("plNote").hidden = !!data.playlist; }
    [["photoGrid", data.photos, "No photos yet."], ["videoGrid", data.videos, "No videos yet."]].forEach(function (x) {
      var grid = $(x[0]); grid.textContent = "";
      if (blocked) return;
      if (!loaded) { grid.appendChild(el("p", "empty", "Loading…")); return; }
      if (!x[1].length) { grid.appendChild(el("p", "empty", x[2])); return; }
      x[1].forEach(function (it) { grid.appendChild(tile(it)); });
    });
    $("photoCount").textContent = loaded ? "(" + data.photos.length + ")" : ""; $("videoCount").textContent = loaded ? "(" + data.videos.length + ")" : "";
    $("videoSec").hidden = blocked; $("photoSec").hidden = blocked;
    $("blockedMsg").hidden = !blocked;
  }
  function load(fresh) {
    return GB.api("album" + Q + (fresh ? "&fresh=1" : "")).then(function (j) { data = j; loaded = true; blocked = false; render(); if (current) { var again = find(current.id); if (again) open(again, true); } },
      function (e) { loaded = true; blocked = e.status === 401 || e.status === 403 || e.status === 404; render(); if (!blocked) flash($("pageMsg"), "Could not load the album. Reload the page to try again.", true); });
  }
  function find(id) { return data.photos.concat(data.videos).filter(function (x) { return x.id === id; })[0]; }

  /* ---------- viewer ---------- */
  function open(it, keep) {
    current = it;
    var box = $("lbMedia");
    if (!keep || box.dataset.id !== it.id) {
      box.textContent = ""; box.dataset.id = it.id;
      if (it.kind === "video") {
        var fr = el("iframe", "lb-video"); fr.title = it.code; fr.allow = "autoplay; encrypted-media; picture-in-picture"; fr.setAttribute("allowfullscreen", "");
        fr.src = "https://www.youtube-nocookie.com/embed/" + it.yt + "?autoplay=1&rel=0&modestbranding=1&playsinline=1"; box.appendChild(fr);
      } else { var im = el("img"); im.src = it.view; im.alt = it.cap || it.code; im.draggable = false; box.appendChild(im); }
    }
    $("lbCode").textContent = it.code;
    var meta = []; if (it.cap) meta.push(it.cap); if (it.by) meta.push("Added by " + it.by);
    $("lbMeta").textContent = meta.join(" · "); $("lbMeta").hidden = !meta.length;
    var act = $("lbAct"); act.textContent = "";
    var up = el("button", it.mine === 1 ? "primary" : "", "👍 Like · " + it.up); up.type = "button"; up.addEventListener("click", function () { vote(it, it.mine === 1 ? 0 : 1); });
    var down = el("button", it.mine === -1 ? "primary" : "", "👎 Dislike · " + it.down); down.type = "button"; down.addEventListener("click", function () { vote(it, it.mine === -1 ? 0 : -1); });
    act.appendChild(up); act.appendChild(down);
    var ask = el("button", "", it.kind === "video" ? "Ask for this video" : "Ask for this photo"); ask.type = "button";
    ask.addEventListener("click", function () { if (!need()) return; $("reqBox").hidden = false; $("reqNote").focus(); });
    act.appendChild(ask);
    $("reqBox").hidden = true; $("reqNote").value = "";
    var adm = $("lbAdmin"); adm.textContent = ""; adm.hidden = !admin;
    if (admin) {
      if (it.drive) { var d = el("a", "btnlink", "Open in Drive"); d.href = it.drive; d.target = "_blank"; d.rel = "noopener"; adm.appendChild(d); }
      if (it.pending) adm.appendChild(btn("Approve", "primary", function () { moderate(it, "approve"); }));
      adm.appendChild(btn(it.hidden ? "Show again" : "Hide from the album", "", function () { moderate(it, it.hidden ? "unhide" : "hide"); }));
      if (it.kind === "photo") adm.appendChild(confirmBtn("Move to Drive trash", function () { moderate(it, "trash", true); }));
    }
    flash($("lbMsg"), "");
    var dlg = $("lb"); if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
  }
  function btn(text, cls, fn) { var b = el("button", cls, text); b.type = "button"; b.addEventListener("click", fn); return b; }
  function confirmBtn(text, fn) { var armed = false, b = btn(text, "danger", function () { if (!armed) { armed = true; b.textContent = "Confirm"; return; } fn(); }); return b; }
  function close() { current = null; $("lbMedia").textContent = ""; $("lbMedia").dataset.id = ""; var dlg = $("lb"); if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); }
  $("lbClose").addEventListener("click", close);
  $("lb").addEventListener("click", function (ev) { if (ev.target === this) close(); });
  $("lb").addEventListener("cancel", function () { $("lbMedia").textContent = ""; $("lbMedia").dataset.id = ""; current = null; });
  document.addEventListener("contextmenu", function (ev) { if (ev.target.closest && ev.target.closest(".no-save")) ev.preventDefault(); });

  function need() {
    if (data.me) return true;
    flash($("lbMsg"), "Sign in first, so the admin knows who is asking.", true);
    var a = $("lbMsg");
    if (GB.site() && GB.site().googleSignIn) { var b = btn("Sign in with Google", "small primary", function () { GB.googleSignIn(); }); a.appendChild(document.createTextNode(" ")); a.appendChild(b); }
    return false;
  }
  function vote(it, v) {
    if (!need()) return;
    GB.api("album/vote" + Q, { item: it.id, v: v }).then(function (j) { it.mine = v; if (j.up !== undefined) { it.up = j.up; it.down = j.down; } render(); open(it, true); },
      function (e) { flash($("lbMsg"), e.status === 401 ? "Sign in again to vote." : "Could not save your vote. Try again.", true); });
  }
  $("reqSend").addEventListener("click", function () {
    var it = current; if (!it || !need()) return;
    GB.api("album/request" + Q, { item: it.id, code: it.code, note: $("reqNote").value }).then(function () { $("reqBox").hidden = true; flash($("lbMsg"), "Request sent. The admin will share " + it.code + " with you."); },
      function (e) { flash($("lbMsg"), e.status === 429 ? "You have sent many requests this hour. Try again later." : "Could not send the request. Try again.", true); });
  });
  function moderate(it, action, closeAfter) {
    GB.api("album/moderate" + Q, { item: it.id, action: action }).then(function () { if (closeAfter) close(); load(true); }, function (e) { flash($("lbMsg"), e.message && e.message.length > 12 ? e.message : "That did not work. Try again.", true); });
  }

  /* ---------- uploads ---------- */
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { resolve({ img: img, done: function () { URL.revokeObjectURL(url); } }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("read")); };
      img.src = url;
    });
  }
  function fit(img, tries, maxChars) {
    for (var i = 0; i < tries.length; i++) {
      var k = Math.min(1, tries[i][0] / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      var d = c.toDataURL("image/jpeg", tries[i][1]); if (d.length < maxChars) return d;
    }
    return null;
  }
  $("phForm").addEventListener("submit", function (ev) {
    ev.preventDefault(); if (busy) return;
    var files = Array.prototype.slice.call($("phFiles").files || []), cap = $("phCap").value, i = 0, failed = 0, pending = false;
    if (!files.length) { flash($("phMsg"), "Choose one or more photos first.", true); return; }
    busy = true;
    function next() {
      if (i >= files.length) {
        busy = false; $("phFiles").value = ""; $("phCap").value = "";
        var ok = files.length - failed;
        flash($("phMsg"), (ok ? ok + (ok === 1 ? " photo" : " photos") + " uploaded" + (pending ? "; they appear once the admin approves them." : ".") : "") + (failed ? " " + failed + " could not be uploaded (use JPG or PNG)." : ""), !!failed);
        return load(true);
      }
      var f = files[i++]; flash($("phMsg"), "Uploading " + i + " of " + files.length + "…");
      return loadImage(f).then(function (p) {
        var d = fit(p.img, [[4000, 0.92], [3200, 0.9], [2600, 0.88], [2000, 0.85]], 5300000); p.done();
        if (!d) throw new Error("big");
        return GB.api("album/upload" + Q, { photo: d, caption: cap });
      }).then(function (j) { if (j && j.status === "pending") pending = true; return next(); },
        function (e) { if (e && (e.status === 401 || e.status === 403)) { busy = false; flash($("phMsg"), "Sign in again to upload.", true); return; } failed++; return next(); });
    }
    next();
  });
  $("vdForm").addEventListener("submit", function (ev) {
    ev.preventDefault(); if (busy) return;
    var f = $("vdFile").files && $("vdFile").files[0];
    if (!f) { flash($("vdMsg"), "Choose a video first.", true); return; }
    busy = true; flash($("vdMsg"), "Preparing the upload…");
    GB.api("album/video-start" + Q, { name: f.name, size: f.size, mime: f.type || "video/mp4", caption: $("vdCap").value }).then(function (j) {
      return new Promise(function (resolve, reject) {
        var x = new XMLHttpRequest(); x.open("PUT", j.upload); x.setRequestHeader("Content-Type", f.type || "video/mp4");
        x.upload.onprogress = function (p) { if (p.lengthComputable) flash($("vdMsg"), "Uploading… " + Math.round(p.loaded / p.total * 100) + "%"); };
        x.onload = function () { x.status >= 200 && x.status < 300 ? resolve() : reject(new Error("put")); };
        x.onerror = function () { reject(new Error("put")); };
        x.send(f);
      });
    }).then(function () { busy = false; $("vdFile").value = ""; $("vdCap").value = ""; flash($("vdMsg"), "Video received. The admin will add it to the album's YouTube playlist."); },
      function (e) { busy = false; flash($("vdMsg"), e.status === 401 ? "Sign in again to upload." : e.message === "put" ? "The upload stopped. Check your connection and try again, or send the video to the admin." : "Could not start the upload. Try again.", true); });
  });

  /* ---------- admin ---------- */
  $("numberBtn").addEventListener("click", function () {
    var total = 0;
    flash($("numMsg"), "Numbering…");
    (function step() {
      GB.api("album/number" + Q, {}).then(function (j) {
        total += j.done;
        if (j.remaining > 0 && j.done > 0) { flash($("numMsg"), "Numbered " + total + ", " + j.remaining + " to go…"); step(); }
        else { flash($("numMsg"), total ? "Done. " + total + " photos numbered." : "All photos are already numbered."); load(true); }
      }, function (e) { flash($("numMsg"), "Numbering stopped: " + (e.message || "try again") + ". Press the button again to continue.", true); });
    })();
  });
  $("refreshBtn").addEventListener("click", function () { flash($("numMsg"), "Reading Drive and YouTube again…"); load(true).then(function () { flash($("numMsg"), "Up to date."); }); });

  render();
  GB.ready.then(function (site) {
    var ev = GB.eventTabs(E, "album");
    if (ev) { $("evTitle").textContent = ev.title + ": photos and videos"; document.title = ev.title + " photos and videos · Girish Bhawan"; }
    admin = !!(site && site.me.admin);
    load(admin);
  });
})();
