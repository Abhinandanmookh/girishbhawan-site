(function () {
  var $ = GB.$, el = GB.el, flash = GB.flash, SID = GB.qs("s"), Q = "?s=" + encodeURIComponent(SID), admin = false;
  var OK = ["pdf", "jpg", "jpeg", "png", "webp", "csv", "txt", "xlsx", "xls", "docx", "doc", "pptx"], MAX = 4 * 1024 * 1024;
  function size(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }

  function load() {
    GB.api("files" + Q).then(function (j) {
      $("secTitle").textContent = j.section.title; document.title = j.section.title + " · Girish Bhawan"; $("secSub").textContent = j.section.desc || "";
      $("secAccess").textContent = j.section.access === "public" ? "Open to everyone" : j.section.access === "admin" ? "Visible to the admin only" : "Family members only";
      $("upSec").hidden = !j.mayUpload;
      var box = $("files"); box.textContent = "";
      if (!j.files.length) { box.appendChild(el("p", "empty", "No documents have been added yet.")); return; }
      j.files.forEach(function (f) {
        var row = el("div", "filerow"), main = el("div", "filemain");
        var a = el("a", "post-link", f.name); a.href = "/api/file/" + encodeURIComponent(SID) + "/" + f.id; main.appendChild(a);
        if (f.note) main.appendChild(el("span", "note", f.note));
        main.appendChild(el("span", "post-meta", size(f.size) + " · added " + GB.when(f.ts) + (f.by ? " by " + f.by : "")));
        row.appendChild(main);
        if (admin) {
          var del = el("button", "small danger", "Delete"); del.type = "button"; var armed = false;
          del.addEventListener("click", function () {
            if (!armed) { armed = true; del.textContent = "Confirm delete"; return; }
            GB.api("files/delete" + Q, { id: f.id }).then(load, function () { flash($("pageMsg"), "Could not delete. Try again.", true); });
          });
          row.appendChild(del);
        }
        box.appendChild(row);
      });
    }, function (e) {
      $("upSec").hidden = true; $("files").textContent = "";
      var gone = e.status === 404;
      $("secTitle").textContent = gone ? "Section not found" : "Family members only";
      $("files").appendChild(el("p", "empty", gone ? "This section does not exist." : e.status === 403 ? "Your account does not have access to this section. Ask the admin if you think it should." : "Log in with an approved family account to see this section."));
    });
  }
  $("upForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = $("upFile").files && $("upFile").files[0];
    if (!f) { flash($("upMsg"), "Choose a file first.", true); return; }
    var ext = (/\.([A-Za-z0-9]+)$/.exec(f.name) || [])[1];
    if (!ext || OK.indexOf(ext.toLowerCase()) < 0) { flash($("upMsg"), "That file type is not accepted. Use PDF, Excel, Word, PowerPoint, CSV, text or a picture.", true); return; }
    if (f.size > MAX) { flash($("upMsg"), "That file is larger than 4 MB. Compress it or split it and try again.", true); return; }
    flash($("upMsg"), "Uploading…");
    var r = new FileReader();
    r.onerror = function () { flash($("upMsg"), "Could not read that file.", true); };
    r.onload = function () {
      var data = String(r.result).split(",")[1] || "";
      GB.api("files" + Q, { name: f.name, note: $("upNote").value, data: data }).then(function () { $("upFile").value = ""; $("upNote").value = ""; flash($("upMsg"), "Uploaded."); load(); },
        function (e) { flash($("upMsg"), e.status === 401 || e.status === 403 ? "You are not allowed to upload here." : "Could not upload. Try again.", true); });
    };
    r.readAsDataURL(f);
  });
  GB.ready.then(function (site) { admin = !!(site && site.me.admin); load(); });
})();
