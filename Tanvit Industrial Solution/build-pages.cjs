const fs = require("fs");
const path = require("path");
const base = __dirname;

const header = (active) => `<header class="site-header">
  <div class="header-inner">
    <div class="brand">
      <a class="brand-link" href="index.html" aria-label="Tanvit Industrial Solutions — Home">
        <div class="brand-lockup">
          <img class="brand-logo" src="assets/logo-tanvit.png" alt="" width="240" height="160" decoding="async">
          <div class="brand-text">
            <span class="brand-name">TANVIT INDUSTRIAL SOLUTIONS</span>
            <span class="brand-tagline">A Trusted partner for Industry</span>
          </div>
        </div>
      </a>
    </div>
    <nav class="nav" aria-label="Main">
      <a href="index.html" class="${active === "home" ? "active" : ""}">Home</a>
      <a href="shop.html" class="${active === "shop" ? "active" : ""}">Shop</a>
      <a href="highlight.html" class="${active === "highlight" ? "active" : ""}">Highlight</a>
      <a href="about.html" class="${active === "about" ? "active" : ""}">About</a>
      <a href="contact.html" class="${active === "contact" ? "active" : ""}">Contact</a>
      <a href="quotation.html" class="quote-nav-link${active === "quote" ? " active" : ""}" aria-label="GET QUOTATION">GET QUOTATION</a>
    </nav>
  </div>
</header>`;

const footer = `<footer class="site-footer">
  <div class="footer-inner">
    <div>
      <div class="brand-lockup footer-brand">
        <img class="brand-logo" src="assets/logo-tanvit.png" alt="" width="200" height="133" decoding="async">
        <div class="brand-text">
          <span class="brand-name">TANVIT INDUSTRIAL SOLUTIONS</span>
          <span class="brand-tagline">A Trusted partner for Industry</span>
        </div>
      </div>
      <p style="margin-top:1rem">Industrial consumables and machinery for manufacturing, fabrication, and maintenance teams across India.</p>
    </div>
    <div>
      <h3>Explore</h3>
      <p><a href="shop.html">Shop catalog</a></p>
      <p><a href="highlight.html">Today's highlight</a></p>
      <p><a href="about.html">About us</a></p>
    </div>
    <div>
      <h3>Contact</h3>
      <p><a href="contact.html">Enquiries &amp; support</a></p>
    </div>
  </div>
  <div class="footer-bottom">© Tanvit Industrial Solutions. All rights reserved.</div>
</footer>`;

const head = (title, desc) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Outfit:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/styles.css">
<link rel="icon" type="image/png" href="assets/logo-tanvit.png">
</head>
<body>`;

const scripts = `<script src="js/store.js"></script>
<script src="js/catalog-loader.js"></script>`;

const pages = {};

pages["index.html"] =
  head(
    "Tanvit Industrial Solution | Industrial consumables & machinery",
    "Tanvit supplies industrial consumables and machinery across India. A Trusted partner for Industry — quality sourcing, clear pricing, dependable delivery."
  ).replace(
    "</head>",
    '<link rel="preload" as="image" href="assets/slider/slide-1.png">\n</head>'
  ) +
  header("home") +
  `<main>
  <section class="hero-slider" aria-roledescription="carousel" aria-label="Featured" tabindex="0">
    <div class="hero-slider-viewport">
      <div class="hero-slider-track" id="heroSliderTrack">
        <article class="hero-slide hero-slide--media hero-slide--photo-center" aria-label="Slide 1 of 3">
          <div class="hero-slide-media">
            <img src="assets/slider/slide-1.png" alt="Industrial power tools — drills, grinders, saws, and related equipment" width="1200" height="800" decoding="async" fetchpriority="high">
          </div>
          <div class="hero-slide-scrim" aria-hidden="true"></div>
          <div class="hero-slide-inner">
            <p class="hero-eyebrow">Power tools &amp; equipment</p>
            <h1>Reliable consumables &amp; machinery for your plant</h1>
            <p class="tagline">A Trusted partner for Industry — from welding floors to machine shops, we help you keep production moving.</p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="shop.html">Browse the catalog</a>
              <a class="btn btn-secondary" href="contact.html">Talk to us</a>
            </div>
          </div>
        </article>
        <article class="hero-slide hero-slide--media" aria-label="Slide 2 of 3" aria-hidden="true">
          <div class="hero-slide-media">
            <img src="assets/slider/slide-2.jpg" alt="" width="1920" height="1080" decoding="async" loading="lazy">
          </div>
          <div class="hero-slide-scrim" aria-hidden="true"></div>
          <div class="hero-slide-inner">
            <p class="hero-eyebrow">Consumables</p>
            <h1>Everything your shop reorders, week after week</h1>
            <p class="tagline">Welding consumables, tools, and industrial supplies — specified clearly so you can request a quote with confidence.</p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="shop.html">Shop consumables</a>
              <a class="btn btn-secondary" href="contact.html">Request a quote</a>
            </div>
          </div>
        </article>
        <article class="hero-slide hero-slide--media" aria-label="Slide 3 of 3" aria-hidden="true">
          <div class="hero-slide-media">
            <img src="assets/slider/slide-3.jpg" alt="" width="1920" height="1080" decoding="async" loading="lazy">
          </div>
          <div class="hero-slide-scrim" aria-hidden="true"></div>
          <div class="hero-slide-inner">
            <p class="hero-eyebrow">Machinery</p>
            <h1>Equipment that fits your process &amp; budget</h1>
            <p class="tagline">Machinery and lifting tools for fabrication and plant — we help you compare options and plan for maintenance.</p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="shop.html">View machinery</a>
              <a class="btn btn-secondary" href="contact.html">Speak to sales</a>
            </div>
          </div>
        </article>
      </div>
    </div>
    <button type="button" class="hero-slider-nav hero-slider-prev" aria-label="Previous slide">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
    <button type="button" class="hero-slider-nav hero-slider-next" aria-label="Next slide">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
    </button>
    <div class="hero-slider-dots" role="tablist" aria-label="Choose slide">
      <button type="button" class="hero-slider-dot" role="tab" aria-selected="true" aria-label="Slide 1"></button>
      <button type="button" class="hero-slider-dot" role="tab" aria-selected="false" aria-label="Slide 2"></button>
      <button type="button" class="hero-slider-dot" role="tab" aria-selected="false" aria-label="Slide 3"></button>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="section-title">
        <h2>What we offer</h2>
        <p>Two pillars: everyday industrial consumables and equipment that supports your operations — sourced with consistency and care.</p>
      </div>
      <div class="feature-grid">
        <div class="card">
          <div class="card-icon">C</div>
          <h3>Industrial consumables</h3>
          <p>Welding consumables, abrasives, cutting tools, lubricants, seals, and fasteners — the items your teams reorder week after week. We focus on traceable brands and specifications that match your process.</p>
        </div>
        <div class="card">
          <div class="card-icon">M</div>
          <h3>Machinery &amp; equipment</h3>
          <p>Pumps, compressors, power tools, and related machinery suited to shop-floor and field use. We help you compare options and align with your budget and maintenance plans.</p>
        </div>
        <div class="card">
          <div class="card-icon">O</div>
          <h3>Ordering &amp; fulfilment</h3>
          <p>Browse the catalog for indicative prices and specifications. For formal quotations, purchase orders, and delivery, use <a href="quotation.html">Get quotation</a> on each product or reach us via <a href="contact.html">Contact</a> — phone and email on that page.</p>
        </div>
      </div>
    </div>
  </section>
  <section class="section section--clients">
    <div class="container">
      <div class="section-title">
        <h2>Our valued customers</h2>
        <p>Trusted by major cement, construction, and industrial names across India.</p>
      </div>
      <ul class="clients-grid" role="list">
        <li class="clients-item">
          <div class="clients-logo">
            <img src="assets/clients/wonder-cement.png" alt="Wonder Cement Ltd" width="280" height="88" loading="lazy" decoding="async">
          </div>
        </li>
        <li class="clients-item">
          <div class="clients-logo">
            <img src="assets/clients/ultratech.png" alt="UltraTech Cement" width="280" height="88" loading="lazy" decoding="async">
          </div>
        </li>
        <li class="clients-item">
          <div class="clients-logo">
            <img src="assets/clients/nuvoco.png" alt="Nuvoco" width="280" height="88" loading="lazy" decoding="async">
          </div>
        </li>
        <li class="clients-item">
          <div class="clients-logo">
            <img src="assets/clients/birla.jpg" alt="Birla Corporation" width="280" height="88" loading="lazy" decoding="async">
          </div>
        </li>
        <li class="clients-item">
          <div class="clients-logo">
            <img src="assets/clients/monomark.png" alt="Monomark Engineering" width="280" height="88" loading="lazy" decoding="async">
          </div>
        </li>
        <li class="clients-item">
          <div class="clients-logo">
            <img src="assets/clients/hcc.svg" alt="Hindustan Construction Company" width="280" height="88" loading="lazy" decoding="async">
          </div>
        </li>
      </ul>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="section-title">
        <h2>Welding categories</h2>
        <p>Browse our welding line — from consumables and cable to machines and safety accessories.</p>
      </div>
      <div class="welding-cat-grid">
        <a class="welding-cat-card" href="shop.html?welding=electrodes">
          <h3>Welding electrodes</h3>
          <p>Low-hydrogen and general-purpose rods for structural work and fabrication.</p>
          <span class="welding-cat-more">View products →</span>
        </a>
        <a class="welding-cat-card" href="shop.html?welding=machine">
          <h3>Welding machine</h3>
          <p>Inverter and industrial welders for workshop and site use.</p>
          <span class="welding-cat-more">View products →</span>
        </a>
        <a class="welding-cat-card" href="shop.html?welding=accessories">
          <h3>Welding accessories</h3>
          <p>Helmets, holders, clamps, and essentials for safe welding.</p>
          <span class="welding-cat-more">View products →</span>
        </a>
        <a class="welding-cat-card" href="shop.html?welding=cable">
          <h3>Welding cable</h3>
          <p>Flexible copper cable by the metre — specify length and lugs.</p>
          <span class="welding-cat-more">View products →</span>
        </a>
      </div>
    </div>
  </section>
  <section class="section section--muted">
    <div class="container">
      <div class="section-title">
        <h2>Why work with Tanvit</h2>
        <p>We built Tanvit around a simple idea: industrial buyers deserve straightforward communication and products that match what was promised.</p>
      </div>
      <div class="feature-grid">
        <div class="card">
          <h3>Clear specifications</h3>
          <p>Product pages highlight grade, size, and compatibility so you can order with confidence — and ask us when you need a datasheet or alternate.</p>
        </div>
        <div class="card">
          <h3>Flexible payment</h3>
          <p>Discuss payment terms, advance, and COD with our team when you confirm an order — we align with how your procurement and finance teams work.</p>
        </div>
        <div class="card">
          <h3>Support that listens</h3>
          <p>Questions about stock, lead time, or a bulk quote? Reach out by phone or email — we aim to respond on the same business day.</p>
        </div>
      </div>
    </div>
  </section>
</main>
` +
  footer +
  scripts +
  `<script src="js/home-slider.js"></script>
</body></html>`;

pages["about.html"] =
  head(
    "About us | Tanvit Industrial Solution",
    "Learn about Tanvit Industrial Solution — our mission, what we supply, and how we support industrial customers across India."
  ) +
  header("about") +
  `<main>
  <div class="page-hero">
    <h1>About Tanvit</h1>
    <p class="lead">We are an industrial supply partner focused on consumables and machinery — helping you reduce downtime and keep standards high on the shop floor.</p>
  </div>
  <div class="container section">
    <div class="prose">
      <h2>Who we are</h2>
      <p><strong>Tanvit Industrial Solution</strong> serves manufacturers, fabricators, contractors, and maintenance teams that need dependable products without unnecessary complexity. Our name stands for a straightforward promise: quality-aligned sourcing, honest timelines, and responsive service.</p>
      <h2>What we supply</h2>
      <p>Our portfolio spans <strong>industrial consumables</strong> — such as welding electrodes and wires, grinding and cutting discs, lubricants, hand tools, and maintenance consumables — and <strong>machinery &amp; equipment</strong> including pumps, compressors, and related equipment for production and site use. Every category is curated so you can move from search to purchase with clear product information.</p>
      <h2>How we work</h2>
      <p>We combine a digital catalog with direct support. Browse and order online when you know exactly what you need; contact us when you want a recommendation, a bulk quotation, or a delivery schedule that matches your project. As we grow, we continue to invest in accurate listings, safe packaging, and partners who share our standards.</p>
      <h2>Looking ahead</h2>
      <p>We are expanding our range and strengthening logistics so Tanvit can grow with your organisation. For quotations and orders, we pair this catalog with direct support by phone and email. Whether you place your first order or your hundredth, we are here to be <em>A Trusted partner for Industry</em>.</p>
    </div>
  </div>
</main>` +
  footer +
  scripts +
  `</body></html>`;

pages["contact.html"] =
  head(
    "Contact | Tanvit Industrial Solution",
    "Contact Tanvit for product enquiries, quotations, order support, and partnership discussions. Industrial consumables and machinery."
  ) +
  header("contact") +
  `<main>
  <div class="page-hero">
    <h1>Contact us</h1>
    <p class="lead">We are glad to help with catalog questions, quotations, order status, and partnership enquiries. Reach out by phone or email — we typically respond within one business day.</p>
  </div>
  <div class="container section">
    <div class="contact-grid">
      <div class="contact-card">
        <h2>Get in touch</h2>
        <div class="contact-row">
          <strong>Phone</strong>
          <a href="tel:+919414110440">+91-9414110440</a>
        </div>
        <div class="contact-row">
          <strong>Email</strong>
          <a href="mailto:tanvitindustrialsolutions@gmail.com">tanvitindustrialsolutions@gmail.com</a>
        </div>
        <div class="contact-row">
          <strong>Registered address</strong>
          <span>61-Pannadhai Colony, Chittorgarh, Rajasthan — 312001</span>
        </div>
        <div class="contact-row">
          <strong>Business hours</strong>
          <span>Monday to Saturday, 10:00 – 18:00 IST (excluding public holidays)</span>
        </div>
      </div>
      <div class="contact-card">
        <h2>What to include in your message</h2>
        <p style="color:var(--color-text-muted);font-size:0.9375rem;line-height:1.65">For the fastest help, please share:</p>
        <ul style="margin:0.75rem 0 0;padding-left:1.2rem;color:var(--color-text-muted);font-size:0.9375rem;line-height:1.65">
          <li>Company name and contact person</li>
          <li>Product name or category, quantity, and delivery location</li>
          <li>Whether you need a formal quotation or GST invoice details</li>
        </ul>
        <p style="margin-top:1.25rem;font-size:0.9375rem"><a class="btn btn-primary" href="mailto:tanvitindustrialsolutions@gmail.com?subject=Enquiry%20from%20website">Send an email</a></p>
      </div>
    </div>
  </div>
</main>` +
  footer +
  scripts +
  `</body></html>`;

pages["quotation.html"] =
  head(
    "Get a quotation | Tanvit Industrial Solution",
    "Request a product quotation — Tanvit Industrial Solution. Email or call for prices and delivery."
  ) +
  header("quote") +
  `<main>
  <div class="page-hero">
    <h1>Get a quotation</h1>
    <p class="lead">We do not take orders through a shopping cart on this site. Tell us what you need and we will respond with pricing, lead time, and dispatch options.</p>
  </div>
  <div class="container section quotation-section">
    <div class="quotation-page-grid">
      <div class="prose quotation-instructions">
        <h2>How to request a quote</h2>
        <ol style="padding-left:1.25rem;line-height:1.7;color:var(--color-text-muted)">
          <li>Browse the <a href="shop.html">shop</a> and open a product.</li>
          <li>Choose quantity (and enter any required specifications, for example capacity and length for configurable machinery).</li>
          <li>Click <strong>Get quotation</strong> on the product page — your request is sent straight to us from the site.</li>
        </ol>
        <p style="margin-top:1.25rem;font-size:0.9375rem;color:var(--color-text-muted)">Or use the form on this page — your message is delivered to our inbox when you click <strong>Send request</strong> (no Outlook or other mail program required).</p>
        <p style="margin-top:1rem">
          <a class="btn btn-secondary" href="contact.html">Full contact details</a>
        </p>
        <p style="margin-top:1rem;font-size:0.9375rem;color:var(--color-text-muted)">Direct email: <strong>tanvitindustrialsolutions@gmail.com</strong> · Phone: <a href="tel:+919414110440">+91-9414110440</a></p>
      </div>
      <div class="quotation-form-card">
        <h2 class="quotation-form-card__title">Quotation request form</h2>
        <p class="quotation-form-card__lead">Fill in your details and what you need, then send — we receive it directly at our office inbox (see <code>docs/OPERATIONS.md</code> to connect the form if this is a new deployment).</p>
        <div id="quotationFormSuccess" class="quotation-form-success" role="status" hidden></div>
        <div id="quotationFormError" class="quotation-form-error" role="alert" hidden></div>
        <form id="quotationForm" class="quotation-form" novalidate>
          <div class="form-group">
            <label for="q_name">Your name <span class="req">*</span></label>
            <input type="text" id="q_name" name="q_name" required autocomplete="name" maxlength="120" placeholder="Contact person">
          </div>
          <div class="form-group">
            <label for="q_company">Company / organisation</label>
            <input type="text" id="q_company" name="q_company" autocomplete="organization" maxlength="160" placeholder="Optional">
          </div>
          <div class="form-group">
            <label for="q_email">Email <span class="req">*</span></label>
            <input type="email" id="q_email" name="q_email" required autocomplete="email" maxlength="120" placeholder="you@company.com">
          </div>
          <div class="form-group">
            <label for="q_phone">Phone <span class="req">*</span></label>
            <input type="tel" id="q_phone" name="q_phone" required autocomplete="tel" maxlength="40" placeholder="Mobile with country code">
          </div>
          <div class="form-group">
            <label for="q_gst">GST number (GSTIN)</label>
            <input type="text" id="q_gst" name="q_gst" maxlength="20" placeholder="15-character GSTIN, if applicable" autocomplete="off" spellcheck="false">
          </div>
          <div class="form-group">
            <label for="q_location">Delivery location</label>
            <input type="text" id="q_location" name="q_location" maxlength="200" placeholder="City, state, PIN">
          </div>
          <div class="form-group">
            <label for="q_message">Requirements &amp; specifications <span class="req">*</span></label>
            <textarea id="q_message" name="q_message" required rows="5" maxlength="4000" placeholder="Products, grades, sizes, quantities, capacity/length if machinery, timeline…"></textarea>
          </div>
          <p class="field-hint" style="margin:0 0 1rem;font-size:0.875rem;color:var(--color-text-muted)"><span class="req">*</span> Required fields.</p>
          <button type="submit" class="btn btn-primary">Send request</button>
        </form>
      </div>
    </div>
  </div>
</main>` +
  footer +
  `<script src="js/store.js"></script>
<script src="js/catalog-loader.js"></script>
<script src="js/site-config.js"></script>
<script src="js/enquiry-submit.js"></script>
<script src="js/quotation-page.js"></script>
</body></html>`;

pages["highlight.html"] =
  head(
    "Today's highlight | Tanvit Industrial Solution",
    "Daily featured industrial products for marketing — export as PNG or PDF."
  ) +
  header("highlight") +
  `<main>
  <div class="container section highlight-page-wrap highlight-page-wrap--marketing">
    <div class="highlight-toolbar highlight-toolbar--modern no-print" id="highlightToolbar" hidden>
      <div class="highlight-toolbar__row">
      <div class="highlight-toolbar__primary">
        <button type="button" class="btn btn-wa" id="highlightWa" title="Share on WhatsApp with link back to this page">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Share on WhatsApp
        </button>
        <button type="button" class="btn btn-secondary" id="highlightRefresh" title="Show another set of featured products from the catalog (also updates automatically each day)">New picks</button>
      </div>
      <div class="highlight-toolbar__export" role="group" aria-label="Download or print sheet">
        <button type="button" class="btn btn-primary" id="highlightPng">PNG</button>
        <button type="button" class="btn btn-secondary" id="highlightPdf">PDF</button>
        <button type="button" class="btn btn-secondary" id="highlightPrint">Print</button>
      </div>
      </div>
      <div class="highlight-toolbar__row highlight-toolbar__row--secondary">
        <div class="highlight-toolbar__theme">
          <label for="highlightFlyerTheme">Flyer design</label>
          <select id="highlightFlyerTheme" class="highlight-toolbar__select" title="Choose a layout style for the sheet below" aria-describedby="highlightFlyerThemeHint">
            <option value="classic">Classic — rich mast &amp; bands</option>
            <option value="minimal">Minimal — clean brochure</option>
            <option value="bold">Bold — dark grid, high contrast</option>
            <option value="studio">Studio — warm paper &amp; gold accents</option>
          </select>
          <span id="highlightFlyerThemeHint" class="highlight-toolbar__theme-hint">Saved on this device</span>
        </div>
      </div>
      <p class="highlight-toolbar__hint">Marketing flyer below — export <strong>PNG</strong> or <strong>PDF</strong> for sharing; use <strong>Print</strong> → Save as PDF and enable <em>Background graphics</em> for handouts.</p>
    </div>
    <div id="highlightRoot" class="highlight-root"></div>
    <p class="empty-state" id="highlightEmpty" hidden style="padding:2rem;text-align:center"></p>
  </div>
</main>` +
  footer +
  `<script src="js/store.js"></script>
<script src="js/catalog-loader.js"></script>
<script src="js/vendor/html2canvas.min.js"></script>
<script src="js/vendor/jspdf.umd.min.js"></script>
<script src="js/highlight-page.js"></script>
</body></html>`;

pages["shop.html"] =
  head(
    "Shop | Tanvit Industrial Solution",
    "Browse industrial consumables and machinery — welding, abrasives, lubricants, pumps, compressors, and more."
  ) +
  header("shop") +
  `<main>
  <div class="page-hero">
    <h1>Shop</h1>
    <p class="lead">Explore consumables and machinery — including welding electrodes, machines, accessories, and cable. Use filters below. Listed prices are inclusive of taxes where shown (indicative). Use <strong>Get quotation</strong> on each product to email us, or read <a href="quotation.html">how to request a quote</a>.</p>
  </div>
  <div class="container section" style="padding-top:0">
    <div id="opsNotice" class="notice" hidden>Purchasing is by <strong>quotation and direct contact</strong> — there is no shopping cart. For stock, GST invoices, and delivery, use <a href="contact.html">Contact</a> or <a href="quotation.html">Get quotation</a>.</div>
    <div class="shop-toolbar">
      <div class="shop-filter-block">
        <label class="shop-filter-label" for="shopProductType">Product type</label>
        <select id="shopProductType" class="shop-select" name="productType" aria-label="Product type">
          <option value="all">All products</option>
          <option value="consumables">Consumables</option>
          <option value="machinery">Machinery</option>
        </select>
      </div>
      <div class="shop-filter-block">
        <label class="shop-filter-label" for="shopWeldingCategory">Category</label>
        <select id="shopWeldingCategory" class="shop-select" name="weldingCategory" aria-label="Welding category">
          <option value="">All</option>
          <option value="any">All welding</option>
          <option value="electrodes">Welding electrodes</option>
          <option value="machine">Welding machine</option>
          <option value="accessories">Welding accessories</option>
          <option value="cable">Welding cable</option>
        </select>
      </div>
    </div>
    <div id="productGrid" class="product-grid"></div>
  </div>
</main>` +
  footer +
  `<script src="js/site-config.js"></script>
<script>
(function () {
  if (window.TanvitSiteConfig && window.TanvitSiteConfig.showOpsNotice) {
    var el = document.getElementById("opsNotice");
    if (el) el.hidden = false;
  }
})();
</script>
<script src="js/store.js"></script>
<script src="js/catalog-loader.js"></script>
<script src="js/shop.js"></script>
</body></html>`;

pages["product.html"] =
  head("Product | Tanvit Industrial Solution", "Product details — Tanvit Industrial Solution") +
  header("shop") +
  `<main>
  <div class="container" id="productRoot">
    <p style="padding:2rem 0;color:var(--color-text-muted)">Loading product…</p>
  </div>
</main>` +
  footer +
  `<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script src="js/store.js"></script>
<script src="js/catalog-loader.js"></script>
<script src="js/site-config.js"></script>
<script src="js/enquiry-submit.js"></script>
<script defer src="js/product-page.js"></script>
</body></html>`;

pages["cart.html"] =
  head("Cart removed | Tanvit Industrial Solution", "We use quotations instead of a shopping cart.") +
  header("quote") +
  `<main>
  <div class="container section">
    <div class="notice" style="max-width:36rem;margin:0 auto">
      <h1 style="margin:0 0 0.75rem;font-size:1.5rem">Shopping cart is no longer used</h1>
      <p style="color:var(--color-text-muted);line-height:1.65">Tanvit takes enquiries by quotation and email. If you followed an old bookmark, use the links below.</p>
      <p style="margin-top:1.25rem">
        <a class="btn btn-primary" href="quotation.html">Get a quotation</a>
        <a class="btn btn-secondary" href="shop.html" style="margin-left:0.5rem">Browse the shop</a>
      </p>
    </div>
  </div>
</main>` +
  footer +
  scripts +
  `</body></html>`;

pages["checkout.html"] =
  head("Checkout removed | Tanvit Industrial Solution", "Use quotation or contact for orders.") +
  header("quote") +
  `<main>
  <div class="container section">
    <div class="notice" style="max-width:36rem;margin:0 auto">
      <h1 style="margin:0 0 0.75rem;font-size:1.5rem">Checkout is no longer on this site</h1>
      <p style="color:var(--color-text-muted);line-height:1.65">Orders are confirmed by quotation and direct contact — not through an online checkout.</p>
      <p style="margin-top:1.25rem">
        <a class="btn btn-primary" href="quotation.html">Get a quotation</a>
        <a class="btn btn-secondary" href="contact.html" style="margin-left:0.5rem">Contact</a>
      </p>
    </div>
  </div>
</main>` +
  footer +
  scripts +
  `</body></html>`;

pages["order-success.html"] =
  head("Orders | Tanvit Industrial Solution", "Request a quotation from Tanvit.") +
  header("quote") +
  `<main>
  <div class="container section">
    <div class="notice" style="max-width:36rem;margin:0 auto">
      <h1 style="margin:0 0 0.75rem;font-size:1.5rem">This confirmation page is retired</h1>
      <p style="color:var(--color-text-muted);line-height:1.65">The site no longer records demo orders in the browser. For a quotation or purchase order, use the links below.</p>
      <p style="margin-top:1.25rem">
        <a class="btn btn-primary" href="quotation.html">Get a quotation</a>
        <a class="btn btn-secondary" href="shop.html" style="margin-left:0.5rem">Shop</a>
      </p>
    </div>
  </div>
</main>` +
  footer +
  scripts +
  `</body></html>`;

for (const [name, html] of Object.entries(pages)) {
  fs.writeFileSync(path.join(base, name), html, "utf8");
}
console.log("Wrote", Object.keys(pages).join(", "));
