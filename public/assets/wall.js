(function () {
  var $ = GB.$, el = GB.el, flash = GB.flash, admin = false, posts = [], loaded = false, autoApprove = false, busy = false;

  function when(ts) { try { return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return "link"; } }

  function render() {
    var feed = $("feed"); feed.textContent = "";
    $("wallAdmin").hidden = !admin; $("autoApprove").checked = autoApprove;
    $("modHint").textContent = admin ? "You are logged in as admin, so your posts appear straight away." : "A photo or a link is needed. Posts appear once the admin has approved them.";
    if (!loaded) { feed.appendChild(el("p", "empty", "Loading posts…")); return; }
    if (!posts.length) { feed.appendChild(el("p", "empty", "Nothing has been shared yet. Be the first to post a photo or a link.")); return; }
    posts.forEach(function (p) {
      var card = el("article", "post" + (p.status === "pending" ? " pending" : ""));
      if (p.photo) { var im = el("img"); im.src = "/api/photo/" + p.id; im.alt = "Photo shared by " + p.name; im.loading = "lazy"; card.appendChild(im); }
      var body = el("div", "post-body");
      if (p.status === "pending") body.appendChild(el("span", "pill part", "Waiting for approval"));
      if (p.comment) body.appendChild(el("p", "post-text", p.comment));
      if (p.link) { var a = el("a", "post-link", "Open on " + host(p.link)); a.href = p.link; a.target = "_blank"; a.rel = "noopener nofollow ugc"; body.appendChild(a); }
      body.appendChild(el("p", "post-meta", p.name + " · " + when(p.ts)));
      if (admin) {
        var act = el("div", "actions");
        if (p.status === "pending") { var ok = el("button", "small primary", "Approve"); ok.type = "button"; ok.addEventListener("click", function () { moderate(p.id, "approve"); }); act.appendChild(ok); }
        var del = el("button", "small danger", "Delete"); del.type = "button"; var armed = false;
        del.addEventListener("click", function () { if (!armed) { armed = true; del.textContent = "Confirm delete"; return; } moderate(p.id, "delete"); });
        act.appendChild(del); body.appendChild(act);
      }
      card.appendChild(body); feed.appendChild(card);
    });
  }
  function load() {
    return GB.api("posts").then(function (j) { posts = j.posts || []; autoApprove = !!j.autoApprove; loaded = true; render(); },
      function () { loaded = true; render(); flash($("feedMsg"), "Could not load the posts. Reload the page to try again.", true); });
  }
  function moderate(id, action) {
    GB.api("posts/moderate", { id: id, action: action }).then(load, function (e) {
      if (e.status === 401) GB.setAdmin(false);
      flash($("feedMsg"), e.status === 401 ? "Your admin session has ended. Log in again." : "That did not work. Try again.", true);
    });
  }
  $("autoApprove").addEventListener("change", function () {
    var v = this.checked;
    GB.api("posts/settings", { autoApprove: v }).then(function () { autoApprove = v; flash($("feedMsg"), v ? "New posts now appear without approval." : "New posts now wait for your approval."); },
      function () { flash($("feedMsg"), "Could not change the setting. Try again.", true); });
  });

  function shrink(file) { return GB.shrink(file, [[1600, 0.82], [1280, 0.75], [1024, 0.7]], 1900000); }
  $("postForm").addEventListener("submit", function (ev) {
    ev.preventDefault(); if (busy) return;
    var name = $("pName").value.trim(), link = $("pLink").value.trim(), file = $("pPhoto").files && $("pPhoto").files[0];
    if (!name) { flash($("pMsg"), "Enter your name.", true); $("pName").focus(); return; }
    if (!link && !file) { flash($("pMsg"), "Add a photo or paste a link.", true); return; }
    if (link && !/^https?:\/\//i.test(link)) link = "https://" + link;
    busy = true; flash($("pMsg"), file ? "Preparing the photo…" : "Posting…");
    (file ? shrink(file) : Promise.resolve(null)).then(function (photo) {
      flash($("pMsg"), "Posting…");
      return GB.api("posts", { name: name, link: link, comment: $("pComment").value, photo: photo, website: $("pWebsite").value });
    }).then(function (j) {
      busy = false; $("pLink").value = ""; $("pComment").value = ""; $("pPhoto").value = "";
      flash($("pMsg"), j.status === "approved" ? "Posted." : "Thank you. Your post will appear once the admin approves it.");
      load();
    }, function (e) {
      busy = false;
      flash($("pMsg"), e.message === "read" ? "That file could not be opened as a photo. Try a JPG or PNG."
        : e.message === "big" || e.code === "photo" ? "That photo is too large. Try a smaller one."
        : e.code === "link" ? "That link does not look right. Paste the full address."
        : e.status === 429 ? "You have posted several times in the last hour. Try again later."
        : "Could not post. Check your connection and try again.", true);
    });
  });

  render();
  GB.onAdmin(function (a) { var changed = a !== admin; admin = a; if (changed || !loaded) load(); else render(); });
})();
