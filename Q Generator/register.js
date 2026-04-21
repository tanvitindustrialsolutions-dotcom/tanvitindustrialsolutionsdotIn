/**
 * Company-wise document register with separate Contacts and Accounts sections.
 */
(function () {
  const SUPABASE_URL = 'https://ncswfxrbhyjhjvzeepwf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_lIOdxplC0bGpLKewX5XfwA_tsqNwMqF';
  const COMPANY_TAB_STORAGE = 'qg-register-company-tabs';
  const COMPANY_CONTACT_FILTER_STORAGE = 'qg-register-company-contact-filter';
  const CONTACT_CATEGORIES = ['customer', 'vendor', 'reseller'];
  const CONTACT_CATEGORY_LABELS = { customer: 'Customer', vendor: 'Vendor', reseller: 'Reseller' };

  const DOC_LABEL = {
    quotation: 'Quotation',
    proforma: 'Proforma invoice',
    invoice: 'Tax invoice',
    po: 'Purchase order',
    delivery_challan: 'Delivery challan',
    letterhead: 'Letterhead',
  };

  let client = null;
  function sb() {
    if (!client) {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'qg-auth-v2',
          storage: window.localStorage,
        },
      });
    }
    return client;
  }

  const $ = (id) => document.getElementById(id);

  function showErr(msg) {
    const el = $('regErr');
    if (!el) return;
    if (!msg) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.textContent = msg;
    el.style.display = 'block';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function companyLabel(row) {
    const p = row.profile || {};
    return (p.companyName || row.name || '—').trim() || '—';
  }

  function formatType(t) {
    return DOC_LABEL[t] || (t ? String(t).replace(/_/g, ' ') : '—');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  function normalizeCategory(v) {
    const x = String(v || '').trim().toLowerCase();
    return CONTACT_CATEGORIES.includes(x) ? x : 'customer';
  }

  function categoryLabel(v) {
    return CONTACT_CATEGORY_LABELS[normalizeCategory(v)] || 'Customer';
  }

  function getCompanyTabState() {
    try {
      const raw = sessionStorage.getItem(COMPANY_TAB_STORAGE) || '{}';
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function setCompanyTabState(companyId, tabName) {
    const state = getCompanyTabState();
    state[String(companyId)] = tabName;
    try {
      sessionStorage.setItem(COMPANY_TAB_STORAGE, JSON.stringify(state));
    } catch (_) {}
  }

  function getCompanyTab(companyId) {
    const state = getCompanyTabState();
    const tab = state[String(companyId)];
    return tab === 'contacts' ? 'contacts' : 'accounts';
  }

  function getContactFilterState() {
    try {
      const raw = sessionStorage.getItem(COMPANY_CONTACT_FILTER_STORAGE) || '{}';
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function setContactFilter(companyId, filterValue) {
    const st = getContactFilterState();
    st[String(companyId)] = filterValue;
    try {
      sessionStorage.setItem(COMPANY_CONTACT_FILTER_STORAGE, JSON.stringify(st));
    } catch (_) {}
  }

  function getContactFilter(companyId) {
    const st = getContactFilterState();
    const v = String(st[String(companyId)] || 'all');
    return (v === 'customer' || v === 'vendor' || v === 'reseller') ? v : 'all';
  }

  function renderContactsTable(rows, companyId) {
    const filter = getContactFilter(companyId);
    const filteredRows = filter === 'all' ? rows : rows.filter((r) => normalizeCategory(r.category) === filter);
    if (!rows.length) return '<div class="reg-empty" style="padding:14px 8px">No contacts saved for this company.</div>';
    const filterHtml = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <select class="reg-company-contact-filter" data-company-id="${escapeHtml(String(companyId))}" style="max-width:210px">
          <option value="all" ${filter === 'all' ? 'selected' : ''}>All categories</option>
          <option value="customer" ${filter === 'customer' ? 'selected' : ''}>Customer</option>
          <option value="vendor" ${filter === 'vendor' ? 'selected' : ''}>Vendor</option>
          <option value="reseller" ${filter === 'reseller' ? 'selected' : ''}>Reseller</option>
        </select>
      </div>
    `;
    if (!filteredRows.length) return `${filterHtml}<div class="reg-empty" style="padding:14px 8px">No contacts in this category.</div>`;
    const tr = filteredRows.map((r) => `
      <tr>
        <td>${escapeHtml(r.contact)}</td>
        <td>${escapeHtml(r.client)}</td>
        <td><span class="reg-badge">${escapeHtml(categoryLabel(r.category))}</span></td>
        <td class="reg-muted">${escapeHtml(r.designation || '—')}</td>
        <td class="reg-muted">${escapeHtml(r.phone || '—')}</td>
        <td class="reg-muted">${escapeHtml(r.email || '—')}</td>
        <td><a class="reg-open" href="index.html?company=${encodeURIComponent(String(companyId || ''))}&client=${encodeURIComponent(String(r.clientId || ''))}">Open in app</a></td>
      </tr>
    `).join('');
    return `
      ${filterHtml}
      <div class="reg-table-wrap">
        <table class="reg-table">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Client</th>
              <th>Category</th>
              <th>Designation</th>
              <th>Phone</th>
              <th>Email</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${tr}</tbody>
        </table>
      </div>
    `;
  }

  function renderAccountsTable(rows) {
    if (!rows.length) return '<div class="reg-empty" style="padding:14px 8px">No documents saved for this company.</div>';
    const tr = rows.map((q) => `
      <tr>
        <td>${escapeHtml(q.ref_no || '—')}</td>
        <td>${escapeHtml(q.client_name || '—')}</td>
        <td class="reg-muted">${escapeHtml(formatType(q.doc_type))}</td>
        <td class="reg-muted">${escapeHtml(q.doc_date || '—')}</td>
        <td class="reg-muted">${escapeHtml(formatDate(q.saved_at))}</td>
        <td><span class="reg-badge${q.finalized ? ' final' : ''}">${q.finalized ? 'Final' : 'Draft'}</span></td>
        <td><a class="reg-open" href="index.html?doc=${encodeURIComponent(q.id)}" data-doc-id="${escapeHtml(String(q.id))}">Open</a></td>
      </tr>
    `).join('');
    return `
      <div class="reg-table-wrap">
        <table class="reg-table">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Client</th>
              <th>Type</th>
              <th>Date</th>
              <th>Saved</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${tr}</tbody>
        </table>
      </div>
    `;
  }

  function buildCompanyCard(comp, docs, contacts) {
    const cid = String(comp.id);
    const tab = getCompanyTab(cid);
    const contactsCount = contacts.length;
    const docsCount = docs.length;
    const contactsPanelStyle = tab === 'contacts' ? '' : 'display:none';
    const accountsPanelStyle = tab === 'accounts' ? '' : 'display:none';
    return `
      <section class="reg-company-card" data-company-id="${escapeHtml(cid)}">
        <div class="reg-company-head">
          <div>
            <div class="reg-company-title">${escapeHtml(comp.label)}</div>
            <div class="reg-muted">${docsCount} account records · ${contactsCount} contacts</div>
          </div>
          <div class="reg-company-tabs">
            <button type="button" class="reg-company-tab ${tab === 'contacts' ? 'is-active' : ''}" data-company-tab="contacts">Contacts</button>
            <button type="button" class="reg-company-tab ${tab === 'accounts' ? 'is-active' : ''}" data-company-tab="accounts">Accounts Register</button>
          </div>
        </div>
        <div class="reg-company-panel" data-company-panel="contacts" style="${contactsPanelStyle}">
          ${renderContactsTable(contacts, cid)}
        </div>
        <div class="reg-company-panel" data-company-panel="accounts" style="${accountsPanelStyle}">
          ${renderAccountsTable(docs)}
        </div>
      </section>
    `;
  }

  function attachOpenHandlers(rootEl) {
    rootEl.querySelectorAll('a.reg-open[data-doc-id]').forEach((openLink) => {
      const docId = String(openLink.getAttribute('data-doc-id') || '');
      if (!docId) return;
      const target = 'index.html?doc=' + encodeURIComponent(docId);
      openLink.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          sessionStorage.setItem('qg-open-doc', docId);
        } catch (_) {}
        window.location.assign(target);
      });
    });
  }

  function attachOpenClientHandlers(rootEl) {
    rootEl.querySelectorAll('a.reg-open[href*="client="]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          const url = new URL(link.href, window.location.origin);
          const company = String(url.searchParams.get('company') || '');
          const client = String(url.searchParams.get('client') || '');
          if (company) sessionStorage.setItem('qg-open-company', company);
          if (client) sessionStorage.setItem('qg-open-client', client);
        } catch (_) {}
        window.location.assign('index.html');
      });
    });
  }

  function attachCompanyTabHandlers(rootEl) {
    rootEl.querySelectorAll('.reg-company-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.reg-company-card');
        if (!card) return;
        const companyId = card.getAttribute('data-company-id');
        const tab = btn.getAttribute('data-company-tab');
        if (!companyId || (tab !== 'contacts' && tab !== 'accounts')) return;

        setCompanyTabState(companyId, tab);

        card.querySelectorAll('.reg-company-tab').forEach((x) => {
          x.classList.toggle('is-active', x === btn);
        });
        card.querySelectorAll('[data-company-panel]').forEach((panel) => {
          const on = panel.getAttribute('data-company-panel') === tab;
          panel.style.display = on ? '' : 'none';
        });
      });
    });
  }

  function attachContactFilterHandlers(rootEl) {
    rootEl.querySelectorAll('.reg-company-contact-filter').forEach((sel) => {
      sel.addEventListener('change', () => {
        const companyId = sel.getAttribute('data-company-id');
        if (!companyId) return;
        setContactFilter(companyId, sel.value || 'all');
        loadCompanyRegisters();
      });
    });
  }

  async function loadCompanyRegisters() {
    const wrap = $('regCompaniesWrap');
    const empty = $('regCompaniesEmpty');
    if (!wrap) return;

    const { data: ures, error: uerr } = await sb().auth.getUser();
    if (uerr || !ures?.user) {
      showAuth();
      return;
    }
    const uid = ures.user.id;

    const [{ data: comps, error: cerr }, { data: docs, error: derr }, { data: clients, error: clerr }] = await Promise.all([
      sb().from('companies').select('id, name, profile').eq('user_id', uid).order('created_at', { ascending: true }),
      sb().from('saved_quotations').select('id, ref_no, client_name, doc_date, doc_type, finalized, saved_at, company_ref').eq('user_id', uid).order('saved_at', { ascending: false }),
      sb().from('clients').select('id, name, company_id, contacts').eq('user_id', uid),
    ]);

    if (cerr || derr || clerr) {
      showErr((cerr || derr || clerr).message || 'Could not load company register data.');
      wrap.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

    showErr('');
    const companies = (comps || []).map((c) => ({ id: c.id, label: companyLabel(c) }));
    const docsByCompany = {};
    (docs || []).forEach((d) => {
      const key = d.company_ref ? String(d.company_ref) : '__unknown__';
      if (!docsByCompany[key]) docsByCompany[key] = [];
      docsByCompany[key].push(d);
    });

    const contactsByCompany = {};
    (clients || []).forEach((cl) => {
      const key = cl.company_id ? String(cl.company_id) : '__unknown__';
      if (!contactsByCompany[key]) contactsByCompany[key] = [];
      const clientName = (cl.name || '').trim() || '—';
      const arr = Array.isArray(cl.contacts) ? cl.contacts : [];
      arr.forEach((ct) => {
        const sal = String(ct?.salutation || '').trim();
        const nm = String(ct?.name || '').trim();
        contactsByCompany[key].push({
          contact: [sal, nm].filter(Boolean).join(' ').trim() || '—',
          client: clientName,
          clientId: String(cl.id || ''),
          category: normalizeCategory(ct?.category),
          designation: String(ct?.designation || '').trim(),
          phone: String(ct?.phone || '').trim(),
          email: String(ct?.email || '').trim(),
        });
      });
    });

    wrap.innerHTML = '';
    if (!companies.length) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    companies.forEach((comp) => {
      const key = String(comp.id);
      const cardHtml = buildCompanyCard(comp, docsByCompany[key] || [], contactsByCompany[key] || []);
      const tmp = document.createElement('div');
      tmp.innerHTML = cardHtml;
      const card = tmp.firstElementChild;
      if (!card) return;
      attachOpenHandlers(card);
      attachOpenClientHandlers(card);
      attachCompanyTabHandlers(card);
      attachContactFilterHandlers(card);
      wrap.appendChild(card);
    });
  }

  function showAuth() {
    $('regAuthCard').style.display = '';
    $('regListCard').style.display = 'none';
    const ta = $('regTopActions');
    if (ta) {
      ta.innerHTML =
        '<a class="btn btn-ghost" href="portal.html" style="font-size:11px">← HOME</a>' +
        '<a class="btn btn-default" href="index.html">Full app</a>';
    }
  }

  function showList() {
    $('regAuthCard').style.display = 'none';
    $('regListCard').style.display = '';
    const ta = $('regTopActions');
    if (ta) {
      ta.innerHTML =
        '<a class="btn btn-ghost" href="portal.html" style="font-size:11px">← HOME</a>' +
        '<a class="btn btn-default" href="index.html">Full app</a>';
    }
    loadCompanyRegisters();
  }

  async function init() {
    const { data: { session } } = await sb().auth.getSession();
    if (session?.user) showList();
    else showAuth();

    $('regSignIn')?.addEventListener('click', async () => {
      const email = ($('regEmail').value || '').trim();
      const password = $('regPass').value || '';
      if (!email) {
        showErr('Enter your email.');
        return;
      }
      if (!password) {
        showErr('Enter your password.');
        return;
      }
      showErr('');
      const btn = $('regSignIn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Signing in...';
      }
      try {
        const { error } = await sb().auth.signInWithPassword({ email, password });
        if (error) throw error;
        $('regPass').value = '';
        showList();
      } catch (e) {
        showErr(e.message || 'Sign in failed.');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Sign in';
        }
      }
    });

    $('regSignOut')?.addEventListener('click', async () => {
      await sb().auth.signOut();
      showAuth();
    });

    $('regRefresh')?.addEventListener('click', () => {
      loadCompanyRegisters();
    });

    sb().auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') showAuth();
      else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        if ($('regListCard')?.style.display === 'none') showList();
        else loadCompanyRegisters();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
