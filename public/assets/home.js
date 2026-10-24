GB.ready.then(function (site) {
  var $ = GB.$, el = GB.el, box = $("doors"); if (!site) return;
  var member = site.me.admin || (site.me.user && site.me.user.status === "active");
  box.textContent = "";
  function door(href, title, text, subs) {
    var card = el("div", "door"), a = el("a", "door-main"); a.href = href;
    a.appendChild(el("b", null, title)); a.appendChild(el("span", null, text)); card.appendChild(a);
    if (subs && subs.length) { var row = el("div", "door-links"); subs.forEach(function (s) { var x = el("a", null, s[1]); x.href = s[0]; row.appendChild(x); }); card.appendChild(row); }
    box.appendChild(card);
  }
  var years = {};
  site.events.forEach(function (e) { (years[e.year] = years[e.year] || []).push(e); });
  Object.keys(years).sort(function (a, b) { return b - a; }).forEach(function (y) {
    var h = el("h3", "year-head", y); box.appendChild(h);
    years[y].forEach(function (e) {
      var q = "?e=" + e.id, subs = [["/album/" + q, "Photos and videos"]];
      if (e.schedule) subs.push(["/nirghonto/" + q, "Nirghonto"]);
      door("/event/" + q, e.occasion || e.title, e.sub || "Photos, links and greetings from the family.", subs);
    });
  });
  door("/story/", "Our story", "The family's history and memories, year by year. Anyone can add to it.");
  if (member) door("/tshirt/", "Dress orders", "Who ordered which size, and who has paid.");
  site.sections.forEach(function (s) { door("/section/?s=" + s.id, s.title, s.desc || "Documents for the family."); });
  if (!site.me.admin && !site.me.user) door("/account/", "Family login", "Log in or register to see the family-only sections.");

  GB.api("catalog").then(function (j) {
    var shop = $("shop"); shop.textContent = "";
    if (!j.items.length) return;
    j.items.forEach(function (it) {
      var card = el("article", "item");
      if (it.image) { var im = el("img"); im.src = it.image; im.alt = it.name; im.loading = "lazy"; card.appendChild(im); }
      var body = el("div", "item-body");
      var head = el("div", "item-head"); head.appendChild(el("h3", null, it.name)); head.appendChild(el("span", "item-price", "₹" + Number(it.price).toLocaleString("en-IN"))); body.appendChild(head);
      var extra = it.sizes.filter(function (z) { return it.sizePrices[z] && it.sizePrices[z] !== it.price; }).map(function (z) { return z + " ₹" + it.sizePrices[z]; });
      body.appendChild(el("p", "post-meta", "Sizes: " + it.sizes.join(", ") + (extra.length ? " (" + extra.join(", ") + ")" : "")));
      if (it.desc) body.appendChild(el("p", "post-text", it.desc));
      card.appendChild(body); shop.appendChild(card);
    });
    $("shopSec").hidden = false;
  }, function () {});
});
