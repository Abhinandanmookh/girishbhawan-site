(function () {
  var $ = GB.$, flash = GB.flash;
  function show() {
    var me = GB.me(), site = GB.site() || { groups: [] };
    $("guest").hidden = !!(me.admin || me.user); $("member").hidden = !me.user; $("adminBox").hidden = !me.admin;
    if (me.user) {
      var u = me.user, names = site.groups.filter(function (g) { return u.groups.indexOf(g.id) >= 0; }).map(function (g) { return g.name; });
      $("mName").textContent = u.name; $("mLogin").textContent = u.login;
      $("mStatus").textContent = u.status === "active" ? "Approved" : "Waiting for the admin's approval";
      $("mStatus").className = "pill " + (u.status === "active" ? "paid" : "part");
      $("mGroups").textContent = u.status !== "active" ? "You can see the family-only sections once the admin approves your account." : names.length ? "Your groups: " + names.join(", ") : "You are not in a group yet. The admin decides which sections you can open.";
    }
    var sel = $("rWants");
    if (sel.options.length <= 1) site.groups.forEach(function (g) { var o = document.createElement("option"); o.value = g.id; o.textContent = g.name; sel.appendChild(o); });
  }
  $("loginForm").addEventListener("submit", function (ev) {
    ev.preventDefault(); flash($("lMsg"), "Checking…");
    GB.api("login", { user: $("lUser").value.trim(), pass: $("lPass").value }).then(function (j) { location.href = j.admin ? "/admin/" : "/"; }, function (e) {
      flash($("lMsg"), e.status === 429 ? "Too many wrong attempts. Wait 15 minutes and try again." : e.status === 401 ? "Wrong login or password."
        : e.status === 403 ? "This account has been blocked by the admin." : e.status === 503 ? "The admin password has not been set in Netlify yet." : "Could not reach the server. Try again.", true);
    });
  });
  $("regForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if ($("rPass").value.length < 8) { flash($("rMsg"), "The password needs at least 8 characters.", true); return; }
    flash($("rMsg"), "Creating your account…");
    GB.api("register", { name: $("rName").value, login: $("rLogin").value, pass: $("rPass").value, wants: $("rWants").value, note: $("rNote").value, website: $("rWebsite").value })
      .then(function () { location.reload(); }, function (e) {
        flash($("rMsg"), e.code === "name" ? "Enter your name." : e.code === "login" ? "Enter a mobile number with country code, or an email address."
          : e.code === "exists" ? "An account with that mobile number or email already exists. Log in instead."
          : e.status === 429 ? "Too many accounts were created from this network. Try again in an hour." : "Could not create the account. Try again.", true);
      });
  });
  $("pwForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if ($("pwNew").value.length < 8) { flash($("pwMsg"), "The new password needs at least 8 characters.", true); return; }
    GB.api("password", { old: $("pwOld").value, "new": $("pwNew").value }).then(function () { $("pwOld").value = ""; $("pwNew").value = ""; flash($("pwMsg"), "Password changed."); },
      function (e) { flash($("pwMsg"), e.status === 403 ? "The current password is wrong." : "Could not change the password. Try again.", true); });
  });
  GB.ready.then(show);
})();
