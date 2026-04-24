(function () {
  "use strict";

  const path = window.location.pathname || "";
  const isAbout = /\/about\.html?$|\/about$/i.test(path) || path.endsWith("about.html");
  const isContact = /\/contact\.html?$|\/contact$/i.test(path) || path.endsWith("contact.html");
  if (!isAbout && !isContact) return;

  function setMetaDescription(content) {
    if (content == null || String(content).trim() === "") return;
    let m = document.querySelector('meta[name="description"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
    }
    m.setAttribute("content", String(content).trim());
  }

  function applyAbout(a) {
    if (!a || typeof a !== "object") return;
    setMetaDescription(a.metaDescription);
    const map = [
      ["aboutHeroTitle", a.heroTitle],
      ["aboutHeroLead", a.heroLead],
      ["aboutSectionTitle", a.sectionTitle],
      ["aboutSectionSub", a.sectionSub]
    ];
    map.forEach(([id, val]) => {
      if (val == null) return;
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    });
    if (Array.isArray(a.cards)) {
      a.cards.forEach((card, i) => {
        if (!card || typeof card !== "object") return;
        const h = document.getElementById("aboutCard" + i + "Title");
        const b = document.getElementById("aboutCard" + i + "Body");
        if (h && card.title != null) h.textContent = String(card.title);
        if (b && card.bodyHtml != null) b.innerHTML = String(card.bodyHtml);
      });
    }
  }

  function applyContact(c) {
    if (!c || typeof c !== "object") return;
    setMetaDescription(c.metaDescription);
    const textMap = [
      ["contactHeroTitle", c.heroTitle],
      ["contactHeroLead", c.heroLead],
      ["contactAddress", c.address],
      ["contactHours", c.hours],
      ["contactMessageTitle", c.messageBoxTitle],
      ["contactMessageIntro", c.messageIntro]
    ];
    textMap.forEach(([id, val]) => {
      if (val == null) return;
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    });
    const phoneA = document.getElementById("contactPhoneLink");
    if (phoneA && c.phoneTel) {
      phoneA.href = "tel:" + String(c.phoneTel).replace(/\s/g, "");
      if (c.phone != null) phoneA.textContent = String(c.phone);
    }
    const emailA = document.getElementById("contactEmailLink");
    if (emailA && c.email) {
      emailA.href = "mailto:" + String(c.email).trim();
      emailA.textContent = String(c.email).trim();
    }
    const ul = document.getElementById("contactMessageList");
    if (ul && Array.isArray(c.messageBullets)) {
      ul.innerHTML = c.messageBullets
        .map((line) => {
          const d = document.createElement("div");
          d.textContent = line == null ? "" : String(line);
          return "<li>" + d.innerHTML + "</li>";
        })
        .join("");
    }
    const btn = document.getElementById("contactEmailBtn");
    if (btn && c.email) {
      const subj = encodeURIComponent(c.emailButtonSubject != null ? String(c.emailButtonSubject) : "Enquiry from website");
      btn.href = "mailto:" + String(c.email).trim() + "?subject=" + subj;
      if (c.emailButtonLabel != null) btn.textContent = String(c.emailButtonLabel);
    }
  }

  fetch("/data/site.json", { credentials: "same-origin", cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((site) => {
      if (!site || !site.pages) return;
      if (isAbout && site.pages.about) applyAbout(site.pages.about);
      if (isContact && site.pages.contact) applyContact(site.pages.contact);
    })
    .catch(function () {
      /* keep static HTML */
    });
})();
