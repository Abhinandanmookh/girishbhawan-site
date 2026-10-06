(function () {
  var $ = GB.$, el = GB.el, flash = GB.flash, site = null, users = [];
  var ACCESS = [["admin", "Admin only"], ["groups", "Selected groups"], ["members", "All approved members"], ["public", "Everyone, no login"]];

  function input(value, onchange, attrs) { var i = el("input"); i.value = value || ""; for (var k in attrs || {}) i.setAttribute(k, attrs[k]); i.addEventListener("input", function () { onchange(i.value); }); return i; }
  function field(label, control, cls) { var l = el("label", "f" + (cls ? " " + cls : "")); l.appendChild(el("span", "label", label)); l.appendChild(control); return l; }
  function check(label, on, onchange) { var l = el("label", "chk"), c = el("input"); c.type = "checkbox"; c.checked = !!on; c.addEventListener("change", function () { onchange(c.checked); }); l.appendChild(c); l.appendChild(el("span", null, label)); return l; }
  function select(options, value, onchange) { var s = el("select"); options.forEach(function (o) { var x = el("option", null, o[1]); x.value = o[0]; s.appendChild(x); }); s.value = value; s.addEventListener("change", function () { onchange(s.value); }); return s; }
  function button(text, cls, fn) { var b = el("button", cls, text); b.type = "button"; b.addEventListener("click", fn); return b; }
  function confirmBtn(text, fn) { var armed = false, b = button(text, "small danger", function () { if (!armed) { armed = true; b.textContent = "Confirm"; return; } fn(); }); return b; }
  function groupChecks(selected, onchange) {
    var box = el("div", "checks");
    site.groups.forEach(function (g) {
      if (!g.id) return;
      box.appendChild(check(g.name, selected.indexOf(g.id) >= 0, function (on) { var i = selected.indexOf(g.id); if (on && i < 0) selected.push(g.id); if (!on && i >= 0) selected.splice(i, 1); if (onchange) onchange(); }));
    });
    if (!box.childNodes.length) box.appendChild(el("span", "hint", "Save your groups first, then tick them here."));
    return box;
  }

  /* ---------- members ---------- */
  function userAction(u, body, done) {
    body.id = u.id;
    GB.api("admin/user", body).then(function () { flash($("uMsg"), done); load(); }, function (e) { flash($("uMsg"), e.code === "password" ? "The new password needs at least 8 characters." : "That did not work. Try again.", true); });
  }
  function renderUsers() {
    var box = $("users"); box.textContent = "";
    var pending = users.filter(function (u) { return u.status === "pending"; }).length;
    $("uCount").textContent = users.length + " account" + (users.length === 1 ? "" : "s") + (pending ? ", " + pending + " waiting for approval" : "");
    if (!users.length) { box.appendChild(el("p", "empty", "No one has registered yet. Family members create an account from the Log in or register link, and appear here for your approval.")); return; }
    users.forEach(function (u) {
      var card = el("div", "admin"), head = el("div", "head"), groups = u.groups.slice();
      if (u.status === "pending" && u.wants && groups.indexOf(u.wants) < 0) groups.push(u.wants);
      var title = el("div"); title.appendChild(el("strong", null, u.name)); title.appendChild(el("span", "note", u.login + " · registered " + GB.when(u.created)));
      head.appendChild(title);
      head.appendChild(el("span", "pill " + (u.status === "active" ? "paid" : u.status === "pending" ? "part" : "pending"), u.status === "active" ? "Approved" : u.status === "pending" ? "Waiting" : "Blocked"));
      card.appendChild(head);
      var want = site.groups.filter(function (g) { return g.id === u.wants; })[0];
      if (want || u.note) card.appendChild(el("p", "hint", (want ? "Says they belong to: " + want.name + ". " : "") + (u.note ? "Note: " + u.note : "")));
      card.appendChild(groupChecks(groups));
      var act = el("div", "actions");
      if (u.status === "pending") act.appendChild(button("Approve", "small primary", function () { userAction(u, { action: "approve", groups: groups }, u.name + " approved."); }));
      if (u.status === "active") act.appendChild(button("Save groups", "small", function () { userAction(u, { action: "groups", groups: groups }, "Groups saved for " + u.name + "."); }));
      if (u.status === "active") act.appendChild(button("Block", "small", function () { userAction(u, { action: "block" }, u.name + " blocked."); }));
      if (u.status === "blocked") act.appendChild(button("Unblock", "small", function () { userAction(u, { action: "unblock" }, u.name + " unblocked."); }));
      act.appendChild(confirmBtn("Delete account", function () { userAction(u, { action: "delete" }, u.name + " deleted."); }));
      card.appendChild(act);
      var reset = el("div", "actions"), pw = el("input"); pw.type = "text"; pw.placeholder = "New password for " + u.name; pw.setAttribute("aria-label", "New password for " + u.name); pw.autocomplete = "off"; pw.className = "narrow";
      reset.appendChild(pw); reset.appendChild(button("Set password", "small", function () { userAction(u, { action: "reset", pass: pw.value }, "Password changed for " + u.name + ". Tell them the new one."); }));
      card.appendChild(reset);
      box.appendChild(card);
    });
  }

  /* ---------- settings: groups, sections, events, links ---------- */
  function listEditor(boxId, items, build, blank, addText) {
    var box = $(boxId); box.textContent = "";
    items.forEach(function (it, i) {
      var card = el("div", "admin"); build(card, it);
      var act = el("div", "actions"); act.appendChild(confirmBtn("Remove", function () { items.splice(i, 1); renderSite(); })); card.appendChild(act);
      box.appendChild(card);
    });
    box.appendChild(button(addText, "", function () { items.push(blank()); renderSite(); }));
  }
  function accessRow(card, it, order) {
    var checks = groupChecks(it.groups);
    var opts = order.map(function (k) { return ACCESS.filter(function (a) { return a[0] === k; })[0]; });
    card.appendChild(field("Who can open it", select(opts, it.access, function (v) { it.access = v; checks.hidden = v !== "groups"; })));
    checks.hidden = it.access !== "groups"; card.appendChild(checks);
  }
  function renderSite() {
    $("lFb").value = site.links.facebook || ""; $("lIg").value = site.links.instagram || "";
    listEditor("groups", site.groups, function (card, g) {
      card.appendChild(field("Group name", input(g.name, function (v) { g.name = v; }, { maxlength: 60 })));
    }, function () { return { id: "", name: "" }; }, "Add a group");
    listEditor("sections", site.sections, function (card, s) {
      var row = el("div", "row");
      row.appendChild(field("Section title", input(s.title, function (v) { s.title = v; }, { maxlength: 60 })));
      row.appendChild(field("Short description", input(s.desc, function (v) { s.desc = v; }, { maxlength: 200 })));
      card.appendChild(row); accessRow(card, s, ["admin", "groups", "members", "public"]);
      card.appendChild(check("Members who can open it may also upload documents", s.memberUpload, function (on) { s.memberUpload = on; }));
    }, function () { return { id: "", title: "", desc: "", access: "admin", groups: [], memberUpload: false }; }, "Add a section");
    listEditor("events", site.events, function (card, e) {
      var row = el("div", "row");
      row.appendChild(field("Event title", input(e.title, function (v) { e.title = v; }, { maxlength: 60 })));
      row.appendChild(field("Line under the title", input(e.sub, function (v) { e.sub = v; }, { maxlength: 200 })));
      card.appendChild(row); accessRow(card, e, ["public", "members", "groups", "admin"]);
      card.appendChild(field("Who can post photos and links", select([["anyone", "Anyone who can open the page"], ["members", "Approved members only"]], e.post, function (v) { e.post = v; })));
      card.appendChild(check("Show new posts straight away, without my approval", e.autoApprove, function (on) { e.autoApprove = on; }));
      card.appendChild(check("This event has a Nirghonto (schedule) page", e.schedule, function (on) { e.schedule = on; }));
    }, function () { return { id: "", title: "", sub: "", schedule: true, access: "public", groups: [], post: "anyone", autoApprove: false }; }, "Add an event");
  }
  $("siteSave").addEventListener("click", function () {
    site.links = { facebook: $("lFb").value.trim(), instagram: $("lIg").value.trim() };
    flash($("siteMsg"), "Saving…");
    GB.api("admin/site", site).then(function (j) { site = j.site; renderSite(); renderUsers(); flash($("siteMsg"), "Settings saved."); },
      function (e) { flash($("siteMsg"), e.status === 401 ? "Your admin session has ended. Log in again." : "Could not save. Try again.", true); });
  });

  /* ---------- backup: one zip with every record, photo and document ---------- */
  var T = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc(u8) { var c = 0xffffffff; for (var i = 0; i < u8.length; i++) c = T[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), c = crc(f.data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(12, 0x5C21, true); h.setUint32(14, c, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, name.length, true);
      var d = new DataView(new ArrayBuffer(46));
      d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x0800, true);
      d.setUint16(14, 0x5C21, true); d.setUint32(16, c, true); d.setUint32(20, f.data.length, true); d.setUint32(24, f.data.length, true); d.setUint16(28, name.length, true); d.setUint32(42, offset, true);
      parts.push(new Uint8Array(h.buffer), name, f.data); central.push(new Uint8Array(d.buffer), name);
      offset += 30 + name.length + f.data.length;
    });
    var size = central.reduce(function (t, x) { return t + x.length; }, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: "application/zip" });
  }
  function unzip(u8) {
    var v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), pos = 0, out = [], dec = new TextDecoder();
    while (pos + 30 <= u8.length && v.getUint32(pos, true) === 0x04034b50) {
      var method = v.getUint16(pos + 8, true), flags = v.getUint16(pos + 6, true), len = v.getUint32(pos + 18, true), nl = v.getUint16(pos + 26, true), xl = v.getUint16(pos + 28, true);
      if (method !== 0 || (flags & 8)) throw new Error("format");
      var start = pos + 30 + nl + xl;
      out.push({ name: dec.decode(u8.subarray(pos + 30, pos + 30 + nl)), data: u8.subarray(start, start + len) });
      pos = start + len;
    }
    return out;
  }
  function b64(u8) { var s = "", i; for (i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  $("bkGet").addEventListener("click", function () {
    flash($("bkMsg"), "Collecting the data…");
    GB.api("admin/backup").then(function (bk) {
      var files = [{ name: "data.json", data: new TextEncoder().encode(JSON.stringify(bk)) }], i = 0;
      function next() {
        if (i >= bk.blobs.length) return Promise.resolve();
        var k = bk.blobs[i++]; flash($("bkMsg"), "Collecting photos and documents: " + i + " of " + bk.blobs.length + "…");
        return fetch("/api/admin/blob?key=" + encodeURIComponent(k), { credentials: "same-origin", cache: "no-store" })
          .then(function (r) { if (!r.ok) throw new Error("blob"); return r.arrayBuffer(); }).then(function (buf) { files.push({ name: "blobs/" + k, data: new Uint8Array(buf) }); return next(); });
      }
      return next().then(function () {
        var a = el("a"), url = URL.createObjectURL(zip(files));
        a.href = url; a.download = "girish-bhawan-backup-" + new Date().toISOString().slice(0, 10) + ".zip"; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        flash($("bkMsg"), "Backup downloaded: " + Object.keys(bk.json).length + " records and " + bk.blobs.length + " files (photos and documents). Keep the zip somewhere safe.");
      });
    }).then(null, function () { flash($("bkMsg"), "The backup could not be completed. Try again.", true); });
  });
  var armed = false;
  $("bkPut").addEventListener("click", function () {
    var f = $("bkFile").files && $("bkFile").files[0], btn = this;
    if (!f) { flash($("bkMsg"), "Choose a backup zip first.", true); return; }
    if (!armed) { armed = true; btn.textContent = "Confirm: overwrite the site with this backup"; return; }
    armed = false; btn.textContent = "Restore from backup";
    f.arrayBuffer().then(function (buf) {
      var files = unzip(new Uint8Array(buf)), data = files.filter(function (x) { return x.name === "data.json"; })[0];
      if (!data) throw new Error("format");
      var bk = JSON.parse(new TextDecoder().decode(data.data)), blobs = files.filter(function (x) { return x.name.indexOf("blobs/") === 0; }), i = 0;
      flash($("bkMsg"), "Restoring the records…");
      return GB.api("admin/restore", bk).then(function next() {
        if (i >= blobs.length) return;
        var x = blobs[i++]; flash($("bkMsg"), "Restoring photos and documents: " + i + " of " + blobs.length + "…");
        return GB.api("admin/blob", { key: x.name.slice(6), data: b64(x.data) }).then(next);
      }).then(function () { flash($("bkMsg"), "Restore complete."); load(); });
    }).then(null, function (e) { flash($("bkMsg"), e.message === "format" ? "That file is not a backup made by this page." : "The restore stopped before finishing. Try again with the same zip.", true); });
  });

  function load() {
    return GB.api("admin/state").then(function (j) { site = j.site; users = j.users; $("adminBody").hidden = false; $("adminGate").hidden = true; renderUsers(); renderSite(); },
      function () { $("adminBody").hidden = true; $("adminGate").hidden = false; });
  }
  GB.ready.then(load);
})();
