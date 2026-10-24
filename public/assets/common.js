/* Shared helpers: server calls, who is logged in, navigation and footer. */
window.GB = (function () {
  var subs = [], site = null, me = { admin: false, user: null };
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function flash(node, text, err) { node.textContent = text; node.className = "msg" + (err ? " err" : ""); }
  function qs(name) { try { return new URLSearchParams(location.search).get(name) || ""; } catch (e) { return ""; } }
  function when(ts) { try { return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } }
  function api(path, body) {
    return fetch("/api/" + path, {
      method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store",
      headers: body ? { "Content-Type": "application/json", "X-Requested-With": "gb" } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || "error"); e.status = r.status; e.code = j.error; throw e; }
        return j;
      });
    });
  }
  function link(href, text, cls) { var a = el("a", cls, text); a.href = href; return a; }
  function ext(href, text) { var a = link(href, text); a.target = "_blank"; a.rel = "noopener"; return a; }
  function sep(node) { node.appendChild(document.createTextNode(" · ")); }

  function draw() {
    var nav = $("siteNav"), here = location.pathname + location.search;
    if (nav && site) {
      nav.textContent = "";
      var items = [["/", "Home"]];
      site.events.slice().sort(function (a, b) { return b.year - a.year; }).slice(0, 3).forEach(function (e) { items.push(["/event/?e=" + e.id, e.title]); });
      items.push(["/story/", "Our story"]);
      if (me.admin || (me.user && me.user.status === "active")) items.push(["/tshirt/", "Dress orders"]);
      site.sections.forEach(function (s) { items.push(["/section/?s=" + s.id, s.title]); });
      items.forEach(function (it) { var a = link(it[0], it[1]); if (it[0] === here || (it[0] === "/" && location.pathname === "/")) a.setAttribute("aria-current", "page"); nav.appendChild(a); });
    }
    var foot = $("siteFoot");
    if (foot) {
      foot.textContent = "Girish Bhawan, Bhowanipore, Kolkata";
      var L = (site && site.links) || {};
      if (L.facebook) { sep(foot); foot.appendChild(ext(L.facebook, "Facebook")); }
      if (L.instagram) { sep(foot); foot.appendChild(ext(L.instagram, "Instagram")); }
      if (L.youtube) { sep(foot); foot.appendChild(ext(L.youtube, "YouTube")); }
      sep(foot);
      if (me.admin) { foot.appendChild(link("/admin/", "Admin page")); sep(foot); }
      if (me.guest && !me.admin && !me.user) {
        foot.appendChild(document.createTextNode("Signed in with Google as " + me.guest.name + (me.guest.kind ? " (" + me.guest.kind + ")" : "")));
        sep(foot);
        var gout = el("button", "linkbtn", "Sign out"); gout.type = "button";
        gout.addEventListener("click", function () { api("guest/logout", {}).then(function () {}, function () {}).then(function () { location.reload(); }); });
        foot.appendChild(gout); sep(foot);
      }
      if (me.admin || me.user) {
        if (me.user) { foot.appendChild(link("/account/", me.user.name)); sep(foot); }
        var out = el("button", "linkbtn", "Log out"); out.type = "button";
        out.addEventListener("click", function () { api("logout", {}).then(function () {}, function () {}).then(function () { location.href = "/"; }); });
        foot.appendChild(out);
      } else foot.appendChild(link("/account/", "Log in or register"));
    }
  }
  /* Tabs shown on every event page: family posts, photos and videos, Nirghonto */
  function eventTabs(E, current) {
    var box = $("evTabs"); if (!box || !site) return null;
    var ev = site.events.filter(function (x) { return x.id === E; })[0]; if (!ev) return null;
    var q = "?e=" + encodeURIComponent(E), tabs = [["/event/", "From the family", "wall"], ["/album/", "Photos and videos", "album"]];
    if (ev.schedule) tabs.push(["/nirghonto/", "Nirghonto", "nirghonto"]);
    box.textContent = "";
    tabs.forEach(function (t) { var a = link(t[0] + q, t[1]); if (t[2] === current) a.setAttribute("aria-current", "page"); box.appendChild(a); });
    box.hidden = false;
    return ev;
  }
  /* Sign in with Google: anyone can, to vote on photos and ask for them. First time, they say whether they are family or a guest. */
  function googleSignIn(next) { location.href = "/api/google/signin?next=" + encodeURIComponent(next || (location.pathname + location.search)); }
  function askKind() {
    if (!me.guest || me.guest.kind || me.admin || me.user || $("kindBox")) return;
    var box = el("div", "kindbox"); box.id = "kindBox"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Family or guest");
    box.appendChild(el("p", null, "Welcome, " + me.guest.name + ". Are you family or a guest?"));
    var row = el("div", "actions");
    ["Family", "Guest"].forEach(function (k) {
      var b = el("button", k === "Family" ? "primary" : "", k); b.type = "button";
      b.addEventListener("click", function () { api("guest", { kind: k }).then(function () { me.guest.kind = k; box.remove(); draw(); }, function () { box.remove(); }); });
      row.appendChild(b);
    });
    box.appendChild(row); document.body.appendChild(box);
  }
  function fire() { subs.forEach(function (f) { f(me.admin); }); }
  function onAdmin(f) { subs.push(f); f(me.admin); }
  function setAdmin(a) { me.admin = !!a; draw(); fire(); }

  /* Shrink a picture in the browser so uploads stay small and carry no location data.
     tries = [[longest side in px, JPEG quality], ...]; rejects with "read" or "big". */
  function shrink(file, tries, maxChars) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var out = null;
        for (var i = 0; i < tries.length; i++) {
          var k = Math.min(1, tries[i][0] / Math.max(img.naturalWidth, img.naturalHeight));
          var c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
          var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL("image/jpeg", tries[i][1]);
          if (out.length < maxChars) break;
        }
        URL.revokeObjectURL(url);
        if (!out || out.length >= maxChars) reject(new Error("big")); else resolve(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("read")); };
      img.src = url;
    });
  }

  draw();
  var ready = api("site").then(function (j) { site = j; me = j.me; draw(); fire(); askKind(); return j; }, function () { return null; });
  return { api: api, el: el, flash: flash, qs: qs, when: when, onAdmin: onAdmin, setAdmin: setAdmin, shrink: shrink, ready: ready, $: $, eventTabs: eventTabs,
    member: function () { return !!(me.user && me.user.status === "active"); },
    voter: function () { return !!(me.admin || (me.user && me.user.status === "active") || me.guest); },
    googleSignIn: googleSignIn,
    me: function () { return me; }, site: function () { return site; } };
})();
