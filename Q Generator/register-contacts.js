(function () {
  const C = window.QGRegisterCommon;
  if (!C) return;

  const CONTACT_CATEGORIES = ['customer', 'vendor', 'reseller'];
  const CONTACT_CATEGORY_LABELS = { customer: 'Customer', vendor: 'Vendor', reseller: 'Reseller' };
  const SALUTATIONS = ['Mr.', 'Mrs.', 'Miss', 'Ms.', 'Dr.', 'Prof.', 'Eng.', 'Er.', 'M/s'];
  const CATEGORY_FILTER_KEY = 'qg-register-contacts-category-filter';
  const SEARCH_FILTER_KEY = 'qg-register-contacts-search-filter';

  let _contactsRowsCache = null;
  let _searchDebounce = null;

  function parseSearchTokens(raw) {
    return String(raw || '')
      .toLowerCase()
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function rowSearchHaystack(r) {
    const bits = [
      r.contact,
      r.clientName,
      r.companyName,
      categoryLabel(r.category),
      r.designation,
      r.phone,
      r.email,
    ];
    return bits.map((s) => String(s || '').toLowerCase()).join(' ');
  }

  function rowMatchesSearch(r, tokens) {
    if (!tokens.length) return true;
    const hay = rowSearchHaystack(r);
    return tokens.every((t) => hay.includes(t));
  }

  function scheduleContactsSearchRender() {
    if (_searchDebounce) clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(() => {
      _searchDebounce = null;
      try {
        const inp = C.$('regContactsSearch');
        if (inp) localStorage.setItem(SEARCH_FILTER_KEY, inp.value || '');
      } catch (_) {}
      renderContactsTable();
    }, 200);
  }

  function renderContactsTable() {
    const wrap = C.$('regContactsWrap');
    const empty = C.$('regContactsEmpty');
    if (!wrap || !_contactsRowsCache) return;
    const rows = _contactsRowsCache;

    const selectedCategory = String((C.$('regContactsCategoryFilter') || {}).value || 'all');
    const searchRaw = String((C.$('regContactsSearch') || {}).value || '');
    const searchTokens = parseSearchTokens(searchRaw);

    const afterCategory = selectedCategory === 'all'
      ? rows.slice()
      : rows.filter((r) => normalizeCategory(r.category) === selectedCategory);
    const filteredRows = afterCategory.filter((r) => rowMatchesSearch(r, searchTokens));

    wrap.innerHTML = '';
    if (!filteredRows.length) {
      if (empty) empty.style.display = 'block';
      if (empty) {
        if (!rows.length) {
          empty.textContent = 'No contacts saved yet.';
        } else if (!afterCategory.length) {
          empty.textContent = selectedCategory !== 'all'
            ? ('No contacts in ' + categoryLabel(selectedCategory) + ' category.')
            : 'No contacts match these filters.';
        } else if (searchTokens.length) {
          empty.textContent = 'No contacts match your search.';
        } else {
          empty.textContent = 'No contacts match these filters.';
        }
      }
      return;
    }
    if (empty) empty.style.display = 'none';

    const table = `
      <div class="reg-table-wrap">
        <table class="reg-table">
          <thead>
            <tr>
              <th>Contact</th><th>Client</th><th>Company</th><th>Category</th><th>Designation</th><th>Phone</th><th>Email</th><th></th><th></th>
            </tr>
          </thead>
          <tbody>
            ${filteredRows.map((r) => `
              <tr>
                <td>${C.escapeHtml(r.contact)}</td>
                <td>${C.escapeHtml(r.clientName)}</td>
                <td class="reg-muted">${C.escapeHtml(r.companyName)}</td>
                <td><span class="reg-badge">${C.escapeHtml(categoryLabel(r.category))}</span></td>
                <td class="reg-muted">${C.escapeHtml(r.designation || '—')}</td>
                <td class="reg-muted">${C.escapeHtml(r.phone || '—')}</td>
                <td class="reg-muted">${C.escapeHtml(r.email || '—')}</td>
                <td><button type="button" class="btn btn-ghost reg-contact-edit" data-row-key="${C.escapeHtml(r.rowKey)}" style="font-size:11px;padding:4px 8px">Edit</button></td>
                <td><button type="button" class="btn btn-ghost reg-contact-delete" data-client-id="${C.escapeHtml(r.clientId)}" data-contact-id="${C.escapeHtml(r.contactId)}" data-contact-idx="${C.escapeHtml(String(r.contactIdx))}" style="font-size:11px;padding:4px 8px">Delete</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    const holder = document.createElement('div');
    holder.innerHTML = table;
    attachContactActionHandlers(holder, filteredRows);
    wrap.appendChild(holder);
  }
  let _clientsCache = [];
  let _companiesById = {};
  let _companiesCache = [];
  let _userId = '';

  function normalizeCategory(v) {
    const x = String(v || '').trim().toLowerCase();
    return CONTACT_CATEGORIES.includes(x) ? x : 'customer';
  }

  function categoryLabel(v) {
    return CONTACT_CATEGORY_LABELS[normalizeCategory(v)] || 'Customer';
  }

  function normClientName(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function normPhoneDigits(s) {
    return String(s || '').replace(/\D/g, '');
  }

  function normEmailLower(s) {
    return String(s || '').trim().toLowerCase();
  }

  /** Same person for duplicate detection (salutation / designation ignored). */
  function contactsEquivalent(a, b) {
    if (normClientName(a?.name) !== normClientName(b?.name)) return false;
    if (normPhoneDigits(a?.phone) !== normPhoneDigits(b?.phone)) return false;
    if (normEmailLower(a?.email) !== normEmailLower(b?.email)) return false;
    return true;
  }

  function findDuplicateContact(contacts, incoming) {
    const list = Array.isArray(contacts) ? contacts : [];
    for (let i = 0; i < list.length; i++) {
      if (contactsEquivalent(list[i], incoming)) return list[i];
    }
    return null;
  }

  function clientsForCompany(companyId) {
    return _clientsCache.filter((c) => String(c.company_id || '') === String(companyId || ''));
  }

  function normGstKey(s) {
    const n = String(s || '').trim().toUpperCase().replace(/\s/g, '');
    return n.length >= 10 ? n : '';
  }

  /** Company row whose seller GSTIN (profile.companyGstin) matches, or null. */
  function findCompanyProfileBySellerGstin(gstRaw) {
    const key = normGstKey(gstRaw);
    if (!key) return null;
    for (const row of _companiesCache) {
      const p = row.profile || {};
      if (normGstKey(p.companyGstin) === key) return row;
    }
    return null;
  }

  /**
   * Rule 1: duplicate GSTIN → throw. Rule 2: name match + GST mismatch → confirm; returns false if user cancels.
   */
  function assertClientGstNameRules(companyId, name, gstin, excludeClientId) {
    const R = typeof window !== 'undefined' ? window.QGClientRules : null;
    if (!R || typeof R.check !== 'function') return true;
    const list = clientsForCompany(companyId);
    const excludeId = excludeClientId && excludeClientId !== '__new__' ? String(excludeClientId) : '';
    const v = R.check(list, { name, gstin }, { excludeId });
    if (v.block) throw new Error(v.block);
    if (v.warn) {
      if (!window.confirm(v.warn + '\n\nProceed anyway?')) return false;
    }
    return true;
  }

  function renderSalutationOptions(selected) {
    const want = String(selected || '').trim();
    return SALUTATIONS.map((s) => `<option value="${C.escapeHtml(s)}" ${want === s ? 'selected' : ''}>${C.escapeHtml(s)}</option>`).join('');
  }

  function rebuildClientOptions(overlay, companyId) {
    const sel = overlay.querySelector('#qgContactClientExisting');
    if (!sel) return;
    const cur = String(sel.value || '__new__');
    const rows = _clientsCache.filter((c) => String(c.company_id || '') === String(companyId || ''));
    const opts = ['<option value="__new__">Create new client</option>'].concat(
      rows.map((cl) => `<option value="${C.escapeHtml(String(cl.id))}">${C.escapeHtml(cl.name || 'Unnamed client')}</option>`)
    );
    sel.innerHTML = opts.join('');
    if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
  }

  function fillClientDetailsFromExisting(overlay, clientId) {
    const row = _clientsCache.find((x) => String(x.id) === String(clientId || ''));
    if (!row) return;
    const setVal = (id, v) => { const el = overlay.querySelector('#' + id); if (el) el.value = v || ''; };
    setVal('qgClientName', row.name || '');
    setVal('qgClientGstin', row.gstin || '');
    setVal('qgClientAddress', row.address || '');
    setVal('qgClientBuyerState', row.buyer_state || '');
  }

  async function upsertClientForContact(companyId, existingClientId, clientInput) {
    const payload = {
      name: String(clientInput.name || '').trim(),
      gstin: String(clientInput.gstin || '').trim().toUpperCase(),
      address: String(clientInput.address || '').trim(),
      buyer_state: String(clientInput.buyerState || '').trim(),
      company_id: companyId,
      user_id: _userId,
    };
    if (!payload.name) throw new Error('Client name is required.');
    if (!companyId) throw new Error('Profile is required.');

    if (existingClientId && existingClientId !== '__new__') {
      const row = _clientsCache.find((x) => String(x.id) === String(existingClientId));
      if (!row) throw new Error('Selected client not found.');
      if (!assertClientGstNameRules(companyId, payload.name, payload.gstin, existingClientId)) return null;
      const contacts = Array.isArray(row.contacts) ? row.contacts : [];
      const { error } = await C.sb().from('clients').update({
        ...payload,
        contacts,
      }).eq('id', row.id);
      if (error) throw error;
      // keep local cache aligned so immediate contact save works reliably
      row.name = payload.name;
      row.gstin = payload.gstin;
      row.address = payload.address;
      row.buyer_state = payload.buyer_state;
      row.company_id = payload.company_id;
      return String(row.id);
    }

    if (!assertClientGstNameRules(companyId, payload.name, payload.gstin, null)) return null;

    const { data, error } = await C.sb().from('clients').insert({
      ...payload,
      contacts: [],
      ship_addresses: [],
    }).select('id').single();
    if (error) throw error;
    // cache newly created client for subsequent saveContactToClient call
    _clientsCache.push({
      id: data.id,
      name: payload.name,
      gstin: payload.gstin,
      address: payload.address,
      buyer_state: payload.buyer_state,
      company_id: payload.company_id,
      contacts: [],
    });
    return String(data.id);
  }

  async function saveContactToClient(clientId, contact) {
    const row = _clientsCache.find((x) => String(x.id) === String(clientId));
    if (!row) {
      // fallback: fetch directly in case local cache is stale
      const { data: fresh, error: ferr } = await C.sb()
        .from('clients')
        .select('id,contacts')
        .eq('id', clientId)
        .eq('user_id', _userId)
        .maybeSingle();
      if (ferr || !fresh) throw new Error('Client not found.');
      const contacts = Array.isArray(fresh.contacts) ? fresh.contacts.slice() : [];
      if (findDuplicateContact(contacts, contact)) {
        throw new Error('This contact already exists for this client (same name, phone, and email).');
      }
      contacts.push(contact);
      const { error } = await C.sb().from('clients').update({ contacts }).eq('id', fresh.id).eq('user_id', _userId);
      if (error) throw error;
      return;
    }
    const contacts = Array.isArray(row.contacts) ? row.contacts.slice() : [];
    if (findDuplicateContact(contacts, contact)) {
      throw new Error('This contact already exists for this client (same name, phone, and email).');
    }
    contacts.push(contact);
    const payload = { contacts };
    const { error } = await C.sb().from('clients').update(payload).eq('id', row.id).eq('user_id', _userId);
    if (error) throw error;
    row.contacts = contacts;
  }

  async function deleteContactFromClient(clientId, contactId, contactIdx) {
    const row = _clientsCache.find((x) => String(x.id) === String(clientId));
    if (!row) throw new Error('Client not found.');
    const contacts = Array.isArray(row.contacts) ? row.contacts.slice() : [];
    const next = contacts.filter((ct, idx) => {
      if (ct && ct.id != null) return String(ct.id) !== String(contactId);
      return idx !== Number(contactIdx);
    });
    const { error } = await C.sb().from('clients').update({ contacts: next }).eq('id', row.id).eq('user_id', _userId);
    if (error) throw error;
  }

  async function updateContactInClient(clientId, contactId, contactIdx, patch) {
    const row = _clientsCache.find((x) => String(x.id) === String(clientId));
    if (!row) throw new Error('Client not found.');
    const contacts = Array.isArray(row.contacts) ? row.contacts.slice() : [];
    let hit = false;
    const next = contacts.map((ct, idx) => {
      const idMatch = ct && ct.id != null && String(ct.id) === String(contactId);
      const idxMatch = ct && ct.id == null && idx === Number(contactIdx);
      if (idMatch || idxMatch) {
        hit = true;
        return { ...(ct || {}), ...patch };
      }
      return ct;
    });
    if (!hit) throw new Error('Contact not found.');
    const { error } = await C.sb().from('clients').update({ contacts: next }).eq('id', row.id).eq('user_id', _userId);
    if (error) throw error;
  }

  function openAddContactModal() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:16px;z-index:99999';
    const profileOptions = _companiesCache.map((co) => {
      const id = String(co.id || '');
      const nm = _companiesById[id] || 'Unnamed Company';
      return `<option value="${C.escapeHtml(id)}">${C.escapeHtml(nm)}</option>`;
    }).join('');
    overlay.innerHTML = `
      <div style="width:560px;max-width:100%;background:var(--panel-bg);border:1px solid var(--panel-border);border-radius:10px;padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <strong style="font-size:14px">Add Contact</strong>
          <button type="button" id="qgCloseModal" class="btn btn-ghost" style="font-size:11px;padding:4px 8px">Close</button>
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <label>Profile (Company) *</label>
          <select id="qgContactProfile">${profileOptions}</select>
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <label>Existing Client</label>
          <select id="qgContactClientExisting">
            <option value="__new__">Create new client</option>
          </select>
        </div>
        <div class="form-row" style="margin-bottom:8px">
          <div class="form-group" style="margin-bottom:0"><label>Client name *</label><input id="qgClientName" type="text"></div>
          <div class="form-group" style="margin-bottom:0"><label>Client GSTIN</label><input id="qgClientGstin" type="text"></div>
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <label>Client address</label>
          <input id="qgClientAddress" type="text">
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <label>Buyer state code</label>
          <input id="qgClientBuyerState" type="text" placeholder="e.g. 27">
        </div>
        <div class="form-row" style="margin-bottom:8px">
          <div class="form-group" style="margin-bottom:0"><label>Salutation</label><select id="qgContactSal">${renderSalutationOptions('Mr.')}</select></div>
          <div class="form-group" style="margin-bottom:0"><label>Name *</label><input id="qgContactName" type="text"></div>
        </div>
        <div class="form-row" style="margin-bottom:8px">
          <div class="form-group" style="margin-bottom:0"><label>Category</label><select id="qgContactCategory"><option value="customer">Customer</option><option value="vendor">Vendor</option><option value="reseller">Reseller</option></select></div>
          <div class="form-group" style="margin-bottom:0"><label>Designation</label><input id="qgContactDes" type="text"></div>
        </div>
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0"><label>Phone</label><input id="qgContactPhone" type="text"></div>
          <div class="form-group" style="margin-bottom:0"><label>Email</label><input id="qgContactEmail" type="email"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
          <button type="button" id="qgSaveContact" class="btn btn-primary">Save Contact</button>
        </div>
        <div id="qgModalErr" style="display:none;margin-top:10px;padding:8px 10px;border-radius:8px;border:1px solid rgba(200,23,30,0.35);background:rgba(200,23,30,0.12);color:#fca5a5;font-size:12px"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#qgCloseModal')?.addEventListener('click', close);
    const profileSel = overlay.querySelector('#qgContactProfile');
    const existingSel = overlay.querySelector('#qgContactClientExisting');
    if (profileSel) {
      rebuildClientOptions(overlay, profileSel.value || '');
      profileSel.addEventListener('change', () => {
        rebuildClientOptions(overlay, profileSel.value || '');
        const nameEl = overlay.querySelector('#qgClientName');
        if (nameEl) nameEl.value = '';
      });
    }
    if (existingSel) {
      existingSel.addEventListener('change', () => {
        const val = existingSel.value || '__new__';
        if (val !== '__new__') fillClientDetailsFromExisting(overlay, val);
      });
    }
    const setModalErr = (msg) => {
      const el = overlay.querySelector('#qgModalErr');
      if (!el) return;
      if (!msg) {
        el.style.display = 'none';
        el.textContent = '';
        return;
      }
      el.style.display = '';
      el.textContent = msg;
    };
    overlay.querySelector('#qgSaveContact')?.addEventListener('click', async () => {
      let companyId = String((overlay.querySelector('#qgContactProfile') || {}).value || '');
      let existingClientId = String((overlay.querySelector('#qgContactClientExisting') || {}).value || '__new__');
      const clientName = String((overlay.querySelector('#qgClientName') || {}).value || '').trim();
      const clientGstin = String((overlay.querySelector('#qgClientGstin') || {}).value || '').trim();
      const clientAddress = String((overlay.querySelector('#qgClientAddress') || {}).value || '').trim();
      const clientBuyerState = String((overlay.querySelector('#qgClientBuyerState') || {}).value || '').trim();
      const name = String((overlay.querySelector('#qgContactName') || {}).value || '').trim();
      if (!companyId) return setModalErr('Select a profile.');
      if (!clientName) return setModalErr('Client name is required.');
      if (!name) return setModalErr('Contact name is required.');

      {
        const matchCo = findCompanyProfileBySellerGstin(clientGstin);
        if (matchCo && String(matchCo.id) !== String(companyId)) {
          const curLabel = _companiesById[companyId] || 'the profile you selected';
          const othLabel = C.companyLabel(matchCo);
          const ok = window.confirm(
            'This GSTIN is already saved as your company profile "' + othLabel + '".\n\n' +
              'Contacts for this GST must be saved under that profile (not "' + curLabel + '").\n\n' +
              'Save this contact under "' + othLabel + '" instead?'
          );
          if (!ok) {
            setModalErr('Change the client GSTIN, pick the correct profile in the list, or cancel.');
            return;
          }
          companyId = String(matchCo.id);
          existingClientId = '__new__';
          if (profileSel) profileSel.value = companyId;
          rebuildClientOptions(overlay, companyId);
          if (existingSel) existingSel.value = '__new__';
        }
      }
      const contact = {
        id: Date.now() + Math.random(),
        salutation: String((overlay.querySelector('#qgContactSal') || {}).value || '').trim() || 'Mr.',
        name,
        category: normalizeCategory((overlay.querySelector('#qgContactCategory') || {}).value || 'customer'),
        designation: String((overlay.querySelector('#qgContactDes') || {}).value || '').trim(),
        phone: String((overlay.querySelector('#qgContactPhone') || {}).value || '').trim(),
        email: String((overlay.querySelector('#qgContactEmail') || {}).value || '').trim(),
      };
      try {
        setModalErr('');
        const clientId = await upsertClientForContact(companyId, existingClientId, {
          name: clientName,
          gstin: clientGstin,
          address: clientAddress,
          buyerState: clientBuyerState,
        });
        if (!clientId) return;
        await saveContactToClient(clientId, contact);
        C.showErr('');
        close();
        loadMain();
      } catch (err) {
        setModalErr(err?.message || 'Could not save contact.');
      }
    });
  }

  function openEditContactModal(rowData) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:16px;z-index:99999';
    overlay.innerHTML = `
      <div style="width:520px;max-width:100%;background:var(--panel-bg);border:1px solid var(--panel-border);border-radius:10px;padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <strong style="font-size:14px">Edit Contact</strong>
          <button type="button" id="qgCloseEditModal" class="btn btn-ghost" style="font-size:11px;padding:4px 8px">Close</button>
        </div>
        <div class="reg-muted" style="margin-bottom:10px">${C.escapeHtml(rowData.clientName)} — ${C.escapeHtml(rowData.companyName)}</div>
        <div class="form-row" style="margin-bottom:8px">
          <div class="form-group" style="margin-bottom:0"><label>Salutation</label><select id="qgEditSal">${renderSalutationOptions(rowData.salutation || 'Mr.')}</select></div>
          <div class="form-group" style="margin-bottom:0"><label>Name *</label><input id="qgEditName" type="text" value="${C.escapeHtml(rowData.name || '')}"></div>
        </div>
        <div class="form-row" style="margin-bottom:8px">
          <div class="form-group" style="margin-bottom:0"><label>Category</label><select id="qgEditCategory"><option value="customer">Customer</option><option value="vendor">Vendor</option><option value="reseller">Reseller</option></select></div>
          <div class="form-group" style="margin-bottom:0"><label>Designation</label><input id="qgEditDes" type="text" value="${C.escapeHtml(rowData.designation || '')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0"><label>Phone</label><input id="qgEditPhone" type="text" value="${C.escapeHtml(rowData.phone || '')}"></div>
          <div class="form-group" style="margin-bottom:0"><label>Email</label><input id="qgEditEmail" type="email" value="${C.escapeHtml(rowData.email || '')}"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
          <button type="button" id="qgUpdateContact" class="btn btn-primary">Update</button>
        </div>
        <div id="qgEditModalErr" style="display:none;margin-top:10px;padding:8px 10px;border-radius:8px;border:1px solid rgba(200,23,30,0.35);background:rgba(200,23,30,0.12);color:#fca5a5;font-size:12px"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#qgCloseEditModal')?.addEventListener('click', close);
    const catSel = overlay.querySelector('#qgEditCategory');
    if (catSel) catSel.value = normalizeCategory(rowData.category);
    const setErr = (msg) => {
      const el = overlay.querySelector('#qgEditModalErr');
      if (!el) return;
      if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
      el.style.display = ''; el.textContent = msg;
    };
    overlay.querySelector('#qgUpdateContact')?.addEventListener('click', async () => {
      const name = String((overlay.querySelector('#qgEditName') || {}).value || '').trim();
      if (!name) return setErr('Contact name is required.');
      try {
        setErr('');
        await updateContactInClient(rowData.clientId, rowData.contactId, rowData.contactIdx, {
          salutation: String((overlay.querySelector('#qgEditSal') || {}).value || '').trim() || 'Mr.',
          name,
          category: normalizeCategory((overlay.querySelector('#qgEditCategory') || {}).value || 'customer'),
          designation: String((overlay.querySelector('#qgEditDes') || {}).value || '').trim(),
          phone: String((overlay.querySelector('#qgEditPhone') || {}).value || '').trim(),
          email: String((overlay.querySelector('#qgEditEmail') || {}).value || '').trim(),
        });
        close();
        loadMain();
      } catch (err) {
        setErr(err?.message || 'Could not update contact.');
      }
    });
  }

  function attachContactActionHandlers(rootEl, rows) {
    rootEl.querySelectorAll('.reg-contact-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const clientId = String(btn.getAttribute('data-client-id') || '');
        const contactId = String(btn.getAttribute('data-contact-id') || '');
        const contactIdx = Number(btn.getAttribute('data-contact-idx') || -1);
        if (!clientId) return;
        if (!confirm('Delete this contact?')) return;
        try {
          await deleteContactFromClient(clientId, contactId, contactIdx);
          loadMain();
        } catch (err) {
          C.showErr(err?.message || 'Could not delete contact.');
        }
      });
    });
    rootEl.querySelectorAll('.reg-contact-edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = String(btn.getAttribute('data-row-key') || '');
        const row = rows.find((x) => x.rowKey === key);
        if (!row) return;
        openEditContactModal(row);
      });
    });
  }

  async function loadMain() {
    const wrap = C.$('regContactsWrap');
    const empty = C.$('regContactsEmpty');
    if (!wrap) return;
    const user = await C.ensureUser();
    if (!user) {
      _contactsRowsCache = null;
      return C.showAuth();
    }

    const [{ data: comps, error: cerr }, { data: clients, error: clerr }] = await Promise.all([
      C.sb().from('companies').select('id,name,profile').eq('user_id', user.id).order('created_at', { ascending: true }),
      C.sb().from('clients').select('id,name,company_id,contacts').eq('user_id', user.id),
    ]);
    if (cerr || clerr) {
      _contactsRowsCache = null;
      C.showErr((cerr || clerr).message || 'Could not load contacts.');
      wrap.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    C.showErr('');

    const byCompName = {};
    (comps || []).forEach((c) => { byCompName[String(c.id)] = C.companyLabel(c); });
    _companiesById = byCompName;
    _companiesCache = comps || [];
    _userId = String(user.id || '');
    _clientsCache = clients || [];
    const rows = [];
    (clients || []).forEach((cl) => {
      const companyId = String(cl.company_id || '');
      const companyName = byCompName[companyId] || 'Unknown Company';
      const clientName = (cl.name || '').trim() || '—';
      const contacts = Array.isArray(cl.contacts) ? cl.contacts : [];
      contacts.forEach((ct, contactIdx) => {
        const sal = String(ct?.salutation || '').trim();
        const nm = String(ct?.name || '').trim();
        rows.push({
          rowKey: String(cl.id || '') + ':' + String(ct?.id ?? contactIdx),
          companyId,
          clientId: String(cl.id || ''),
          contactId: String(ct?.id ?? ''),
          contactIdx,
          companyName,
          clientName,
          salutation: sal,
          name: nm,
          contact: [sal, nm].filter(Boolean).join(' ').trim() || '—',
          category: normalizeCategory(ct?.category),
          designation: String(ct?.designation || '').trim(),
          phone: String(ct?.phone || '').trim(),
          email: String(ct?.email || '').trim(),
        });
      });
    });

    rows.sort((a, b) => (a.companyName + a.clientName + a.contact).localeCompare(b.companyName + b.clientName + b.contact));

    _contactsRowsCache = rows;
    renderContactsTable();
  }

  document.addEventListener('DOMContentLoaded', () => {
    C.markActiveNav('contacts');
    C.bootTheme();
    C.initAuthFlow(loadMain);
    const cat = C.$('regContactsCategoryFilter');
    if (cat) {
      try {
        const saved = localStorage.getItem(CATEGORY_FILTER_KEY) || 'all';
        if (['all', 'customer', 'vendor', 'reseller'].includes(saved)) cat.value = saved;
      } catch (_) {}
      cat.addEventListener('change', () => {
        try { localStorage.setItem(CATEGORY_FILTER_KEY, cat.value || 'all'); } catch (_) {}
        renderContactsTable();
      });
    }
    const searchInp = C.$('regContactsSearch');
    if (searchInp) {
      try {
        const savedQ = localStorage.getItem(SEARCH_FILTER_KEY) || '';
        searchInp.value = savedQ;
      } catch (_) {}
      searchInp.addEventListener('input', () => { scheduleContactsSearchRender(); });
    }
    C.$('regAddContact')?.addEventListener('click', openAddContactModal);
  });
})();
