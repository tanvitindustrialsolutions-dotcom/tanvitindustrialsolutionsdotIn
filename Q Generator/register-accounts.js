(function () {
  const C = window.QGRegisterCommon;
  if (!C) return;

  let _accountsCache = null;

  const DOC_LABEL = {
    quotation: 'Quotation',
    proforma: 'Proforma invoice',
    invoice: 'Tax invoice',
    po: 'Purchase order',
    delivery_challan: 'Delivery challan',
    letterhead: 'Letterhead',
  };

  function formatType(t) {
    if (t === '__none__' || t == null || t === '') return 'Unspecified type';
    return DOC_LABEL[t] || (t ? String(t).replace(/_/g, ' ') : '—');
  }

  const DOC_TYPE_ORDER = Object.keys(DOC_LABEL);

  function sortDocTypeKeys(keys) {
    return keys.slice().sort((a, b) => {
      const ia = DOC_TYPE_ORDER.indexOf(a);
      const ib = DOC_TYPE_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return String(a).localeCompare(String(b));
    });
  }

  function groupRowsByDocType(rows) {
    const m = {};
    (rows || []).forEach((q) => {
      const raw = q.doc_type;
      const k = raw != null && String(raw).trim() !== '' ? String(raw) : '__none__';
      if (!m[k]) m[k] = [];
      m[k].push(q);
    });
    return m;
  }

  function attachOpenDocHandlers(rootEl, returnCtx) {
    rootEl.querySelectorAll('a.reg-open[data-doc-id]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const docId = String(a.getAttribute('data-doc-id') || '');
        if (!docId) return;
        try {
          sessionStorage.setItem('qg-open-doc', docId);
          if (returnCtx && returnCtx.companyId != null && String(returnCtx.companyId) !== '') {
            C.setAppReturnFromAccounts(docId, {
              companyId: returnCtx.companyId,
              docTypeKey: returnCtx.docTypeKey != null ? returnCtx.docTypeKey : null,
            });
          } else {
            C.clearAppReturnNav();
          }
        } catch (_) {}
        window.location.assign('index.html');
      });
    });
  }

  function renderCompanyBlock(companyName, rows, opts) {
    const hideTypeColumn = !!(opts && opts.hideTypeColumn);
    const typeCol = (q) => (hideTypeColumn ? '' : `<td class="reg-muted">${C.escapeHtml(formatType(q.doc_type))}</td>`);
    const typeTh = hideTypeColumn ? '' : '<th>Type</th>';
    const tbody = rows.map((q) => `
      <tr>
        <td>${C.escapeHtml(q.ref_no || '—')}</td>
        <td>${C.escapeHtml(q.client_name || '—')}</td>
        ${typeCol(q)}
        <td class="reg-muted">${C.escapeHtml(q.doc_date || '—')}</td>
        <td class="reg-muted">${C.escapeHtml(C.formatDate(q.saved_at))}</td>
        <td><span class="reg-badge${q.finalized ? ' final' : ''}">${q.finalized ? 'Final' : 'Draft'}</span></td>
        <td><a class="reg-open" data-doc-id="${C.escapeHtml(String(q.id))}" href="index.html?doc=${encodeURIComponent(q.id)}">Open</a></td>
      </tr>
    `).join('');
    const subtitle = opts && opts.subtitle ? `<div class="reg-muted">${C.escapeHtml(opts.subtitle)}</div>` : '';
    return `
      <section class="reg-company-card">
        <div class="reg-company-head">
          <div>
            <div class="reg-company-title">${C.escapeHtml(companyName)}</div>
            ${subtitle}
            <div class="reg-muted">${rows.length} document${rows.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div class="reg-company-panel">
          <div class="reg-table-wrap">
            <table class="reg-table">
              <thead>
                <tr>
                  <th>Ref</th><th>Client</th>${typeTh}<th>Date</th><th>Saved</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>${tbody}</tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  function renderCompanyNameList(comps, grouped, byCompName) {
    const items = [];
    (comps || []).forEach((co) => {
      const id = String(co.id);
      const rows = grouped[id] || [];
      items.push({ id, label: byCompName[id] || C.companyLabel(co), count: rows.length });
    });
    if ((grouped['__unknown__'] || []).length) {
      items.push({
        id: '__unknown__',
        label: 'Documents without company profile',
        count: grouped['__unknown__'].length,
      });
    }
    if (!items.length) {
      return '<div class="reg-empty" style="padding:20px">No company profiles yet.</div>';
    }
    return `
      <div class="reg-muted" style="margin-bottom:12px">Select a company to view saved documents.</div>
      <div class="reg-accounts-company-list">
        ${items.map((it) => `
          <button type="button" class="reg-accounts-company-item" data-company-id="${C.escapeHtml(it.id)}">
            <span class="reg-accounts-company-name">${C.escapeHtml(it.label)}</span>
            <span class="reg-muted">${it.count} document${it.count === 1 ? '' : 's'}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  function attachCompanyPickHandlers(wrap, comps, grouped, byCompName) {
    wrap.querySelectorAll('.reg-accounts-company-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-company-id');
        if (!id) return;
        const name = id === '__unknown__'
          ? 'Documents without company profile'
          : (byCompName[id] || 'Company');
        const rows = grouped[id] || [];
        renderDocumentsForCompany(wrap, id, name, rows);
      });
    });
  }

  function renderDocTypePickerList(rows) {
    const byType = groupRowsByDocType(rows);
    const keys = sortDocTypeKeys(Object.keys(byType));
    return `
      <div class="reg-muted" style="margin-bottom:12px">Select a document type.</div>
      <div class="reg-accounts-company-list">
        ${keys.map((k) => {
          const n = byType[k].length;
          const label = formatType(k === '__none__' ? null : k);
          return `
          <button type="button" class="reg-accounts-company-item" data-doc-type="${C.escapeHtml(k)}">
            <span class="reg-accounts-company-name">${C.escapeHtml(label)}</span>
            <span class="reg-muted">${n} document${n === 1 ? '' : 's'}</span>
          </button>`;
        }).join('')}
      </div>
    `;
  }

  function bindBackToCompanies(wrap) {
    const back = wrap.querySelector('[data-action="back-companies"]');
    if (back) {
      back.addEventListener('click', () => {
        if (_accountsCache) renderAccountsListView(wrap, _accountsCache);
      });
    }
  }

  function renderDocumentsForCompany(wrap, companyId, companyName, rows) {
    const empty = C.$('regAccountsEmpty');
    if (empty) empty.style.display = 'none';
    if (!rows.length) {
      wrap.innerHTML = `
        <div class="reg-accounts-detail-head">
          <button type="button" class="btn btn-ghost" data-action="back-companies" style="font-size:11px">← All companies</button>
        </div>
        <div class="reg-empty" style="padding:20px">No documents saved for this company yet.</div>`;
      bindBackToCompanies(wrap);
      return;
    }
    wrap.innerHTML = `
      <div class="reg-accounts-detail-head">
        <button type="button" class="btn btn-ghost" data-action="back-companies" style="font-size:11px">← All companies</button>
      </div>
      <div class="reg-muted" style="margin-bottom:4px">${C.escapeHtml(companyName)}</div>
      ${renderDocTypePickerList(rows)}
    `;
    bindBackToCompanies(wrap);
    const byType = groupRowsByDocType(rows);
    wrap.querySelectorAll('.reg-accounts-company-item[data-doc-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const typeKey = btn.getAttribute('data-doc-type');
        if (typeKey == null) return;
        const filtered = byType[typeKey] || [];
        renderDocumentsTableForType(wrap, companyId, companyName, typeKey, rows, filtered);
      });
    });
  }

  function renderDocumentsTableForType(wrap, companyId, companyName, typeKey, allCompanyRows, filteredRows) {
    const empty = C.$('regAccountsEmpty');
    if (empty) empty.style.display = 'none';
    const typeLabel = formatType(typeKey === '__none__' ? null : typeKey);
    wrap.innerHTML = `
      <div class="reg-accounts-detail-head">
        <button type="button" class="btn btn-ghost" data-action="back-types" style="font-size:11px">← Document types</button>
      </div>
      ${filteredRows.length
        ? renderCompanyBlock(companyName, filteredRows, { hideTypeColumn: true, subtitle: typeLabel })
        : '<div class="reg-empty" style="padding:20px">No documents in this category.</div>'}
    `;
    const backTypes = wrap.querySelector('[data-action="back-types"]');
    if (backTypes) {
      backTypes.addEventListener('click', () => {
        renderDocumentsForCompany(wrap, companyId, companyName, allCompanyRows);
      });
    }
    const block = wrap.querySelector('.reg-company-card');
    if (block) attachOpenDocHandlers(block, { companyId, docTypeKey: typeKey });
  }

  function tryConsumeAccountsReturnNav(wrap) {
    if (!_accountsCache) return;
    try {
      const raw = sessionStorage.getItem(C.QG_APP_RETURN_KEY);
      if (!raw) return;
      const nav = JSON.parse(raw);
      if (!nav || nav.resume?.scope !== 'accounts') return;
      const want = String(nav.href || '').trim().toLowerCase();
      const here = (C.registerPageBasename && C.registerPageBasename()) || '';
      if (want && here && want !== here) return;

      const cid = String(nav.resume.companyId || '');
      const grouped = _accountsCache.grouped;
      if (!Object.prototype.hasOwnProperty.call(grouped, cid)) {
        C.clearAppReturnNav();
        return;
      }
      const rows = grouped[cid] || [];
      const name = cid === '__unknown__'
        ? 'Documents without company profile'
        : (_accountsCache.byCompName[cid] || 'Company');
      const dtk = nav.resume.docTypeKey;
      if (dtk != null && dtk !== '') {
        const byType = groupRowsByDocType(rows);
        const filtered = byType[dtk];
        if (filtered && filtered.length) {
          renderDocumentsTableForType(wrap, cid, name, dtk, rows, filtered);
        } else {
          renderDocumentsForCompany(wrap, cid, name, rows);
        }
      } else {
        renderDocumentsForCompany(wrap, cid, name, rows);
      }
      C.clearAppReturnNav();
    } catch (_) {
      try { C.clearAppReturnNav(); } catch (__) {}
    }
  }

  function renderAccountsListView(wrap, cache) {
    const empty = C.$('regAccountsEmpty');
    const hasAnyDoc = Object.keys(cache.grouped).some((k) => (cache.grouped[k] || []).length > 0);
    const hasCompanies = (cache.comps || []).length > 0;
    if (!hasCompanies && !hasAnyDoc) {
      if (empty) {
        empty.style.display = 'block';
        empty.textContent = 'No company profiles and no saved documents yet.';
      }
      wrap.innerHTML = '';
      return;
    }
    if (empty) {
      empty.style.display = 'none';
      empty.textContent = 'No saved documents yet.';
    }
    wrap.innerHTML = renderCompanyNameList(cache.comps, cache.grouped, cache.byCompName);
    attachCompanyPickHandlers(wrap, cache.comps, cache.grouped, cache.byCompName);
  }

  async function loadMain() {
    const wrap = C.$('regAccountsWrap');
    const empty = C.$('regAccountsEmpty');
    if (!wrap) return;
    const user = await C.ensureUser();
    if (!user) return C.showAuth();

    const [{ data: comps, error: cerr }, { data: docs, error: derr }] = await Promise.all([
      C.sb().from('companies').select('id,name,profile').eq('user_id', user.id).order('created_at', { ascending: true }),
      C.sb().from('saved_quotations').select('id,ref_no,client_name,doc_date,doc_type,finalized,saved_at,company_ref').eq('user_id', user.id).order('saved_at', { ascending: false }),
    ]);
    if (cerr || derr) {
      C.showErr((cerr || derr).message || 'Could not load accounts register.');
      wrap.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    C.showErr('');

    const byCompName = {};
    (comps || []).forEach((c) => { byCompName[String(c.id)] = C.companyLabel(c); });
    const grouped = {};
    (docs || []).forEach((d) => {
      const key = d.company_ref ? String(d.company_ref) : '__unknown__';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(d);
    });
    _accountsCache = { comps: comps || [], grouped, byCompName };
    renderAccountsListView(wrap, _accountsCache);
    tryConsumeAccountsReturnNav(wrap);
  }

  document.addEventListener('DOMContentLoaded', () => {
    C.markActiveNav('accounts');
    C.bootTheme();
    C.initAuthFlow(loadMain);
  });
})();
