/* Shared helpers: server calls, admin login, footer. */
window.GB = (function () {
  var admin = false, subs = [];
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function flash(node, text, err) { node.textContent = text; node.className = "msg" + (err ? " err" : ""); }
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
  function setAdmin(a) {
    admin = !!a;
    if ($("loginLink")) { $("loginLink").hidden = admin; $("logoutBtn").hidden = !admin; if (admin) $("loginSec").hidden = true; }
    subs.forEach(function (f) { f(admin); });
  }
  function onAdmin(f) { subs.push(f); f(admin); }

  var foot = $("siteFoot");
  if (foot) {
    var sec = el("section"); sec.id = "loginSec"; sec.hidden = true;
    sec.innerHTML = '<h2>Admin login</h2><form id="loginForm" novalidate><div class="row">'
      + '<label class="f" for="lUser"><span class="label">Username</span><input id="lUser" autocomplete="username" autocapitalize="none"></label>'
      + '<label class="f" for="lPass"><span class="label">Password</span><input id="lPass" type="password" autocomplete="current-password"></label></div>'
      + '<div class="actions"><button class="primary" type="submit">Log in</button><button type="button" id="lCancel">Cancel</button></div>'
      + '<div class="msg" id="lMsg" role="status"></div></form>';
    foot.parentNode.insertBefore(sec, foot);
    foot.innerHTML = 'Girish Bhawan, Bhowanipore, Kolkata · <a href="https://www.facebook.com/girishbhawan" target="_blank" rel="noopener">Girish Bhawan on Facebook</a> · '
      + '<button class="linkbtn" type="button" id="loginLink">Admin login</button><button class="linkbtn" type="button" id="logoutBtn" hidden>Log out</button>';
    $("loginLink").addEventListener("click", function () { sec.hidden = false; $("lUser").focus(); sec.scrollIntoView({ block: "nearest" }); });
    $("lCancel").addEventListener("click", function () { sec.hidden = true; });
    $("loginForm").addEventListener("submit", function (ev) {
      ev.preventDefault(); flash($("lMsg"), "Checking…");
      api("login", { user: $("lUser").value.trim(), pass: $("lPass").value }).then(function () {
        $("lPass").value = ""; flash($("lMsg"), ""); setAdmin(true);
      }, function (e) {
        flash($("lMsg"), e.status === 429 ? "Too many wrong attempts. Wait 15 minutes and try again."
          : e.status === 401 ? "Wrong username or password."
          : e.status === 503 ? "The admin password has not been set in Netlify yet."
          : "Could not reach the server. Try again.", true);
      });
    });
    $("logoutBtn").addEventListener("click", function () { api("logout", {}).then(function () {}, function () {}).then(function () { setAdmin(false); }); });
  }
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
  api("me").then(function (j) { setAdmin(j.admin); }, function () {});
  return { api: api, el: el, flash: flash, onAdmin: onAdmin, setAdmin: setAdmin, shrink: shrink, $: $ };
})();
