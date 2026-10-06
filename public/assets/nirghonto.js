(function () {
  var $ = GB.$, el = GB.el, flash = GB.flash, data = { note: "", days: [] }, loaded = false, admin = false;

  function toText(d) {
    return d.days.map(function (day) {
      return "# " + day.name + (day.date ? " | " + day.date : "") + "\n" + day.items.map(function (it) { return (it.time ? it.time + " | " : "") + it.what; }).join("\n");
    }).join("\n\n").trim();
  }
  function fromText(text) {
    var days = [], cur = null;
    String(text).split(/\r?\n/).forEach(function (line) {
      line = line.trim(); if (!line) return;
      if (line.charAt(0) === "#") { var p = line.slice(1).split("|"); cur = { name: p[0].trim(), date: (p[1] || "").trim(), items: [] }; if (cur.name) days.push(cur); else cur = null; return; }
      if (!cur) return;
      var i = line.indexOf("|");
      cur.items.push(i < 0 ? { time: "", what: line } : { time: line.slice(0, i).trim(), what: line.slice(i + 1).trim() });
    });
    return days;
  }
  function render() {
    var box = $("days"); box.textContent = "";
    $("schedAdmin").hidden = !admin;
    $("schedImg").hidden = !data.image; $("schedPh").hidden = !!data.image; $("imgRemove").hidden = !data.image;
    if (data.image) { var src = "/api/schedule-image?v=" + data.image; if ($("schedImg").getAttribute("src") !== src) $("schedImg").src = src; }
    $("note").hidden = !data.note; $("note").textContent = data.note;
    if (!loaded) { box.appendChild(el("p", "empty", "Loading the schedule…")); return; }
    if (!data.days.length) { box.appendChild(el("p", "empty", "The schedule will be published here.")); return; }
    data.days.forEach(function (day) {
      var sec = el("section", "day"), head = el("div", "day-head");
      head.appendChild(el("h2", null, day.name)); if (day.date) head.appendChild(el("span", "label", day.date));
      sec.appendChild(head);
      if (!day.items.length) sec.appendChild(el("p", "hint", "Timings will be added here."));
      else {
        var list = el("dl", "times");
        day.items.forEach(function (it) { list.appendChild(el("dt", "num", it.time || "")); list.appendChild(el("dd", null, it.what)); });
        sec.appendChild(list);
      }
      box.appendChild(sec);
    });
  }
  $("schedSave").addEventListener("click", function () {
    var next = { note: $("schedNote").value, days: fromText($("schedText").value) };
    if (!next.days.length) { flash($("schedMsg"), "Add at least one day. A day line starts with #.", true); return; }
    flash($("schedMsg"), "Saving…");
    GB.api("schedule", next).then(function (j) { data = j.data; render(); fill(); flash($("schedMsg"), "Schedule saved."); }, function (e) {
      if (e.status === 401) GB.setAdmin(false);
      flash($("schedMsg"), e.status === 401 ? "Your admin session has ended. Log in again." : "Could not save. Try again.", true);
    });
  });
  function imgFail(e) {
    if (e.status === 401) GB.setAdmin(false);
    flash($("imgMsg"), e.message === "read" ? "That file could not be opened as a picture. Try a JPG or PNG."
      : e.message === "big" || e.code === "photo" ? "That picture is too large. Try a smaller one."
      : e.status === 401 ? "Your admin session has ended. Log in again." : "Could not upload. Try again.", true);
  }
  $("imgSave").addEventListener("click", function () {
    var file = $("imgFile").files && $("imgFile").files[0];
    if (!file) { flash($("imgMsg"), "Choose a picture first.", true); return; }
    flash($("imgMsg"), "Uploading…");
    GB.shrink(file, [[2200, 0.9], [1800, 0.85], [1400, 0.8]], 3900000).then(function (photo) { return GB.api("schedule/image", { photo: photo }); })
      .then(function (j) { data.image = j.image; $("imgFile").value = ""; render(); flash($("imgMsg"), "Image uploaded."); }, imgFail);
  });
  var armed = false;
  $("imgRemove").addEventListener("click", function () {
    if (!armed) { armed = true; this.textContent = "Confirm remove"; return; }
    armed = false; this.textContent = "Remove image";
    GB.api("schedule/image", { remove: true }).then(function () { data.image = 0; render(); flash($("imgMsg"), "Image removed."); }, imgFail);
  });
  function fill() { $("schedText").value = toText(data); $("schedNote").value = data.note || ""; }

  render();
  GB.api("schedule").then(function (j) { data = j; loaded = true; render(); fill(); },
    function () { loaded = true; render(); flash($("pageMsg"), "Could not load the schedule. Reload the page to try again.", true); });
  GB.onAdmin(function (a) { admin = a; render(); });
})();
