(function () {
  var $ = GB.$, el = GB.el, flash = GB.flash, admin = false, entries = [];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function when(x) { return (x.day ? x.day + " " : "") + (x.month ? MONTHS[x.month - 1] + " " : "") + x.year; }
  function render() {
    var box = $("timeline"); box.textContent = "";
    if (!entries.length) { box.appendChild(el("p", "empty", "No stories yet. Be the first to add one.")); return; }
    var lastYear = null;
    entries.forEach(function (x) {
      if (x.year !== lastYear) { box.appendChild(el("h2", "tl-year", String(x.year))); lastYear = x.year; }
      var card = el("article", "tl-item" + (x.status !== "approved" ? " pending" : ""));
      card.appendChild(el("span", "tl-date", when(x)));
      if (x.status !== "approved") card.appendChild(el("span", "pill part", "Waiting for approval"));
      if (x.title) card.appendChild(el("h3", null, x.title));
      if (x.photo) { var im = el("img"); im.src = "/api/story/img/" + x.id; im.alt = x.title || "Photo for " + when(x); im.loading = "lazy"; card.appendChild(im); }
      if (x.text) card.appendChild(el("p", "post-text", x.text));
      card.appendChild(el("p", "post-meta", "Shared by " + x.name));
      if (admin) card.appendChild(adminTools(x));
      box.appendChild(card);
    });
  }
  function adminTools(x) {
    var wrap = el("div", "stack"), act = el("div", "actions");
    if (x.status !== "approved") act.appendChild(btn("Approve", "small primary", function () { mod({ id: x.id, action: "approve" }); }));
    var form = el("div", "stack"); form.hidden = true;
    act.appendChild(btn("Edit", "small", function () { form.hidden = !form.hidden; }));
    var armed = false, del = btn("Delete", "small danger", function () { if (!armed) { armed = true; del.textContent = "Confirm delete"; return; } mod({ id: x.id, action: "delete" }); });
    act.appendChild(del); wrap.appendChild(act);
    var f = {};
    [["year", "Year", x.year], ["month", "Month (1-12, optional)", x.month || ""], ["day", "Day (optional)", x.day || ""], ["title", "Title", x.title], ["name", "Shared by", x.name]].forEach(function (d) {
      var l = el("label", "f"), i = el("input"); l.appendChild(el("span", "label", d[1])); i.value = d[2]; l.appendChild(i); form.appendChild(l); f[d[0]] = i;
    });
    var tl = el("label", "f"), ta = el("textarea"); ta.rows = 5; ta.value = x.text; tl.appendChild(el("span", "label", "Story")); tl.appendChild(ta); form.appendChild(tl);
    form.appendChild(btn("Save changes", "small primary", function () {
      mod({ id: x.id, action: "edit", year: f.year.value, month: f.month.value, day: f.day.value, title: f.title.value, name: f.name.value, text: ta.value });
    }));
    wrap.appendChild(form);
    return wrap;
  }
  function btn(text, cls, fn) { var b = el("button", cls, text); b.type = "button"; b.addEventListener("click", fn); return b; }
  function mod(body) { GB.api("story/moderate", body).then(load, function () { flash($("pageMsg"), "That did not work. Check the year and try again.", true); }); }
  function load() { return GB.api("story").then(function (j) { entries = j.entries; render(); }, function () { flash($("pageMsg"), "Could not load the timeline. Reload the page to try again.", true); }); }

  // Month and day lists
  var ms = $("sMonth"); MONTHS.forEach(function (m, i) { var o = el("option", null, m); o.value = i + 1; ms.appendChild(o); });
  var ds = $("sDay"); for (var d = 1; d <= 31; d++) { var o = el("option", null, String(d)); o.value = d; ds.appendChild(o); }

  function shrink(file) { return GB.shrink(file, [[1600, 0.82], [1280, 0.78], [1024, 0.72], [800, 0.7]], 1390000); }
  var busy = false;
  $("storyForm").addEventListener("submit", function (ev) {
    ev.preventDefault(); if (busy) return;
    var year = Number($("sYear").value), now = new Date().getFullYear();
    if (!(year >= 1700 && year <= now + 1)) { flash($("sMsg"), "Enter the year, for example 1965.", true); $("sYear").focus(); return; }
    if ($("sDay").value && !$("sMonth").value) { flash($("sMsg"), "Choose the month too, or leave the day empty.", true); return; }
    if (!$("sTitle").value.trim() && !$("sText").value.trim()) { flash($("sMsg"), "Add a title or a few lines about what happened.", true); return; }
    if (!$("sName").value.trim() && !GB.voter()) { flash($("sMsg"), "Enter your name.", true); $("sName").focus(); return; }
    var f = $("sPhoto").files && $("sPhoto").files[0];
    busy = true; flash($("sMsg"), f ? "Preparing the photo…" : "Sending…");
    (f ? shrink(f) : Promise.resolve(null)).then(function (photo) {
      return GB.api("story", { year: year, month: $("sMonth").value, day: $("sDay").value, title: $("sTitle").value, text: $("sText").value, name: $("sName").value, photo: photo, website: $("sWebsite").value });
    }).then(function (j) {
      busy = false; ["sTitle", "sText", "sPhoto", "sYear"].forEach(function (id) { $(id).value = ""; }); $("sMonth").value = ""; $("sDay").value = "";
      flash($("sMsg"), j.status === "approved" ? "Added to the timeline." : "Thank you. Your story will appear once the admin approves it.");
      load();
    }, function (e) {
      busy = false;
      flash($("sMsg"), e.message === "big" || e.code === "photo" ? "That photo is too large even after shrinking. Try another one." : e.message === "read" ? "That file could not be opened as a photo." : e.status === 429 ? "Several stories were sent from here in the last hour. Try again later." : "Could not send. Check the fields and try again.", true);
    });
  });

  GB.ready.then(function (site) {
    admin = !!(site && site.me.admin);
    var me = site && site.me, name = me && (me.user ? me.user.name : me.guest ? me.guest.name : "");
    if (name) $("sName").value = name;
    load();
  });
})();
