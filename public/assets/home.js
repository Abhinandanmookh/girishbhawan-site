GB.ready.then(function (site) {
  var box = GB.$("doors"); if (!site) return;
  box.textContent = "";
  function door(href, title, text) { var a = GB.el("a", "door"); a.href = href; a.appendChild(GB.el("b", null, title)); a.appendChild(GB.el("span", null, text)); box.appendChild(a); }
  site.events.forEach(function (e) {
    door("/event/?e=" + e.id, e.title, e.sub || "Photos, links and greetings from the family.");
    if (e.schedule) door("/nirghonto/?e=" + e.id, e.title + " Nirghonto", "The schedule, day by day.");
  });
  door("/tshirt/", "T-shirt orders", "Who ordered which size, and who has paid.");
  site.sections.forEach(function (s) { door("/section/?s=" + s.id, s.title, s.desc || "Documents for the family."); });
  if (!site.me.admin && !site.me.user) door("/account/", "Family login", "Log in or register to see the family-only sections.");
});
