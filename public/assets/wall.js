(function () {
  var $ = GB.$, el = GB.el, flash = GB.flash, E = GB.qs("e") || "durga-puja-2026", Q = "?e=" + encodeURIComponent(E);
  var admin = false, posts = [], loaded = false, busy = false, mayPost = true, needsApproval = true, blocked = false;

  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return "link"; } }
  function render() {
    var feed = $("feed"); feed.textContent = "";
    var member = !!(GB.me().user && GB.me().user.status === "active");
    $("postSec").hidden = blocked || !mayPost; $("nameField").hidden = member;
    $("loginToPost").hidden = blocked || mayPost;
    $("modHint").textContent = needsApproval ? "A photo or a link is needed. Posts appear once the admin has approved them." : "A photo or a link is needed. Your post appears straight away.";
    if (blocked) { feed.appendChild(el("p", "empty", "This page is for family members. Log in with an approved account to see it.")); return; }
    if (!loaded) { feed.appendChild(el("p", "empty", "Loading posts…")); return; }
    if (!posts.length) { feed.appendChild(el("p", "empty", "Nothing has been shared yet. Be the first to post a photo or a link.")); return; }
    posts.forEach(function (p) {
      var card = el("article", "post" + (p.status === "pending" ? " pending" : ""));
      if (p.photo) { var im = el("img"); im.src = "/api/photo/" + p.id + Q; im.alt = "Photo shared by " + p.name; im.loading = "lazy"; card.appendChild(im); }
      var body = el("div", "post-body");
      if (p.status === "pending") body.appendChild(el("span", "pill part", "Waiting for approval"));
      if (p.comment) body.appendChild(el("p", "post-text", p.comment));
      if (p.link) { var a = el("a", "post-link", "Open on " + host(p.link)); a.href = p.link; a.target = "_blank"; a.rel = "noopener nofollow ugc"; body.appendChild(a); }
      body.appendChild(el("p", "post-meta", p.name + " · " + GB.when(p.ts)));
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
    return GB.api("posts" + Q).then(function (j) { posts = j.posts || []; mayPost = !!j.mayPost; needsApproval = !!j.needsApproval; loaded = true; blocked = false; render(); },
      function (e) { loaded = true; blocked = e.status === 401 || e.status === 403 || e.status === 404; render(); if (!blocked) flash($("feedMsg"), "Could not load the posts. Reload the page to try again.", true); });
  }
  function moderate(id, action) {
    GB.api("posts/moderate" + Q, { id: id, action: action }).then(load, function (e) {
      if (e.status === 401) GB.setAdmin(false);
      flash($("feedMsg"), e.status === 401 ? "Your admin session has ended. Log in again." : "That did not work. Try again.", true);
    });
  }
  function shrink(file) { return GB.shrink(file, [[1600, 0.82], [1280, 0.75], [1024, 0.7]], 1900000); }
  $("postForm").addEventListener("submit", function (ev) {
    ev.preventDefault(); if (busy) return;
    var member = GB.me().user && GB.me().user.status === "active";
    var name = member ? GB.me().user.name : $("pName").value.trim(), link = $("pLink").value.trim(), file = $("pPhoto").files && $("pPhoto").files[0];
    if (!name) { flash($("pMsg"), "Enter your name.", true); $("pName").focus(); return; }
    if (!link && !file) { flash($("pMsg"), "Add a photo or paste a link.", true); return; }
    if (link && !/^https?:\/\//i.test(link)) link = "https://" + link;
    busy = true; flash($("pMsg"), file ? "Preparing the photo…" : "Posting…");
    (file ? shrink(file) : Promise.resolve(null)).then(function (photo) {
      flash($("pMsg"), "Posting…");
      return GB.api("posts" + Q, { name: name, link: link, comment: $("pComment").value, photo: photo, website: $("pWebsite").value });
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
        : e.status === 401 || e.status === 403 ? "Log in with an approved account to post here."
        : "Could not post. Check your connection and try again.", true);
    });
  });

  render();
  GB.ready.then(function (site) {
    var ev = site && site.events.filter(function (x) { return x.id === E; })[0];
    if (ev) { $("evTitle").textContent = ev.title; document.title = ev.title + " · Girish Bhawan"; $("evSub").textContent = ev.sub || ""; $("schedLink").hidden = !ev.schedule; $("schedLink").href = "/nirghonto/" + Q; }
    admin = !!(site && site.me.admin);
    load();
    GB.onAdmin(function (a) { if (a !== admin) { admin = a; load(); } });
  });
})();
