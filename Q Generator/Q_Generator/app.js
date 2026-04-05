function showPanel(n){var p=document.getElementById("panel-"+n),t=document.getElementById("tab-"+n);if(!p)return;document.querySelectorAll(".panel-section").forEach(function(x){x.classList.remove("active")});document.querySelectorAll(".snav-btn").forEach(function(x){x.classList.remove("active")});p.classList.add("active");if(t)t.classList.add("active");}
window.showPanel=showPanel;
// ===== STATE
let state = {
  viewingLocked: null,
  docType: 'quotation',
  template: 'classic',
  activeClientId: null,
  activeCompanyId: null,
  logoData: null,
  resolvedGstType: 'igst',
  showItemDiscount: false,
  items: [],
  contacts: [],
  partnerLogos: [],
  partnerAlign: 'center',
  productImages: [],
  colors: {
    accent: '#C8171E',
    header: '#f8f9fd',
    text: '#1a1a2e',
    footerBg: '#C8171E'
  }
};

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'SGD ' };

// Global helper — get value of any input/select by id
function val(id) { return (document.getElementById(id) || {}).value || ''; }

const DOC_LABELS = {
  quotation:        'QUOTATION',
  proforma:         'PROFORMA INVOICE',
  invoice:          'TAX INVOICE',
  po:               'PURCHASE ORDER',
  delivery_challan: 'DELIVERY CHALLAN',
  letterhead:       'LETTERHEAD',
};

const DOC_REF_PREFIXES = {
  quotation:        'QT',
  proforma:         'PI',
  invoice:          'INV',
  po:               'PO',
  delivery_challan: 'DC',
  letterhead:       'LH',
};

// Returns default ref for a doc type: e.g. "PI/2026/001"
function _defaultRef(docType) {
  const prefix = DOC_REF_PREFIXES[docType] || 'QT';
  const year   = new Date().getFullYear();
  return prefix + '/' + year + '/001';
}

function _refSeqStorageKey(docType, year) {
  const cid = (typeof state !== 'undefined' && state.activeCompanyId) ? String(state.activeCompanyId) : 'global';
  const prefix = DOC_REF_PREFIXES[docType] || 'QT';
  return `qg.refSeq.${cid}.${prefix}.${year}`;
}

function _pad3(n) {
  const x = Math.max(0, parseInt(n || 0, 10) || 0);
  return String(x).padStart(3, '0');
}

function _parseRefNo(refNo) {
  const s = String(refNo || '').trim().toUpperCase();
  const m = s.match(/^([A-Z]{1,6})\/(\d{4})\/(\d{1,})$/);
  if (!m) return null;
  return { prefix: m[1], year: parseInt(m[2], 10), seq: parseInt(m[3], 10) };
}

async function setNextRefNo() {
  const el = document.getElementById('refNo');
  if (!el) return;
  const docType = state.docType || 'quotation';
  const prefix  = DOC_REF_PREFIXES[docType] || 'QT';
  const year    = new Date().getFullYear();

  let nextSeq = 1;
  try {
    const k = _refSeqStorageKey(docType, year);
    const stored = parseInt(localStorage.getItem(k) || '0', 10) || 0;
    nextSeq = Math.max(nextSeq, stored + 1);
  } catch(e) {}

  // Also consider existing saved quotations (prevents duplicates after switching devices)
  try {
    if (typeof DM !== 'undefined' && DM.getQuotations) {
      const existing = await DM.getQuotations();
      const maxSeq = (existing || [])
        .map(q => _parseRefNo(q.refNo))
        .filter(x => x && x.prefix === prefix && x.year === year)
        .reduce((m, x) => Math.max(m, x.seq || 0), 0);
      nextSeq = Math.max(nextSeq, maxSeq + 1);
    }
  } catch(e) {}

  el.value = `${prefix}/${year}/${_pad3(nextSeq)}`;
  syncDoc();
  try { localStorage.setItem(_refSeqStorageKey(docType, year), String(nextSeq)); } catch(e) {}
}

// Update refNo field when doc type changes — only if it's still on a default prefix
function _updateRefPrefix(newType) {
  const el = document.getElementById('refNo');
  if (!el) return;
  const current = el.value.trim();
  // Check if current value starts with any known prefix — if so, swap it
  const knownPrefixes = Object.values(DOC_REF_PREFIXES);
  const startsWithKnown = knownPrefixes.some(p => current.toUpperCase().startsWith(p + '/'));
  if (!current || startsWithKnown) {
    // Preserve the sequence number if present
    const parts = current.split('/');
    const seq   = parts.length >= 3 ? parts.slice(2).join('/') : '001';
    const year  = new Date().getFullYear();
    el.value = (DOC_REF_PREFIXES[newType] || 'QT') + '/' + year + '/' + seq;
    syncDoc();
  }
}

// ===== GSTIN VALIDATION =====
// Indian GSTIN: 15 chars — 2 digit state + 5 alpha PAN + 4 digit PAN + 1 alpha PAN + 1 entity + Z + 1 checksum
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function validateGstin(value) {
  if (!value || !value.trim()) return 'empty';           // blank — optional but warn
  const v = value.trim().toUpperCase();
  if (v.length !== 15)         return 'invalid';
  if (!GSTIN_REGEX.test(v))    return 'invalid';
  return 'valid';
}

// Live feedback on a GSTIN input — shows coloured badge next to field
function _gstinFeedback(inputId) {
  const el  = document.getElementById(inputId);
  if (!el) return;
  const val    = el.value.trim().toUpperCase();
  const status = validateGstin(val);

  // Auto-uppercase as user types
  if (el.value !== el.value.toUpperCase()) el.value = el.value.toUpperCase();

  let badge = el.parentElement.querySelector('.gstin-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'gstin-badge';
    badge.style.cssText = 'position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:600;letter-spacing:0.3px;pointer-events:none;padding:2px 6px;border-radius:4px;';
    el.parentElement.style.position = 'relative';
    el.parentElement.appendChild(badge);
  }

  if (!val) {
    badge.style.display = 'none';
  } else if (status === 'valid') {
    badge.textContent = '✓ Valid';
    badge.style.cssText += 'display:inline;background:rgba(34,197,94,0.15);color:#4ade80;border:1px solid rgba(34,197,94,0.3);';
    badge.style.display = '';
  } else {
    badge.textContent = val.length < 15 ? val.length + '/15' : '✗ Invalid';
    badge.style.cssText += 'display:inline;background:rgba(200,23,30,0.12);color:#f87171;border:1px solid rgba(200,23,30,0.25);';
    badge.style.display = '';
  }
}

function _toggleGstinNA(inputId, checkboxId) {
  const input = document.getElementById(inputId);
  const chk   = document.getElementById(checkboxId);
  if (!input || !chk) return;
  if (chk.checked) {
    input.value    = '';
    input.disabled = true;
    input.style.opacity = '0.4';
    // Remove badge
    const badge = input.parentElement.querySelector('.gstin-badge');
    if (badge) badge.style.display = 'none';
  } else {
    input.disabled = false;
    input.style.opacity = '';
    input.focus();
  }
}

// ===== SETTINGS DRAWER + PREVIEW EDITING =====
function initSettingsToggle() {
  const sidebar   = document.querySelector('.sidebar');
  const toggleBtn = document.getElementById('settingsToggleBtn');
  if (!sidebar || !toggleBtn) return;

  // Default: hide left panel on desktop/tablet; keep mobile UX as-is.
  const isDesktop = window.matchMedia && window.matchMedia('(min-width: 641px)').matches;
  if (isDesktop) {
    sidebar.setAttribute('data-hidden', 'true');
    toggleBtn.classList.remove('active');
  }
}

function toggleSettingsDrawer() {
  const sidebar   = document.querySelector('.sidebar');
  const toggleBtn = document.getElementById('settingsToggleBtn');
  if (!sidebar) return;

  const isHidden = sidebar.getAttribute('data-hidden') === 'true';
  if (isHidden) sidebar.removeAttribute('data-hidden');
  else sidebar.setAttribute('data-hidden', 'true');

  if (toggleBtn) toggleBtn.classList.toggle('active', isHidden);

  // Preview width changed — re-scale to fit.
  scaleDocument();
  requestAnimationFrame(() => {
    const preview = document.querySelector('.preview-pane');
    if (preview) preview.focus();
  });
}

function openSettingsPanel(name) {
  // On mobile, sidebar is the "edit" view
  const isMobile = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
  if (isMobile) {
    if (typeof setMobileView === 'function') setMobileView('edit');
    if (typeof showPanel === 'function') showPanel(name);
    return;
  }

  const sidebar = document.querySelector('.sidebar');
  if (sidebar && sidebar.getAttribute('data-hidden') === 'true') {
    sidebar.removeAttribute('data-hidden');
    const toggleBtn = document.getElementById('settingsToggleBtn');
    if (toggleBtn) toggleBtn.classList.add('active');
    scaleDocument();
  }
  if (typeof showPanel === 'function') showPanel(name);
}

let _clientPickerEl = null;
let _clientPickerSelectedClientId = null;

function closeClientPicker() {
  if (_clientPickerEl && _clientPickerEl.parentNode) _clientPickerEl.parentNode.removeChild(_clientPickerEl);
  _clientPickerEl = null;
  _clientPickerSelectedClientId = null;
}

function openClientPicker(e) {
  if (e) e.stopPropagation();
  closeClientPicker();

  const anchor = document.getElementById('docClientName');
  if (!anchor) return;

  const rect = anchor.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'client-picker-pop';
  pop.innerHTML = `
    <div class="client-picker-head">
      <div class="client-picker-title">Select saved client</div>
      <button class="client-picker-close" type="button" aria-label="Close">✕</button>
    </div>
    <div class="client-picker-body">
      <input class="client-picker-search" id="clientPickerSearch" placeholder="Search name / GSTIN / address…" />
      <div class="client-picker-list" id="clientPickerList"></div>
      <div id="clientPickerContactsWrap" style="display:none">
        <div class="client-picker-subtitle">Select contact (optional)</div>
        <div class="client-picker-contacts" id="clientPickerContacts"></div>
      </div>
    </div>
  `;

  document.body.appendChild(pop);
  _clientPickerEl = pop;

  // Position near anchor
  const margin = 8;
  let left = rect.left;
  let top = rect.bottom + margin;
  left = Math.min(left, window.innerWidth - pop.offsetWidth - 12);
  left = Math.max(12, left);
  if (top + pop.offsetHeight > window.innerHeight - 12) {
    top = rect.top - pop.offsetHeight - margin;
  }
  top = Math.max(12, Math.min(top, window.innerHeight - pop.offsetHeight - 12));
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';

  const closeBtn = pop.querySelector('.client-picker-close');
  if (closeBtn) closeBtn.addEventListener('click', closeClientPicker);

  const searchEl = pop.querySelector('#clientPickerSearch');
  const listEl = pop.querySelector('#clientPickerList');
  const contactsWrap = pop.querySelector('#clientPickerContactsWrap');
  const contactsEl = pop.querySelector('#clientPickerContacts');

  const render = () => {
    const db = DM.getClients ? DM.getClients() : [];
    const q = String(searchEl?.value || '').toLowerCase().trim();
    const filtered = q
      ? db.filter(c =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.gstin || '').toLowerCase().includes(q) ||
          (c.address || '').toLowerCase().includes(q)
        )
      : db;

    if (!listEl) return;
    if (!filtered.length) {
      listEl.innerHTML = `<div style="padding:10px;color:#9aa3b2;font-size:12px">No saved clients found.</div>`;
      if (contactsWrap) contactsWrap.style.display = 'none';
      return;
    }

    listEl.innerHTML = filtered.map(c => {
      const meta = [c.gstin, c.address ? String(c.address).split('\n')[0] : ''].filter(Boolean).join(' · ');
      return `
        <div class="client-picker-item" data-id="${escHtml(c.id)}">
          <div class="client-picker-item-name">${escHtml(c.name || '')}</div>
          ${meta ? `<div class="client-picker-item-meta">${escHtml(meta)}</div>` : ''}
        </div>
      `;
    }).join('');

    Array.from(listEl.querySelectorAll('.client-picker-item')).forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        if (!id) return;
        _clientPickerSelectedClientId = id;
        loadClientFromDb(id);

        // Render contacts picker for this client
        const db2 = DM.getClients ? DM.getClients() : [];
        const cl = db2.find(x => String(x.id) === String(id));
        const contacts = (cl && Array.isArray(cl.contacts)) ? cl.contacts : [];

        if (contactsWrap && contactsEl && contacts.length) {
          contactsWrap.style.display = '';
          contactsEl.innerHTML = [
            `<div class="client-picker-contact" data-idx="-1">Use all contacts</div>`,
            ...contacts.map((ct, idx) => {
              const label = [ct.salutation, ct.name, ct.designation].filter(Boolean).join(' ').trim();
              const meta2 = [ct.phone, ct.email].filter(Boolean).join(' · ');
              return `<div class="client-picker-contact" data-idx="${idx}">
                <div style="font-weight:650">${escHtml(label || ('Contact ' + (idx+1)))}</div>
                ${meta2 ? `<div style="color:#9aa3b2;font-size:11px;margin-top:2px">${escHtml(meta2)}</div>` : ''}
              </div>`;
            })
          ].join('');

          Array.from(contactsEl.querySelectorAll('.client-picker-contact')).forEach(el2 => {
            el2.addEventListener('click', () => {
              const idx = parseInt(el2.getAttribute('data-idx') || '-1', 10);
              if (!Number.isFinite(idx)) return;
              if (idx < 0) {
                // keep all contacts as loaded
              } else {
                state.contacts = [JSON.parse(JSON.stringify(contacts[idx]))];
                renderContacts();
                syncDoc();
              }
              closeClientPicker();
            });
          });
        } else {
          closeClientPicker();
        }
      });
    });
  };

  if (searchEl) {
    searchEl.addEventListener('input', render);
    setTimeout(() => searchEl.focus(), 0);
  }

  // Close when clicking outside
  setTimeout(() => {
    window.addEventListener('mousedown', _clientPickerOutsideClick, { capture: true });
  }, 0);

  render();
}

function _clientPickerOutsideClick(ev) {
  if (!_clientPickerEl) return;
  if (_clientPickerEl.contains(ev.target)) return;
  window.removeEventListener('mousedown', _clientPickerOutsideClick, { capture: true });
  closeClientPicker();
}

let _contactPickerEl = null;

function closeContactPicker() {
  if (_contactPickerEl && _contactPickerEl.parentNode) _contactPickerEl.parentNode.removeChild(_contactPickerEl);
  _contactPickerEl = null;
}

let _inlineDatePickerEl = null;

function closeInlineDatePicker() {
  if (_inlineDatePickerEl && _inlineDatePickerEl.parentNode) _inlineDatePickerEl.parentNode.removeChild(_inlineDatePickerEl);
  _inlineDatePickerEl = null;
}

function openInlineDatePicker(anchorId, inputId) {
  closeInlineDatePicker();
  const anchor = document.getElementById(anchorId);
  const inp = document.getElementById(inputId);
  if (!anchor || !inp) return;

  const rect = anchor.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'client-picker-pop';
  pop.style.width = '260px';
  pop.innerHTML = `
    <div class="client-picker-head">
      <div class="client-picker-title">Pick date</div>
      <button class="client-picker-close" type="button" aria-label="Close">✕</button>
    </div>
    <div class="client-picker-body">
      <input id="inlineDateInput" type="date" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:#0b0d12;color:#e9ecf5;font-size:12px;outline:none" />
    </div>
  `;
  document.body.appendChild(pop);
  _inlineDatePickerEl = pop;

  // Position
  const margin = 8;
  let left = rect.left;
  let top = rect.bottom + margin;
  left = Math.min(left, window.innerWidth - pop.offsetWidth - 12);
  left = Math.max(12, left);
  if (top + pop.offsetHeight > window.innerHeight - 12) top = rect.top - pop.offsetHeight - margin;
  top = Math.max(12, Math.min(top, window.innerHeight - pop.offsetHeight - 12));
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';

  const closeBtn = pop.querySelector('.client-picker-close');
  if (closeBtn) closeBtn.addEventListener('click', closeInlineDatePicker);

  const inline = pop.querySelector('#inlineDateInput');
  if (inline) {
    inline.value = inp.value || '';
    // For validUntil input, enforce min (if docDate set)
    if (inputId === 'validUntil') {
      const dd = (document.getElementById('docDate') || {}).value || '';
      if (dd) inline.min = dd;
    }
    inline.addEventListener('input', () => {
      inp.value = inline.value;
      if (inputId === 'docDate') onDocDateChange();
      else if (inputId === 'validUntil') onValidUntilChange();
      else syncDoc();
    });
    setTimeout(() => {
      inline.focus();
      if (inline.showPicker) inline.showPicker();
    }, 0);
  }

  setTimeout(() => {
    window.addEventListener('mousedown', _inlineDatePickerOutsideClick, { capture: true });
  }, 0);
}

function _inlineDatePickerOutsideClick(ev) {
  if (!_inlineDatePickerEl) return;
  if (_inlineDatePickerEl.contains(ev.target)) return;
  window.removeEventListener('mousedown', _inlineDatePickerOutsideClick, { capture: true });
  closeInlineDatePicker();
}

function initPreviewItemEditing() {
  // Event delegation: preview rows are re-rendered often.
  const handler = (e) => {
    const el = e.target;
    if (!el || !el.getAttribute) return;
    // GST% dropdown in preview
    if (e.type === 'change' && el.classList && el.classList.contains('doc-gst-select')) {
      const id = el.getAttribute('data-item-id');
      if (!id) return;
      const item = state.items.find(i => String(i.id) === String(id));
      if (!item) return;
      const n = parseFloat(String(el.value || '').replace(/,/g, ''));
      item.gst = Number.isFinite(n) ? n : 0;
      if (typeof renderItems === 'function') renderItems();
      syncDoc();
      return;
    }
    const id = el.getAttribute('data-item-id');
    const field = el.getAttribute('data-item-field');
    if (!id || !field) return;

    // Save original on focus
    if (e.type === 'focusin') {
      el.dataset._orig = (el.innerText || el.textContent || '').trim();
      return;
    }

    if (e.type === 'keydown' && e.key === 'Enter') {
      e.preventDefault();
      el.blur();
      return;
    }

    if (e.type === 'focusout') {
      const orig = (el.dataset._orig || '').trim();
      const cur  = ((el.innerText || el.textContent || '') + '').trim();
      if (cur === orig) return;

      const item = state.items.find(i => String(i.id) === String(id));
      if (!item) return;

      const setVal = (k, v) => { item[k] = v; };

      if (field === 'qty' || field === 'rate' || field === 'gst' || field === 'disc') {
        const n = parseFloat(cur.replace(/,/g, ''));
        const valNum = Number.isFinite(n) ? n : 0;
        // Rate should be stored at max 2 decimals.
        if (field === 'rate') {
          setVal(field, Math.round(valNum * 100) / 100);
        } else {
          setVal(field, valNum);
        }
      } else {
        setVal(field, cur);
      }

      // Keep sidebar + preview in sync
      if (typeof renderItems === 'function') renderItems();
      syncDoc();
    }
  };

  document.addEventListener('focusin', handler, true);
  document.addEventListener('focusout', handler, true);
  document.addEventListener('keydown', handler, true);
  document.addEventListener('change', handler, true);
}

let _clientGstinPickerEl = null;
function closeClientGstinPicker() {
  if (_clientGstinPickerEl && _clientGstinPickerEl.parentNode) _clientGstinPickerEl.parentNode.removeChild(_clientGstinPickerEl);
  _clientGstinPickerEl = null;
}

function openClientGstinPicker(e) {
  if (e) e.stopPropagation();
  closeClientGstinPicker();

  const anchor = document.getElementById('docClientGstin');
  const gstEl  = document.getElementById('clientGstin');
  const naEl   = document.getElementById('clientGstinNA');
  if (!anchor || !gstEl || !naEl) return;

  const rect = anchor.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'client-picker-pop';
  pop.style.width = '360px';
  pop.innerHTML = `
    <div class="client-picker-head">
      <div class="client-picker-title">Client GST</div>
      <button class="client-picker-close" type="button" aria-label="Close">✕</button>
    </div>
    <div class="client-picker-body">
      <div style="display:flex;gap:8px;align-items:center">
        <input id="gstPickerInput" placeholder="GSTIN (15 chars) e.g. 27AAAAA0000A1Z5" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:#0b0d12;color:#e9ecf5;font-size:12px;outline:none" />
        <button type="button" id="gstSkip" class="btn btn-ghost" style="font-size:11px;padding:6px 10px">Skip</button>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin-top:10px;color:#c9cfdb;font-size:12px;cursor:pointer">
        <input type="checkbox" id="gstUnreg" style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer" />
        Unregistered person (no GSTIN)
      </label>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <button type="button" id="gstCancel" class="btn btn-ghost" style="font-size:11px;padding:6px 10px">Cancel</button>
        <button type="button" id="gstSave" class="btn btn-primary" style="font-size:11px;padding:6px 10px">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(pop);
  _clientGstinPickerEl = pop;

  // Position near anchor
  const margin = 8;
  let left = rect.left;
  let top = rect.bottom + margin;
  left = Math.min(left, window.innerWidth - pop.offsetWidth - 12);
  left = Math.max(12, left);
  if (top + pop.offsetHeight > window.innerHeight - 12) top = rect.top - pop.offsetHeight - margin;
  top = Math.max(12, Math.min(top, window.innerHeight - pop.offsetHeight - 12));
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';

  const $ = (sel) => pop.querySelector(sel);
  const closeBtn = $('.client-picker-close');
  if (closeBtn) closeBtn.addEventListener('click', closeClientGstinPicker);
  const cancelBtn = $('#gstCancel');
  if (cancelBtn) cancelBtn.addEventListener('click', closeClientGstinPicker);

  const input = $('#gstPickerInput');
  const unreg = $('#gstUnreg');
  if (input) input.value = (gstEl.value || '').toUpperCase();
  if (unreg) unreg.checked = !!(naEl.checked && !gstEl.value);

  if (unreg) unreg.addEventListener('change', () => {
    if (unreg.checked) {
      if (input) input.value = '';
    }
  });

  const skipBtn = $('#gstSkip');
  if (skipBtn) skipBtn.addEventListener('click', () => { closeClientGstinPicker(); });

  const saveBtn = $('#gstSave');
  if (saveBtn) saveBtn.addEventListener('click', () => {
    const v = (input ? input.value : '').trim().toUpperCase();
    const isUnreg = !!(unreg && unreg.checked);
    if (isUnreg) {
      gstEl.value = '';
      naEl.checked = true;
      _toggleGstinNA('clientGstin', 'clientGstinNA');
    } else {
      naEl.checked = false;
      _toggleGstinNA('clientGstin', 'clientGstinNA');
      gstEl.value = v;
      _gstinFeedback('clientGstin');
    }
    autoDetectGstType();
    syncDoc();

    // If new client (unsaved), ask to save to DB after GST set/unregistered.
    if (!state.activeClientId && DM.isLoggedIn && DM.isLoggedIn() && state.activeCompanyId) {
      askYesNo('Save this client to database?').then(yes => { if (yes) saveClientToDb(); });
    }
    closeClientGstinPicker();
  });

  setTimeout(() => {
    window.addEventListener('mousedown', _clientGstinPickerOutsideClick, { capture: true });
    if (input) input.focus();
  }, 0);
}

function _clientGstinPickerOutsideClick(ev) {
  if (!_clientGstinPickerEl) return;
  if (_clientGstinPickerEl.contains(ev.target)) return;
  window.removeEventListener('mousedown', _clientGstinPickerOutsideClick, { capture: true });
  closeClientGstinPicker();
}

function openContactPicker(e) {
  if (e) e.stopPropagation();
  closeContactPicker();

  const anchor = (e && (e.currentTarget || e.target) && (e.currentTarget || e.target).getBoundingClientRect)
    ? (e.currentTarget || e.target)
    : document.getElementById('docClientContact');
  if (!anchor) return;

  const contacts = Array.isArray(state.contacts) ? state.contacts : [];
  // If no contacts yet, still show picker with "Add new contact"

  const rect = anchor.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'client-picker-pop';
  pop.innerHTML = `
    <div class="client-picker-head">
      <div class="client-picker-title">Select contact person</div>
      <button class="client-picker-close" type="button" aria-label="Close">✕</button>
    </div>
    <div class="client-picker-body">
      <div class="client-picker-contacts" id="contactPickerList"></div>
    </div>
  `;

  document.body.appendChild(pop);
  _contactPickerEl = pop;

  // Position near anchor
  const margin = 8;
  let left = rect.left;
  let top = rect.bottom + margin;
  left = Math.min(left, window.innerWidth - pop.offsetWidth - 12);
  left = Math.max(12, left);
  if (top + pop.offsetHeight > window.innerHeight - 12) {
    top = rect.top - pop.offsetHeight - margin;
  }
  top = Math.max(12, Math.min(top, window.innerHeight - pop.offsetHeight - 12));
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';

  const closeBtn = pop.querySelector('.client-picker-close');
  if (closeBtn) closeBtn.addEventListener('click', closeContactPicker);

  const list = pop.querySelector('#contactPickerList');
  if (list) {
    list.innerHTML = [
      `<div class="client-picker-contact" data-idx="-1">Use all contacts</div>`,
      ...(contacts.length ? contacts.map((ct, idx) => {
        const label = [ct.salutation, ct.name, ct.designation].filter(Boolean).join(' ').trim();
        const meta = [ct.phone, ct.email].filter(Boolean).join(' · ');
        return `<div class="client-picker-contact" data-idx="${idx}">
          <div style="font-weight:650">${escHtml(label || ('Contact ' + (idx+1)))}</div>
          ${meta ? `<div style="color:#9aa3b2;font-size:11px;margin-top:2px">${escHtml(meta)}</div>` : ''}
        </div>`;
      }) : []),
      `<div class="client-picker-contact" data-idx="-999" style="border-style:dashed">+ Add new contact…</div>`
    ].join('');

    Array.from(list.querySelectorAll('.client-picker-contact')).forEach(el2 => {
      el2.addEventListener('click', () => {
        const idx = parseInt(el2.getAttribute('data-idx') || '-1', 10);
        if (!Number.isFinite(idx)) return;
        if (idx === -999) {
          closeContactPicker();
          openAddContactModal();
          return;
        }
        // Selecting a contact should NOT delete other saved contacts.
        // We only mark which contact is "active" for display.
        if (idx < 0) {
          state.activeContactId = null;
        } else {
          state.activeContactId = contacts[idx]?.id || null;
        }
        syncDoc();
        closeContactPicker();
      });
    });
  }

  // Close when clicking outside
  setTimeout(() => {
    window.addEventListener('mousedown', _contactPickerOutsideClick, { capture: true });
  }, 0);
}

function _contactPickerOutsideClick(ev) {
  if (!_contactPickerEl) return;
  if (_contactPickerEl.contains(ev.target)) return;
  window.removeEventListener('mousedown', _contactPickerOutsideClick, { capture: true });
  closeContactPicker();
}

function openAddContactModal() {
  const name = (document.getElementById('clientName') || {}).value || '';
  if (!name.trim()) {
    showNotification('Enter client name first', 'error');
    return;
  }
  // Build a lightweight in-app modal with Skip buttons.
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.62);display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(2px)';
  overlay.innerHTML = `
    <div style="width:420px;max-width:calc(100vw - 24px);background:#0f1117;border:1px solid rgba(255,255,255,0.10);border-radius:12px;box-shadow:0 18px 70px rgba(0,0,0,0.55);overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.08)">
        <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;letter-spacing:0.8px;font-size:12px;color:#e9ecf5;text-transform:uppercase">Add contact</div>
        <button type="button" id="acClose" style="background:transparent;border:none;color:#9aa3b2;cursor:pointer;padding:4px 6px">✕</button>
      </div>
      <div style="padding:12px 14px;display:flex;flex-direction:column;gap:10px">
        <div style="display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:center">
          <div style="color:#9aa3b2;font-size:12px">Salutation</div>
          <div style="display:flex;gap:8px;align-items:center">
            <select id="acSal" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.10);background:#0b0d12;color:#e9ecf5;font-size:12px;outline:none">
              <option value="">—</option>
              <option>Mr.</option><option>Ms.</option><option>Mrs.</option><option>Dr.</option><option>Er.</option><option>M/s</option>
            </select>
            <button type="button" id="acSkipSal" style="padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.10);background:transparent;color:#9aa3b2;cursor:pointer;font-size:12px">Skip</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:center">
          <div style="color:#9aa3b2;font-size:12px">Name *</div>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="acName" placeholder="Contact person name" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.10);background:#0b0d12;color:#e9ecf5;font-size:12px;outline:none" />
            <button type="button" id="acSkipAll" style="padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.10);background:transparent;color:#9aa3b2;cursor:pointer;font-size:12px">Skip</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:center">
          <div style="color:#9aa3b2;font-size:12px">Designation</div>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="acDes" placeholder="(optional)" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.10);background:#0b0d12;color:#e9ecf5;font-size:12px;outline:none" />
            <button type="button" id="acSkipDes" style="padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.10);background:transparent;color:#9aa3b2;cursor:pointer;font-size:12px">Skip</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:center">
          <div style="color:#9aa3b2;font-size:12px">Phone</div>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="acPhone" placeholder="(optional)" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.10);background:#0b0d12;color:#e9ecf5;font-size:12px;outline:none" />
            <button type="button" id="acSkipPhone" style="padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.10);background:transparent;color:#9aa3b2;cursor:pointer;font-size:12px">Skip</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:center">
          <div style="color:#9aa3b2;font-size:12px">Email</div>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="acEmail" placeholder="(optional)" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.10);background:#0b0d12;color:#e9ecf5;font-size:12px;outline:none" />
            <button type="button" id="acSkipEmail" style="padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.10);background:transparent;color:#9aa3b2;cursor:pointer;font-size:12px">Skip</button>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 14px;border-top:1px solid rgba(255,255,255,0.08)">
        <button type="button" id="acCancel" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.10);background:transparent;color:#c9cfdb;cursor:pointer;font-size:12px">Cancel</button>
        <button type="button" id="acSave" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(200,23,30,0.35);background:rgba(200,23,30,0.10);color:#ffd7d9;cursor:pointer;font-size:12px;font-weight:700">Save Contact</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const $ = (id) => overlay.querySelector('#' + id);
  const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  ['acClose','acCancel','acSkipAll'].forEach(id => { const b = $(id); if (b) b.addEventListener('click', close); });
  const setEmpty = (id) => { const el = $(id); if (el) el.value = ''; };
  const mapSkip = { acSkipSal:'acSal', acSkipDes:'acDes', acSkipPhone:'acPhone', acSkipEmail:'acEmail' };
  Object.keys(mapSkip).forEach(btnId => { const b = $(btnId); if (b) b.addEventListener('click', () => setEmpty(mapSkip[btnId])); });

  const nameEl = $('acName');
  if (nameEl) setTimeout(() => nameEl.focus(), 0);

  const saveBtn = $('acSave');
  if (saveBtn) saveBtn.addEventListener('click', () => {
    const cn = (nameEl?.value || '').trim();
    if (!cn) { showNotification('Contact name is required', 'error'); return; }
    const contact = {
      id: Date.now() + Math.random(),
      salutation: ($('acSal')?.value || '').trim(),
      name: cn,
      designation: ($('acDes')?.value || '').trim(),
      phone: ($('acPhone')?.value || '').trim(),
      email: ($('acEmail')?.value || '').trim(),
    };
    state.contacts = Array.isArray(state.contacts) ? state.contacts : [];
    state.contacts.push(contact);
    renderContacts();
    syncDoc();
    close();

    // Ask to save ONLY when logged in (avoid prompting on login screen).
    if (!state.activeClientId && DM && typeof DM.isLoggedIn === 'function' && DM.isLoggedIn() && state.activeCompanyId) {
      askYesNo('Save this client to database?').then(yes => { if (yes) saveClientToDb(); });
    }
  });
}

function askYesNo(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.62);display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(2px)';
    overlay.innerHTML = `
      <div style="width:420px;max-width:calc(100vw - 24px);background:#0f1117;border:1px solid rgba(255,255,255,0.10);border-radius:12px;box-shadow:0 18px 70px rgba(0,0,0,0.55);overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.08)">
          <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;letter-spacing:0.8px;font-size:12px;color:#e9ecf5;text-transform:uppercase">Confirm</div>
          <button type="button" id="ynClose" style="background:transparent;border:none;color:#9aa3b2;cursor:pointer;padding:4px 6px">✕</button>
        </div>
        <div style="padding:14px;color:#e9ecf5;font-size:13px;line-height:1.5">${escHtml(message)}</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;padding:12px 14px;border-top:1px solid rgba(255,255,255,0.08)">
          <button type="button" id="ynNo" class="btn btn-ghost" style="font-size:12px;padding:7px 12px">NO</button>
          <button type="button" id="ynYes" class="btn btn-primary" style="font-size:12px;padding:7px 12px">YES</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const cleanup = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    const finish = (val) => { cleanup(); resolve(val); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(false); });
    overlay.querySelector('#ynClose')?.addEventListener('click', () => finish(false));
    overlay.querySelector('#ynNo')?.addEventListener('click', () => finish(false));
    overlay.querySelector('#ynYes')?.addEventListener('click', () => finish(true));
  });
}

function initPreviewInlineEditing() {
  const editable = document.querySelectorAll('[data-edit-input][data-edit-mode]');
  if (!editable || !editable.length) return;

  editable.forEach(el => {
    const inputId = el.getAttribute('data-edit-input');
    const mode    = el.getAttribute('data-edit-mode') || 'single';
    const inputEl = () => document.getElementById(inputId);

    el.addEventListener('focus', () => {
      const inp = inputEl();
      el.dataset._origText = (el.innerText || el.textContent || '').trim();
      if (inp) el.dataset._origVal = String(inp.value || '');
    });

    el.addEventListener('keydown', (e) => {
      // Keep "single" editable fields single-line by converting Enter -> blur.
      if (mode === 'single' && e.key === 'Enter') {
        e.preventDefault();
        el.blur();
      }
      // For client name: open saved-client picker only on deliberate gesture.
      if (inputId === 'clientName' && (e.key === 'F4' || (e.key === 'ArrowDown' && e.altKey))) {
        e.preventDefault();
        try { openClientPicker({ stopPropagation(){} }); } catch {}
      }
    });

    el.addEventListener('blur', () => {
      const inp = inputEl();
      if (!inp) return;

      const curText = (el.innerText || el.textContent || '').replace(/\u00A0/g, ' ').trim();
      const origText = (el.dataset._origText || '').replace(/\u00A0/g, ' ').trim();
      const origVal  = (el.dataset._origVal || '');

      // If user only clicked (no change), do nothing.
      if (curText === origText) return;

      let txt = curText;
      if (txt === '—') txt = '';
      if (mode === 'single') {
        // Collapse whitespace/newlines to a single space
        txt = txt.replace(/\s+/g, ' ');

        // Undo common placeholder so we don't save it into inputs.
        if ((inputId === 'companyName' || inputId === 'footerLeft') && txt === 'YOUR COMPANY') txt = '';

        // Preview includes "Ref: ..." prefix
        if (inputId === 'refNo') txt = txt.replace(/^Ref:\s*/i, '');

        // Preview includes "Place of Supply: ..." prefix
        if (inputId === 'placeOfSupply') txt = txt.replace(/^Place of Supply:\s*/i, '');

        // Preview includes "Date: ..." prefix (input expects ISO yyyy-mm-dd)
        if (inputId === 'docDate') {
          txt = txt.replace(/^(Date|Due|Valid Until)\s*:\s*/i, '').trim();
          const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (iso) {
            txt = `${iso[1]}-${iso[2]}-${iso[3]}`;
          } else {
            const m = txt.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
            if (m) {
              const dd = String(m[1]).padStart(2, '0');
              const mm = String(m[2]).padStart(2, '0');
              const yyyy = m[3];
              txt = `${yyyy}-${mm}-${dd}`;
            } else {
              // Handles "31 Mar 2026" (formatDate output)
              const d = new Date(txt);
              if (!Number.isNaN(d.getTime())) {
                txt = d.toISOString().slice(0, 10);
              }
            }
          }
        }
      }

      // If date couldn't be parsed into ISO, keep previous valid value.
      if (inputId === 'docDate' && txt && !/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
        inp.value = origVal;
        syncDoc();
        return;
      }

      inp.value = txt;
      // Re-render preview from the canonical input values.
      syncDoc();

      // If user typed a new client name manually, treat as a new client:
      // clear contacts + GST so they can enter fresh details.
      if (inputId === 'clientName') {
        state.activeClientId = null;
        state.contacts = [];
        if (typeof renderContacts === 'function') renderContacts();
        const gstEl = document.getElementById('clientGstin');
        const naEl  = document.getElementById('clientGstinNA');
        if (gstEl) gstEl.value = '';
        if (naEl) { naEl.checked = false; _toggleGstinNA('clientGstin','clientGstinNA'); }
        autoDetectGstType();
        syncDoc();
      }
    });
  });
}

// Enable double-click on client name to open saved-client picker
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('docClientName');
  if (el) {
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { openClientPicker(e); } catch {}
    });
  }
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('docDate').value = today;

  // Default valid until (30 days)
  const valid = new Date();
  valid.setDate(valid.getDate() + 30);
  document.getElementById('validUntil').value = valid.toISOString().split('T')[0];

  // Default ref number
  document.getElementById('refNo').value = _defaultRef(state.docType || 'quotation');

  // Default terms
  document.getElementById('terms').value = '1. Prices are subject to change without prior notice.\n2. Delivery timeline mentioned is approximate and subject to order confirmation.\n3. Goods once sold will not be accepted back.\n4. Disputes subject to local jurisdiction only.\n5. E. & O.E.';

  // Add 3 default items
  addItem(); addItem(); addItem();

  // Add 1 default contact
  addContact();

  // Load defaults first (company/bank/design), then session save
  loadDefaults();
  loadState();
  applyTemplate(state.template || 'classic', false);
  // Always reset tax type to Auto on fresh load
  const gstTypeEl = document.getElementById('gstType');
  if (gstTypeEl) gstTypeEl.value = 'auto';
  applyColors();
  applyGstSlabs();
  syncWatermark();
  syncTaglineSpacing();
  autoDetectGstType();
  syncDoc();
  setTimeout(scaleDocument, 300);

  // Enable preview inline editing + hide left panel on desktop
  initPreviewInlineEditing();
  initPreviewItemEditing();
  initSettingsToggle();
  initSidebarResize();

  DM.init().then(() => {
    _restoreActiveCompanyProfile();
    renderCoProfileList();
  });
});

function initSidebarResize() {
  const sidebar = document.querySelector('.sidebar');
  const grip = document.querySelector('.sidebar-resizer');
  if (!sidebar || !grip) return;

  // Restore last width
  try {
    const w = parseInt(localStorage.getItem('qg.sidebarWidthPx') || '', 10);
    if (Number.isFinite(w) && w >= 420 && w <= 820) {
      document.documentElement.style.setProperty('--sidebar-w', w + 'px');
    }
  } catch {}

  let startX = 0;
  let startW = 0;
  const onMove = (ev) => {
    const x = (ev.touches && ev.touches[0]) ? ev.touches[0].clientX : ev.clientX;
    const dx = startX - x; // sidebar is on right: drag left => wider
    let next = Math.round(startW + dx);
    next = Math.max(420, Math.min(820, next));
    document.documentElement.style.setProperty('--sidebar-w', next + 'px');
  };
  const onUp = () => {
    document.body.classList.remove('resizing');
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('mouseup', onUp, true);
    window.removeEventListener('touchmove', onMove, true);
    window.removeEventListener('touchend', onUp, true);
    try {
      const cur = getComputedStyle(sidebar).width;
      const w = parseInt(cur, 10);
      if (Number.isFinite(w)) localStorage.setItem('qg.sidebarWidthPx', String(w));
    } catch {}
  };

  const onDown = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const x = (ev.touches && ev.touches[0]) ? ev.touches[0].clientX : ev.clientX;
    startX = x;
    startW = parseInt(getComputedStyle(sidebar).width, 10) || 560;
    document.body.classList.add('resizing');
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    window.addEventListener('touchmove', onMove, true);
    window.addEventListener('touchend', onUp, true);
  };

  grip.addEventListener('mousedown', onDown, true);
  grip.addEventListener('touchstart', onDown, { capture: true, passive: false });
}

async function _restoreActiveCompanyProfile() {
  // Handled inside DM._onLogin — this is a no-op stub kept for compatibility
}

// ===== PANELS =====
// ===== QUOTATIONS =====
/** Must match default in DB trigger + company_quotation_limits; change DB when monetizing.
 *  Red overflow gradient: starts when count > (limit − 3); newest (limit − 3) rows stay clear (min 1). */
const SAVED_PER_DOC_TYPE_LIMIT = 10;

const _DOCTYPE_LABELS = {
  quotation:        'Quotations',
  proforma:         'Proforma Invoices',
  invoice:          'Tax Invoices',
  po:               'Purchase Orders',
  delivery_challan: 'Delivery Challans',
};

async function renderQuotationsList() {
  const list = document.getElementById('quotList');
  if (!list) return;
  if (DM.refreshQuotations) DM.refreshQuotations();
  const dt  = state.docType || 'quotation';
  const hdr = document.querySelector('#panel-quotations .quot-toolbar span');
  if (hdr) hdr.textContent = 'SAVED ' + (_DOCTYPE_LABELS[dt] || 'DOCUMENTS').toUpperCase();
  const all = await DM.getQuotations();
  // Filter to current doc type — DB now fetches all types so old docs are never lost
  state._allQuotations = all.filter(q => (q.docType || 'quotation') === dt);
  _renderQuotRows(state._allQuotations);
  _updateQuotSaveBtn();
}

// ── Document conversion ──
const CONVERSION_CHAIN = {
  quotation:        ['proforma', 'invoice', 'delivery_challan'],
  proforma:         ['invoice', 'delivery_challan'],
  invoice:          ['delivery_challan'],
  po:               ['delivery_challan'],
  delivery_challan: [],
};
const CONVERT_LABELS = {
  proforma:         'Proforma Invoice',
  invoice:          'Tax Invoice',
  delivery_challan: 'Delivery Challan',
};

async function convertDocument(fromId, toDocType) {
  document.querySelectorAll('.quot-convert-menu').forEach(m => m.style.display = 'none');
  showNotification('Converting…', 'info');
  const snap = await DM.loadQuotation(fromId);
  if (!snap) { showNotification('Could not load source document', 'error'); return; }
  let existingConv = [];
  try { existingConv = await DM.getQuotations(); } catch(e) { existingConv = []; }
  const countTarget = existingConv.filter(q => (q.docType || 'quotation') === toDocType).length;
  if (countTarget >= SAVED_PER_DOC_TYPE_LIMIT) {
    showNotification('Limit reached: up to ' + SAVED_PER_DOC_TYPE_LIMIT + ' saved ' + (toDocType || 'documents') + ' for this company. Delete one to convert.', 'error');
    return;
  }
  const newSnap   = JSON.parse(JSON.stringify(snap));
  newSnap.docType = toDocType;
  newSnap.savedAt = new Date().toISOString();
  const oldPrefix = DOC_REF_PREFIXES[snap.docType] || 'QT';
  const newPrefix = DOC_REF_PREFIXES[toDocType]    || 'DC';
  const oldRef    = newSnap.refNo || '';
  newSnap.refNo   = oldRef.startsWith(oldPrefix + '/')
    ? newPrefix + oldRef.slice(oldPrefix.length)
    : newPrefix + '/' + new Date().getFullYear() + '/001';
  if (newSnap.fields) {
    if (newSnap.fields.refNo   !== undefined) newSnap.fields.refNo   = newSnap.refNo;
    if (newSnap.fields.docType !== undefined) newSnap.fields.docType = toDocType;
    if (toDocType === 'po') newSnap.fields.showProductImages = false;
  }
  const newId = await DM.saveQuotation(newSnap);
  if (!newId) return;
  showNotification('Converted → ' + (DOC_LABELS[toDocType] || toDocType), 'ok');
  await openQuotation(newId);
}

function toggleConvertMenu(id) {
  // Close all other open menus
  document.querySelectorAll('.quot-convert-menu').forEach(m => {
    if (m.id !== 'convert-menu-' + id) m.style.display = 'none';
  });
  const menu = document.getElementById('convert-menu-' + id);
  if (!menu) return;
  if (menu.style.display !== 'none') { menu.style.display = 'none'; return; }

  // Position using fixed coords so it escapes overflow:hidden/auto containers
  const btn  = menu.closest('.quot-convert-wrap').querySelector('.quot-convert-btn');
  const rect = btn.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top      = (rect.bottom + 4) + 'px';
  menu.style.left     = rect.left + 'px';
  menu.style.display  = '';

  // Close on outside click
  setTimeout(() => {
    const close = e => {
      if (!e.target.closest('.quot-convert-wrap')) {
        document.querySelectorAll('.quot-convert-menu').forEach(m => m.style.display = 'none');
      }
      document.removeEventListener('click', close);
    };
    document.addEventListener('click', close);
  }, 0);
}

/**
 * List order is newest-first (index 0 = newest). Newest `clearCount` rows stay untinted,
 * where clearCount = max(1, limit − 3). When n > clearCount, rows [clearCount..] get red gradient:
 * --quot-of 0 = light (newest tinted) → 1 = strong (oldest).
 */
function _quotationOverflowTintMeta(fullForType) {
  const full = fullForType || [];
  const limit = SAVED_PER_DOC_TYPE_LIMIT;
  const clearCount = Math.max(1, limit - 3);
  const idToIdx = {};
  full.forEach((row, i) => {
    if (row.id != null) idToIdx[String(row.id)] = i;
  });
  const n = full.length;
  const overflow = n > clearCount ? n - clearCount : 0;
  return { idToIdx, limit, clearCount, overflow };
}

function _renderQuotRows(quots) {
  const list = document.getElementById('quotList');
  if (!list) return;
  const full = state._allQuotations || [];
  const { idToIdx, clearCount, overflow } = _quotationOverflowTintMeta(full);
  if (!quots.length) {
    list.innerHTML = `<div class="quot-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      No saved quotations yet.<br>Build a quotation and click<br><strong>Save New</strong> to archive it.
    </div>`;
    return;
  }
  list.innerHTML = quots.map(q => {
    const isActive = state.viewingLocked && state.viewingLocked.id === q.id;
    const idx = idToIdx[String(q.id)];
    let ofCls = '';
    let ofStyle = '';
    if (overflow > 0 && idx !== undefined && idx >= clearCount) {
      const j = idx - clearCount;
      const ratio = overflow === 1 ? 1 : j / (overflow - 1);
      ofCls = ' quot-overflow-tint';
      ofStyle = ` style="--quot-of:${ratio.toFixed(4)}"`;
    }
    const dateStr  = q.date ? new Date(q.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
    const hasRemark = q.remark && q.remark.trim();
    return `<div class="quot-row-wrap${hasRemark ? ' has-remark' : ''}${ofCls}"${ofStyle}>
    <div class="quot-row${isActive ? ' active-locked' : ''}" onclick="openQuotation('${q.id}')">
      <div class="quot-row-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
      <div class="quot-row-main">
        <div class="quot-row-top">
          <span class="quot-row-ref">${escHtml(q.refNo)}</span>
          <span class="quot-type-badge">${(DOC_REF_PREFIXES[q.docType || 'quotation'] || 'QT')}</span>
          <span class="quot-row-client">${escHtml(q.clientName)}</span>
          <span class="quot-row-date">${dateStr}</span>
        </div>
        <div class="quot-row-actions" onclick="event.stopPropagation()">
          <span class="quot-status-tag ${q.finalized ? 'final' : 'draft'}"
            onclick="toggleQuotFinalized('${q.id}')"
            title="Click to toggle finalized status">${q.finalized ? 'Finalized' : 'Draft'}</span>
          <button class="quot-row-update" onclick="updateQuotation('${q.id}')" title="Overwrite with current document">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
            Update
          </button>
          <button class="quot-row-del" onclick="deleteQuotation('${q.id}')" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Delete
          </button>
          <span class="quot-remark-tag${hasRemark ? ' has-remark' : ''}" onclick="openRemarkEdit('${q.id}')" title="Add / edit remark">
            ${hasRemark ? '✎ Remark' : '+ Remark'}
          </span>
          ${(CONVERSION_CHAIN[q.docType || 'quotation'] || []).length ? `
          <div class="quot-convert-wrap">
            <button class="quot-convert-btn" onclick="toggleConvertMenu('${q.id}')" title="Convert to another document type">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              Convert
            </button>
            <div class="quot-convert-menu" id="convert-menu-${q.id}" style="display:none">
              ${(CONVERSION_CHAIN[q.docType || 'quotation'] || []).map(t => `
                <button onclick="convertDocument('${q.id}','${t}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  ${CONVERT_LABELS[t] || t}
                </button>`).join('')}
            </div>
          </div>` : ''}
        </div>
      </div>
    </div>
    <div class="quot-remark-row">
      <span class="quot-remark-text" id="remark-text-${q.id}">${escHtml(q.remark || '')}</span>
      <div style="display:none;flex:1;gap:6px" id="remark-edit-${q.id}">
        <input class="quot-remark-input" id="remark-input-${q.id}" type="text"
          placeholder="Short remark… (50 words max)" value="${escHtml(q.remark || '')}"
          onclick="event.stopPropagation()"
          oninput="updateRemarkCounter('${q.id}')"
          onkeydown="if(event.key==='Enter')saveRemark('${q.id}'); if(event.key==='Escape')closeRemarkEdit('${q.id}')">
        <span class="quot-remark-counter" id="remark-counter-${q.id}">${(q.remark||'').trim().split(/\s+/).filter(Boolean).length}/50</span>
        <button class="quot-remark-btn" onclick="event.stopPropagation(); saveRemark('${q.id}')">Save</button>
        <button class="quot-remark-btn" onclick="event.stopPropagation(); closeRemarkEdit('${q.id}')">✕</button>
      </div>
    </div>
    </div>`;
  }).join('');
}

function filterQuotations() {
  const q = (document.getElementById('quotSearch')?.value || '').toLowerCase().trim();
  const all = state._allQuotations || [];
  _renderQuotRows(q ? all.filter(x =>
    (x.refNo || '').toLowerCase().includes(q) ||
    (x.clientName || '').toLowerCase().includes(q)
  ) : all);
}

function _updateQuotSaveBtn() {
  const btn   = document.getElementById('quotSaveBtn');
  const label = document.getElementById('quotSaveBtnLabel');
  if (!btn || !label) return;
  if (state.viewingLocked) {
    label.textContent = 'Update';
    btn.classList.add('is-update');
  } else {
    label.textContent = 'Save New';
    btn.classList.remove('is-update');
  }
}

async function saveCurrentQuotation() {
  try {
  if (state.viewingLocked) {
    await updateQuotation(state.viewingLocked.id);
    return;
  }
  const cid = state.activeCompanyId;
  if (!cid) { showNotification('⚠ No company profile active — go to Company tab and click Save Profile first.', 'error'); return; }

  // Collect snapshot from current state
  const clientName = document.getElementById('clientName')?.value || '—';
  const refNo      = document.getElementById('refNo')?.value      || '—';
  const docDate    = document.getElementById('docDate')?.value    || '';

  // Duplicate ref no check (within same docType)
  const dt = state.docType || 'quotation';
  let existing = [];
  try { existing = await DM.getQuotations(); } catch(e) { existing = []; }
  const dup      = existing.find(q => (q.docType || 'quotation') === dt && (q.refNo || '').trim() === (refNo || '').trim() && refNo !== '—');
  if (dup) {
    alert('⚠ Ref No "' + refNo + '" is already saved.\n\nPlease change the Ref No field to a new number, then try again.');
    return;
  }

  const countSameType = existing.filter(q => (q.docType || 'quotation') === dt).length;
  if (countSameType >= SAVED_PER_DOC_TYPE_LIMIT) {
    showNotification('Limit reached: up to ' + SAVED_PER_DOC_TYPE_LIMIT + ' saved documents per type for this company. Delete an older one to save a new one.', 'error');
    return;
  }

  const snapshot = {
    savedAt:    new Date().toISOString(),
    refNo, clientName, docDate,
    // Full state clone
    docType:    state.docType,
    colors:     JSON.parse(JSON.stringify(state.colors)),
    template:   state.template || 'classic',
    items:      JSON.parse(JSON.stringify(state.items)),
    showItemDiscount:  document.getElementById('discToggleBtn')?.classList.contains('btn-default') || false,
    showDiscountOnDoc: document.getElementById('showDiscOnDoc')?.checked || false,
    letterShowTo:      document.getElementById('letterShowTo')?.checked   || false,
    letterShowSeal:    document.getElementById('letterShowSeal')?.checked || false,
    contacts:   JSON.parse(JSON.stringify(state.contacts || [])),
    // All input field values
    fields: {}
  };

  // Capture every input/select/textarea in sidebar (skip file inputs and base64 values)
  document.querySelectorAll('.sidebar-content input, .sidebar-content select, .sidebar-content textarea').forEach(el => {
    if (!el.id) return;
    if (el.type === 'file' || el.type === 'hidden') return;
    const val = el.type === 'checkbox' ? el.checked : el.value;
    // Skip base64 data URLs - they are stored separately
    if (typeof val === 'string' && val.startsWith('data:')) return;
    if (typeof val === 'string' && val.length > 2000) return;
    snapshot.fields[el.id] = val;
  });

  const uid = await DM.saveQuotation(snapshot);
  if (uid) {
    showToast('Quotation saved and locked ✓', 'ok');
    await renderQuotationsList();
    // Auto-advance ref sequence for convenience
    try {
      const dt = state.docType || 'quotation';
      const year = new Date().getFullYear();
      const parsed = _parseRefNo(document.getElementById('refNo')?.value || '');
      const prefix = DOC_REF_PREFIXES[dt] || 'QT';
      if (parsed && parsed.prefix === prefix && parsed.year === year && Number.isFinite(parsed.seq)) {
        const k = _refSeqStorageKey(dt, year);
        const stored = parseInt(localStorage.getItem(k) || '0', 10) || 0;
        if (parsed.seq > stored) localStorage.setItem(k, String(parsed.seq));
      }
    } catch(e) {}
  } else {
    showNotification('⚠ Save failed — make sure you are signed in and have an active company profile.', 'error');
  }
  } catch(err) {
    console.error('saveCurrentQuotation error:', err);
    showNotification('⚠ Save error: ' + err.message, 'error');
  }
}


// Refresh sidebar UI elements whose .value was restored from snap.fields
// but whose visual labels / pickers / visibility weren't re-drawn.
function _refreshSidebarAfterRestore() {
  // Slider value labels
  const sliderLabels = [
    ['companyNameSize',       'companyNameSizeVal',       'px'],
    ['taglineLetterSpacing',  'taglineLetterSpacingVal',  'px'],
    ['taglineWordSpacing',    'taglineWordSpacingVal',    'px'],
    ['productImgHeight',      'productImgHeightVal',      'px'],
    ['watermarkOpacity',      'watermarkOpacityVal',      '%'],
    ['watermarkSize',         'watermarkSizeVal',         'px'],
    ['watermarkRotation',     'watermarkRotationVal',     '°'],
  ];
  sliderLabels.forEach(([inputId, labelId, unit]) => {
    const inp = document.getElementById(inputId);
    const lbl = document.getElementById(labelId);
    if (inp && lbl) lbl.textContent = inp.value + unit;
  });


  // Product image height label (not in loadState)
  const pih = document.getElementById('productImgHeight');
  const pihl = document.getElementById('productImgHeightVal');
  if (pih && pihl) pihl.textContent = pih.value + 'px';

}

async function openQuotation(uid) {
  const snap = await DM.loadQuotation(uid);
  if (!snap) { showToast('Could not load quotation.', 'warn'); return; }

  // Restore state
  if (snap.docType) { state.docType = snap.docType; const sel = document.getElementById('docTypeSelect'); if (sel) sel.value = snap.docType; _applyLetterheadMode(snap.docType === 'letterhead'); }
  if (snap.colors)  { state.colors = snap.colors;  applyColors(); }
  if (snap.template) { applyTemplate(snap.template, false); }
  if (snap.items)   { state.items  = snap.items; if (typeof renderItems === 'function') renderItems(); }
  if (snap.showItemDiscount !== undefined) {
    const _hasDiscValues = (snap.items || []).some(i => parseFloat(i.disc) > 0);
    // Old buggy snapshot: showItemDiscount=false but items have disc values
    // → both showItemDiscount and showDiscountOnDoc were saved wrong, auto-enable both
    const _oldBuggySnap  = !snap.showItemDiscount && _hasDiscValues;
    state.showItemDiscount = snap.showItemDiscount || _oldBuggySnap;
    const btn   = document.getElementById('discToggleBtn');
    const rowEl = document.getElementById('discOnDocRow');
    if (btn) {
      btn.classList.toggle('btn-default', state.showItemDiscount);
      btn.classList.toggle('btn-ghost',   !state.showItemDiscount);
    }
    if (rowEl) rowEl.style.display = state.showItemDiscount ? '' : 'none';
    // showDiscountOnDoc:
    // Old buggy snap (_oldBuggySnap=true): showDiscountOnDoc was always saved false regardless
    //   of user intent — auto-enable since disc data exists (user can Update to correct)
    // New clean snap (_oldBuggySnap=false): snap.showItemDiscount was correctly saved as true
    //   → trust snap.showDiscountOnDoc exactly
    state.showDiscountOnDoc = _oldBuggySnap
      ? state.showItemDiscount
      : (snap.showDiscountOnDoc && state.showItemDiscount);
    const chk = document.getElementById('showDiscOnDoc');
    if (chk) chk.checked = state.showDiscountOnDoc;
  } else if (snap.showDiscountOnDoc !== undefined) {
    state.showDiscountOnDoc = snap.showDiscountOnDoc && state.showItemDiscount;
    const chk = document.getElementById('showDiscOnDoc');
    if (chk) chk.checked = state.showDiscountOnDoc;
  }
  if (snap.contacts){ state.contacts = snap.contacts; if (typeof renderContacts === 'function') renderContacts(); }

  // Restore field values
  if (snap.fields) {
    Object.entries(snap.fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = val;
      else el.value = val;
    });
  }
  // Restore letterhead font-size slider labels
  [['letterFontSubject','letterFontSubjectVal'],['letterFontToName','letterFontToNameVal'],
   ['letterFontBody','letterFontBodyVal'],['letterFontSeal','letterFontSealVal']].forEach(([inp,lbl]) => {
    const i = document.getElementById(inp), l = document.getElementById(lbl);
    if (i && l) l.textContent = i.value + 'px';
  });

  // Ensure discOnDocRow visibility matches restored showItemDiscount
  const _discOnDocRow = document.getElementById('discOnDocRow');
  if (_discOnDocRow) _discOnDocRow.style.display = state.showItemDiscount ? '' : 'none';

  syncDoc();

  // Force showDiscountOnDoc state — must come AFTER syncDoc so it overrides any resets
  const _savedShowDiscOnDoc = snap.showDiscountOnDoc || false;
  state.showDiscountOnDoc = _savedShowDiscOnDoc && state.showItemDiscount;
  const _chkDisc = document.getElementById('showDiscOnDoc');
  if (_chkDisc) _chkDisc.checked = state.showDiscountOnDoc;

  // Refresh all sidebar UI that snap.fields restores by .value but doesn't visually update
  _refreshSidebarAfterRestore();

  // Allow switching between locked quotes without exiting first
  state.viewingLocked = { id: uid, refNo: snap.refNo };
  _applyLockMode(true);
  _updateQuotSaveBtn();
  await renderQuotationsList();
  showToast('Viewing: ' + (snap.refNo || uid), 'ok');

  // Final re-apply: checkPageOverflow fires at rAF+50ms (during the await above).
  // After all async settles, force correct discount state and re-run syncDoc so
  // continuation pages render with the right columns and discounted amounts.
  const _hasDisc2           = (snap.items || []).some(i => parseFloat(i.disc) > 0);
  const _oldBuggyFinal      = !snap.showItemDiscount && _hasDisc2;
  const _finalShowItemDisc  = snap.showItemDiscount || _oldBuggyFinal;
  const _finalShowDiscOnDoc = _oldBuggyFinal
    ? _finalShowItemDisc
    : ((snap.showDiscountOnDoc || false) && _finalShowItemDisc);
  state.showItemDiscount  = _finalShowItemDisc;
  state.showDiscountOnDoc = _finalShowDiscOnDoc;
  const _chkFinal = document.getElementById('showDiscOnDoc');
  if (_chkFinal) _chkFinal.checked = _finalShowDiscOnDoc;
  const _btnFinal = document.getElementById('discToggleBtn');
  if (_btnFinal) {
    _btnFinal.classList.toggle('btn-default', _finalShowItemDisc);
    _btnFinal.classList.toggle('btn-ghost',   !_finalShowItemDisc);
  }
  const _rowFinal = document.getElementById('discOnDocRow');
  if (_rowFinal) _rowFinal.style.display = _finalShowItemDisc ? '' : 'none';
  // Re-apply letterhead mode after all async operations settle
  _applyLetterheadMode(state.docType === 'letterhead');
  syncDoc();
}

async function deleteQuotation(uid) {
  if (!confirm('Delete this saved quotation? This cannot be undone.')) return;
  if (state.viewingLocked && state.viewingLocked.id === uid) exitLockedMode();
  await DM.deleteQuotation(uid);
  await renderQuotationsList();
  showToast('Quotation deleted.', 'ok');
}

async function updateQuotation(uid) {
  if (!uid) return;
  // Find the saved entry so we can show its ref no in the confirm dialog
  const existing = await DM.getQuotations();
  const entry    = existing.find(q => q.id === uid);
  const label    = entry ? `"${entry.refNo}" (${entry.clientName})` : 'this quotation';
  if (!confirm(`Overwrite ${label} with the current document?\n\nThis cannot be undone.`)) return;
  const cid = state.activeCompanyId;
  if (!cid) { showToast('No company profile active.', 'warn'); return; }
  const clientName = document.getElementById('clientName')?.value || '—';
  const refNo      = document.getElementById('refNo')?.value      || '—';
  const docDate    = document.getElementById('docDate')?.value    || '';
  const snapshot = {
    id: uid, savedAt: new Date().toISOString(),
    refNo, clientName, docDate,
    docType:           state.docType,
    colors:            JSON.parse(JSON.stringify(state.colors)),
    template:          state.template || 'classic',
    items:             JSON.parse(JSON.stringify(state.items)),
    showItemDiscount:  document.getElementById('discToggleBtn')?.classList.contains('btn-default') || false,
    showDiscountOnDoc: document.getElementById('showDiscOnDoc')?.checked || false,
    letterShowTo:      document.getElementById('letterShowTo')?.checked   || false,
    letterShowSeal:    document.getElementById('letterShowSeal')?.checked || false,
    contacts:          JSON.parse(JSON.stringify(state.contacts || [])),
    fields:            {}
  };
  document.querySelectorAll('.sidebar-content input, .sidebar-content select, .sidebar-content textarea').forEach(el => {
    if (el.id) snapshot.fields[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  await DM.updateQuotation(uid, snapshot);
  if (state.viewingLocked && state.viewingLocked.id === uid) state.viewingLocked.refNo = refNo;
  showToast('Quotation updated ✓', 'ok');
  await renderQuotationsList();
}

function _wordCount(str) {
  return (str || '').trim().split(/\s+/).filter(Boolean).length;
}

function updateRemarkCounter(uid) {
  const input   = document.querySelector(`#remark-input-${uid}`);
  const counter = document.querySelector(`#remark-counter-${uid}`);
  if (!input || !counter) return;
  const wc = _wordCount(input.value);
  counter.textContent = `${wc}/50`;
  counter.classList.toggle('over', wc > 50);
}

function openRemarkEdit(uid) {
  const wrap  = document.querySelector(`#remark-edit-${uid}`);
  const text  = document.querySelector(`#remark-text-${uid}`);
  const input = document.querySelector(`#remark-input-${uid}`);
  const row   = wrap?.closest('.quot-row-wrap');
  if (!wrap) return;
  text.style.display  = 'none';
  wrap.style.display  = 'flex';
  if (row) row.classList.add('editing-remark');
  updateRemarkCounter(uid);
  input?.focus();
  input?.select();
}

function closeRemarkEdit(uid) {
  const wrap = document.querySelector(`#remark-edit-${uid}`);
  const text = document.querySelector(`#remark-text-${uid}`);
  const row  = wrap?.closest('.quot-row-wrap');
  if (!wrap) return;
  wrap.style.display = 'none';
  text.style.display = '';
  if (row) row.classList.remove('editing-remark');
}

async function saveRemark(uid) {
  const input = document.querySelector(`#remark-input-${uid}`);
  if (!input) return;
  const remark = input.value.trim();
  if (_wordCount(remark) > 50) {
    showToast('Remark exceeds 50 words — please shorten it.', 'warn');
    return;
  }
  const cid = state.activeCompanyId;
  if (!cid) return;
  const idx   = await DM.getQuotations();
  const entry = idx.find(q => q.id === uid);
  if (!entry) return;
  entry.remark = remark;
  await DM._writeQuotIndex(cid, idx);
  renderQuotationsList();
  showToast(remark ? 'Remark saved ✓' : 'Remark removed', 'ok');
}

async function toggleQuotFinalized(uid) {
  const cid = state.activeCompanyId;
  if (!cid) return;
  const idx = await DM.getQuotations();
  const entry = idx.find(q => q.id === uid);
  if (!entry) return;
  entry.finalized = !entry.finalized;
  await DM._writeQuotIndex(cid, idx);
  renderQuotationsList();
  showToast(entry.finalized ? 'Marked as Finalized ✓' : 'Marked as Draft', 'ok');
}

async function exitLockedMode() {
  state.viewingLocked = null;
  _applyLockMode(false);
  const sq = document.getElementById('quotSearch');
  if (sq) sq.value = '';
  await renderQuotationsList();
}

function _applyLockMode(locked) {
  const sc     = document.getElementById('sidebarContent');
  const banner = document.getElementById('lockBanner');
  if (sc)     sc.classList.toggle('locked', locked);
  if (banner) banner.classList.toggle('visible', locked);
}


function showPanel(name) {
  document.querySelectorAll('.panel-section').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.snav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'client'      && typeof renderClientDb       === 'function') renderClientDb();
  if (name === 'quotations'  && typeof renderQuotationsList === 'function') renderQuotationsList();
}
window.showPanel = showPanel;

// ── Due Date / Due Days sync ──
function onValidUntilChange() {
  state._validUntilTouched = true;

  // Never allow Valid Until earlier than doc date
  const docDateEl2 = document.getElementById('docDate');
  const validEl2   = document.getElementById('validUntil');
  if (docDateEl2 && validEl2 && docDateEl2.value && validEl2.value && validEl2.value < docDateEl2.value) {
    validEl2.value = docDateEl2.value;
  }

  // When user picks a due date, compute how many days from invoice date
  const docDateEl = document.getElementById('docDate');
  const validEl   = document.getElementById('validUntil');
  const dueDaysEl = document.getElementById('dueDays');
  if (state.docType === 'invoice' && docDateEl && validEl && dueDaysEl) {
    const from = new Date(docDateEl.value);
    const to   = new Date(validEl.value);
    if (!isNaN(from) && !isNaN(to)) {
      const diff = Math.round((to - from) / 86400000);
      dueDaysEl.value = diff >= 0 ? diff : '';
    }
  }
  syncDoc();
}

function onDocDateChange() {
  const docDateEl = document.getElementById('docDate');
  const validEl   = document.getElementById('validUntil');
  if (docDateEl && validEl && docDateEl.value) {
    // Keep validUntil same as docDate unless user explicitly changed it.
    if (!state._validUntilTouched) validEl.value = docDateEl.value;
    // Never allow validUntil earlier than docDate
    if (validEl.value && validEl.value < docDateEl.value) validEl.value = docDateEl.value;
    // Set min so calendar can't pick past date
    validEl.min = docDateEl.value;
  }
  syncDoc();
}

function onDueDaysChange() {
  // When user types due days, compute and set the due date
  const docDateEl = document.getElementById('docDate');
  const validEl   = document.getElementById('validUntil');
  const dueDaysEl = document.getElementById('dueDays');
  if (docDateEl && validEl && dueDaysEl) {
    const days = parseInt(dueDaysEl.value);
    const from = new Date(docDateEl.value);
    if (!isNaN(days) && !isNaN(from)) {
      from.setDate(from.getDate() + days);
      validEl.value = from.toISOString().split('T')[0];
    }
  }
  syncDoc();
}

// ===== DOC TYPE =====
function setDocType(type) {
  const prevType = state.docType;
  state.docType = type;
  const sel = document.getElementById('docTypeSelect');
  if (sel) sel.value = type;
  _updateRefPrefix(type);
  // Delivery Challan has no GST — force type to none; switching away restores auto
  const gstTypeEl = document.getElementById('gstType');
  if (gstTypeEl) {
    if (type === 'delivery_challan') {
      state._prevGstType = gstTypeEl.value; // save to restore later
      gstTypeEl.value = 'none';
    } else if (state._prevGstType && gstTypeEl.value === 'none') {
      gstTypeEl.value = state._prevGstType;
      state._prevGstType = null;
    }
  }
  _applyLetterheadMode(type === 'letterhead');
  const pi = document.getElementById('showProductImages');
  if (type === 'po') {
    // PO: product images off by default; user can turn on manually (checkbox stays enabled).
    if (pi) {
      pi.checked = false;
      pi.disabled = false;
    }
    if (typeof syncProductImagesToDoc === 'function') syncProductImagesToDoc();
  } else if (prevType === 'po' && pi) {
    // Leaving PO: restore product-images toggle from saved company profile (not PO-forced off).
    pi.disabled = false;
    const cid = state.activeCompanyId;
    const p   = cid && typeof DM !== 'undefined' && DM.getCompanies
      ? DM.getCompanies().find(c => String(c.id) === String(cid))
      : null;
    const b = p ? _coerceProfileBool(p.showProductImages) : undefined;
    if (b !== undefined) pi.checked = b;
    if (typeof syncProductImagesToDoc === 'function') syncProductImagesToDoc();
  }
  syncDoc();
  renderQuotationsList();
}

function _applyLetterheadMode(isLH) {
  // Hide sidebar tabs not relevant to letterhead
  const hiddenTabs = ['items', 'taxes', 'banking'];
  hiddenTabs.forEach(tab => {
    const btn   = document.getElementById('tab-' + tab);
    const panel = document.getElementById('panel-' + tab);
    if (btn)   btn.style.display = isLH ? 'none' : '';
    if (panel && isLH && panel.classList.contains('active')) showPanel('document');
  });
  // Show/hide letterhead-specific controls in DOCUMENT tab
  const lhCtrl = document.getElementById('letterheadControls');
  if (lhCtrl) lhCtrl.style.display = isLH ? '' : 'none';
  // Hide Notes & Terms sidebar section for letterhead
  const _ntSection = document.getElementById('sidebarNotesTerms');
  if (_ntSection) _ntSection.style.display = isLH ? 'none' : '';
  // Hide document fields irrelevant to letterhead (Valid Until, Delivery, Payment Terms, Place of Supply)
  ['validUntilGroup', 'dueDaysGroup', 'deliveryPaymentRow', 'placeOfSupplyGroup'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isLH ? 'none' : '';
  });

  // Product Images footer:
  // Letterhead forces the footer hidden, but we do NOT overwrite the user's saved toggle.
  const pi = document.getElementById('showProductImages');
  if (pi) {
    pi.disabled = isLH; // makes it clear it's forced off in letterhead
    if (typeof syncProductImagesToDoc === 'function') syncProductImagesToDoc();
  }

}

// ===== COMPANY NAME SIZE =====
function updateNameSize(val) {
  document.getElementById('companyNameSizeVal').textContent = val + 'px';
  syncDoc();
}

// ===== CONTACTS =====
function addContact(data = {}) {
  const id = Date.now() + Math.random();
  const contact = { id, salutation: data.salutation || 'Mr.', name: data.name || '', designation: data.designation || '', phone: data.phone || '', email: data.email || '' };
  state.contacts.push(contact);
  renderContacts();
  syncDoc();
}

function removeContact(id) {
  state.contacts = state.contacts.filter(c => c.id !== id);
  renderContacts();
  syncDoc();
}

function renderContacts() {
  const list = document.getElementById('contactsList');
  list.innerHTML = '';
  state.contacts.forEach((c, idx) => {
    const div = document.createElement('div');
    div.className = 'contact-card';
    div.innerHTML = `
      <div class="contact-card-header">
        <span class="contact-card-label">Contact ${idx + 1}</span>
        <button class="del-row-btn" onclick="removeContact(${c.id})" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style="display:grid;grid-template-columns:72px 1fr 1fr;gap:6px;margin-bottom:6px">
        <select style="font-size:12px;padding:6px 6px" onchange="updateContact(${c.id},'salutation',this.value)">
          <option value="Mr." ${c.salutation==='Mr.'?'selected':''}>Mr.</option>
          <option value="Mrs." ${c.salutation==='Mrs.'?'selected':''}>Mrs.</option>
          <option value="Miss" ${c.salutation==='Miss'?'selected':''}>Miss</option>
          <option value="Ms." ${c.salutation==='Ms.'?'selected':''}>Ms.</option>
          <option value="Dr." ${c.salutation==='Dr.'?'selected':''}>Dr.</option>
          <option value="Prof." ${c.salutation==='Prof.'?'selected':''}>Prof.</option>
          <option value="Eng." ${c.salutation==='Eng.'?'selected':''}>Eng.</option>
        </select>
        <input type="text" value="${escHtml(c.name)}" placeholder="Full Name" oninput="updateContact(${c.id},'name',this.value)" style="font-size:12px">
        <input type="text" value="${escHtml(c.designation)}" placeholder="Designation" oninput="updateContact(${c.id},'designation',this.value)" style="font-size:12px">
      </div>
      <div class="form-row">
        <div><input type="tel" value="${escHtml(c.phone)}" placeholder="Phone" oninput="updateContact(${c.id},'phone',this.value)" style="font-size:12px"></div>
        <div><input type="email" value="${escHtml(c.email)}" placeholder="Email" oninput="updateContact(${c.id},'email',this.value)" style="font-size:12px"></div>
      </div>
    `;
    list.appendChild(div);
  });
}

function updateContact(id, field, value) {
  const c = state.contacts.find(c => c.id === id);
  if (c) { c[field] = value; syncDoc(); }
}

// ===== EXCEL TEMPLATE DOWNLOAD =====
function downloadExcelTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Description', 'Specification / HSN', 'Qty', 'Unit', 'Rate', 'GST%'],
    ['Sample Item 1', 'HSN: 8481', 1, 'Nos', 1000, 18],
    ['Sample Item 2', '', 2, 'Set', 500, 12],
    ['Sample Item 3', 'HSN: 7307', 5, 'Kg', 200, 5],
  ]);
  ws['!cols'] = [{wch:35},{wch:22},{wch:8},{wch:10},{wch:12},{wch:8}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Items');
  XLSX.writeFile(wb, 'items_template.xlsx');
  showNotification('✓ Template downloaded');
}

// ===== PARTNER LOGOS =====
function handlePartnerLogos(input) {
  const files = Array.from(input.files);
  let pending = files.length;
  files.forEach(file => {
    if (file.size > 2 * 1024 * 1024) { showNotification('File too large: ' + file.name, 'error'); pending--; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      state.partnerLogos = state.partnerLogos || [];
      state.partnerLogos.push({ id: Date.now() + Math.random(), data: e.target.result });
      pending--;
      if (pending === 0) { renderPartnerLogosSidebar(); DM.saveBrandLogos(state.partnerLogos || []); syncDoc(); }
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function removePartnerLogo(id) {
  state.partnerLogos = (state.partnerLogos || []).filter(l => l.id !== id);
  renderPartnerLogosSidebar();
  DM.saveBrandLogos(state.partnerLogos || []);
  syncDoc();
}

function renderPartnerLogosSidebar() {
  const list = document.getElementById('partnerLogosList');
  const logos = state.partnerLogos || [];
  list.innerHTML = logos.map(l => `
    <div class="partner-thumb">
      <img src="${l.data}" alt="">
      <button class="partner-thumb-del" onclick="removePartnerLogo(${l.id})" title="Remove">✕</button>
    </div>
  `).join('');
}

function setPartnerAlign(align) {
  state.partnerAlign = align;
  document.getElementById('alignCenter').classList.toggle('active-align', align === 'center');
  document.getElementById('alignRight').classList.toggle('active-align', align === 'right');
  syncPartnerLogosToDoc();
  requestAnimationFrame(() => requestAnimationFrame(checkPageOverflow));
}

function syncPartnerLogosToDoc() {
  const logos = state.partnerLogos || [];
  const section = document.getElementById('docFooterLogos');
  const inner = document.getElementById('docFooterLogosInner');
  const showChk = document.getElementById('showPartnerLogos');
  const show = showChk ? showChk.checked : true;
  if (!section || !inner) return;
  if (!show || logos.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  inner.style.justifyContent = state.partnerAlign === 'right' ? 'flex-end' : 'center';
  inner.classList.toggle('partner-logos--dense', logos.length > 8);
  inner.innerHTML = logos.map(l => `<img class="doc-partner-logo" src="${l.data}" alt="">`).join('');
}

// ===== FOOTER BG =====

async function exportPDF() {
  const btn = document.getElementById('exportPDFBtn');
  // If user is editing inside the preview, remove focus so focus ring
  // doesn't get baked into the exported canvas.
  const activeEl = document.activeElement;
  if (activeEl && typeof activeEl.blur === 'function') activeEl.blur();

  document.body.classList.add('exporting');
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Generating…`;

  let _frozen = [];
  try {
    // Freeze <select> elements that html2canvas often fails to capture
    _frozen = [];
    document.querySelectorAll('.doc-gst-select').forEach(sel => {
      try {
        const txt = sel.options && sel.selectedIndex >= 0 ? (sel.options[sel.selectedIndex].text || '') : (sel.value || '');
        const span = document.createElement('span');
        span.className = 'doc-gst-frozen';
        span.textContent = txt;
        span.style.cssText = 'font-size:11px;color:var(--doc-text);';
        sel.parentNode.insertBefore(span, sel.nextSibling);
        _frozen.push(span);
      } catch {}
    });

    const { jsPDF } = window.jspdf;
    const A4_W = 210; // mm
    const A4_H = 297; // mm
    const PX_PER_MM = 794 / A4_W; // doc page is 794px = 210mm

    // Collect all doc pages (main + annexure if present)
    const pages = Array.from(document.querySelectorAll('.preview-pane .doc-page'));

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });

    const _fitA4 = (pxW, pxH) => {
      const scaleByW = A4_W / (pxW || 1);
      let w = A4_W;
      let h = pxH * scaleByW;
      if (h > A4_H) {
        const scaleByH = A4_H / (pxH || 1);
        h = A4_H;
        w = pxW * scaleByH;
      }
      const x = (A4_W - w) / 2;
      const y = (A4_H - h) / 2;
      return { x, y, w, h };
    };

    const _base64ToU8 = (dataUrl) => {
      const s = String(dataUrl || '');
      const b64 = s.includes(',') ? s.split(',')[1] : s;
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    };


    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];

      // Capture page with html2canvas
      const canvas = await html2canvas(page, {
        scale: 2,               // 2x for crisp text
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: page.offsetWidth,
        height: page.offsetHeight,
        windowWidth: page.offsetWidth,
        windowHeight: page.offsetHeight,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const canvasH = canvas.height / 2; // account for scale:2
      const canvasW = canvas.width  / 2;

      // Convert canvas px to mm
      const imgW = A4_W;
      const imgH = (canvasH / PX_PER_MM);

      if (i > 0) pdf.addPage();

      // If page is taller than A4 (e.g. annexure with many items), tile across pages
      if (imgH <= A4_H + 2) {
        // Fits on one PDF page — top-aligned
        pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH, '', 'FAST');
      } else {
        // Tile vertically across multiple PDF pages
        const sliceH = A4_H * PX_PER_MM * 2; // slice height in canvas px (with scale:2)
        let sliceTop = 0;
        let first = true;
        while (sliceTop < canvas.height) {
          const slice = document.createElement('canvas');
          slice.width = canvas.width;
          slice.height = Math.min(sliceH, canvas.height - sliceTop);
          const ctx = slice.getContext('2d');
          ctx.drawImage(canvas, 0, sliceTop, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
          const sliceData = slice.toDataURL('image/jpeg', 0.95);
          const sliceImgH = (slice.height / 2) / PX_PER_MM;
          if (!first) pdf.addPage();
          pdf.addImage(sliceData, 'JPEG', 0, 0, imgW, sliceImgH, '', 'FAST');
          sliceTop += sliceH;
          first = false;
        }
      }
    }

    // Build filename from ref/company
    const refNo = (document.getElementById('refNo') || {}).value || '';
    const company = (document.getElementById('companyName') || {}).value || 'Document';
    const docType = (document.getElementById('docTypeLabel') || {}).textContent || 'Quote';
    const safeName = [docType, refNo || company].filter(Boolean).join('_').replace(/[^a-zA-Z0-9_\-]/g, '_');
    pdf.save(safeName + '.pdf');

  } catch (err) {
    console.error('PDF export failed:', err);
    alert('PDF export failed. Please try the Print button instead.\n\n' + err.message);
  } finally {
    // Cleanup frozen placeholders
    try { _frozen?.forEach(n => n && n.parentNode && n.parentNode.removeChild(n)); } catch {}
    document.body.classList.remove('exporting');
    btn.disabled = false;
    btn.innerHTML = origHTML;
  }
}

// ===== SAVE / LOAD =====
function saveState() {
  try {
    const fields = [
      'companyName','companyTagline','companyGstin','companyAddress','companyPhone','companyEmail','companyWebsite',
      'companyNameFont','companyNameSize',
      'clientName','clientAddress','clientGstin','shipToAddress','shipToState','buyerState','sellerState',
      'refNo','docDate','validUntil','currency','docSubject','deliveryTime','paymentTerms','placeOfSupply',
      'notes','terms','footerLeft','footerTagline','footerRight',
      'bankName','bankAccName','bankAccNo','bankAccType','bankIfsc','bankSwift','bankBranch',
      'gstType','gstRate','gstSlabs','discountPct','discountAmt','freightAmt','customTaxLabel',
      'watermarkOpacity','watermarkSize','watermarkRotation','taglineLetterSpacing','taglineWordSpacing','productImagesLabel','productImgHeight','productImgPerRow',
    ];
    const saved = {};
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) saved[id] = el.value;
    });
    const checkboxes = ['enableDiscount','enableFreight','showBankDetails','showGstin','showShipTo','showNotes','showTerms','showAmtWords','enableLogoWatermark','showProductImages','showPartnerLogos','footerBgLinkAccent'];
    checkboxes.forEach(id => {
      const el = document.getElementById(id);
      if (el) saved[id] = el.checked;
    });
    saved._contacts = state.contacts;
    // Images stored in user_images table — not in session
    saved._partnerAlign = state.partnerAlign || 'center';
    saved._docType = state.docType;
    saved._colors = state.colors;
    saved._template = state.template || 'classic';
    DM.saveSession(saved);
    showNotification('✓ Saved successfully');
  } catch (e) {
    showNotification('Could not save: ' + e.message, 'error');
  }
}

function loadState() {
  try {
    const saved = DM.getSession();
    if (!saved) return;
    // When a company profile is active, do not let session restore overwrite
    // settings that are owned by the company profile (profile should win after login).
    const _profileOwned = new Set([
      // Company
      'companyName','companyTagline','companyGstin','companyAddress','companyPhone','companyEmail','companyWebsite',
      'sellerState','showCompanyName','showTagline','companyNameFont','companyNameSize','taglineLetterSpacing','taglineWordSpacing',
      // Footer
      'footerLeft','footerTagline','footerRight',
      // Banking
      'bankName','bankAccName','bankAccNo','bankAccType','bankIfsc','bankSwift','bankBranch','showBankDetails',
      // Taxes / pricing
      'gstType','gstRate','gstSlabs','currency','customTaxLabel','enableDiscount','discountPct','discountAmt','enableFreight','freightAmt',
      // Document options
      'showGstin','showShipTo','showNotes','showTerms','showAmtWords','terms','notes',
      // Design / template
      'footerBgLinkAccent',
      // Watermark
      'enableLogoWatermark','watermarkOpacity','watermarkSize','watermarkRotation',
      // Product images footer options
      'showProductImages','showPartnerLogos','productImagesLabel','productImgHeight','productImgPerRow',
    ]);

    Object.keys(saved).forEach(id => {
      if (id.startsWith('_')) return;
      if (id === 'refNo') return;
      if (state.activeCompanyId && _profileOwned.has(id)) return;
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = saved[id];
      else el.value = saved[id];
    });
    if (saved._contacts) { state.contacts = saved._contacts; renderContacts(); }
    else if (!state.contacts.length) { addContact(); }
    if (saved._partnerLogos) { state.partnerLogos = saved._partnerLogos; renderPartnerLogosSidebar(); }
    if (saved._productImages) { state.productImages = saved._productImages; renderProductImagesSidebar(); syncProductImagesToDoc(); }
    if (saved._partnerAlign) {
      state.partnerAlign = saved._partnerAlign;
      document.getElementById('alignCenter').classList.toggle('active-align', saved._partnerAlign === 'center');
      document.getElementById('alignRight').classList.toggle('active-align', saved._partnerAlign === 'right');
    }
    if (saved._logo) {
      state.logoData = saved._logo;
      document.getElementById('logoPreview').src = saved._logo;
      document.getElementById('logoZone').classList.add('has-logo');
    }
    if (saved._docType) {
      state.docType = saved._docType;
      const selEl = document.getElementById('docTypeSelect');
      if (selEl) selEl.value = saved._docType;
    }
    // Apply letterhead mode if docType was letterhead
    _applyLetterheadMode(state.docType === 'letterhead');
    if (saved._colors) {
      state.colors = { ...state.colors, ...saved._colors };
      Object.keys(saved._colors).forEach(k => {
        const el = document.getElementById('color' + cap(k));
        if (el) el.value = saved._colors[k];
        const sw = document.getElementById('swatch' + cap(k));
        if (sw) sw.style.background = saved._colors[k];
        const hx = document.getElementById('hex' + cap(k));
        if (hx) hx.value = saved._colors[k];
      });
      applyColors();
    }
    // Sync discount state from restored checkboxes into state object
    const _discTogBtn = document.getElementById('discToggleBtn');
    if (_discTogBtn) state.showItemDiscount = _discTogBtn.classList.contains('btn-default');
    const _showDiscChk = document.getElementById('showDiscOnDoc');
    if (_showDiscChk) state.showDiscountOnDoc = _showDiscChk.checked && state.showItemDiscount;

    const ns = document.getElementById('companyNameSize');
    if (ns) document.getElementById('companyNameSizeVal').textContent = ns.value + 'px';
    const ls = document.getElementById('logoSize');
    if (ls) { const lv = document.getElementById('logoSizeVal'); if (lv) lv.textContent = ls.value + 'px'; }
    const wo = document.getElementById('watermarkOpacity');
    if (wo) document.getElementById('watermarkOpacityVal').textContent = wo.value + '%';
    const ws2 = document.getElementById('watermarkSize');
    if (ws2) document.getElementById('watermarkSizeVal').textContent = ws2.value + 'px';
    const wr = document.getElementById('watermarkRotation');
    if (wr) document.getElementById('watermarkRotationVal').textContent = wr.value + '°';
    const tls = document.getElementById('taglineLetterSpacing');
    if (tls) document.getElementById('taglineLetterSpacingVal').textContent = tls.value + 'px';
    const tws = document.getElementById('taglineWordSpacing');
    if (tws) document.getElementById('taglineWordSpacingVal').textContent = tws.value + 'px';

    if (saved._template) state.template = normalizeTemplateId(saved._template);
    const _tplSel = document.getElementById('docTemplateSelect');
    if (_tplSel) _tplSel.value = state.template || 'classic';

    // Ensure footer visibility matches restored toggle/docType
    if (typeof syncProductImagesToDoc === 'function') syncProductImagesToDoc();
    if (typeof syncPartnerLogosToDoc === 'function') syncPartnerLogosToDoc();
  } catch (e) { /* ignore */ }
}

// ===== PRODUCT IMAGES =====
function handleProductImages(input) {
  const files = Array.from(input.files);
  let pending = files.length;
  files.forEach(file => {
    if (file.size > 3 * 1024 * 1024) { showNotification('File too large: ' + file.name, 'error'); pending--; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      state.productImages = state.productImages || [];
      state.productImages.push({ id: Date.now() + Math.random(), data: e.target.result, caption: '' });
      pending--;
      if (pending === 0) { renderProductImagesSidebar(); DM.saveProductImages(state.productImages || []); syncProductImagesToDoc(); }
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function removeProductImage(id) {
  state.productImages = (state.productImages || []).filter(p => p.id !== id);
  renderProductImagesSidebar();
  DM.saveProductImages(state.productImages || []);
  syncProductImagesToDoc();
}

function updateProductImageCaption(id, caption) {
  const img = (state.productImages || []).find(p => p.id === id);
  if (img) { img.caption = caption; syncProductImagesToDoc(); }
}

function renderProductImagesSidebar() {
  const list = document.getElementById('productImagesList');
  const images = state.productImages || [];
  list.innerHTML = images.map(p => `
    <div class="product-img-thumb">
      <img src="${p.data}" alt="">
      <button class="product-img-del" onclick="removeProductImage(${p.id})" title="Remove">✕</button>
      <input class="product-img-caption-input" type="text" value="${(p.caption||'').replace(/"/g,'&quot;')}" placeholder="Caption..." oninput="updateProductImageCaption(${p.id}, this.value)">
    </div>
  `).join('');
}

function syncProductImagesToDoc() {
  const images = state.productImages || [];
  const section = document.getElementById('docProductImages');
  const grid = document.getElementById('docProductImagesGrid');
  const show = document.getElementById('showProductImages').checked;
  const label = document.getElementById('productImagesLabel').value || 'Product Images';
  const height = document.getElementById('productImgHeight').value;
  const perRow = parseInt(document.getElementById('productImgPerRow').value) || 4;

  document.getElementById('productImgHeightVal').textContent = height + 'px';
  document.getElementById('docProductImagesLabel').textContent = label;

  // Letterhead always hides product images footer (without changing user's toggle).
  if (state.docType === 'letterhead') { section.style.display = 'none'; return; }

  if (!show || images.length === 0) { section.style.display = 'none'; return; }

  // CSS grid repeat(perRow, 1fr) — works for any template width
  grid.style.gridTemplateColumns = `repeat(${perRow}, 1fr)`;
  grid.innerHTML = images.map(p => `
    <div class="doc-product-img-item">
      <div style="width:100%;height:${height}px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fafafa;border:1px solid #e0e4ef;border-radius:4px;">
        <img src="${p.data}" alt="" style="max-width:100%;max-height:${height}px;width:auto;height:auto;display:block;">
      </div>
      ${p.caption ? `<div class="doc-product-img-caption">${p.caption}</div>` : ''}
    </div>
  `).join('');
  section.style.display = '';
}

// ===== WATERMARK =====
function syncWatermark() {
  const enabled = document.getElementById('enableLogoWatermark').checked;
  const controls = document.getElementById('watermarkControls');
  controls.style.display = enabled ? '' : 'none';

  // Show/hide the no-logo warning
  const noLogoMsg = document.getElementById('watermarkNoLogoMsg');
  if (noLogoMsg) noLogoMsg.style.display = (enabled && !state.logoData) ? '' : 'none';

  const el = document.getElementById('docWatermark');
  const img = document.getElementById('docWatermarkImg');

  if (enabled && state.logoData) {
    const opacity = document.getElementById('watermarkOpacity').value;
    const size = document.getElementById('watermarkSize').value;
    const rotation = document.getElementById('watermarkRotation').value;
    document.getElementById('watermarkOpacityVal').textContent = opacity + '%';
    document.getElementById('watermarkSizeVal').textContent = size + 'px';
    document.getElementById('watermarkRotationVal').textContent = rotation + '°';
    img.src = state.logoData;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.opacity = opacity / 100;
    el.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

// ===== TAGLINE SPACING =====
function syncTaglineSpacing() {
  const ls = document.getElementById('taglineLetterSpacing').value;
  const ws = document.getElementById('taglineWordSpacing').value;
  document.getElementById('taglineLetterSpacingVal').textContent = ls + 'px';
  document.getElementById('taglineWordSpacingVal').textContent = ws + 'px';
  const el = document.getElementById('docTagline');
  if (el) {
    el.style.letterSpacing = ls + 'px';
    el.style.wordSpacing = ws + 'px';
  }
}

function handleLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showNotification('File too large. Max 2MB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    state.logoData = e.target.result;
    document.getElementById('logoPreview').src = state.logoData;
    document.getElementById('logoZone').classList.add('has-logo');
    DM.saveLogo(state.logoData);
    syncDoc();
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  state.logoData = null;
  document.getElementById('logoPreview').src = '';
  document.getElementById('logoZone').classList.remove('has-logo');
  document.getElementById('logoInput').value = '';
  DM.deleteLogo();
  syncDoc();
}

// ===== ITEMS =====
function toggleDiscountOnDoc(checked) {
  state.showDiscountOnDoc = checked;
  syncDoc();
}

function toggleItemDiscount() {
  state.showItemDiscount = !state.showItemDiscount;
  const btn   = document.getElementById('discToggleBtn');
  const rowEl = document.getElementById('discOnDocRow');
  if (btn) {
    btn.classList.toggle('btn-default', state.showItemDiscount);
    btn.classList.toggle('btn-ghost',   !state.showItemDiscount);
    btn.title = state.showItemDiscount ? 'Remove discount column' : 'Add per-item discount column';
  }
  // Show "Show on Doc" checkbox only when disc column is active
  if (rowEl) rowEl.style.display = state.showItemDiscount ? '' : 'none';
  // If disc column removed, also disable on-doc
  if (!state.showItemDiscount) {
    state.showDiscountOnDoc = false;
    const chk = document.getElementById('showDiscOnDoc');
    if (chk) chk.checked = false;
  }
  renderItems();
  syncDoc();
}

function addItem(data = {}) {
  const id = Date.now() + Math.random();
  const slabs = getGstSlabs();
  const defGst = data.gst !== undefined ? data.gst : (slabs[0] !== undefined ? slabs[0] : 0);
  const item = {
    id,
    desc: data.desc || '',
    spec: data.spec || '',
    qty:  data.qty  || 1,
    unit: data.unit || 'Nos',
    rate: data.rate || 0,
    gst:  defGst,
    disc: data.disc !== undefined ? data.disc : 0,
  };
  state.items.push(item);
  renderItems();
  syncDoc();
}

function removeItem(id) {
  state.items = state.items.filter(i => i.id !== id);
  renderItems();
  syncDoc();
}

function renderItems() {
  const tbody = document.getElementById('itemsBody');
  tbody.innerHTML = '';
  const showDisc = state.showItemDiscount;
  // Sync header visibility
  const discHdr = document.getElementById('discColHeader');
  if (discHdr) discHdr.style.display = showDisc ? '' : 'none';

  state.items.forEach((item, idx) => {
    const qty      = parseFloat(item.qty)  || 0;
    const rate     = parseFloat(item.rate) || 0;
    const discPct  = showDisc ? (parseFloat(item.disc) || 0) : 0;
    const baseAmt  = qty * rate;
    const discAmt  = baseAmt * discPct / 100;
    const amount   = baseAmt - discAmt;

    const gstSlabsForRow = getGstSlabs();
    const gstOpts = gstSlabsForRow.map(v =>
      `<option value="${v}"${String(v) === String(item.gst) ? ' selected' : ''}>${v}%</option>`
    ).join('');

    const tr = document.createElement('tr');
    tr.draggable = true;
    tr.addEventListener('dragstart', e => dragStart(e, item.id));
    tr.addEventListener('dragover',  dragOver);
    tr.addEventListener('drop',      e => dropItem(e, item.id));
    tr.innerHTML = `
      <td class="col-drag"><div class="drag-handle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/></svg></div></td>
      <td class="col-sno" style="color:var(--text-muted);font-size:11px;padding:4px 4px;text-align:center">${idx + 1}</td>
      <td class="col-desc">
        <input type="text" value="${escHtml(item.desc)}" placeholder="Item description" oninput="updateItem(${item.id},'desc',this.value)" style="font-size:11.5px">
        <input type="text" value="${escHtml(item.spec)}" placeholder="Spec / HSN (optional)" oninput="updateItem(${item.id},'spec',this.value)" style="font-size:10px;color:var(--text-muted);margin-top:2px">
      </td>
      <td class="col-qty"><input type="number" value="${item.qty}" min="0" oninput="updateItem(${item.id},'qty',this.value)" style="text-align:right;font-size:11.5px"></td>
      <td class="col-unit"><input type="text" value="${escHtml(item.unit)}" oninput="updateItem(${item.id},'unit',this.value)" style="text-align:center;font-size:11px"></td>
      <td class="col-rate"><input type="number" value="${item.rate}" min="0" step="0.01" oninput="updateItem(${item.id},'rate',this.value)" style="text-align:right;font-size:11.5px"></td>
      ${showDisc ? `<td class="col-disc"><input type="number" value="${item.disc||0}" min="0" max="100" step="0.1" oninput="updateItem(${item.id},'disc',this.value)" style="text-align:right;font-size:11px"></td>` : ''}
      <td class="col-gst"><select class="item-gst-select" onchange="updateItem(${item.id},'gst',this.value)">${gstOpts}</select></td>
      <td class="col-amount"><span class="item-amount">${formatCurrency(amount)}</span></td>
      <td class="col-del"><button class="del-row-btn" onclick="removeItem(${item.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>
    `;
    tbody.appendChild(tr);
  });
}

function updateItem(id, field, value) {
  const item = state.items.find(i => i.id === id);
  if (item) {
    item[field] = value;
    // Update amount display in row
    const _disc  = parseFloat(item.disc) || 0;
    const _discForAmt = state.showItemDiscount ? _disc : 0;
    const amount = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0) * (1 - _discForAmt / 100);
    const amtSpans = document.querySelectorAll('#itemsBody .item-amount');
    const idx = state.items.indexOf(item);
    if (amtSpans[idx]) amtSpans[idx].textContent = formatCurrency(amount);
    syncDoc();
  }
}

// ===== EXCEL IMPORT =====

function findCol(headers, keywords) {
  for (let kw of keywords) {
    const idx = headers.findIndex(h => h.includes(kw));
    if (idx >= 0) return idx;
  }
  return -1;
}

// ===== CALCULATIONS =====
function calcTotals() {
  const _rawGstCalc = document.getElementById('gstType').value;
  const gstType = _rawGstCalc === 'auto' ? (state.resolvedGstType || 'igst') : _rawGstCalc;

  // Step 1: per-item taxable amounts and slab map
  const slabMap = {}; // rate -> taxable base
  let subtotal = 0;
  state.items.forEach(i => {
    const base   = (parseFloat(i.qty) || 0) * (parseFloat(i.rate) || 0);
    const disc   = state.showItemDiscount ? (parseFloat(i.disc) || 0) : 0;
    const lineAmt = base * (1 - disc / 100);
    subtotal += lineAmt;
    if (gstType !== 'none') {
      const rate = parseFloat(i.gst) >= 0 ? parseFloat(i.gst) : 0;
      slabMap[rate] = (slabMap[rate] || 0) + lineAmt;
    }
  });

  // Step 2: global document-level discount
  let discountAmt = 0;
  if (document.getElementById('enableDiscount').checked) {
    const pct   = parseFloat(document.getElementById('discountPct').value) || 0;
    const fixed = parseFloat(document.getElementById('discountAmt').value) || 0;
    discountAmt = fixed > 0 ? fixed : (subtotal * pct / 100);
  }
  const afterDiscount = subtotal - discountAmt;

  // Step 3: freight
  let freightAmt = 0;
  if (document.getElementById('enableFreight').checked) {
    freightAmt = parseFloat(document.getElementById('freightAmt').value) || 0;
  }
  const taxable = afterDiscount + freightAmt;

  // Step 4: per-slab tax (applying discount ratio proportionally)
  const discRatio  = subtotal > 0 ? afterDiscount / subtotal : 1;
  const taxSlabs   = [];
  let taxAmt       = 0;

  if (gstType !== 'none') {
    const rates = Object.keys(slabMap).map(Number).sort((a,b) => a - b);
    rates.forEach(rate => {
      // Apply discount ratio to slab, distribute freight by slab weight
      const weight       = subtotal > 0 ? slabMap[rate] / subtotal : 0;
      const slabTaxable  = slabMap[rate] * discRatio + freightAmt * weight;
      const slabTax      = slabTaxable * rate / 100;
      taxAmt            += slabTax;
      taxSlabs.push({ rate, taxable: slabTaxable, taxAmt: slabTax });
    });
  }

  const grand   = taxable + taxAmt;
  // Legacy scalar gstRate (blended) — kept for any code still reading it
  const gstRate = taxable > 0 ? parseFloat((taxAmt / taxable * 100).toFixed(4)) : 0;

  return { subtotal, discountAmt, afterDiscount, freightAmt, taxable, taxAmt, grand, gstRate, gstType, taxSlabs };
}

// ===== MAIN SYNC =====
function syncDoc() {
  const currency = document.getElementById('currency').value;
  const sym = CURRENCY_SYMBOLS[currency] || currency + ' ';

  // Helper
  const fmt = (n) => sym + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const val = (id) => (document.getElementById(id) || {}).value || '';

  // Header
  document.getElementById('docTypeLabel').textContent = DOC_LABELS[state.docType] || 'QUOTATION';
  const refNo = val('refNo');
  document.getElementById('docRefNo').textContent = refNo ? 'Ref: ' + refNo : '';
  const docDate = val('docDate');
  document.getElementById('docDateLine').textContent = docDate ? 'Date: ' + formatDate(docDate) : '';
  const validUntil = val('validUntil');
  const validLine = document.getElementById('docValidLine');
  if (validUntil && state.docType !== 'letterhead') {
    validLine.textContent = (state.docType === 'invoice' ? 'Due: ' : 'Valid Until: ') + formatDate(validUntil);
    validLine.style.display = state.docType === 'delivery_challan' ? 'none' : '';
  } else {
    validLine.style.display = 'none';
  }

  // Purchase Order: vendor / billing / delivery wording on preview
  const _isPO = state.docType === 'po';
  const _billToLbl = _isPO ? 'Vendor Detail' : 'Bill To';
  const _shipToLbl = _isPO ? 'Delivery Address' : 'Ship To';
  const _ourLbl    = _isPO ? 'Billing Detail' : 'Our Details';
  const _sideBill  = _isPO ? 'Vendor Detail' : 'Bill To / Client Details';
  const _sideShip  = _isPO ? 'Delivery Address (if different)' : 'Ship To (if different)';
  const _setLbl = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  _setLbl('docBillToLabel', _billToLbl);
  _setLbl('docShipToLabel', _shipToLbl);
  _setLbl('docOurDetailsLabel', _ourLbl);
  _setLbl('sidebarBillToSectionTitle', _sideBill);
  _setLbl('sidebarShipToSectionTitle', _sideShip);

  // Logo / Company
  const showCompanyName = (document.getElementById('showCompanyName') || {}).checked !== false;
  const showTagline     = (document.getElementById('showTagline')     || {}).checked !== false;
  const companyName = val('companyName') || 'YOUR COMPANY';
  const nameSize = document.getElementById('companyNameSize').value + 'px';
  const nameFont = val('companyNameFont') || "'Barlow Condensed', sans-serif";
  const docLogo     = document.getElementById('docLogo');
  const docFallback = document.getElementById('docCompanyFallback');
  const docWithLogo = document.getElementById('docCompanyWithLogo');
  const docTaglineEl = document.getElementById('docTagline');

  docFallback.style.fontSize   = nameSize;
  docFallback.style.fontFamily = nameFont;
  docWithLogo.style.fontFamily = nameFont;

  if (state.logoData) {
    docLogo.src = state.logoData;
    docLogo.classList.add('visible');
    docFallback.style.display = 'none';
    // Apply logo size from slider
    const _logoSizePx = (document.getElementById('logoSize')?.value || '70') + 'px';
    docLogo.style.maxHeight = _logoSizePx;
    docLogo.style.maxWidth  = 'none'; // let height drive the size
    if (showCompanyName) {
      docWithLogo.textContent = companyName;
      docWithLogo.style.display = '';
      const smallSize = Math.max(12, Math.round(parseInt(nameSize) * 0.65));
      docWithLogo.style.fontSize = smallSize + 'px';
    } else {
      docWithLogo.style.display = 'none';
    }
  } else {
    docLogo.classList.remove('visible');
    if (showCompanyName) {
      docFallback.style.display = '';
      docFallback.textContent = companyName;
    } else {
      docFallback.style.display = 'none';
    }
    docWithLogo.style.display = 'none';
  }

  // Tagline
  if (showTagline && val('companyTagline')) {
    docTaglineEl.textContent = val('companyTagline');
    docTaglineEl.style.display = '';
  } else {
    docTaglineEl.textContent = '';
    docTaglineEl.style.display = 'none';
  }

  // Client
  document.getElementById('docClientName').textContent = val('clientName') || '—';
  document.getElementById('docClientAddress').textContent = val('clientAddress');
  // Multi-contacts (optionally show only selected contact without deleting others)
  const allContacts = Array.isArray(state.contacts) ? state.contacts : [];
  const contactsForDoc = (state.activeContactId)
    ? allContacts.filter(c => String(c.id) === String(state.activeContactId))
    : allContacts;
  const contactLines = contactsForDoc
    .filter(c => c.name || c.phone || c.email)
    .map(c => {
      const parts = [];
      if (c.name) parts.push(c.name + (c.designation ? ` (${c.designation})` : ''));
      if (c.phone) parts.push(c.phone);
      if (c.email) parts.push(c.email);
      return parts.join(' · ');
    });
  const contactEl = document.getElementById('docClientContact');
  if (contactEl) {
    contactEl.innerHTML = contactLines.length
      ? contactLines.map(l => `<div style="font-size:11px;color:#555;margin-top:2px">${escHtml(l)}</div>`).join('')
      : `<span class="doc-placeholder">Click to add contact…</span>`;
  }

  const clientGstin = val('clientGstin');
  const clientGstEl = document.getElementById('docClientGstin');
  const showGstin   = document.getElementById('showGstin').checked;
  const gstNA       = document.getElementById('clientGstinNA')?.checked || false;
  if (clientGstEl) {
    if (showGstin) {
      clientGstEl.style.display = '';
      if (clientGstin) clientGstEl.textContent = 'GSTIN: ' + clientGstin;
      else if (gstNA)  clientGstEl.textContent = 'GSTIN: Unregistered';
      else             clientGstEl.textContent = 'GSTIN: — (click to add)';
    } else {
      clientGstEl.style.display = 'none';
    }
  }

  // Ship To
  const shipTo = val('shipToAddress');
  const showShipTo = document.getElementById('showShipTo').checked && shipTo;
  document.getElementById('docShipToBlock').style.display = showShipTo ? '' : 'none';
  document.getElementById('docShipTo').textContent = shipTo;
  const docMetaEl = document.getElementById('docMeta');
  if (docMetaEl) {
    docMetaEl.classList.toggle('doc-meta--has-ship', !!showShipTo);
    docMetaEl.classList.toggle('doc-meta--no-ship', !showShipTo);
  }

  // Our details / Billing Detail (PO): order = company name, address, GST, phone, email
  const ourNameEl = document.getElementById('docOurCompanyName');
  if (ourNameEl) {
    const cn = val('companyName').trim();
    ourNameEl.textContent = cn || '—';
    ourNameEl.style.display = '';
  }
  const ourAddrEl = document.getElementById('docOurAddress');
  if (ourAddrEl) ourAddrEl.textContent = val('companyAddress');
  const ourGstEl = document.getElementById('docOurGstin');
  const ourGstin = val('companyGstin');
  if (ourGstEl) {
    if (ourGstin && document.getElementById('showGstin').checked) {
      ourGstEl.textContent = 'GSTIN: ' + ourGstin;
      ourGstEl.style.display = '';
    } else {
      ourGstEl.style.display = 'none';
    }
  }
  const ourPhoneEl = document.getElementById('docOurPhone');
  if (ourPhoneEl) ourPhoneEl.textContent = val('companyPhone');
  const ourEmailEl = document.getElementById('docOurEmail');
  if (ourEmailEl) ourEmailEl.textContent = val('companyEmail');

  // Delivery / Payment
  document.getElementById('docDelivery').textContent = val('deliveryTime') || '—';
  document.getElementById('docPaymentTerms').textContent = val('paymentTerms');

  // Subject
  const subject = val('docSubject');
  document.getElementById('docSubjectText').textContent = subject || '—';
  document.getElementById('docSubjectLine').style.display = subject ? '' : 'none';

  // ── Letterhead mode ──────────────────────────────────────────────────
  const _isLH = state.docType === 'letterhead';
  const _lhBody = document.getElementById('docLetterBody');
  if (_lhBody) _lhBody.style.display = _isLH ? 'flex' : 'none';
  if (_isLH) {
    const _showTo   = document.getElementById('letterShowTo')?.checked   || false;
    const _showSeal = document.getElementById('letterShowSeal')?.checked || false;
    const _bodyFont = document.getElementById('letterBodyFont')?.value   || "'Barlow', sans-serif";
    const _fSubject = (document.getElementById('letterFontSubject')?.value || '13') + 'px';
    const _fTo      = (document.getElementById('letterFontToName')?.value  || '13') + 'px'; // controls whole To section
    const _fBody    = (document.getElementById('letterFontBody')?.value    || '12') + 'px';
    const _fSeal    = (document.getElementById('letterFontSeal')?.value    || '11') + 'px';
    const _subject  = val('docSubject');

    // ── Company address in header ─────────────────────────────


    // ── "To" block ────────────────────────────────────────────
    const _lhTo = document.getElementById('docLetterTo');
    if (_lhTo) _lhTo.style.display = _showTo ? '' : 'none';
    if (_showTo) {
      // Font size controls entire To section via the wrapper
      if (_lhTo) _lhTo.style.fontSize = _fTo;

      const _lhToName        = document.getElementById('docLetterToName');
      const _lhToContactName = document.getElementById('docLetterToContactName');
      const _lhToAddr        = document.getElementById('docLetterToAddr');
      const _lhToContact     = document.getElementById('docLetterToContact');
      const _lhToGstin       = document.getElementById('docLetterToGstin');

      // Company name (bold, 1em relative to section font) — keep placeholder for easy editing
      if (_lhToName) {
        const _nm = val('clientName') || '';
        _lhToName.textContent = _nm || '—';
        _lhToName.classList.toggle('doc-placeholder', !_nm);
      }

      // Contact person name with salutation (first contact, shown after company name)
      const _ctsAll = Array.isArray(state.contacts) ? state.contacts : [];
      const _firstContact = (state.activeContactId
        ? _ctsAll.find(ct => String(ct.id) === String(state.activeContactId))
        : null
      ) || _ctsAll.find(ct => ct.name);
      if (_lhToContactName) {
        const _sal = _firstContact?.salutation ? _firstContact.salutation + ' ' : '';
        const _label = _firstContact?.name ? (_sal + _firstContact.name) : 'CONTACT';
        _lhToContactName.textContent = _label;
        _lhToContactName.style.display = '';
        _lhToContactName.classList.toggle('doc-placeholder', !_firstContact?.name);
      }

      // Address — keep placeholder for easy editing
      if (_lhToAddr) {
        const _ad = val('clientAddress') || '';
        _lhToAddr.textContent = _ad || '—';
        _lhToAddr.classList.toggle('doc-placeholder', !_ad);
      }

      // Phone + email (all contacts)
      const _contactParts = (state.contacts || [])
        .filter(ct => ct.phone || ct.email)
        .map(ct => [ct.phone, ct.email].filter(Boolean).join('  ·  '))
        .join('  |  ');
      if (_lhToContact) _lhToContact.textContent = _contactParts;

      // GST number
      const _gstin = val('clientGstin');
      if (_lhToGstin) {
        if (_gstin) { _lhToGstin.textContent = 'GSTIN: ' + _gstin; _lhToGstin.style.display = ''; }
        else          _lhToGstin.style.display = 'none';
      }
    }

    // ── Subject line ──────────────────────────────────────────
    const _subjNormal    = document.getElementById('docSubjectLine');
    const _subjInBody    = document.getElementById('docLetterSubject');
    const _subjInBodyTxt = document.getElementById('docLetterSubjectText');

    if (_showTo) {
      // With "To" block: subject appears below To section, left-aligned with "Re:"
      if (_subjNormal) _subjNormal.style.display = 'none';
      if (_subjInBody) {
        _subjInBody.style.display     = '';
        _subjInBody.style.fontSize    = _fSubject;
        _subjInBody.style.textAlign   = 'left';
        _subjInBody.style.fontWeight  = '600';
      }
      if (_subjInBodyTxt) {
        const _s = _subject || '';
        _subjInBodyTxt.textContent = _s || 'SUBJECT';
        _subjInBodyTxt.classList.toggle('doc-placeholder', !_s);
      }
    } else {
      // Without "To" block: subject is centred, bold, no "Re:" label
      if (_subjNormal) _subjNormal.style.display = 'none'; // hide the normal one always for LH
      if (_subjInBody) {
        _subjInBody.style.display    = '';
        _subjInBody.style.fontSize   = _fSubject;
        _subjInBody.style.textAlign  = 'center';
        _subjInBody.style.fontWeight = '700';
      }
      if (_subjInBodyTxt) {
        const _s = _subject || '';
        _subjInBodyTxt.textContent = _s || 'SUBJECT';
        _subjInBodyTxt.classList.toggle('doc-placeholder', !_s);
      }
    }

    // ── Body text ─────────────────────────────────────────────
    const _lhText = document.getElementById('docLetterText');
    if (_lhText) {
      const _body = document.getElementById('letterBody')?.value || '';
      _lhText.textContent      = _body || 'Dear Sir/Madam,';
      _lhText.style.fontFamily = _bodyFont;
      _lhText.style.fontSize   = _fBody;
      _lhText.classList.toggle('doc-placeholder', !_body);
    }

    // ── Seal ──────────────────────────────────────────────────
    const _lhSeal = document.getElementById('docLetterSeal');
    if (_lhSeal) _lhSeal.style.display = _showSeal ? '' : 'none';
    if (_showSeal) {
      const _sealFor   = document.getElementById('docLetterSealFor');
      const _sealLabel = document.getElementById('docLetterSealLabel');
      if (_sealFor)   { _sealFor.textContent = 'For ' + (val('companyName') || 'Company'); _sealFor.style.fontSize = _fSeal; }
      if (_sealLabel)   _sealLabel.style.fontSize = _fSeal;
    }
  } else {
    // Not letterhead — hide in-body subject, restore normal subject behaviour
    const _subjInBody = document.getElementById('docLetterSubject');
    if (_subjInBody) _subjInBody.style.display = 'none';
  }
  // Hide items/totals for letterhead; keep meta visible so preview editing still works.
  const _docTableSec  = document.querySelector('.doc-table-section');
  const _docTotalsSec = document.getElementById('docTotalsSection');
  const _docMeta      = document.getElementById('docMeta');
  const _docAmtWords  = document.getElementById('docAmtWordsBlock');
  if (_docTableSec)  _docTableSec.style.display  = _isLH ? 'none' : '';
  if (_docTotalsSec) _docTotalsSec.style.display  = _isLH ? 'none' : '';
  if (_docMeta)      _docMeta.style.display        = '';
  if (_docAmtWords)  _docAmtWords.style.display    = _isLH ? 'none' : '';

  // Items Table
  const docTbody = document.getElementById('docTableBody');
  // Show/hide disc column header — must be outside items check so it restores on saved-doc open
  const _docDiscTh = document.getElementById('docDiscTh');
  if (_docDiscTh) _docDiscTh.style.display = state.showDiscountOnDoc ? '' : 'none';

  if (state.items.length === 0) {
    docTbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#ccc;padding:20px;font-size:11.5px">No items added yet.</td></tr>`;
  } else {

    // Hide GST% column for Delivery Challan
    const _isDC = state.docType === 'delivery_challan';
    const _docGstTh = document.getElementById('docGstTh');
    if (_docGstTh) _docGstTh.style.display = _isDC ? 'none' : '';

    docTbody.innerHTML = state.items.map((item, idx) => {
      const _disc    = parseFloat(item.disc) || 0;
      const _discAmt = state.showItemDiscount ? _disc : 0;
      const _rate    = parseFloat(item.rate) || 0;
      const _qty     = parseFloat(item.qty)  || 0;
      const amount   = _qty * _rate * (1 - _discAmt / 100);
      const gstVal   = item.gst !== undefined && item.gst !== '' ? item.gst + '%' : '—';
      const gstSlabsForRow = getGstSlabs();
      const gstOpts = gstSlabsForRow.map(v =>
        `<option value="${v}"${String(v) === String(item.gst) ? ' selected' : ''}>${v}%</option>`
      ).join('');
      // When disc column is hidden but discount is applied, fold discount into unit price
      const _showDiscCol = state.showDiscountOnDoc && state.showItemDiscount;
      const displayRateRaw  = (!_showDiscCol && _discAmt > 0)
        ? _rate * (1 - _discAmt / 100)   // discounted unit price
        : _rate;                           // original rate
      const displayRate = (Math.round(displayRateRaw * 100) / 100).toFixed(2);
      const discCell = _showDiscCol
        ? `<td class="center" style="font-size:11px;opacity:0.75">${_disc > 0 ? _disc + '%' : '—'}</td>`
        : '';
      const gstCell  = _isDC ? '' : `<td class="center"><select class="doc-gst-select" data-item-id="${item.id}">${gstOpts}</select></td>`;
      return `<tr>
        <td class="sno">${idx + 1}</td>
        <td>
          <div class="item-desc doc-editable" contenteditable="true" spellcheck="false" data-item-id="${item.id}" data-item-field="desc">${escHtml(item.desc) || ''}</div>
          <div class="item-spec doc-editable" contenteditable="true" spellcheck="false" data-item-id="${item.id}" data-item-field="spec">${escHtml(item.spec) || ''}</div>
          
        </td>
        <td class="right doc-editable" contenteditable="true" spellcheck="false" data-item-id="${item.id}" data-item-field="qty">${escHtml(item.qty)}</td>
        <td class="center doc-editable" contenteditable="true" spellcheck="false" data-item-id="${item.id}" data-item-field="unit">${escHtml(item.unit)}</td>
        <td class="right doc-editable" contenteditable="true" spellcheck="false" data-item-id="${item.id}" data-item-field="rate">${escHtml(displayRate)}</td>
        ${discCell}
        ${gstCell}
        <td class="right">${fmt(amount)}</td>
        <td class="col-del no-export"><button class="doc-del-item-btn" type="button" onclick="removeItem(${item.id})">×</button></td>
      </tr>`;
    }).join('');
  }

  // Totals
  const T            = calcTotals();
  const customTaxLabel = val('customTaxLabel') || 'Tax';
  document.getElementById('docTotalsBody').innerHTML =
    buildTotalsHTML(T, T.gstType, customTaxLabel, val('currency') || 'INR');

  // Sidebar totals
  const fmtSide = (n) => sym + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('sidebarSubtotal').textContent = fmtSide(T.subtotal);
  document.getElementById('t-subtotal').textContent = fmtSide(T.subtotal);
  document.getElementById('t-discount').textContent = '−' + fmtSide(T.discountAmt);
  document.getElementById('t-freight').textContent = fmtSide(T.freightAmt);
  document.getElementById('t-tax').textContent = fmtSide(T.taxAmt);
  document.getElementById('t-grand').textContent = fmtSide(T.grand);
  document.getElementById('t-discount-row').style.display = T.discountAmt > 0 ? '' : 'none';
  document.getElementById('t-freight-row').style.display  = T.freightAmt  > 0 ? '' : 'none';
  document.getElementById('t-tax-row').style.display = (state.docType !== 'delivery_challan' && T.gstType !== 'none') ? '' : 'none';

  // Amount in words
  const showAmtWords = document.getElementById('showAmtWords').checked;
  const amtWordsBlock = document.getElementById('docAmtWordsBlock');
  amtWordsBlock.style.display = showAmtWords ? '' : 'none';
  if (showAmtWords) {
    document.getElementById('docAmtWords').textContent = numberToWords(T.grand, currency);
  }
  const pos = val('placeOfSupply');
  const _posEl = document.getElementById('docPlaceSupply');
  if (_posEl) {
    if (state.docType === 'letterhead') {
      _posEl.textContent = '';
      _posEl.style.display = 'none';
    } else {
      _posEl.style.display = '';
      _posEl.textContent = pos ? ('Place of Supply: ' + pos) : 'Place of Supply: —';
      _posEl.classList.toggle('doc-placeholder', !pos);
    }
  }

  // Bank Details
  const showBank = document.getElementById('showBankDetails').checked;
  const bankSection = document.getElementById('docBankSection');
  bankSection.style.display = showBank ? '' : 'none';
  if (showBank) {
    const bankRows = [
      ['Bank', val('bankName')],
      ['Acc Name', val('bankAccName')],
      ['Acc No.', val('bankAccNo')],
      ['Type', val('bankAccType') || 'Current'],
      ['IFSC', val('bankIfsc')],
      ['SWIFT', val('bankSwift')],
      ['Branch', val('bankBranch')],
    ].filter(([k, v]) => v);
    bankSection.querySelector('#docBankContent').innerHTML = bankRows.map(([k, v]) =>
      `<div class="doc-bank-row"><span class="doc-bank-key">${k}:</span><span class="doc-bank-val">${escHtml(v)}</span></div>`
    ).join('');
  }

  // Terms column: delivery/payment always here; numbered terms block follows showTerms
  const showTerms = document.getElementById('showTerms').checked;
  const termsSection = document.getElementById('docTermsSection');
  if (termsSection) {
    termsSection.style.display = '';
    termsSection.style.gridColumn = showBank ? '' : '1 / -1';
    termsSection.classList.toggle('doc-terms-section--full', !showBank);
  }
  const termsParagraphWrap = document.getElementById('docTermsParagraphWrap');
  if (termsParagraphWrap) termsParagraphWrap.style.display = showTerms ? '' : 'none';
  const docTermsContentEl = document.getElementById('docTermsContent');
  if (docTermsContentEl) docTermsContentEl.textContent = val('terms');

  // Notes
  const showNotes = document.getElementById('showNotes').checked;
  const notesSection = document.getElementById('docNotesSection');
  const notesContent = val('notes');
  notesSection.style.display = showNotes ? '' : 'none';
  const notesEl = document.getElementById('docNotesContent');
  if (notesEl) {
    if (notesContent) {
      notesEl.textContent = notesContent;
      notesEl.classList.remove('doc-placeholder');
    } else {
      notesEl.textContent = '—';
      notesEl.classList.add('doc-placeholder');
    }
  }

  // Footer
  const footerLeft = val('footerLeft') || companyName;
  document.getElementById('docFooterCompany').textContent = footerLeft;
  // Address sub-footer — show full address centered below main footer

  const footerTagline = val('footerTagline');
  const footerParts = [val('companyPhone'), val('companyEmail'), val('companyWebsite')].filter(Boolean);
  document.getElementById('docFooterContact').textContent = footerTagline || footerParts.join('  |  ');
  document.getElementById('docFooterRight').textContent = val('footerRight');

  // GST type for tax toggle — use raw value so UI controls still work
  const _rawGstType = document.getElementById('gstType').value;
  document.getElementById('gstRateGroup').style.display = _rawGstType === 'none' ? 'none' : '';
  document.getElementById('customTaxLabelGroup').style.display = _rawGstType === 'custom' ? '' : 'none';

  // Partner logos
  syncPartnerLogosToDoc();

  // ── Letterhead: final hide (overrides all calc above) ────────────────
  if (state.docType === 'letterhead') {
    // Always hide these (not relevant to a letter)
    const _lhAlwaysHide = [
      document.querySelector('.doc-table-section'),   // items table
      document.getElementById('docTotalsSection'),    // subtotal / grand total
      document.getElementById('docAmtWordsBlock'),    // amount in words
      document.getElementById('docMeta'),             // bill-to / our-details band
      document.getElementById('docBottomSection'),    // bank + terms
      document.getElementById('docNotesSection'),     // notes
      document.getElementById('docSubjectLine'),      // normal subject (LH uses in-body version)
    ];
    _lhAlwaysHide.forEach(el => { if (el) el.style.display = 'none'; });
    // Footer, product images, logos — always show (user may have them set up)
    const _footerGrp = document.querySelector('.doc-footer-group');
    if (_footerGrp) _footerGrp.style.display = '';
    const _footer = document.getElementById('docFooter');
    if (_footer) _footer.style.display = '';
  } else {
    // Leaving letterhead: restore bottom sections (bank/terms/notes) visibility based on toggles.
    const bottom = document.getElementById('docBottomSection');
    if (bottom) bottom.style.display = '';
  }

  // Auto-pagination when page 1 exceeds A4 height
  // Letterhead needs slightly more time for the To-block / seal layout to settle
  const _rafDelay = state.docType === 'letterhead' ? 80 : 50;
  requestAnimationFrame(() => setTimeout(checkPageOverflow, _rafDelay));
}

// ===== MULTI-PAGE ITEM TABLE (overflow) =====

function buildTotalsHTML(T, gstType, customTaxLabel, currency) {
  const sym = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : (currency + ' ');
  const fmt = n => sym + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let html = `<tr><td>Subtotal</td><td>${fmt(T.subtotal)}</td></tr>`;
  if (T.discountAmt > 0) html += `<tr><td>Discount</td><td>−${fmt(T.discountAmt)}</td></tr>`;
  if (T.freightAmt  > 0) html += `<tr><td>Freight &amp; Packing</td><td>${fmt(T.freightAmt)}</td></tr>`;
  if (gstType !== 'none' && T.taxSlabs && T.taxSlabs.length) {
    T.taxSlabs.forEach((slab, si) => {
      if (slab.taxAmt === 0) return;
      const sep = si === 0 ? ' class="separator"' : '';
      if (gstType === 'cgst_sgst') {
        html += `<tr${sep}><td>CGST @ ${slab.rate / 2}%</td><td>${fmt(slab.taxAmt / 2)}</td></tr>`;
        html += `<tr><td>SGST @ ${slab.rate / 2}%</td><td>${fmt(slab.taxAmt / 2)}</td></tr>`;
      } else if (gstType === 'igst') {
        html += `<tr${sep}><td>IGST @ ${slab.rate}%</td><td>${fmt(slab.taxAmt)}</td></tr>`;
      } else {
        const lbl = gstType === 'vat' ? 'VAT' : escHtml(customTaxLabel);
        html += `<tr${sep}><td>${lbl} @ ${slab.rate}%</td><td>${fmt(slab.taxAmt)}</td></tr>`;
      }
    });
  } else if (gstType !== 'none' && T.taxAmt > 0) {
    // fallback scalar
    if (gstType === 'cgst_sgst') {
      html += `<tr class="separator"><td>CGST @ ${T.gstRate/2}%</td><td>${fmt(T.taxAmt/2)}</td></tr>`;
      html += `<tr><td>SGST @ ${T.gstRate/2}%</td><td>${fmt(T.taxAmt/2)}</td></tr>`;
    } else if (gstType === 'igst') {
      html += `<tr class="separator"><td>IGST @ ${T.gstRate}%</td><td>${fmt(T.taxAmt)}</td></tr>`;
    } else {
      html += `<tr class="separator"><td>${escHtml(gstType === 'vat' ? 'VAT' : customTaxLabel)} @ ${T.gstRate}%</td><td>${fmt(T.taxAmt)}</td></tr>`;
    }
  }
  html += `<tr class="grand-total"><td>Grand Total</td><td>${fmt(T.grand)}</td></tr>`;
  return html;
}

function checkPageOverflow() {
  const A4_HEIGHT  = 1123;
  /** Subpixel / rounding slack so a page that visually fits is not treated as overflow (avoids clipping footer). */
  const A4_FIT_EPS = 1;
  const A4_USABLE  = 1040; // conservative usable height per annexure page (header+footer take ~83px)
  const docPage    = document.getElementById('docPage');
  const isLH       = state.docType === 'letterhead';

  // Preserve preview scroll position while we remove/rebuild continuation pages.
  // Without this, adding items can cause the browser to snap scroll back to top.
  const _previewPane = document.querySelector('.preview-pane');
  const _prevScrollTop = _previewPane ? _previewPane.scrollTop : 0;
  const _scheduleRestore = () => {
    if (!_previewPane) return;
    requestAnimationFrame(() => {
      // Clamp in case scrollHeight changed.
      _previewPane.scrollTop = Math.min(_prevScrollTop, _previewPane.scrollHeight);
    });
  };

  const _ensureInlineAddItemButton = () => {
    document.querySelectorAll('.doc-inline-actions').forEach(el => el.remove());
    document.querySelectorAll('.doc-add-item-row').forEach(el => el.remove());
    document.querySelectorAll('.doc-add-item-bar').forEach((el) => { el.innerHTML = ''; });
    if (state.docType === 'letterhead') return;

    const mountBar = (barEl) => {
      if (!barEl) return;
      barEl.innerHTML = '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'doc-add-item-btn';
      btn.textContent = '+ Add Item';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        addItem();
      });
      barEl.appendChild(btn);
    };

    const preview = document.querySelector('.preview-pane');
    if (!preview) return;

    const contPages = Array.from(preview.querySelectorAll('.doc-annexure-page.doc-page'));
    if (contPages.length) {
      const last = contPages[contPages.length - 1];
      mountBar(last.querySelector('.doc-add-item-bar'));
      return;
    }

    mountBar(document.getElementById('docAddItemBar'));
  };

  // ── Remove all previously generated pages / separators / notes ──
  document.querySelectorAll('.doc-annexure-page, #docAnnexurePage, #docPageSeparator, #docAnnexureNote, .doc-page-separator, .doc-lh-page').forEach(el => el.remove());

  // ── LETTERHEAD overflow: create continuation pages for letter body ──
  if (isLH) {
    _checkLetterheadOverflow();
    _ensureInlineAddItemButton();
    _scheduleRestore();
    return;
  }

  // ── Measure page 1 content height ──
  // Table: use scrollHeight vs rect height when flex clips the table band.
  const contentH = Array.from(docPage.children)
    .filter(el => !el.classList.contains('doc-watermark'))
    .reduce((h, el) => {
      if (window.getComputedStyle(el).display === 'none') return h;
      let blockH = el.getBoundingClientRect().height;
      if (el.classList.contains('doc-table-section')) {
        const sh = el.scrollHeight;
        if (blockH > sh + 2) blockH = sh;
        else blockH = Math.max(blockH, sh);
      }
      return h + blockH;
    }, 0);

  if (contentH <= A4_HEIGHT + A4_FIT_EPS) {
    // Everything fits — restore normal page 1 view
    const totSec  = document.getElementById('docTotalsSection');
    const tblWrap = document.getElementById('docTableBody');
    if (totSec)  totSec.style.display = '';
    if (tblWrap) tblWrap.closest('table').style.display = '';
    _ensureInlineAddItemButton();
    _scheduleRestore();
    return;
  }

  // ── Page 1 overflows — split items: first page + continuation page(s) ──
  const T              = calcTotals();
  const currency       = document.getElementById('currency').value;
  const gstType        = document.getElementById('gstType').value;
  const customTaxLabel = (document.getElementById('customTaxLabel') || {}).value || 'Tax';
  const refNo          = (document.getElementById('refNo')         || {}).value || '—';
  const companyName    = (document.getElementById('companyName')   || {}).value || 'Company';
  const docTypeLabel   = document.getElementById('docTypeLabel').textContent;
  const dp             = document.getElementById('docPage');
  const accentColor    = dp.style.getPropertyValue('--doc-accent') || '#C8171E';
  const textColor      = dp.style.getPropertyValue('--doc-text')   || '#1a1a2e';
  const footerBg       = state.colors.footerBg || '#ffffff';
  const isDark         = isColorDark(footerBg);
  const ftTextColor    = isDark ? '#fff' : accentColor;
  const footerLeft     = (document.getElementById('footerLeft')    || {}).value || companyName;
  const footerTagline  = (document.getElementById('footerTagline') || {}).value;
  const footerContact  = footerTagline ||
    [(document.getElementById('companyPhone')  || {}).value,
     (document.getElementById('companyEmail')  || {}).value,
     (document.getElementById('companyWebsite')|| {}).value].filter(Boolean).join('  |  ');
  const footerRight    = (document.getElementById('footerRight') || {}).value || '';

  const sym  = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : (currency + ' ');
  const fmt  = n => sym + (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const _showDiscCol = state.showDiscountOnDoc && state.showItemDiscount;
  const discHeader   = _showDiscCol ? '<th class="right" style="width:52px">Disc%</th>' : '';
  const _isDC        = state.docType === 'delivery_challan';
  const gstHeader    = _isDC ? '' : '<th class="right" style="width:52px">GST%</th>';

  const makeItemRow = (item, idx) => {
    const _disc    = parseFloat(item.disc) || 0;
    const _discAmt = state.showItemDiscount ? _disc : 0;
    const _rate    = parseFloat(item.rate) || 0;
    const amount   = (parseFloat(item.qty) || 0) * _rate * (1 - _discAmt / 100);
    const displayRateRaw = (!_showDiscCol && _discAmt > 0) ? _rate * (1 - _discAmt / 100) : _rate;
    const displayRate = Math.round(displayRateRaw * 100) / 100;
    const discCell = _showDiscCol
      ? `<td class="right doc-editable" contenteditable="true" spellcheck="false" data-item-id="${item.id}" data-item-field="disc">${escHtml(_disc)}</td>`
      : '';
    const gstSlabsForRow = getGstSlabs();
    const gstOpts = gstSlabsForRow.map(v =>
      `<option value="${v}"${String(v) === String(item.gst) ? ' selected' : ''}>${v}%</option>`
    ).join('');
    const gstCell  = _isDC ? '' : `<td class="center"><select class="doc-gst-select" data-item-id="${item.id}">${gstOpts}</select></td>`;
    return `<tr>
      <td class="sno">${idx + 1}</td>
      <td>
        <div class="item-desc doc-editable" contenteditable="true" spellcheck="false" data-item-id="${item.id}" data-item-field="desc">${escHtml(item.desc) || ''}</div>
        <div class="item-spec doc-editable" contenteditable="true" spellcheck="false" data-item-id="${item.id}" data-item-field="spec">${escHtml(item.spec) || ''}</div>
      </td>
      <td class="right doc-editable" contenteditable="true" spellcheck="false" data-item-id="${item.id}" data-item-field="qty">${escHtml(item.qty)}</td>
      <td class="center doc-editable" contenteditable="true" spellcheck="false" data-item-id="${item.id}" data-item-field="unit">${escHtml(item.unit)}</td>
      <td class="right doc-editable" contenteditable="true" spellcheck="false" data-item-id="${item.id}" data-item-field="rate">${escHtml(displayRate)}</td>
      ${discCell}${gstCell}
      <td class="right">${fmt(amount)}</td>
      <td class="col-del no-export"><button class="doc-del-item-btn" type="button" onclick="removeItem(${item.id})">×</button></td>
    </tr>`;
  };

  const makeContinuationHeader = (pageNum, totalPages) => `
    <div class="doc-annexure-header doc-continuation-header">
      <div>
        <div class="doc-annexure-title">Line items (continued)</div>
        <div class="doc-annexure-sub">${escHtml(docTypeLabel)} — Ref: ${escHtml(refNo)}</div>
      </div>
      <div class="doc-annexure-ref">
        <div>${escHtml(companyName)}</div>
        <div>Page ${pageNum} of ${totalPages}</div>
      </div>
    </div>`;

  const makeContinuationPageFooter = (showTotals, showContinue) => {
    const inner = `
    ${showContinue ? `<div class="doc-continue-note">Continue to next page →</div>` : ``}
    ${showTotals ? `
    <div class="doc-totals-section">
      <div></div>
      <table class="doc-totals-table">
        <tbody>${buildTotalsHTML(T, gstType, customTaxLabel, currency)}</tbody>
      </table>
    </div>` : ''}
    <div class="doc-footer${isDark ? ' dark-footer' : ''}" style="background:${footerBg};border-top-color:${accentColor}">
      <div class="doc-footer-company" style="color:${ftTextColor}">${escHtml(footerLeft)}</div>
      <div class="doc-footer-contact">${escHtml(footerContact)}</div>
      <div class="doc-footer-right">${escHtml(footerRight)}</div>
    </div>`;
    return `<div class="doc-annex-tail">${inner}</div>`;
  };

  const tableHead = `
    <table class="doc-table" style="width:100%">
      <thead>
        <tr style="background:${accentColor}">
          <th style="width:32px">#</th>
          <th>Description</th>
          <th style="width:45px;text-align:right">Qty</th>
          <th style="width:45px;text-align:center">Unit</th>
          <th class="right" style="width:90px">Unit Rate</th>
          ${discHeader}${gstHeader}
          <th class="right" style="width:100px">Amount</th>
          <th class="col-del no-export" style="width:26px"></th>
        </tr>
      </thead>`;

  const previewPane = document.querySelector('.preview-pane');
  const _docW = 794;

  const _probeWrap = (html) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:' + _docW + 'px;visibility:hidden;pointer-events:none;font-family:Barlow,sans-serif;';
    d.innerHTML = html;
    document.body.appendChild(d);
    const h = d.firstElementChild ? d.firstElementChild.getBoundingClientRect().height : 0;
    document.body.removeChild(d);
    return h;
  };

  // Probe row heights (full item list) before changing page 1 tbody.
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:' + _docW + 'px;visibility:hidden;font-family:Barlow,sans-serif;';
  probe.innerHTML = tableHead + '<tbody>' + state.items.map(makeItemRow).join('') + '</tbody></table>';
  document.body.appendChild(probe);
  const rows = Array.from(probe.querySelectorAll('tbody tr'));
  const rowHeights = rows.map(r => r.getBoundingClientRect().height);
  document.body.removeChild(probe);

  const n = state.items.length;
  const prefix = [0];
  for (let i = 0; i < rowHeights.length; i++) prefix.push(prefix[i] + (rowHeights[i] || 28));

  // Live layout: height reserved outside tbody + thead/chrome inside table section.
  const tableSectionEl = docPage.querySelector('.doc-table-section');
  let tableSectionH = 0;
  if (tableSectionEl && window.getComputedStyle(tableSectionEl).display !== 'none') {
    let blockH = tableSectionEl.getBoundingClientRect().height;
    const sh = tableSectionEl.scrollHeight;
    if (blockH > sh + 2) blockH = sh;
    else blockH = Math.max(blockH, sh);
    tableSectionH = blockH;
  }
  const tbodyEl = document.getElementById('docTableBody');
  const tbodyH = tbodyEl ? tbodyEl.getBoundingClientRect().height : 0;
  const restH = contentH - tableSectionH;
  const nonTbodyTableH = Math.max(0, tableSectionH - tbodyH);

  const colSpan = document.querySelectorAll('#docTable thead th').length || 9;
  const contRowProbe =
    `<tr class="doc-table-continue-row"><td colspan="${colSpan}" style="text-align:center;padding:10px 12px;font-size:11px;font-style:italic;color:#333;opacity:0.85;border-top:1px solid #e0e4ef;">` +
    'Continue to page 2 for the remaining 9 items.</td></tr>';
  const CONT_MSG_H = _probeWrap(tableHead + '<tbody>' + contRowProbe + '</tbody></table>') || 32;

  const HEADER_H     = _probeWrap(makeContinuationHeader(2, 2)) || 72;
  const TABLE_HEAD_H = _probeWrap(tableHead + '<tbody></tbody></table>') || 34;
  const FOOTER_H     = _probeWrap(makeContinuationPageFooter(false, false)) || 52;
  const TOTALS_H     = _probeWrap('<div class="doc-totals-section" style="padding:16px 36px">' +
    '<div></div><table class="doc-totals-table"><tbody>' +
    buildTotalsHTML(calcTotals(), document.getElementById('gstType').value,
      (document.getElementById('customTaxLabel') || {}).value || 'Tax',
      document.getElementById('currency').value) +
    '</tbody></table></div>') || 90;

  const buildPage1Html = (kVal) => {
    let html = '';
    for (let i = 0; i < kVal; i++) html += makeItemRow(state.items[i], i);
    if (kVal < n && n - kVal > 0) {
      const rem = n - kVal;
      const remWord = rem === 1 ? 'item' : 'items';
      html +=
        `<tr class="doc-table-continue-row"><td colspan="${colSpan}" style="text-align:center;padding:10px 12px;font-size:11px;font-style:italic;color:var(--doc-text);opacity:0.8;border-top:1px solid #e0e4ef;">` +
        `Continue to page 2 for the remaining <strong>${rem}</strong> ${remWord}.</td></tr>`;
    }
    return html;
  };

  // Initial k from summed heights vs full A4 (shrink/grow below use real layout).
  let k = 0;
  for (let trial = 1; trial <= n; trial++) {
    const h = restH + nonTbodyTableH + prefix[trial] + (trial < n ? CONT_MSG_H : 0);
    if (h <= A4_HEIGHT + A4_FIT_EPS) k = trial;
    else break;
  }
  if (k === 0 && n > 0) k = 1;

  const mainTbody = document.getElementById('docTableBody');
  const _fitsPage = () => docPage.scrollHeight <= docPage.clientHeight + 2;

  while (k >= 1) {
    mainTbody.innerHTML = buildPage1Html(k);
    docPage.offsetHeight;
    if (_fitsPage()) break;
    k--;
  }
  if (k < 1) k = 1;

  // Fill leftover vertical space: summed heights often underestimate vs flex (totals margin, etc.).
  while (k < n) {
    mainTbody.innerHTML = buildPage1Html(k + 1);
    docPage.offsetHeight;
    if (_fitsPage()) k++;
    else {
      mainTbody.innerHTML = buildPage1Html(k);
      docPage.offsetHeight;
      break;
    }
  }

  const pages = [];
  if (k < n) {
    let currentPage = [];
    let usedH = HEADER_H + TABLE_HEAD_H;
    for (let i = k; i < n; i++) {
      const rowH = rowHeights[i] || 28;
      if (usedH + rowH + FOOTER_H > A4_USABLE && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        usedH = HEADER_H + TABLE_HEAD_H;
      }
      currentPage.push(i);
      usedH += rowH;
    }
    if (currentPage.length > 0) pages.push(currentPage);

    if (pages.length) {
      const sumRowsH = (idxs) => idxs.reduce((s, i) => s + (rowHeights[i] || 28), 0);
      let last = pages[pages.length - 1];
      let lastUsed = HEADER_H + TABLE_HEAD_H + sumRowsH(last);
      if (lastUsed + FOOTER_H + TOTALS_H > A4_USABLE && last.length > 1) {
        const spill = [];
        while (last.length > 0) {
          lastUsed = HEADER_H + TABLE_HEAD_H + sumRowsH(last);
          if (lastUsed + FOOTER_H + TOTALS_H <= A4_USABLE) break;
          spill.push(last.pop());
        }
        if (spill.length) {
          spill.reverse();
          pages.push(spill);
        }
        if (pages[pages.length - 2] && pages[pages.length - 2].length === 0) {
          pages.splice(pages.length - 2, 1);
        }
      }
    }
  }

  const totalPages = 1 + pages.length;

  pages.forEach((itemIndices, pi) => {
    const pageNum = pi + 2;
    const isLastPage = pi === pages.length - 1;

    const separator = document.createElement('div');
    separator.className = 'doc-page-separator';
    separator.textContent = `Page ${pageNum} of ${totalPages}`;

    const contPage = document.createElement('div');
    contPage.className = 'doc-page doc-annexure-page';
    [...dp.classList].filter((c) => c.startsWith('tpl-')).forEach((c) => contPage.classList.add(c));
    contPage.style.setProperty('--doc-accent', accentColor);
    contPage.style.setProperty('--doc-text', textColor);
    contPage.style.setProperty('--doc-header-bg', state.colors.header || '#f8f9fd');
    contPage.style.fontFamily = dp.style.fontFamily || '';
    contPage.innerHTML = `
      ${makeContinuationHeader(pageNum, totalPages)}
      <div class="doc-table-section">
        <div class="doc-table-scroll">
        ${tableHead}
          <tbody>${itemIndices.map(i => makeItemRow(state.items[i], i)).join('')}</tbody>
        </table>
        </div>
        <div class="doc-add-item-bar no-export"></div>
      </div>
      ${makeContinuationPageFooter(isLastPage, !isLastPage)}
    `;

    previewPane.appendChild(separator);
    previewPane.appendChild(contPage);
  });

  if (totalPages > 1) {
    const sep1 = document.createElement('div');
    sep1.className = 'doc-page-separator';
    sep1.id = 'docPageSeparator';
    sep1.textContent = `Page 1 of ${totalPages}`;
    docPage.after(sep1);
  }

  _ensureInlineAddItemButton();

  _scheduleRestore();
}

function _checkLetterheadOverflow() {
  const docPage   = document.getElementById('docPage');
  const lhTextEl  = document.getElementById('docLetterText');
  const lhBody    = document.getElementById('docLetterBody');
  if (!lhTextEl || !lhBody) return;

  const bodyText  = lhTextEl.textContent || '';
  if (!bodyText.trim()) return;

  // ── Build style context ──────────────────────────────────────
  const dp           = docPage;
  const accentColor  = dp.style.getPropertyValue('--doc-accent') || '#C8171E';
  const textColor    = dp.style.getPropertyValue('--doc-text')   || '#1a1a2e';
  const footerBg     = state.colors.footerBg || '#ffffff';
  const isDark       = isColorDark(footerBg);
  const ftTextColor  = isDark ? '#fff' : accentColor;
  const companyName  = (document.getElementById('companyName') || {}).value || '';
  const footerLeft   = (document.getElementById('footerLeft')  || {}).value || companyName;
  const footerTagline= (document.getElementById('footerTagline')|| {}).value;
  const footerContact= footerTagline ||
    [(document.getElementById('companyPhone')  || {}).value,
     (document.getElementById('companyEmail')  || {}).value,
     (document.getElementById('companyWebsite')|| {}).value].filter(Boolean).join('  |  ');
  const footerRight  = (document.getElementById('footerRight') || {}).value || '';
  const bodyFont     = lhTextEl.style.fontFamily || "'Barlow', sans-serif";
  const bodyFontSize = lhTextEl.style.fontSize   || '12px';
  const refNoText    = (document.getElementById('refNo') ? document.getElementById('refNo').value : '') || '';

  // ── Measure available height for body text on page 1 ─────────
  // Use a probe to measure the NATURAL (unconstrained) height of the text
  // Probe must use real document pixels (unscaled)
  const _preview2 = document.querySelector('.preview-pane');
  const _scale2   = _preview2 ? Math.min(1, (_preview2.clientWidth - 24) / 794) : 1;
  const PROBE_W   = (lhTextEl.getBoundingClientRect().width / _scale2) || 722;
  const probe      = document.createElement('div');
  probe.style.cssText = [
    'position:fixed', 'top:-99999px', 'left:-99999px',
    'width:' + PROBE_W + 'px',
    'font-family:' + bodyFont,
    'font-size:' + bodyFontSize,
    'line-height:1.75',
    'white-space:pre-wrap',
    'word-break:break-word',
    'visibility:hidden',
    'pointer-events:none'
  ].join(';');
  probe.textContent = bodyText;
  document.body.appendChild(probe);
  const naturalH = probe.getBoundingClientRect().height;
  document.body.removeChild(probe);

  // Available height on page 1 for text.
  //
  // THE ONLY RELIABLE APPROACH:
  // docLetterBody has flex:1 in the page column. Its offsetHeight is already
  // the exact space allocated to it by the browser — it accounts for the
  // header, all bottom elements, AND the margin-top:auto spacing on footer-group.
  // We just subtract what is already used INSIDE the letter body above the text.
  //
  //   avail1 = lhBody.offsetHeight
  //           − (height of To block, if visible)
  //           − (height of subject line, if visible)
  //           − padding-top of letter body (20px)
  //           − gap between elements (14px × number of visible items above text)
  //           − sealH (seal is below text, inside letter body)
  //           − 8px safety buffer

  // Seal inside letter body
  const _sealEl  = document.getElementById('docLetterSeal');
  const _sealH   = (_sealEl && window.getComputedStyle(_sealEl).display !== 'none')
    ? _sealEl.offsetHeight + 14  // +14px gap
    : 0;

  // Elements inside docLetterBody that sit ABOVE the text
  const _toEl   = document.getElementById('docLetterTo');
  const _subjEl = document.getElementById('docLetterSubject');
  let _aboveH   = 20; // padding-top of doc-letter-body
  let _gapCount = 0;
  if (_toEl   && window.getComputedStyle(_toEl).display   !== 'none') { _aboveH += _toEl.offsetHeight;   _gapCount++; }
  if (_subjEl && window.getComputedStyle(_subjEl).display !== 'none') { _aboveH += _subjEl.offsetHeight; _gapCount++; }
  _aboveH += _gapCount * 14; // gap:14px between items in doc-letter-body

  const avail1 = lhBody.offsetHeight - _aboveH - _sealH - 8;

  // If everything fits — nothing to do
  if (naturalH <= avail1 + 4) return;

  // ── Need multiple pages — split paragraphs into page-sized chunks ──
  // Cont pages: header ~52px + padding 40px + footer 72px = 164px overhead
  const CONT_OVERHEAD = 200; // new header ~88px + footer 72px + padding 40px
  const AVAIL_CONT    = 1123 - CONT_OVERHEAD;

  const paragraphs = bodyText.split('\n');

  // Measure height of each paragraph using the probe
  const paraHeights = paragraphs.map(p => {
    if (!p.trim()) return parseFloat(bodyFontSize) * 1.75; // blank line height
    probe.textContent = p;
    document.body.appendChild(probe);
    const h = probe.getBoundingClientRect().height;
    document.body.removeChild(probe);
    return h + (parseFloat(bodyFontSize) * 1.75 * 0.5); // +half line gap between paras
  });

  // ── Split text into page-sized chunks ──────────────────────────
  // Strategy: measure each paragraph. If a single paragraph is too tall
  // to fit on a page, split it further at the word level.

  const measureH = (text) => {
    probe.textContent = text;
    document.body.appendChild(probe);
    const h = probe.getBoundingClientRect().height;
    document.body.removeChild(probe);
    return h;
  };

  // Split a paragraph that is too tall by binary-searching word boundaries
  const splitPara = (para, cap) => {
    const words  = para.split(' ');
    const chunks = [];
    let lo = 0;
    while (lo < words.length) {
      let hi = words.length;
      // Binary search: find max words that fit within cap
      let mid, best = lo;
      while (lo < hi) {
        mid = Math.floor((lo + hi + 1) / 2);
        const slice = words.slice(best, mid).join(' ');
        if (measureH(slice) <= cap) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }
      if (lo === best) lo++; // always advance at least one word
      chunks.push(words.slice(best, lo).join(' '));
      best = lo;
    }
    return chunks;
  };

  const pages = [];       // each entry: string (ready to display)
  let curLines = [];      // paragraphs/sub-paragraphs for current page
  let curH     = 0;
  let isFirstPage = true;
  const capacity  = () => isFirstPage ? avail1 : AVAIL_CONT;

  const flushPage = () => {
    if (curLines.length > 0) {
      pages.push(curLines.join('\n'));
      curLines = [];
      curH     = 0;
      isFirstPage = false;
    }
  };

  for (let i = 0; i < paragraphs.length; i++) {
    const para      = paragraphs[i];
    const ph        = paraHeights[i];
    const cap       = capacity();
    const remaining = cap - curH;

    if (ph <= remaining) {
      // Fits entirely — add it
      curLines.push(para);
      curH += ph;
    } else {
      // Doesn't fit in remaining space.
      // Step 1: split only what fits in `remaining` for the current page.
      // Step 2: split the rest into full-cap chunks for subsequent pages.

      let leftover = para;

      // Only try to fill remaining if there's a meaningful amount (>30px)
      if (remaining > 30) {
        const fitChunks = splitPara(leftover, remaining);
        // fitChunks[0] is the portion that fits in `remaining`
        if (fitChunks.length > 0 && measureH(fitChunks[0]) <= remaining) {
          curLines.push(fitChunks[0]);
          curH += measureH(fitChunks[0]);
          leftover = fitChunks.slice(1).join(' ');
        }
      }

      // Flush current page (it's now full or we skipped filling it)
      flushPage();

      // Split remaining text into full-page chunks
      if (leftover.trim()) {
        const restChunks = splitPara(leftover, capacity());
        for (const chunk of restChunks) {
          const ch = measureH(chunk);
          if (curH + ch > capacity() && curLines.length > 0) flushPage();
          curLines.push(chunk);
          curH += ch;
        }
      }
    }
  }
  flushPage();

  if (pages.length <= 1) return; // everything fit after all

  // ── Apply page 1 text (trimmed to what fits) ──────────────────
  lhTextEl.textContent = pages[0];

  // ── Create continuation pages ─────────────────────────────────
  const previewPane = document.querySelector('.preview-pane');
  const totalPages  = pages.length;

  // Insert "Page 1 of N" label after docPage
  const sep1 = document.createElement('div');
  sep1.className   = 'doc-page-separator';
  sep1.textContent = 'Page 1 of ' + totalPages;
  docPage.after(sep1);

  pages.slice(1).forEach((chunk, pi) => {
    const pageNum = pi + 2;
    const sep = document.createElement('div');
    sep.className   = 'doc-page-separator';
    sep.textContent = 'Page ' + pageNum + ' of ' + totalPages;

    const pg = document.createElement('div');
    pg.className = 'doc-page doc-lh-page';
    [...docPage.classList].filter((c) => c.startsWith('tpl-')).forEach((c) => pg.classList.add(c));
    pg.style.setProperty('--doc-accent', accentColor);
    pg.style.setProperty('--doc-text',   textColor);
    pg.style.setProperty('--doc-header-bg', state.colors.header || '#f8f9fd');
    // ── Clone the real page-1 header so continuation pages look identical ──
    const _origHeader = document.getElementById('docHeader');
    const _clonedHeader = _origHeader ? _origHeader.cloneNode(true) : null;
    if (_clonedHeader) {
      // Remove the id to avoid duplicates; add page number to the ref block
      _clonedHeader.removeAttribute('id');
      const _refEl  = _clonedHeader.querySelector('#docRefNo');
      const _dateEl = _clonedHeader.querySelector('#docDateLine');
      const _validEl= _clonedHeader.querySelector('#docValidLine');
      if (_refEl)   { _refEl.removeAttribute('id');  }
      if (_dateEl)  { _dateEl.removeAttribute('id'); }
      if (_validEl) { _validEl.style.display = 'none'; } // hide Valid Until on cont pages
      // Add "Page X of N" as a small line below ref
      if (_refEl) {
        const _pgLabel = document.createElement('div');
        _pgLabel.style.cssText = 'font-size:10px;opacity:0.55;margin-top:2px';
        _pgLabel.textContent = 'Page ' + pageNum + ' of ' + totalPages + ' — Continued';
        _refEl.after(_pgLabel);
      }
    }

    // Build body + footer as HTML string, prepend cloned header as DOM node
    const _bodyHtml =
      '<div style="padding:20px 36px;flex:1;overflow:hidden;min-height:0;display:flex;flex-direction:column;gap:10px;">' +
        (refNoText ? '<div style="font-size:11px;font-weight:600;color:' + accentColor + ';letter-spacing:0.3px">Ref: ' + escHtml(refNoText) + '</div>' : '') +
        '<div style="font-family:' + bodyFont + ';font-size:' + bodyFontSize + ';line-height:1.75;color:' + textColor + ';white-space:pre-wrap;">' + escHtml(chunk) + '</div>' +
      '</div>' +
      '<div class="doc-footer' + (isDark ? ' dark-footer' : '') + '" style="flex-shrink:0;background:' + footerBg + ';border-top-color:' + accentColor + '">' +
        '<div class="doc-footer-company" style="color:' + ftTextColor + '">' + escHtml(footerLeft) + '</div>' +
        '<div class="doc-footer-contact">' + escHtml(footerContact) + '</div>' +
        '<div class="doc-footer-right">' + escHtml(footerRight) + '</div>' +
      '</div>' +
      (_fullAddr ? '<div class="doc-footer-addr-bar" style="background:#f5f5f0;border-top:1px solid #e0e0da;color:' + accentColor + '">' + escHtml(_fullAddr) + '</div>' : '');

    // Set body + footer HTML, then prepend the cloned header DOM node
    pg.innerHTML = _bodyHtml;
    if (_clonedHeader) pg.insertBefore(_clonedHeader, pg.firstChild);

    previewPane.appendChild(sep);
    previewPane.appendChild(pg);
  });
}

// ===== COLOR THEME =====
function isColorDark(hex) {
  try {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 140;
  } catch { return false; }
}

function applyColor(which, value) {
  state.colors[which] = value;
  const sw = document.getElementById('swatch' + cap(which));
  const hx = document.getElementById('hex' + cap(which));
  if (sw) sw.style.background = value;
  if (hx) hx.value = value;
  if (which === 'accent') {
    const linked = document.getElementById('footerBgLinkAccent');
    if (linked && linked.checked) _syncFooterBgToAccent(value);
  }
  applyColors();
}

function toggleFooterBgLink() {
  const linked = document.getElementById('footerBgLinkAccent');
  if (linked && linked.checked) _syncFooterBgToAccent(state.colors.accent);
}

function _syncFooterBgToAccent(accentVal) {
  state.colors.footerBg = accentVal;
  const el = document.getElementById('colorFooterBg'); if (el) el.value = accentVal;
  const sw = document.getElementById('swatchFooterBg'); if (sw) sw.style.background = accentVal;
  const hx = document.getElementById('hexFooterBg');   if (hx) hx.value = accentVal;
}

function applyColorHex(which, value) {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
    state.colors[which] = value;
    const el = document.getElementById('color' + cap(which));
    if (el) el.value = value;
    const sw = document.getElementById('swatch' + cap(which));
    if (sw) sw.style.background = value;
    applyColors();
  }
}

// ══════════════════════════════════════════════════════════
// DOCUMENT LAYOUT — classic | executive | minimal (unknown / legacy ids → classic)
// ══════════════════════════════════════════════════════════
const DOCUMENT_TEMPLATE_IDS = ['classic', 'executive', 'minimal'];

function normalizeTemplateId(_id) {
  const s = String(_id || '').toLowerCase().trim();
  if (DOCUMENT_TEMPLATE_IDS.indexOf(s) !== -1) return s;
  return 'classic';
}

function applyTemplate(_id, doSync = true) {
  const tid = normalizeTemplateId(_id);
  state.template = tid;
  const docPage = document.getElementById('docPage');
  if (!docPage) return;
  [...docPage.classList].filter((c) => c.startsWith('tpl-')).forEach((c) => docPage.classList.remove(c));
  docPage.classList.add('tpl-' + tid);
  const hdr = document.getElementById('docHeader');
  if (hdr) hdr.removeAttribute('data-stamp');
  const tplSel = document.getElementById('docTemplateSelect');
  if (tplSel && tplSel.value !== tid) tplSel.value = tid;
  applyColors();
  if (doSync) syncDoc();
  requestAnimationFrame(() => setTimeout(checkPageOverflow, 60));
}

function applyColors() {
  const docPage = document.getElementById('docPage');
  if (!docPage) return;
  const tpl = state.template || 'classic';
  const accent = state.colors.accent;
  const header = state.colors.header;
  const text = state.colors.text;
  const footerBg = state.colors.footerBg || '#ffffff';
  docPage.style.setProperty('--doc-accent', accent);
  docPage.style.setProperty('--doc-text', text);
  docPage.style.setProperty('--doc-header-bg', header);
  docPage.style.setProperty('--doc-footer-bg', footerBg);
  // Derived vars: contrast text on accent / footer backgrounds
  docPage.style.setProperty('--doc-accent-text', isColorDark(accent) ? '#fff' : text);
  docPage.style.setProperty('--doc-footer-text', isColorDark(footerBg) ? '#fff' : accent);
  document.querySelectorAll('.doc-table thead tr').forEach(tr => {
    tr.style.background = accent;
  });
  document.querySelectorAll('.doc-header').forEach(el => {
    if (tpl === 'executive') {
      el.style.background = accent;
      el.style.borderBottom = 'none';
    } else if (tpl === 'minimal') {
      el.style.background = 'transparent';
      el.style.borderBottom = '';
    } else {
      el.style.background = '';
      el.style.borderBottom = '';
      el.style.borderBottomColor = accent;
      el.style.borderBottomWidth = '';
      el.style.borderBottomStyle = '';
    }
  });
  document.querySelectorAll('.doc-meta').forEach(el => {
    if (tpl === 'minimal') {
      el.style.background = `linear-gradient(180deg, ${header} 0%, #ffffff 72%)`;
      el.style.borderBottom = '1px solid rgba(0,0,0,0.07)';
    } else {
      el.style.background = header;
      el.style.borderBottom = '';
    }
  });
  document.querySelectorAll('.doc-meta-label, .doc-bank-label, .doc-terms-label, .doc-notes-label').forEach(el => {
    el.style.color = accent;
  });
  document.querySelectorAll('.doc-doc-type').forEach(el => {
    if (tpl === 'executive' && el.closest('.doc-header')) {
      el.style.color = '#ffffff';
    } else {
      el.style.color = accent;
    }
  });
  document.querySelectorAll('.doc-company-name-fallback, .doc-company-name-with-logo').forEach(el => {
    el.style.color = accent;
    el.style.opacity = '';
  });
  document.querySelectorAll('.doc-title-meta .doc-ref-number, .doc-title-meta .doc-date-line').forEach(el => {
    if (tpl === 'executive' && el.closest('.doc-header')) {
      el.style.color = 'rgba(255,255,255,0.92)';
    } else {
      el.style.removeProperty('color');
    }
  });
  document.querySelectorAll('.doc-totals-table .grand-total td:first-child').forEach(el => {
    el.style.borderTopColor = accent;
  });
  document.querySelectorAll('.doc-totals-table .grand-total td:last-child').forEach(el => {
    el.style.color = accent;
    el.style.borderTopColor = accent;
  });
  // Footer background — apply to all footers (main + any annexure page)
  const footerCompanyColor = isColorDark(footerBg) ? '#fff' : accent;
  document.querySelectorAll('.doc-footer').forEach(footer => {
    footer.style.background    = footerBg;
    footer.style.borderTopColor = accent;
  });
  document.querySelectorAll('.doc-footer-company').forEach(el => {
    el.style.color = footerCompanyColor;
  });
  // Keep dark-footer class on main footer for any CSS that uses it
  const mainFooter = document.getElementById('docFooter');
  if (mainFooter) mainFooter.classList.toggle('dark-footer', isColorDark(footerBg));
}

function applyFont() {
  const font = document.getElementById('docFont').value;
  document.getElementById('docPage').style.fontFamily = font;
  requestAnimationFrame(() => setTimeout(checkPageOverflow, 50));
}

function applyPreset(name) {
  const presets = {
    red:   { accent: '#C8171E', header: '#fdf8f8', text: '#1a1a2e', footerBg: '#C8171E' },
    navy:  { accent: '#1a3a6b', header: '#f0f4fb', text: '#0d1b2e', footerBg: '#1a3a6b' },
    green: { accent: '#1a6b3a', header: '#f0fbf4', text: '#0d2e1a', footerBg: '#1a6b3a' },
    gold:  { accent: '#b8860b', header: '#fdfbf0', text: '#2e2010', footerBg: '#b8860b' },
    slate: { accent: '#334155', header: '#f0f2f5', text: '#0f172a', footerBg: '#334155' },
  };
  const p = presets[name];
  if (!p) return;
  state.colors = { ...p };
  Object.keys(p).forEach(k => {
    const el = document.getElementById('color' + cap(k));
    if (el) el.value = p[k];
    const sw = document.getElementById('swatch' + cap(k));
    if (sw) sw.style.background = p[k];
    const hx = document.getElementById('hex' + cap(k));
    if (hx) hx.value = p[k];
  });
  applyColors();
  showNotification('✓ Preset applied');
}

// ===== HELPERS =====
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function formatDate(d) {
  if (!d) return '';
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function formatCurrency(n) {
  const sym = CURRENCY_SYMBOLS[document.getElementById('currency').value] || '';
  return sym + (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== AMOUNT IN WORDS =====
function numberToWords(amount, currency = 'INR') {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

  function words(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '') + ' ';
    if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred ' + words(n%100);
    if (n < 100000) return words(Math.floor(n/1000)) + 'Thousand ' + words(n%1000);
    if (n < 10000000) return words(Math.floor(n/100000)) + 'Lakh ' + words(n%100000);
    return words(Math.floor(n/10000000)) + 'Crore ' + words(n%10000000);
  }

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const mainLabel = currency === 'INR' ? 'Rupees' : (currency === 'USD' ? 'Dollars' : currency);
  const subLabel = currency === 'INR' ? 'Paise' : 'Cents';

  let result = (words(rupees) || 'Zero ') + mainLabel;
  if (paise > 0) result += ' and ' + words(paise) + subLabel;
  result += ' Only';
  return result.replace(/\s+/g, ' ').trim();
}

// ===== GST SLABS =====
function getGstSlabs() {
  const raw = (document.getElementById('gstSlabs') || {}).value || '0,5,12,18,28';
  return raw.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n)).sort((a,b) => a-b);
}

function buildGstOptions(selectEl, currentVal) {
  const slabs = getGstSlabs();
  const cur = parseFloat(currentVal);
  const all = new Set([...slabs, cur]);
  [...all].sort((a,b) => a-b).forEach(v => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v + '%';
    if (v === cur) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

function applyGstSlabs() {
  const slabs = getGstSlabs();
  const gstRateEl = document.getElementById('gstRate');
  if (gstRateEl) {
    const cur = gstRateEl.value;
    gstRateEl.innerHTML = '';
    slabs.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v + '%';
      if (String(v) === String(cur)) opt.selected = true;
      gstRateEl.appendChild(opt);
    });
  }
  // Also rebuild per-item GST dropdowns
  document.querySelectorAll('.item-gst-select').forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = '';
    slabs.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v + '%';
      if (String(v) === String(cur)) opt.selected = true;
      sel.appendChild(opt);
    });
  });
  syncDoc();
}

// ===== GST AUTO-DETECT =====
const GST_STATE_CODES = {
  '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
  '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
  '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
  '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
  '20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat',
  '25':'Daman & Diu','26':'Dadra & Nagar Haveli','27':'Maharashtra','28':'Andhra Pradesh',
  '29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu',
  '34':'Puducherry','35':'Andaman & Nicobar','36':'Telangana','37':'Andhra Pradesh (new)',
  '38':'Ladakh','97':'Other Territory','99':'Centre Jurisdiction'
};

function _autoSelectState(gstinId, stateSelectId) {
  const gstin = (document.getElementById(gstinId) || {}).value || '';
  const code  = gstin.trim().substring(0, 2);
  if (!/^[0-9]{2}$/.test(code)) return;
  const sel = document.getElementById(stateSelectId);
  if (!sel) return;
  sel.value = code;           // option values are already '01','08' etc.
  autoDetectGstType();
}

function autoDetectGstType() {
  const gstTypeEl = document.getElementById('gstType');
  if (!gstTypeEl || gstTypeEl.value !== 'auto') return;

  const sellerGstin  = (document.getElementById('companyGstin') || {}).value || '';
  const sellerState  = (document.getElementById('sellerState')  || {}).value || '';
  const buyerState   = (document.getElementById('buyerState')   || {}).value || '';
  const showShipTo   = document.getElementById('showShipTo');
  const shipToState  = (document.getElementById('shipToState')  || {}).value || '';
  const sameChk      = document.getElementById('shipSameAsBilling');
  const useSameAsBilling = sameChk ? sameChk.checked : true;

  const sellerCode = sellerState || sellerGstin.substring(0, 2);
  const shipCode   = (!useSameAsBilling && showShipTo && showShipTo.checked && shipToState) ? shipToState : buyerState;
  const buyerCode  = shipCode || buyerState;

  if (!sellerCode || !buyerCode) return;

  // Same state = CGST + SGST; different state = IGST
  const isIntra = sellerCode === buyerCode;
  state.resolvedGstType = isIntra ? 'cgst_sgst' : 'igst';

  // Reflect in doc
  syncDoc();
}

// ===== WATERMARK UPLOAD =====
function handleWatermarkUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showNotification('Watermark too large. Max 2MB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    state.watermarkData = e.target.result;
    const wmImg = document.getElementById('watermarkImg');
    if (wmImg) { wmImg.src = state.watermarkData; wmImg.style.display = 'block'; }
    DM.saveWatermark(state.watermarkData);
    syncWatermark();
  };
  reader.readAsDataURL(file);
}

function removeWatermark() {
  state.watermarkData = null;
  const wmImg = document.getElementById('watermarkImg');
  if (wmImg) { wmImg.src = ''; wmImg.style.display = 'none'; }
  const wmInput = document.getElementById('watermarkInput');
  if (wmInput) wmInput.value = '';
  DM.deleteWatermark();
  syncWatermark();
}

// ===== ITEM DRAG & DROP =====
let _dragSrcId = null;

function dragStart(e, id) {
  _dragSrcId = id;
  e.dataTransfer.effectAllowed = 'move';
}

function dragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const tr = e.target.closest('tr');
  if (tr) {
    document.querySelectorAll('#itemsBody tr').forEach(r => r.classList.remove('drag-over'));
    tr.classList.add('drag-over');
  }
}

function dropItem(e, targetId) {
  e.preventDefault();
  document.querySelectorAll('#itemsBody tr').forEach(r => r.classList.remove('drag-over'));
  if (_dragSrcId === targetId) return;
  const srcIdx = state.items.findIndex(i => i.id === _dragSrcId);
  const tgtIdx = state.items.findIndex(i => i.id === targetId);
  if (srcIdx < 0 || tgtIdx < 0) return;
  const [moved] = state.items.splice(srcIdx, 1);
  state.items.splice(tgtIdx, 0, moved);
  renderItems();
  syncDoc();
}

// ===== EXCEL ITEM IMPORT =====
function handleExcelImport(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rows.length < 2) { showNotification('No data found in Excel', 'error'); return; }
      const header = rows[0].map(h => String(h).toLowerCase().trim());
      const getCol = names => { for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; } return -1; };
      const descI  = getCol(['description','desc','item','product','particulars','name']);
      const specI  = getCol(['spec','specification','hsn','hsn/sac']);
      const qtyI   = getCol(['qty','quantity','nos']);
      const unitI  = getCol(['unit','uom']);
      const rateI  = getCol(['rate','price','unit price','unit rate','amount']);
      const gstI   = getCol(['gst%','gst rate','gst','tax%','tax rate']);
      if (descI < 0) { showNotification('Could not find description column', 'error'); return; }
      let added = 0;
      rows.slice(1).forEach(row => {
        const desc = String(row[descI] || '').trim();
        if (!desc) return;
        addItem({
          desc,
          spec:    specI >= 0  ? String(row[specI]  || '') : '',
          qty:     qtyI  >= 0  ? parseFloat(row[qtyI])  || 1 : 1,
          unit:    unitI >= 0  ? String(row[unitI] || 'Nos') : 'Nos',
          rate:    rateI >= 0  ? parseFloat(row[rateI]) || 0 : 0,
          gstRate: gstI  >= 0  ? parseFloat(row[gstI])  || 18 : 18,
        });
        added++;
      });
      showNotification('Imported ' + added + ' items ✓');
    } catch(err) { showNotification('Import error: ' + err.message, 'error'); }
    input.value = '';
  };
  reader.readAsBinaryString(file);
}

// ===== NOTIFICATION =====
function showToast(msg, type='ok') { showNotification(msg, type === 'ok' ? 'success' : type); }
function showNotification(msg, type = 'success') {
  const el = document.getElementById('notification');
  el.textContent = msg;
  el.style.borderLeftColor = type === 'error' ? '#ef4444' : '#22c55e';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ===== RESPONSIVE / MOBILE =====
function setMobileView(view) {
  const sidebar    = document.querySelector('.sidebar');
  const preview    = document.querySelector('.preview-pane');
  const editBtn    = document.getElementById('mobileEditBtn');
  const previewBtn = document.getElementById('mobilePreviewBtn');
  if (!sidebar || !preview) return;
  if (view === 'edit') {
    sidebar.removeAttribute('data-hidden');
    preview.setAttribute('data-hidden', 'true');
    if (editBtn)    editBtn.classList.add('active');
    if (previewBtn) previewBtn.classList.remove('active');
  } else {
    sidebar.setAttribute('data-hidden', 'true');
    preview.removeAttribute('data-hidden');
    if (editBtn)    editBtn.classList.remove('active');
    if (previewBtn) previewBtn.classList.add('active');
    scaleDocument();
  }
}

function scaleDocument() {
  const preview = document.querySelector('.preview-pane');
  if (!preview) return;
  const DOC_W   = 794;
  const availW  = preview.clientWidth - 24;
  if (availW <= 0) return;
  const scale = Math.min(1, availW / DOC_W);
  document.querySelectorAll('.preview-pane > .doc-page, .preview-pane > .doc-annexure-page').forEach(page => {
    if (scale < 1) {
      page.style.transform       = 'scale(' + scale + ')';
      page.style.transformOrigin = 'top center';
      page.style.marginBottom    = '-' + Math.round(page.offsetHeight * (1 - scale)) + 'px';
      page.style.marginTop       = '8px';
    } else {
      page.style.transform       = '';
      page.style.transformOrigin = '';
      page.style.marginBottom    = '';
    }
  });
  document.querySelectorAll('.doc-page-separator').forEach(sep => {
    sep.style.width = (DOC_W * scale) + 'px';
  });
}

let _resizeTimer;
window.addEventListener('resize', function() {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(function() {
    scaleDocument();
    if (window.innerWidth > 640) {
      const sidebar = document.querySelector('.sidebar');
      const preview = document.querySelector('.preview-pane');
      if (sidebar) sidebar.removeAttribute('data-hidden');
      if (preview) preview.removeAttribute('data-hidden');
    }
  }, 60);
});

// ===== DATA MANAGER =====
// Centralised file-system storage. All data lives in the user-chosen folder.
// ===== DEFAULTS (global wrappers for DM methods) =====
function saveDefaults() {
  // Only persist the active company pointer — all profile data lives in companies table
  DM.saveDefaults({
    _activeCompanyId: state.activeCompanyId || null,
    companyName:      (document.getElementById('companyName') || {}).value || ''
  });
}

function loadDefaults() {
  const d = DM.getDefaults();
  if (d?._activeCompanyId) state.activeCompanyId = d._activeCompanyId;
}


const DM = (() => {
  const URL = 'https://ncswfxrbhyjhjvzeepwf.supabase.co';
  const KEY = 'sb_publishable_lIOdxplC0bGpLKewX5XfwA_tsqNwMqF';

  // ── State ──
  let _sb       = null;
  let _user     = null;
  let _companies = [];          // [{id:UUID, companyName, ...allProfileFields}]
  let _clients   = {};          // {companyUUID: [{id:UUID, name, gstin, ...}]}
  let _images    = {};          // {companyUUID: {logo, watermark, brandLogos, productImages}}
  let _session   = null;        // last document state
  let _defaults  = null;        // {_activeCompanyId, ...}
  let _quotCache = {};          // {companyUUID:docType: [...]}
  let _flushT    = null;
  let _imgFlushT = null;
  /** Serializes _onLogin — SIGNED_IN and getSession() both call it; parallel runs cleared _companies and raced. */
  let _onLoginChain = Promise.resolve();
  /** Set when _onLoginBody finished successfully — avoids duplicate full loads for users with 0 companies (INITIAL_SESSION + getSession). */
  let _loginReadyUserId = null;

  // ── Supabase client (localStorage — no IndexedDB lock) ──
  function sb() {
    if (!_sb) _sb = window.supabase.createClient(URL, KEY, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true,
              storageKey:'qg-auth-v2', storage:window.localStorage }
    });
    return _sb;
  }
  const uid  = () => _user ? _user.id : null;
  const cid  = () => (typeof state!=='undefined' && state.activeCompanyId) ? String(state.activeCompanyId) : null;

  // ── Flush user_data (session + defaults only) ──
  async function _flush() {
    if (!uid()) return;
    const { error } = await sb().from('user_data')
      .upsert({ user_id:uid(), data:{ session:_session, defaults:_defaults }, version:2 }, { onConflict:'user_id' });
    if (error) console.error('[DB] flush:', error.message);
  }
  function _scheduleFlush() { clearTimeout(_flushT); _flushT = setTimeout(_flush, 800); }

  // ── Flush user_images ──
  async function _flushImages() {
    if (!uid()) return;
    const { error } = await sb().from('user_images')
      .upsert({ user_id:uid(), data:_images }, { onConflict:'user_id' });
    if (error) console.error('[DB] flushImages:', error.message);
  }
  function _scheduleFlushImages() { clearTimeout(_imgFlushT); _imgFlushT = setTimeout(_flushImages, 1500); }

  // ── Load companies from DB ──
  async function _loadCompanies() {
    const { data, error } = await sb().from('companies')
      .select('id, name, profile, local_id, created_at')
      .eq('user_id', uid()).order('created_at', { ascending:true });
    if (error) { console.error('[DB] loadCompanies:', error.message); return; }
    // CRITICAL: id must come LAST so profile.id (old numeric) never overwrites the real UUID
    _companies = (data||[]).map(r => ({ ...(r.profile||{}), id:r.id, local_id:r.local_id,
                                         name: r.profile?.companyName || r.name || '' }));
    console.log('[DB] companies loaded:', _companies.length);
  }

  // ── Load clients for one company ──
  async function _loadClients(companyId) {
    if (!companyId) return;
    const { data, error } = await sb().from('clients')
      .select('id, name, gstin, address, buyer_state, contacts, ship_addresses')
      .eq('company_id', companyId).eq('user_id', uid())
      .order('created_at', { ascending:false });
    if (error) { console.error('[DB] loadClients:', error.message); return; }
    _clients[companyId] = (data||[]).map(r => ({
      id:r.id, name:r.name, gstin:r.gstin||'', address:r.address||'',
      buyerState:r.buyer_state||'', contacts:r.contacts||[], shipAddresses:r.ship_addresses||[]
    }));
    console.log('[DB] clients loaded:', _clients[companyId].length, 'for', companyId);
  }

  // ── Load images ──
  async function _loadImages() {
    const { data } = await sb().from('user_images')
      .select('data').eq('user_id', uid()).maybeSingle();
    _images = (data?.data) || {};
  }

  // ── v1 → v2 migration ──
  async function _migrate(oldData, oldImages) {
    console.log('[MIGRATE] v1 → v2 starting...');
    const oldCompanies = oldData['_companies'] || [];
    for (const comp of oldCompanies) {
      const oldId  = String(comp.id);
      const profile = { ...(oldData['_profile_'+oldId] || {}) };
      delete profile.id; delete profile.local_id;
      const clients = oldData['_clients_'+oldId] || [];

      // Insert or find company
      let uuid;
      const { data:existing } = await sb().from('companies')
        .select('id').eq('user_id', uid()).eq('local_id', oldId).maybeSingle();
      if (existing) {
        uuid = existing.id;
      } else {
        const { data:ins, error } = await sb().from('companies')
          .insert({ user_id:uid(), local_id:oldId, name:profile.companyName||comp.name||'', profile })
          .select('id').maybeSingle();
        if (error || !ins) { console.error('[MIGRATE] company insert failed:', error?.message); continue; }
        uuid = ins.id;
      }

      // Migrate clients
      for (const cl of clients) {
        const { data:exCl } = await sb().from('clients')
          .select('id').eq('company_id', uuid).eq('user_id', uid())
          .eq('name', cl.name||'').maybeSingle();
        if (!exCl) {
          await sb().from('clients').insert({
            company_id:uuid, user_id:uid(), name:cl.name||'', gstin:cl.gstin||'',
            address:cl.address||'', buyer_state:cl.buyerState||'',
            contacts:cl.contacts||[], ship_addresses:cl.shipAddresses||[]
          });
        }
      }

      // Update saved_quotations refs
      await sb().from('saved_quotations')
        .update({ company_ref:uuid }).eq('user_id', uid()).eq('company_ref', oldId);

      // Migrate images
      const imgEntry = {};
      const imgSrc   = { ...(oldImages||{}), ...oldData };
      if (imgSrc['_logo_'+oldId])          imgEntry.logo          = imgSrc['_logo_'+oldId];
      if (imgSrc['_watermark_'+oldId])     imgEntry.watermark     = imgSrc['_watermark_'+oldId];
      if (imgSrc['_brandLogos_'+oldId])    imgEntry.brandLogos    = imgSrc['_brandLogos_'+oldId];
      if (imgSrc['_productImages_'+oldId]) imgEntry.productImages = imgSrc['_productImages_'+oldId];
      if (Object.keys(imgEntry).length)    _images[uuid]          = imgEntry;

      // Fix defaults._activeCompanyId if it was this old ID
      if (_defaults?._activeCompanyId === oldId || _defaults?._activeCompanyId == comp.id) {
        _defaults._activeCompanyId = uuid;
      }
    }

    _session  = oldData['_session']  || null;
    _defaults = { ...(_defaults||{}), ...((oldData['_defaults'])||{}),
                  _activeCompanyId: _defaults?._activeCompanyId || null };

    await _flushImages();
    await _flush();
    console.log('[MIGRATE] done. _defaults.activeCompanyId:', _defaults._activeCompanyId);
  }

  function _resetAuthSubmitAfterLoginAttempt() {
    const btn = document.getElementById('qg-auth-submit');
    if (!btn || btn.dataset.mode === 'forgot') return;
    btn.disabled = false;
    btn.textContent = btn.dataset.mode === 'signup' ? 'Create Account' : 'Sign In';
  }

  // ── Login (body; run only via _onLogin queue) ──
  async function _onLoginBody(user) {
    // Guard: same user already completed a load (including 0 companies — do not run twice from INITIAL_SESSION + getSession).
    if (_user?.id === user.id && _loginReadyUserId === user.id) {
      _user = user; _updatePill();
      console.log('[LOGIN] same user re-auth, skipping reinit');
      return;
    }
    console.log('[LOGIN] loading for', user.email);
    _user = user;
    _loginReadyUserId = null;
    _companies=[]; _clients={}; _images={}; _quotCache={};

    // Load stored user_data
    const { data:row, error: rowErr } = await sb().from('user_data')
      .select('data, version').eq('user_id', uid()).maybeSingle();
    if (rowErr) console.warn('[LOGIN] user_data:', rowErr.message);
    console.log('[LOGIN] step user_data ok');
    const storedData = row?.data || {};
    const version    = row?.version || 1;

    _session  = storedData.session  || null;
    _defaults = storedData.defaults || null;

    // Heal numeric activeCompanyId
    const storedCid = _defaults?._activeCompanyId;
    if (storedCid && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(storedCid))) {
      if (_defaults) _defaults._activeCompanyId = null;
    }

    // ── PARALLEL: load companies + images at same time ──
    const [_, imgRes] = await Promise.all([
      _loadCompanies(),
      sb().from('user_images').select('data').eq('user_id', uid()).maybeSingle()
    ]);
    if (imgRes?.error) console.warn('[LOGIN] user_images:', imgRes.error.message);
    _images = imgRes?.data?.data || {};
    console.log('[LOGIN] step companies+images ok');

    if (version < 2) {
      await _migrate(storedData, _images);
      console.log('[LOGIN] step migrate ok');
    }

    // Restore active company
    await _restoreProfile();
    console.log('[LOGIN] step restoreProfile ok');

    // Load clients (single query)
    if (state.activeCompanyId) await _loadClients(state.activeCompanyId);
    console.log('[LOGIN] step clients ok');

    // ── Update UI
    _hideLoginUI();
    _updatePill();
    state.viewingLocked  = null;
    state.activeClientId = null;
    state.items          = [];
    state.contacts       = [];
    if (typeof loadState         === 'function') loadState();
    if (!state.items?.length && typeof addItem === 'function') addItem();
    if (typeof renderClientDb    === 'function') renderClientDb();
    if (typeof applyColors       === 'function') applyColors();
    if (typeof applyGstSlabs     === 'function') applyGstSlabs();
    if (typeof syncWatermark     === 'function') syncWatermark();
    if (typeof autoDetectGstType === 'function') autoDetectGstType();
    if (typeof syncDoc           === 'function') syncDoc();
    console.log('[LOGIN] step ui sync ok');
    _loginReadyUserId = user.id;
    console.log('[LOGIN] done. activeCompanyId:', state.activeCompanyId);
  }

  /** Queue login work so SIGNED_IN and getSession never run two loads at once; always re-enables Sign In on failure. */
  function _onLogin(user) {
    if (!user?.id) return Promise.resolve();
    _onLoginChain = _onLoginChain
      .then(() => _onLoginBody(user))
      .catch(err => {
        console.error('[LOGIN]', err);
        const errEl = document.getElementById('qg-auth-err');
        const inOverlay = document.getElementById('qg-login-overlay');
        const msg = 'Could not load your account. ' + (err?.message || 'Check your connection and try again.');
        if (errEl && inOverlay) {
          errEl.textContent = msg;
          errEl.style.cssText = 'display:block;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:16px;background:rgba(200,23,30,0.12);color:#f87171;border:1px solid rgba(200,23,30,0.3)';
        }
        if (typeof showNotification === 'function') {
          try { showNotification(msg, 'error'); } catch (_) {}
        }
      })
      .finally(() => { _resetAuthSubmitAfterLoginAttempt(); });
    return _onLoginChain;
  }

  // ── Restore active company profile ──
  async function _restoreProfile() {
    if (!_companies.length) { console.log('[RESTORE] no companies'); return; }
    const savedId = _defaults?._activeCompanyId ? String(_defaults._activeCompanyId) : null;

    // 4-level fallback
    let p = null;
    if (savedId) p = _companies.find(c => c.id === savedId);
    if (!p && savedId) p = _companies.find(c => c.local_id === savedId);
    if (!p && _defaults?.companyName) p = _companies.find(c =>
      (c.companyName||c.name||'').toLowerCase() === _defaults.companyName.toLowerCase());
    if (!p) p = _companies[0];
    if (!p) return;

    state.activeCompanyId = p.id;
    console.log('[RESTORE] company:', p.id, p.companyName||p.name);

    // Persist correct UUID
    if (savedId !== p.id) {
      _defaults = { ...(_defaults||{}), _activeCompanyId:p.id };
      _scheduleFlush();
    }

    if (typeof _applyCompanyProfile === 'function') _applyCompanyProfile(p);
    if (typeof _updateCompanyPill   === 'function') _updateCompanyPill(p.companyName||p.name||'');
    await _loadImages();
    if (typeof DM !== 'undefined') await DM.loadProfileFolder(p.id);
  }

  // ── UI helpers ──
  function _showLoginUI() {
    if (document.getElementById('qg-login-overlay')) return;
    const el = document.createElement('div');
    el.id = 'qg-login-overlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)';
    el.innerHTML = `<div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:32px;width:360px;max-width:90vw">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px">Quotation Generator</div>
        <div style="font-size:13px;color:#888;margin-top:4px">Sign in to access your data</div>
      </div>
      <div id="qg-auth-err" style="display:none;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:16px;border:1px solid transparent"></div>
      <input id="qg-auth-email" type="email" placeholder="Email" autocomplete="email"
        style="width:100%;box-sizing:border-box;padding:10px 12px;background:#111;border:1px solid #333;border-radius:8px;color:#fff;font-size:14px;margin-bottom:10px;outline:none">
      <input id="qg-auth-pass" type="password" placeholder="Password" autocomplete="current-password"
        style="width:100%;box-sizing:border-box;padding:10px 12px;background:#111;border:1px solid #333;border-radius:8px;color:#fff;font-size:14px;margin-bottom:16px;outline:none">
      <button type="button" id="qg-auth-submit" data-mode="" onclick="DM._handleLogin()"
        style="width:100%;padding:11px;background:#c8171e;border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Sign In</button>
      <div style="text-align:right;margin-top:8px">
        <span id="qg-forgot-link" onclick="DM._showForgotPassword()" style="font-size:12px;color:#888;cursor:pointer;text-decoration:underline">Forgot password?</span>
      </div>
      <div id="qg-auth-toggle" style="text-align:center;margin-top:10px;font-size:13px;color:#888">
        Don't have an account? <span onclick="DM._toggleSignUp()" style="color:#c8171e;cursor:pointer;font-weight:600">Sign Up</span>
      </div>
    </div>`;
    document.body.appendChild(el);
  }
  function _hideLoginUI() { document.getElementById('qg-login-overlay')?.remove(); }
  function _decodeJwtPayload(token) {
    try {
      const mid = token.split('.')[1];
      if (!mid) return null;
      const pad = mid.length % 4 === 0 ? '' : '='.repeat(4 - (mid.length % 4));
      const json = atob(mid.replace(/-/g, '+').replace(/_/g, '/') + pad);
      return JSON.parse(json);
    } catch { return null; }
  }
  /** Recovery links from email often use PKCE (?code=...); JWT may include amr: ["recovery"]. */
  function _sessionIsPasswordRecovery(session) {
    if (!session?.access_token) return false;
    const p = _decodeJwtPayload(session.access_token);
    if (!p) return false;
    const amr = p.amr;
    if (Array.isArray(amr) && amr.includes('recovery')) return true;
    return false;
  }
  function _showSetPasswordUI() {
    if (document.getElementById('qg-login-overlay')) return;
    const el = document.createElement('div');
    el.id = 'qg-login-overlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)';
    el.innerHTML = `<div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:32px;width:380px;max-width:92vw">
      <div style="text-align:center;margin-bottom:18px">
        <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px">Set new password</div>
        <div style="font-size:13px;color:#888;margin-top:4px">Choose a new password for your account</div>
      </div>
      <div id="qg-auth-err" style="display:none;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:16px;border:1px solid transparent"></div>
      <input id="qg-auth-newpass" type="password" placeholder="New password" autocomplete="new-password"
        style="width:100%;box-sizing:border-box;padding:10px 12px;background:#111;border:1px solid #333;border-radius:8px;color:#fff;font-size:14px;margin-bottom:10px;outline:none">
      <input id="qg-auth-newpass2" type="password" placeholder="Confirm new password" autocomplete="new-password"
        style="width:100%;box-sizing:border-box;padding:10px 12px;background:#111;border:1px solid #333;border-radius:8px;color:#fff;font-size:14px;margin-bottom:16px;outline:none">
      <button id="qg-auth-submit" onclick="DM._handleSetPassword()"
        style="width:100%;padding:11px;background:#c8171e;border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Update Password</button>
      <div style="text-align:center;margin-top:10px;font-size:13px;color:#888">
        <span id="qg-reset-back" onclick="DM._resetToSignIn()" style="color:#c8171e;cursor:pointer;font-weight:600">← Back to Sign In</span>
      </div>
    </div>`;
    document.body.appendChild(el);
  }

  function _isRecoveryUrl() {
    try {
      const url = new URL(window.location.href);
      const qType = url.searchParams.get('type');
      const h = (url.hash || '').replace(/^#/, '');
      const hParams = new URLSearchParams(h);
      const hType = hParams.get('type');
      return (qType && qType.toLowerCase() === 'recovery') || (hType && hType.toLowerCase() === 'recovery');
    } catch { return false; }
  }
  function _cleanAuthUrl() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('type');
      history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') + '');
      if (window.location.hash) history.replaceState({}, document.title, window.location.pathname + window.location.search);
    } catch {}
  }

  function _updatePill() {
    const txt  = document.getElementById('workspacePillText');
    const pill = document.getElementById('workspacePill');
    // Pill always opens Company Profiles modal (switch / create / sign out all live there)
    if (pill) pill.onclick = () => { if (typeof openCompanyProfiles==='function') openCompanyProfiles(); };
    // Just update the displayed text
    if (!_user && txt) txt.textContent = 'No Profile';
    // Company name is set via _updateCompanyPill — don't overwrite with email
  }
  function _updateCompanyPill(name) {
    const txt  = document.getElementById('workspacePillText');
    const icon = document.getElementById('workspacePillIcon');
    if (txt)  txt.textContent    = name || 'No Profile';
    if (icon) icon.style.display = name ? '' : 'none';
  }

  window.addEventListener('beforeunload', () => { _flush(); _flushImages(); });

  // ════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════
  return {
    isLoggedIn:        () => !!_user,
    hasFolder:         () => !!_user,
    refreshQuotations: () => { _quotCache = {}; },
    flushNow:          () => _scheduleFlush(),

    // ── Auth ──
    async init() {
      // Extensions (Grammarly, MS Editor, "Read" tools, etc.) inject content.js/read.js and
      // often log "Host validation failed" / "not in insights whitelist" on localhost — not from this app.
      if (/^localhost$|^127\.0\.0\.1$/i.test(location.hostname)) {
        console.info('[QG] If login hangs, try InPrivate/Incognito with extensions off — see DEV-SERVER.txt (Host validation).');
      }
      // Show appropriate overlay immediately — no waiting for session check
      if (_isRecoveryUrl()) _showSetPasswordUI();
      else _showLoginUI();
      _updatePill();
      // Subscribe BEFORE getSession so PASSWORD_RECOVERY / URL exchange is not missed (race).
      sb().auth.onAuthStateChange(async (event, session) => {
        try {
          if (event === 'PASSWORD_RECOVERY') {
            _hideLoginUI();
            _showSetPasswordUI();
            return;
          }
          if (session?.user && _sessionIsPasswordRecovery(session)) {
            _hideLoginUI();
            _showSetPasswordUI();
            return;
          }
          // v2 emits INITIAL_SESSION on boot; SIGNED_IN after password sign-in — both must load user data.
          if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
            await _onLogin(session.user);
          }
          if (event === 'SIGNED_OUT') {
            _user=null; _loginReadyUserId=null; _companies=[]; _clients={}; _images={}; _session=null; _defaults=null; _quotCache={};
            _updatePill(); _showLoginUI();
          }
        } catch (e) {
          console.error('[AUTH] onAuthStateChange', event, e);
        }
      });
      const { data:{ session } } = await sb().auth.getSession();
      if (session?.user) {
        if (_sessionIsPasswordRecovery(session)) {
          _hideLoginUI();
          _showSetPasswordUI();
        } else if (!_isRecoveryUrl()) {
          await _onLogin(session.user);
        }
      }
    },

    async _handleLogin() {
      const email = document.getElementById('qg-auth-email')?.value?.trim();
      const pass  = document.getElementById('qg-auth-pass')?.value;
      const errEl = document.getElementById('qg-auth-err');
      const btn   = document.getElementById('qg-auth-submit');
      const showErr = msg => { if(errEl){errEl.textContent=msg;errEl.style.cssText='display:block;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:16px;background:rgba(200,23,30,0.12);color:#f87171;border:1px solid rgba(200,23,30,0.3)';}};
      if (!email||!pass) { showErr('Please enter email and password.'); return; }
      if (btn) { btn.textContent='Please wait…'; btn.disabled=true; }
      const isSignUp = btn?.dataset.mode === 'signup';
      try {
        if (isSignUp) {
          const { error } = await sb().auth.signUp({ email, password:pass });
          if (error) throw error;
          if (errEl) { errEl.style.cssText='display:block;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:16px;background:rgba(34,197,94,0.12);color:#4ade80;border:1px solid rgba(34,197,94,0.3)'; errEl.textContent='Account created! Check email to confirm.'; }
          if (btn) { btn.textContent='Create Account'; btn.disabled=false; }
        } else {
          const { data, error } = await sb().auth.signInWithPassword({ email, password:pass });
          if (error) throw error;
          // Do not rely only on onAuthStateChange(SIGNED_IN) — it can be delayed or not fire; load app data here.
          let u = data?.session?.user;
          if (!u) {
            const { data: gs } = await sb().auth.getSession();
            u = gs?.session?.user;
          }
          if (!u) {
            showErr('Could not start a session. If email confirmation is required, confirm your account first, then try again.');
            if (btn) { btn.textContent = 'Sign In'; btn.disabled = false; }
            return;
          }
          await _onLogin(u);
        }
      } catch(e) { showErr(e.message); if(btn){btn.textContent=isSignUp?'Create Account':'Sign In';btn.disabled=false;} }
    },

    _toggleSignUp() {
      const btn=document.getElementById('qg-auth-submit'), tog=document.getElementById('qg-auth-toggle');
      const goingUp = btn?.dataset.mode !== 'signup';
      if (btn) { btn.dataset.mode=goingUp?'signup':''; btn.textContent=goingUp?'Create Account':'Sign In'; }
      if (tog) tog.innerHTML = goingUp
        ? 'Already have an account? <span onclick="DM._toggleSignUp()" style="color:#c8171e;cursor:pointer;font-weight:600">Sign In</span>'
        : 'Don\'t have an account? <span onclick="DM._toggleSignUp()" style="color:#c8171e;cursor:pointer;font-weight:600">Sign Up</span>';
    },

    async setFolder()   { /* no-op — cloud only */ },

    _showForgotPassword() {
      // Swap login form to a single-field "reset" form inline
      const passEl   = document.getElementById('qg-auth-pass');
      const submitEl = document.getElementById('qg-auth-submit');
      const toggleEl = document.getElementById('qg-auth-toggle');
      const forgotEl = document.getElementById('qg-forgot-link');
      const errEl    = document.getElementById('qg-auth-err');
      if (passEl)   passEl.style.display   = 'none';
      if (forgotEl) forgotEl.style.display = 'none';
      if (toggleEl) toggleEl.style.display = 'none';
      if (errEl)    errEl.style.display    = 'none';
      if (submitEl) { submitEl.textContent = 'Send Reset Link'; submitEl.dataset.mode = 'forgot'; submitEl.onclick = () => DM._handleForgotPassword(); }
      const emailEl = document.getElementById('qg-auth-email');
      if (emailEl)  emailEl.placeholder = 'Enter your email address';
      // Add a back link
      let backLink = document.getElementById('qg-forgot-back');
      if (!backLink) {
        backLink = document.createElement('div');
        backLink.id = 'qg-forgot-back';
        backLink.style.cssText = 'text-align:center;margin-top:10px;font-size:13px;color:#888';
        backLink.innerHTML = '<span onclick="DM._resetToSignIn()" style="color:#c8171e;cursor:pointer;font-weight:600">← Back to Sign In</span>';
        submitEl?.parentNode?.insertBefore(backLink, submitEl.nextSibling?.nextSibling);
      }
      backLink.style.display = '';
    },

    async _resetToSignIn() {
      if (document.getElementById('qg-auth-newpass')) {
        await sb().auth.signOut();
        _cleanAuthUrl();
        _hideLoginUI();
        _showLoginUI();
        return;
      }
      const passEl   = document.getElementById('qg-auth-pass');
      const submitEl = document.getElementById('qg-auth-submit');
      const toggleEl = document.getElementById('qg-auth-toggle');
      const forgotEl = document.getElementById('qg-forgot-link');
      const errEl    = document.getElementById('qg-auth-err');
      const backLink = document.getElementById('qg-forgot-back');
      if (passEl)   passEl.style.display   = '';
      if (forgotEl) forgotEl.style.display = '';
      if (toggleEl) toggleEl.style.display = '';
      if (errEl)    { errEl.style.display = 'none'; errEl.textContent = ''; }
      if (backLink) backLink.style.display = 'none';
      if (submitEl) { submitEl.textContent = 'Sign In'; submitEl.dataset.mode = ''; submitEl.onclick = () => DM._handleLogin(); }
      const emailEl = document.getElementById('qg-auth-email');
      if (emailEl)  emailEl.placeholder = 'Email';
    },

    async _handleForgotPassword() {
      const email  = document.getElementById('qg-auth-email')?.value?.trim();
      const errEl  = document.getElementById('qg-auth-err');
      const btn    = document.getElementById('qg-auth-submit');
      const showMsg = (msg, ok) => {
        if (!errEl) return;
        errEl.textContent = msg;
        errEl.style.cssText = ok
          ? 'display:block;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:16px;background:rgba(34,197,94,0.12);color:#4ade80;border:1px solid rgba(34,197,94,0.3)'
          : 'display:block;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:16px;background:rgba(200,23,30,0.12);color:#f87171;border:1px solid rgba(200,23,30,0.3)';
      };
      if (!email) { showMsg('Please enter your email address.', false); return; }
      if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }
      try {
        const { error } = await sb().auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname,
        });
        if (error) throw error;
        showMsg('Reset link sent! Check your inbox (and spam folder).', true);
        if (btn) { btn.textContent = 'Link Sent ✓'; btn.disabled = true; }
      } catch(e) {
        showMsg(e.message || 'Failed to send reset email.', false);
        if (btn) { btn.textContent = 'Send Reset Link'; btn.disabled = false; }
      }
    },

    async _handleSetPassword() {
      const errEl = document.getElementById('qg-auth-err');
      const btn   = document.getElementById('qg-auth-submit');
      const showMsg = (msg, ok) => {
        if (!errEl) return;
        errEl.textContent = msg;
        errEl.style.cssText = ok
          ? 'display:block;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:16px;background:rgba(34,197,94,0.12);color:#4ade80;border:1px solid rgba(34,197,94,0.3)'
          : 'display:block;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:16px;background:rgba(200,23,30,0.12);color:#f87171;border:1px solid rgba(200,23,30,0.3)';
      };
      const p1 = document.getElementById('qg-auth-newpass')?.value || '';
      const p2 = document.getElementById('qg-auth-newpass2')?.value || '';
      if (!p1 || p1.length < 6) { showMsg('Password must be at least 6 characters.', false); return; }
      if (p1 !== p2) { showMsg('Passwords do not match.', false); return; }
      if (btn) { btn.textContent = 'Updating…'; btn.disabled = true; }
      try {
        const { error } = await sb().auth.updateUser({ password: p1 });
        if (error) throw error;
        showMsg('Password updated. Signing you in…', true);
        _cleanAuthUrl();
        const { data:{ session } } = await sb().auth.getSession();
        if (session?.user) await _onLogin(session.user);
      } catch(e) {
        showMsg(e.message || 'Failed to update password.', false);
        if (btn) { btn.textContent = 'Update Password'; btn.disabled = false; }
      }
    },
    async clearFolder() { await sb().auth.signOut(); },

    // ── Companies ──
    getCompanies() { return _companies; },

    // Save or update a company profile. Pass id=null for new.
    async saveProfileData(id, profileData) {
      const profile = { ...profileData };
      delete profile.id; delete profile.local_id; // never embed UUID inside JSON

      if (!id || id === '__new__') {
        // INSERT — DB generates UUID
        const { data, error } = await sb().from('companies')
          .insert({ user_id:uid(), name:profile.companyName||'', profile })
          .select('id').maybeSingle();
        if (error) { console.error('[DB] company insert:', error.message); return null; }
        _companies.unshift({ ...profile, id:data.id, name:profile.companyName||'' });
        console.log('[DB] company created:', data.id);
        return data.id;
      }

      // UPDATE existing
      const { error } = await sb().from('companies')
        .update({ name:profile.companyName||'', profile })
        .eq('id', String(id)).eq('user_id', uid());
      if (error) { console.error('[DB] company update:', error.message); return null; }
      const idx = _companies.findIndex(c => c.id === String(id));
      if (idx >= 0) _companies[idx] = { ..._companies[idx], ...profile, id:String(id) };
      console.log('[DB] company updated:', id);
      return String(id);
    },

    getProfileData(id) { return _companies.find(c=>c.id===String(id)) || null; },
    async loadProfileDataFromFile(id) { return this.getProfileData(id); },

    // Delete a company (also cascades clients via FK)
    async saveCompanies(newList) {
      const keep = new Set(newList.map(c=>c.id));
      for (const c of _companies) {
        if (!keep.has(c.id)) {
          await sb().from('companies').delete().eq('id',c.id).eq('user_id',uid());
          delete _clients[c.id]; delete _images[c.id];
        }
      }
      _companies = _companies.filter(c=>keep.has(c.id));
    },

    async deleteProfileData(id) {
      const sid = String(id);
      await sb().from('companies').delete().eq('id',sid).eq('user_id',uid());
      await sb().from('saved_quotations').delete().eq('company_ref',sid).eq('user_id',uid());
      _companies = _companies.filter(c=>c.id!==sid);
      delete _clients[sid]; delete _images[sid];
      _scheduleFlushImages();
    },

    // ── Clients ──
    getClients(companyId) {
      const key = companyId ? String(companyId) : cid();
      return _clients[key] || [];
    },

    async saveClientRecord(cl) {
      const companyId = cid();
      if (!companyId) { showNotification('No active company profile', 'error'); return null; }
      if (!uid())     { showNotification('Not signed in', 'error'); return null; }
      const { data, error } = await sb().from('clients')
        .insert({ company_id:companyId, user_id:uid(),
                  name:cl.name||'', gstin:cl.gstin||'', address:cl.address||'',
                  buyer_state:cl.buyerState||'', contacts:cl.contacts||[],
                  ship_addresses:cl.shipAddresses||[] })
        .select('id').maybeSingle();
      if (error) {
        console.error('[DB] client insert:', error.message);
        showNotification('Save failed: ' + error.message, 'error');
        return null;
      }
      if (!_clients[companyId]) _clients[companyId] = [];
      _clients[companyId].unshift({ ...cl, id:data.id });
      console.log('[DB] client saved:', data.id, cl.name);
      return data.id;
    },

    async updateClientRecord(id, cl) {
      const { error } = await sb().from('clients')
        .update({ name:cl.name||'', gstin:cl.gstin||'', address:cl.address||'',
                  buyer_state:cl.buyerState||'', contacts:cl.contacts||[],
                  ship_addresses:cl.shipAddresses||[] })
        .eq('id', id).eq('user_id', uid());
      if (error) { console.error('[DB] client update:', error.message); showNotification('Update failed: '+error.message,'error'); return false; }
      const companyId = cid();
      if (companyId && _clients[companyId]) {
        const idx = _clients[companyId].findIndex(c=>c.id===id);
        if (idx>=0) _clients[companyId][idx] = { ..._clients[companyId][idx], ...cl, id };
      }
      return true;
    },

    async deleteClientRecord(id) {
      await sb().from('clients').delete().eq('id',id).eq('user_id',uid());
      const companyId = cid();
      if (companyId && _clients[companyId])
        _clients[companyId] = _clients[companyId].filter(c=>c.id!==id);
    },

    // Keep for compatibility — actual DB ops go via saveClientRecord/updateClientRecord
    saveClients(db) {
      const companyId = cid();
      if (companyId) _clients[companyId] = db;
    },

    async loadClientsForCompany(companyId) {
      if (!companyId) return;
      await _loadClients(String(companyId));
      if (typeof renderClientDb==='function') renderClientDb();
    },

    // ── Session / Defaults ──
    getSession()      { return _session; },
    saveSession(d)    { _session = d; _scheduleFlush(); },
    clearSession()    { _session = null; _scheduleFlush(); },
    getDefaults()     { return _defaults; },
    saveDefaults(d)   { _defaults = d; _scheduleFlush(); },

    // ── Images ──
    saveLogo(url)        { const c=cid(); if(!c)return; if(!_images[c])_images[c]={}; _images[c].logo=url;          _scheduleFlushImages(); },
    deleteLogo()         { const c=cid(); if(!c)return; if(_images[c])delete _images[c].logo;                       _scheduleFlushImages(); },
    saveWatermark(url)   { const c=cid(); if(!c)return; if(!_images[c])_images[c]={}; _images[c].watermark=url;     _scheduleFlushImages(); },
    deleteWatermark()    { const c=cid(); if(!c)return; if(_images[c])delete _images[c].watermark;                  _scheduleFlushImages(); },
    saveBrandLogos(l)    { const c=cid(); if(!c)return; if(!_images[c])_images[c]={}; _images[c].brandLogos=l;      _scheduleFlushImages(); },
    saveProductImages(i) { const c=cid(); if(!c)return; if(!_images[c])_images[c]={}; _images[c].productImages=i;   _scheduleFlushImages(); },

    async loadProfileFolder(companyId) {
      if (!uid() || !companyId) return;
      const img = _images[String(companyId)] || {};
      console.log('[IMAGES] loadProfileFolder', companyId, 'keys:', Object.keys(img));

      state.logoData = img.logo || null;
      const logoPrev = document.getElementById('logoPreview');
      const logoZone = document.getElementById('logoZone');
      if (logoPrev) logoPrev.src = state.logoData || '';
      if (logoZone) logoZone.classList.toggle('has-logo', !!state.logoData);

      state.watermarkData = img.watermark || null;
      const wmImg = document.getElementById('watermarkImg');
      if (wmImg) { wmImg.src = state.watermarkData||''; wmImg.style.display = state.watermarkData?'block':'none'; }

      state.partnerLogos  = (img.brandLogos||[]).map(i=>({ id:Date.now()+Math.random(), data:i.data||i }));
      state.productImages = (img.productImages||[]).map(i=>({ id:Date.now()+Math.random(), data:i.data||i, caption:i.caption||'' }));
      if (typeof renderPartnerLogosSidebar ==='function') renderPartnerLogosSidebar();
      if (typeof renderProductImagesSidebar==='function') renderProductImagesSidebar();
      if (typeof syncProductImagesToDoc    ==='function') syncProductImagesToDoc();
      if (typeof syncPartnerLogosToDoc     ==='function') syncPartnerLogosToDoc();
    },

    // ── Quotations ──
    async getQuotations() {
      const companyId = cid();
      if (!companyId || !uid()) return [];
      const key = companyId + ':all';
      if (_quotCache[key]) return _quotCache[key];
      const { data, error } = await sb().from('saved_quotations')
        .select('id, ref_no, client_name, doc_date, doc_type, finalized, remark, saved_at')
        .eq('user_id', uid()).eq('company_ref', companyId)
        .order('saved_at', { ascending:false });
      if (error) { console.error('[DB] getQuotations:', error.message); return []; }
      _quotCache[key] = (data||[]).map(q=>({
        id:q.id, refNo:q.ref_no||'—', clientName:q.client_name||'—',
        date:q.doc_date||'', docType:q.doc_type||'quotation',
        finalized:q.finalized||false, remark:q.remark||'', savedAt:q.saved_at
      }));
      return _quotCache[key];
    },

    async saveQuotation(snapshot) {
      const companyId = cid();
      if (!uid())       { showNotification('Not signed in','error'); return null; }
      if (!companyId)   { showNotification('No active company profile — save a profile first','error'); return null; }
      const snap = JSON.parse(JSON.stringify(snapshot));
      delete snap.logoData; delete snap.watermarkData;
      if (snap.partnerLogos)  snap.partnerLogos  = [];
      if (snap.productImages) snap.productImages = [];
      const { data, error } = await sb().from('saved_quotations')
        .insert({ user_id:uid(), company_ref:companyId,
                  ref_no:snap.refNo||'—', client_name:snap.clientName||'—',
                  doc_date:snap.docDate||'', doc_type:snap.docType||'quotation',
                  finalized:false, remark:'', saved_at:snap.savedAt||new Date().toISOString(),
                  snapshot:snap })
        .select('id').maybeSingle();
      if (error) {
        console.error('[DB] saveQuotation:', error.message);
        const em = error.message || '';
        if (em.includes('SAVED_QUOTATION_LIMIT_REACHED')) {
          showNotification('Limit reached: maximum saved documents per type for this company. Delete an older one to save a new one.', 'error');
        } else {
          showNotification('Save failed: ' + em, 'error');
        }
        return null;
      }
      _quotCache = {};
      return data.id;
    },

    async loadQuotation(id) {
      const { data, error } = await sb().from('saved_quotations')
        .select('snapshot').eq('id', id).eq('user_id', uid()).maybeSingle();
      if (error||!data) return null;
      return data.snapshot;
    },

    async updateQuotation(id, snap) {
      if (!snap) return;
      const clean = JSON.parse(JSON.stringify(snap));
      delete clean.logoData; delete clean.watermarkData;
      if (clean.partnerLogos)  clean.partnerLogos  = [];
      if (clean.productImages) clean.productImages = [];
      await sb().from('saved_quotations')
        .update({ ref_no:clean.refNo, client_name:clean.clientName, doc_date:clean.docDate, snapshot:clean })
        .eq('id',id).eq('user_id',uid());
      _quotCache = {};
    },

    async deleteQuotation(id) {
      await sb().from('saved_quotations').delete().eq('id',id).eq('user_id',uid());
      _quotCache = {};
    },

    async _writeQuotIndex(companyId, idx) {
      if (!idx?.length) return;
      _quotCache = {};
      await Promise.all(idx.map(e =>
        sb().from('saved_quotations')
          .update({ finalized:!!e.finalized, remark:e.remark||'' })
          .eq('id',e.id).eq('user_id',uid())
      ));
    },
  };
})();



// ── Shim: old code calls getClientDb()/saveClientDb() ──
function getClientDb()     { return DM.getClients(); }
function saveClientDb(db)  { DM.saveClients(db); }

// ===== COMPANY PROFILES =====

function _getCompanyFieldsData() {
  const v   = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const chk = id => { const el = document.getElementById(id); return el ? el.checked : true; };

  return {
    // ── Company Info ──
    companyName:        v('companyName'),
    companyTagline:     v('companyTagline'),
    companyGstin:       v('companyGstin'),
    companyAddress:     v('companyAddress'),
    companyPhone:       v('companyPhone'),
    companyEmail:       v('companyEmail'),
    companyWebsite:     v('companyWebsite'),
    sellerState:        v('sellerState'),
    showCompanyName:    chk('showCompanyName'),
    showTagline:        chk('showTagline'),
    companyNameFont:    v('companyNameFont'),
    companyNameSize:    v('companyNameSize'),
    taglineLetterSpacing: v('taglineLetterSpacing'),
    taglineWordSpacing:   v('taglineWordSpacing'),

    // ── Footer ──
    footerLeft:         v('footerLeft'),
    footerTagline:      v('footerTagline'),
    footerRight:        v('footerRight'),

    // ── Banking ──
    bankName:           v('bankName'),
    bankAccName:        v('bankAccName'),
    bankAccNo:          v('bankAccNo'),
    bankAccType:        v('bankAccType'),
    bankIfsc:           v('bankIfsc'),
    bankSwift:          v('bankSwift'),
    bankBranch:         v('bankBranch'),
    showBankDetails:    chk('showBankDetails'),

    // ── Taxes & Pricing ──
    gstType:            v('gstType'),
    gstRate:            v('gstRate'),
    gstSlabs:           v('gstSlabs'),
    currency:           v('currency'),
    customTaxLabel:     v('customTaxLabel'),
    enableDiscount:     chk('enableDiscount'),
    discountPct:        v('discountPct'),
    discountAmt:        v('discountAmt'),
    enableFreight:      chk('enableFreight'),
    freightAmt:         v('freightAmt'),

    // ── Document Settings ──
    showGstin:          chk('showGstin'),
    showShipTo:         chk('showShipTo'),
    showNotes:          chk('showNotes'),
    showTerms:          chk('showTerms'),
    showAmtWords:       chk('showAmtWords'),
    terms:              v('terms'),
    notes:              v('notes'),

    // ── Design / Colors ──
    colors:             JSON.parse(JSON.stringify(state.colors)),
    footerBgLinkAccent: chk('footerBgLinkAccent'),

    // ── Watermark ──
    enableLogoWatermark: chk('enableLogoWatermark'),
    watermarkOpacity:   v('watermarkOpacity'),
    watermarkSize:      v('watermarkSize'),
    watermarkRotation:  v('watermarkRotation'),
    // watermarkData stored in user_images, not in profile

    // ── Product Images ──
    showProductImages:  chk('showProductImages'),
    productImagesLabel: v('productImagesLabel'),
    productImgHeight:   v('productImgHeight'),
    productImgPerRow:   v('productImgPerRow'),
    // productImages stored in user_images

    // ── Brand / Partner Logos ──
    // partnerLogos stored in user_images
    showPartnerLogos:   chk('showPartnerLogos'),
    partnerAlign:       state.partnerAlign || 'center',

    // ── Template ──
    template:           state.template || 'classic',
    docFont:            v('docFont'),

    // ── Logo Size ──
    logoSize:           document.getElementById('logoSize')?.value || '70',

    // ── Logo — stored in user_images, not in profile ──
    // logoData intentionally excluded
  };
}

/** JSON/DB may return booleans as strings; assigning a string to .checked is wrong. */
function _coerceProfileBool(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
  }
  return undefined;
}

function _applyCompanyProfile(profile) {
  const set    = (id, v) => { if (v === undefined || v === null) return; const el = document.getElementById(id); if (el) el.value = v; };
  const setchk = (id, v) => {
    const el = document.getElementById(id);
    if (!el) return;
    const b = _coerceProfileBool(v);
    if (b === undefined) return;
    el.checked = b;
  };
  const lbl    = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  // ── Company Info ──
  set('companyName',        profile.companyName);
  set('companyTagline',     profile.companyTagline);
  set('companyGstin',       profile.companyGstin);
  set('companyAddress',     profile.companyAddress);
  set('companyPhone',       profile.companyPhone);
  set('companyEmail',       profile.companyEmail);
  set('companyWebsite',     profile.companyWebsite);
  set('sellerState',        profile.sellerState);
  setchk('showCompanyName', profile.showCompanyName);
  setchk('showTagline',     profile.showTagline);
  set('companyNameFont',    profile.companyNameFont);
  set('companyNameSize',    profile.companyNameSize);
  lbl('companyNameSizeVal', (profile.companyNameSize || '24') + 'px');
  set('taglineLetterSpacing', profile.taglineLetterSpacing);
  lbl('taglineLetterSpacingVal', (profile.taglineLetterSpacing || '0') + 'px');
  set('taglineWordSpacing',   profile.taglineWordSpacing);
  lbl('taglineWordSpacingVal', (profile.taglineWordSpacing || '0') + 'px');

  // ── Footer ──
  set('footerLeft',    profile.footerLeft);
  set('footerTagline', profile.footerTagline);
  set('footerRight',   profile.footerRight);

  // ── Banking ──
  set('bankName',    profile.bankName);
  set('bankAccName', profile.bankAccName);
  set('bankAccNo',   profile.bankAccNo);
  set('bankAccType', profile.bankAccType);
  set('bankIfsc',    profile.bankIfsc);
  set('bankSwift',   profile.bankSwift);
  set('bankBranch',  profile.bankBranch);
  setchk('showBankDetails', profile.showBankDetails);

  // ── Taxes & Pricing ──
  set('gstType',       profile.gstType);
  set('gstRate',       profile.gstRate);
  set('gstSlabs',      profile.gstSlabs);
  set('currency',      profile.currency);
  set('customTaxLabel',profile.customTaxLabel);
  setchk('enableDiscount', profile.enableDiscount);
  set('discountPct', profile.discountPct);
  set('discountAmt', profile.discountAmt);
  setchk('enableFreight', profile.enableFreight);
  set('freightAmt',   profile.freightAmt);

  // ── Document Settings ──
  setchk('showGstin',    profile.showGstin);
  setchk('showShipTo',   profile.showShipTo);
  setchk('showNotes',    profile.showNotes);
  setchk('showTerms',    profile.showTerms);
  setchk('showAmtWords', profile.showAmtWords);
  set('terms', profile.terms);
  if (profile.notes !== undefined && profile.notes !== null) {
    const n = document.getElementById('notes');
    if (n) n.value = String(profile.notes);
  }

  // ── Design / Colors ──
  setchk('footerBgLinkAccent', profile.footerBgLinkAccent);
  if (profile.colors) {
    state.colors = { ...state.colors, ...profile.colors };
    Object.keys(profile.colors).forEach(k => {
      const el = document.getElementById('color' + cap(k)); if (el) el.value = profile.colors[k];
      const sw = document.getElementById('swatch' + cap(k)); if (sw) sw.style.background = profile.colors[k];
      const hx = document.getElementById('hex' + cap(k));   if (hx) hx.value = profile.colors[k];
    });
    applyColors();
  }

  // ── Logo & Watermark ──
  // NOTE: Images are ONLY loaded via DM.loadProfileFolder() from user_images table.
  // _applyCompanyProfile never touches image state — prevents clearing on every login.
  setchk('enableLogoWatermark', profile.enableLogoWatermark);
  set('watermarkOpacity',  profile.watermarkOpacity);
  lbl('watermarkOpacityVal', (profile.watermarkOpacity || '8') + '%');
  set('watermarkSize',     profile.watermarkSize);
  lbl('watermarkSizeVal',    (profile.watermarkSize || '320') + 'px');
  set('watermarkRotation', profile.watermarkRotation);
  lbl('watermarkRotationVal', (profile.watermarkRotation || '-30') + '°');

  // ── Product Images ──
  setchk('showProductImages', profile.showProductImages);
  set('productImagesLabel', profile.productImagesLabel);
  set('productImgHeight',   profile.productImgHeight);
  lbl('productImgHeightVal', (profile.productImgHeight || '80') + 'px');
  set('productImgPerRow',   profile.productImgPerRow);
  // NOTE: productImages and partnerLogos come from loadProfileFolder, not profile object

  // ── Brand / Partner Logos ──
  if (profile.showPartnerLogos !== undefined && profile.showPartnerLogos !== null) {
    setchk('showPartnerLogos', profile.showPartnerLogos);
  }
  if (profile.partnerAlign !== undefined) {
    state.partnerAlign = profile.partnerAlign;
    const ac = document.getElementById('alignCenter');
    const ar = document.getElementById('alignRight');
    if (ac) ac.classList.toggle('active-align', profile.partnerAlign === 'center');
    if (ar) ar.classList.toggle('active-align',  profile.partnerAlign === 'right');
  }

  // ── Template ──
  if (profile.template) {
    applyTemplate(profile.template, false); // false = don't call syncDoc yet
  }
  if (profile.docFont !== undefined && profile.docFont !== null) {
    const df = document.getElementById('docFont');
    if (df) { df.value = String(profile.docFont); if (typeof applyFont === 'function') applyFont(); }
  }

  // ── Logo Size ──
  if (profile.logoSize !== undefined) {
    const ls = document.getElementById('logoSize');
    const lv = document.getElementById('logoSizeVal');
    if (ls) ls.value = profile.logoSize;
    if (lv) lv.textContent = profile.logoSize + 'px';
  }

  // ── GST slabs rebuild ──
  applyGstSlabs();
  syncTaglineSpacing();
  syncWatermark();
  syncDoc();
}

function _updateCompanyPill(profileName) {
  const pill = document.getElementById('workspacePill');
  const text = document.getElementById('workspacePillText');
  if (!text) return;
  if (profileName) {
    text.textContent = profileName;
    if (pill) pill.classList.add('has-profile');
  } else {
    text.textContent = 'No Profile';
    if (pill) pill.classList.remove('has-profile');
  }
}

async function saveToCompanyProfile() {
  const data = _getCompanyFieldsData();
  const name = data.companyName.trim();
  if (!name) { showNotification('Enter a company name first', 'error'); return; }

  // Validate company GSTIN if provided
  const gstin     = (data.gstin || '').trim().toUpperCase();
  const gstStatus = validateGstin(gstin);
  if (gstin && gstStatus === 'invalid') {
    showNotification('Invalid company GSTIN format. Must be 15 chars like 22AAAAA0000A1Z5', 'error');
    return;
  }

  const db       = DM.getCompanies();
  const existing = db.find(c => (c.companyName || c.name || '').toLowerCase() === name.toLowerCase());

  if (!existing && db.length >= PROFILE_LIMIT) {
    showNotification('Profile limit reached (' + PROFILE_LIMIT + '). Delete a profile first.', 'error');
    return;
  }

  // Warn if saving without GSTIN and a profile with same name already exists
  if (!gstin && existing) {
    if (!confirm('Saving "' + name + '" without a GSTIN. The existing profile already has this name — update it anyway?')) return;
  }

  const targetId = existing ? existing.id : null;
  const newId    = await DM.saveProfileData(targetId, data);
  if (!newId) { showNotification('Failed to save profile — check console', 'error'); return; }

  state.activeCompanyId = newId;
  _updateCompanyPill(name);
  DM.saveDefaults({ _activeCompanyId: newId, companyName: name });
  renderCoProfileList();
  showNotification('Profile saved: ' + name + ' ✓');
}

async function loadCompanyProfile(id) {
  const p = DM.getCompanies().find(c => c.id === id);
  if (!p) return;
  state.activeCompanyId = id;
  _applyCompanyProfile(p);
  _updateCompanyPill(p.companyName || p.name || '');
  // Persist active company
  const defs = DM.getDefaults() || {};
  DM.saveDefaults({ ...defs, _activeCompanyId: id });
  await DM.loadClientsForCompany(id);
  await DM.loadProfileFolder(id);
  syncWatermark(); syncDoc();
  closeCompanyProfiles();
  renderClientDb();
  showNotification('Loaded: ' + (p.companyName || p.name));
}

async function deleteCompanyProfile(id, e) {
  e.stopPropagation();
  const db      = DM.getCompanies();
  const profile = db.find(c => c.id === id);
  if (!profile) return;
  if (!confirm('Delete profile "' + profile.name + '"? All data for this profile will be permanently removed.')) return;

  // Remove from index first so UI reflects immediately
  await DM.saveCompanies(db.filter(c => c.id !== id));

  // Full data wipe — memory cache, filesystem folder
  await DM.deleteProfileData(id);

  // If this was the active profile, reset the app to a blank state
  if (state.activeCompanyId === id) {
    state.activeCompanyId = null;
    state.logoData = null;
    state.watermarkData = null;
    state.partnerLogos = [];
    state.productImages = [];
    _updateCompanyPill(null);
    const logoPreview = document.getElementById('logoPreview');
    const logoZone    = document.getElementById('logoZone');
    if (logoPreview) logoPreview.src = '';
    if (logoZone)    logoZone.classList.remove('has-logo');
    syncWatermark();
    renderPartnerLogosSidebar();
    renderProductImagesSidebar();
    syncProductImagesToDoc();
  }

  renderCoProfileList();
  renderClientDb();
  showNotification('Profile "' + profile.name + '" deleted');
}

const PROFILE_LIMIT = 3; // change here to adjust the cap

function renderCoProfileList() {
  const container = document.getElementById('coProfileList');
  if (!container) return;
  const db = DM.getCompanies();
  const atLimit = db.length >= PROFILE_LIMIT;
  // Update limit badge
  const badge = document.getElementById('profileLimitBadge');
  if (badge) {
    badge.textContent = db.length + ' / ' + PROFILE_LIMIT + ' profiles used';
    badge.style.color = atLimit ? 'var(--error, #ef4444)' : 'var(--text-muted)';
  }
  // Disable New Profile + Save Profile buttons if at limit and no existing match
  const saveBtn = document.getElementById('saveProfileBtn');
  const newBtn  = document.getElementById('newProfileBtn');
  // Save Profile is allowed even at limit (it updates existing) — we check per-name in the fn
  if (newBtn) {
    newBtn.disabled = atLimit;
    newBtn.title    = atLimit ? 'Profile limit reached (' + PROFILE_LIMIT + ')' : '';
    newBtn.style.opacity = atLimit ? '0.45' : '';
  }

  if (db.length === 0) {
    container.innerHTML = `<div class="co-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
      No profiles saved yet.<br>Fill in your company details and<br>click <strong>Save Current as Profile</strong>.
    </div>`;
    return;
  }

  container.innerHTML = db.map(p => {
    const isActive = p.id === state.activeCompanyId;
    const logoHtml = p.logoData
      ? `<img src="${p.logoData}" alt="">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`;
    const meta = [p.companyGstin, p.companyAddress ? p.companyAddress.split('\n')[0] : ''].filter(Boolean).join(' · ');
    return `<div class="co-profile-card ${isActive ? 'active' : ''}" onclick="loadCompanyProfile('${p.id}')">
      <div class="co-profile-logo">${logoHtml}</div>
      <div class="co-profile-info">
        <div class="co-profile-name">${escHtml(p.name)}</div>
        ${meta ? `<div class="co-profile-meta">${escHtml(meta)}</div>` : ''}
      </div>
      <div class="co-profile-actions">
        <button class="co-profile-btn del" onclick="deleteCompanyProfile('${p.id}', event)" title="Delete profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

function openCompanyProfiles() {
  renderCoProfileList();
  // Refresh storage label each time modal opens
  const statusText = document.getElementById('cloudStatusText');
  const discBtn    = document.getElementById('storageDisconnectBtn');
  if (statusText) {
    if (DM.isLoggedIn()) {
      statusText.textContent = '☁ Cloud sync active';
      statusText.style.color = 'var(--success)';
      if (discBtn) discBtn.style.display = '';
    } else {
      statusText.textContent = 'Not signed in';
      statusText.style.color = 'var(--text-muted)';
      if (discBtn) discBtn.style.display = 'none';
    }
  }
  document.getElementById('companyProfilesOverlay').style.display = 'flex';
}

function closeCompanyProfiles() {
  document.getElementById('companyProfilesOverlay').style.display = 'none';
}

function newDoc() {
  if (!confirm('Start a new document? Client and items will be cleared. Company details stay loaded.')) return;

  // Clear client fields
  clearClientFields();

  // Clear items — one empty row
  state.items = [];
  renderItems();
  addItem();

  // Clear doc-specific fields
  const docFields = ['clientName','clientAddress','clientGstin','buyerState','shipToAddress','shipToState',
    'validUntil','docSubject','deliveryTime','paymentTerms','placeOfSupply','notes'];
  docFields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  // Set refNo to default prefix for current doc type
  const refEl = document.getElementById('refNo');
  if (refEl) refEl.value = _defaultRef(state.docType);

  // Reset date to today
  const today = new Date().toISOString().split('T')[0];
  const dateEl = document.getElementById('docDate');
  if (dateEl) dateEl.value = today;

  DM.clearSession();
  autoDetectGstType();
  syncDoc();
  showNotification('New document ready ✓');
}

function newProfile() {
  const _npDb = DM.getCompanies();
  if (_npDb.length >= PROFILE_LIMIT) {
    showNotification('Profile limit reached (' + PROFILE_LIMIT + '). Delete a profile before creating a new one.', 'error');
    return;
  }
  if (!confirm('Start a completely fresh profile? Everything will be cleared — company, client, items and all fields.')) return;
  closeCompanyProfiles();

  // Clear active profile tracking
  state.activeCompanyId = null;
  state.activeClientId  = null;
  _updateCompanyPill(null);

  // Clear company fields
  const companyFields = ['companyName','companyTagline','companyGstin','companyAddress','companyPhone',
    'companyEmail','companyWebsite','footerLeft','footerTagline','footerRight',
    'bankName','bankAccName','bankAccNo','bankAccType','bankIfsc','bankSwift','bankBranch','terms'];
  companyFields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  // Reset name font/size to defaults
  const fontEl = document.getElementById('companyNameFont');
  if (fontEl) fontEl.value = "'Barlow Condensed', sans-serif";
  const sizeEl = document.getElementById('companyNameSize');
  if (sizeEl) { sizeEl.value = '28'; const lbl = document.getElementById('companyNameSizeVal'); if (lbl) lbl.textContent = '28px'; }

  // Clear logo
  state.logoData = null;
  const logoPrev = document.getElementById('logoPreview');
  const logoZoneEl = document.getElementById('logoZone');
  if (logoPrev) logoPrev.src = '';
  if (logoZoneEl) logoZoneEl.classList.remove('has-logo');

  // Clear partner/brand logos
  state.partnerLogos = [];
  renderPartnerLogosSidebar();

  // Clear product images
  state.productImages = [];
  renderProductImagesSidebar();
  syncProductImagesToDoc();

  // Clear watermark
  state.watermarkData = null;
  const wmImg = document.getElementById('watermarkImg');
  if (wmImg) { wmImg.src = ''; wmImg.style.display = 'none'; }
  const wmPreview = document.getElementById('docWatermarkImg');
  if (wmPreview) wmPreview.src = '';

  // Reset colors to defaults (correct state.colors keys)
  const defaultColors = { accent:'#C8171E', header:'#f8f9fd', text:'#1a1a2e', footerBg:'#C8171E' };
  state.colors = { ...defaultColors };
  Object.keys(defaultColors).forEach(k => {
    const el = document.getElementById('color' + cap(k)); if (el) el.value = defaultColors[k];
    const sw = document.getElementById('swatch' + cap(k)); if (sw) sw.style.background = defaultColors[k];
    const hx = document.getElementById('hex' + cap(k));   if (hx) hx.value = defaultColors[k];
  });

  // Footer bg links to accent — ON by default
  const fbLinkEl = document.getElementById('footerBgLinkAccent');
  if (fbLinkEl) fbLinkEl.checked = true;
  _syncFooterBgToAccent(defaultColors.accent);
  applyColors();

  // Tagline and company name visible by default
  const stEl = document.getElementById('showTagline');     if (stEl) stEl.checked = true;
  const scEl = document.getElementById('showCompanyName'); if (scEl) scEl.checked = true;

  // Clear client DB — new profile has no inherited contacts
  // Clear client list for new company (will load from DB when company is set)
  if (typeof renderClientDb === 'function') renderClientDb();

  // Clear client fields
  clearClientFields();

  // Clear items — one empty row
  state.items = [];
  renderItems();
  addItem();

  // Clear document fields
  const docFields = ['refNo','validUntil','docSubject','deliveryTime','paymentTerms','placeOfSupply','notes'];
  docFields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  // Reset date to today
  const today = new Date().toISOString().split('T')[0];
  const dateEl = document.getElementById('docDate');
  if (dateEl) dateEl.value = today;

  syncWatermark();
  DM.clearSession();
  autoDetectGstType();
  syncDoc();
  showNotification('Fresh document ready ✓');
}

// ===== CLIENT DB CRUD =====

async function saveClientToDb() {
  const name = (document.getElementById('clientName') || {}).value.trim();
  if (!name) { showNotification('Enter a client name first', 'error'); return; }
  if (!DM.isLoggedIn())       { showNotification('Sign in first to save clients', 'error'); return; }
  if (!state.activeCompanyId) { showNotification('Save a company profile first', 'error'); return; }

  const gstin     = ((document.getElementById('clientGstin') || {}).value || '').trim().toUpperCase();
  const gstNA     = document.getElementById('clientGstinNA')?.checked || false;
  const gstStatus = validateGstin(gstin);

  // Block invalid format
  if (gstin && gstStatus === 'invalid') {
    showNotification('Invalid GSTIN format. Must be 15 chars like 22AAAAA0000A1Z5', 'error');
    return;
  }

  // Require explicit checkbox if no GSTIN entered
  if (!gstin && !gstNA) {
    showNotification('Enter a GSTIN or check "GST No. Not Available" before saving', 'error');
    // Highlight the checkbox
    const chkEl = document.getElementById('clientGstinNA');
    if (chkEl) {
      chkEl.parentElement.style.color = 'var(--accent)';
      setTimeout(() => { chkEl.parentElement.style.color = ''; }, 2500);
    }
    return;
  }

  const db = DM.getClients();

  // GSTIN duplicate check:
  // - If we're editing an existing client (activeClientId), allow same GSTIN on that record.
  // - If GSTIN exists on some other client, offer to UPDATE that client instead of blocking.
  let gstDup = null;
  if (gstin) {
    gstDup = db.find(c => (c.gstin || '').trim().toUpperCase() === gstin) || null;
    if (gstDup && state.activeClientId && String(gstDup.id) === String(state.activeClientId)) {
      gstDup = null; // same client, OK
    }
  }

  // Name duplicate warning if no GSTIN
  if (!gstin) {
    const nameDup = db.find(c => c.name.trim().toLowerCase() === name.toLowerCase());
    if (nameDup) {
      if (!confirm('Client "' + name + '" already exists without a GSTIN — are you sure this is a different client?')) return;
    }
  }

  const shipAddr  = (document.getElementById('shipToAddress') || {}).value || '';
  const shipState = (document.getElementById('shipToState')   || {}).value || '';
  const firstShipTo = shipAddr.trim() ? [{
    id: Date.now() + 1,
    label: shipAddr.split('\n')[0].substring(0, 30) || 'Address 1',
    address: shipAddr.trim(),
    state: shipState
  }] : [];

  const client = {
    name,
    address:       (document.getElementById('clientAddress') || {}).value || '',
    gstin,
    gstNotAvailable: gstNA,
    buyerState:    (document.getElementById('buyerState')    || {}).value || '',
    contacts:      state.contacts ? JSON.parse(JSON.stringify(state.contacts)) : [],
    shipAddresses: firstShipTo,
  };

  console.log('[CLIENT SAVE] company:', state.activeCompanyId, 'client:', client.name);

  // If GSTIN exists on another record, treat this as an UPDATE/merge flow.
  if (gstDup) {
    const yes = await askYesNo(`GSTIN already exists for: ${gstDup.name}. Update that client instead?`);
    if (!yes) return;

    const merged = {
      ...gstDup,
      ...client,
      // Merge contacts (dedupe by salutation+name+phone+email).
      contacts: (() => {
        const a = Array.isArray(gstDup.contacts) ? gstDup.contacts : [];
        const b = Array.isArray(client.contacts) ? client.contacts : [];
        const key = (ct) => [ct.salutation||'', ct.name||'', ct.phone||'', ct.email||''].map(s=>String(s).trim().toLowerCase()).join('|');
        const map = new Map();
        a.forEach(ct => map.set(key(ct), ct));
        b.forEach(ct => map.set(key(ct), ct));
        return Array.from(map.values());
      })(),
      // Prefer keeping existing ship addresses if any, otherwise take the new one.
      shipAddresses: (Array.isArray(gstDup.shipAddresses) && gstDup.shipAddresses.length)
        ? gstDup.shipAddresses
        : (client.shipAddresses || []),
    };

    const ok = await DM.updateClientRecord(gstDup.id, merged);
    if (!ok) return;

    renderClientDb();
    loadClientFromDb(gstDup.id);
    showNotification('Client updated ✓');
    return;
  }

  // Update existing active client (no GST conflict)
  if (state.activeClientId) {
    const ok = await DM.updateClientRecord(state.activeClientId, client);
    if (!ok) return;
    renderClientDb();
    loadClientFromDb(state.activeClientId);
    showNotification('Client updated ✓');
    return;
  }

  // Create new client
  const newId = await DM.saveClientRecord(client);
  if (!newId) { showNotification('Failed to save client — open console for details', 'error'); return; }

  // Reset checkbox
  const chkEl = document.getElementById('clientGstinNA');
  if (chkEl) { chkEl.checked = false; _toggleGstinNA('clientGstin', 'clientGstinNA'); }

  renderClientDb();
  loadClientFromDb(newId);
  showNotification('Client saved ✓');
}

function loadClientFromDb(id) {
  const db     = DM.getClients();
  const client = db.find(c => c.id === id);
  if (!client) return;

  state.activeClientId = id;

  const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
  set('clientName',    client.name);
  set('clientAddress', client.address);
  set('clientGstin',   client.gstin);
  // Restore GST Not Available checkbox
  const gstNAchk = document.getElementById('clientGstinNA');
  if (gstNAchk) {
    gstNAchk.checked = !!(client.gstNotAvailable && !client.gstin);
    _toggleGstinNA('clientGstin', 'clientGstinNA');
  }
  _gstinFeedback('clientGstin');
  set('buyerState',    client.buyerState);

  // Load first ship-to address if available, else default to "same as billing"
  const addrs      = client.shipAddresses || [];
  const sameChk    = document.getElementById('shipSameAsBilling');
  const shipFields = document.getElementById('shipToFields');
  if (addrs.length > 0) {
    set('shipToAddress', addrs[0].address);
    set('shipToState',   addrs[0].state);
    if (sameChk)    sameChk.checked             = false;
    if (shipFields) shipFields.style.display     = 'block';
  } else {
    set('shipToAddress', '');
    set('shipToState',   '');
    if (sameChk)    sameChk.checked             = true;
    if (shipFields) shipFields.style.display     = 'none';
  }

  if (client.contacts && Array.isArray(client.contacts)) {
    state.contacts = JSON.parse(JSON.stringify(client.contacts));
    renderContacts();
  }

  renderShipToAddresses(id);
  autoDetectGstType();
  syncDoc();
  saveState();
  showNotification('Loaded: ' + client.name);
}

async function deleteClientFromDb(id, e) {
  e.stopPropagation();
  if (!confirm('Remove this client from the database?')) return;
  await DM.deleteClientRecord(id);
  if (state.activeClientId === id) {
    state.activeClientId = null;
    renderShipToAddresses(null);
  }
  renderClientDb();
  showNotification('Client removed');
}

function clearClientFields() {
  state.activeClientId = null;
  const set = (elId, val='') => { const el = document.getElementById(elId); if (el) el.value = val; };
  set('clientName'); set('clientAddress'); set('clientGstin');
  set('buyerState'); set('shipToAddress'); set('shipToState');
  const sameChk2   = document.getElementById('shipSameAsBilling');
  const shipFields2 = document.getElementById('shipToFields');
  if (sameChk2)    sameChk2.checked              = true;
  if (shipFields2) shipFields2.style.display      = 'none';
  state.contacts = [];
  renderContacts();
  renderShipToAddresses(null);
  autoDetectGstType();
  syncDoc();
}

// ===== SHIP-TO ADDRESS MANAGEMENT =====

function renderShipToAddresses(clientId) {
  const section  = document.getElementById('shipToSavedSection');
  const list     = document.getElementById('shipToSavedList');
  const saveBtn  = document.getElementById('shipToSaveBtn');
  if (!section || !list) return;

  if (!clientId) {
    section.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
    return;
  }

  const db     = DM.getClients();
  const client = db.find(c => c.id === clientId);
  if (!client) { section.style.display = 'none'; return; }

  const addrs = client.shipAddresses || [];
  section.style.display = 'block';
  if (saveBtn) saveBtn.style.display = 'flex';

  if (addrs.length === 0) {
    list.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 0 6px">No saved addresses yet — fill below and click Save</div>';
    return;
  }

  const curAddr = (document.getElementById('shipToAddress') || {}).value || '';
  list.innerHTML = addrs.map(a => `
    <div class="shipto-addr-card ${a.address === curAddr ? 'active' : ''}" onclick="selectShipToAddress(${clientId}, ${a.id})">
      <div class="shipto-addr-info">
        <div class="shipto-addr-label">${escHtml(a.label)}</div>
        <div class="shipto-addr-detail">${escHtml((typeof GST_STATE_CODES !== 'undefined' && a.state ? GST_STATE_CODES[a.state] + ' · ' : '') + a.address.split('\n')[0])}</div>
      </div>
      <button class="shipto-addr-del" onclick="deleteShipToAddress(${clientId}, ${a.id}, event)" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>`).join('');
}

function selectShipToAddress(clientId, addrId) {
  const db     = DM.getClients();
  const client = db.find(c => c.id === clientId);
  if (!client) return;
  const addr = (client.shipAddresses || []).find(a => a.id === addrId);
  if (!addr) return;
  const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
  set('shipToAddress', addr.address);
  set('shipToState',   addr.state);
  renderShipToAddresses(clientId);
  autoDetectGstType();
  syncDoc();
}

function saveShipToToClient() {
  const clientId = state.activeClientId;
  if (!clientId) { showNotification('Load a client first to save an address', 'error'); return; }

  const address   = ((document.getElementById('shipToAddress') || {}).value || '').trim();
  if (!address)   { showNotification('Enter a ship-to address first', 'error'); return; }

  const stateCode = (document.getElementById('shipToState') || {}).value || '';
  const db        = DM.getClients();
  const client    = db.find(c => c.id === clientId);
  if (!client) return;

  client.shipAddresses = client.shipAddresses || [];

  if (client.shipAddresses.find(a => a.address.trim().toLowerCase() === address.toLowerCase())) {
    showNotification('Address already saved', 'error'); return;
  }

  const defaultLabel = address.split('\n')[0].substring(0, 30);
  const label = (prompt('Label for this address (e.g. "Mumbai Warehouse"):', defaultLabel) || '').trim();
  if (!label) return;

  client.shipAddresses.push({ id: Date.now(), label, address, state: stateCode });
  DM.updateClientRecord(client.id, client);

  const sChk   = document.getElementById('shipSameAsBilling');
  const sFields = document.getElementById('shipToFields');
  if (sChk)    sChk.checked            = false;
  if (sFields) sFields.style.display   = 'block';
  renderShipToAddresses(clientId);
  showNotification('Address saved ✓');
}

function deleteShipToAddress(clientId, addrId, e) {
  e.stopPropagation();
  const db     = DM.getClients();
  const client = db.find(c => c.id === clientId);
  if (!client) return;
  client.shipAddresses = (client.shipAddresses || []).filter(a => a.id !== addrId);
  DM.updateClientRecord(client.id, client);
  renderShipToAddresses(clientId);
}

// ===== CLIENT DB RENDER =====
function renderClientDb() {
  const container = document.getElementById('clientDbList');
  if (!container) return;

  const db    = DM.getClients();
  const query = ((document.getElementById('clientDbSearch') || {}).value || '').toLowerCase().trim();
  const filtered = query
    ? db.filter(c => c.name.toLowerCase().includes(query) ||
                     (c.gstin  || '').toLowerCase().includes(query) ||
                     (c.address|| '').toLowerCase().includes(query))
    : db;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="client-db-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:block;margin:0 auto 6px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      ${query ? 'No clients match your search' : 'No saved clients yet.<br>Fill in client details below<br>and click <strong>Save to Client DB</strong>'}
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(c => {
    const meta = [c.gstin, c.address ? c.address.split('\n')[0] : ''].filter(Boolean).join(' · ');
    return `<div class="client-card" onclick="loadClientFromDb('${c.id}')">
      <div class="client-card-info">
        <div class="client-card-name">${escHtml(c.name)}</div>
        ${meta ? `<div class="client-card-meta">${escHtml(meta)}</div>` : ''}
      </div>
      <button class="client-card-edit" onclick="openEditClient('${c.id}', event)" title="Edit client">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="client-card-del" onclick="deleteClientFromDb('${c.id}', event)" title="Remove from DB">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>`;
  }).join('');
}

// ===== CLIENT DB EXCEL EXPORT / IMPORT =====

function exportClientDbExcel() {
  const db = getClientDb();
  if (db.length === 0) { showNotification('No clients to export', 'error'); return; }

  // ── Sheet 1: Clients ──
  const clientRows = [['ID','Name','GSTIN','Buyer State Code','Buyer State Name','Billing Address','Contacts']];
  db.forEach(c => {
    const stateName = (GST_STATE_CODES && c.buyerState) ? (GST_STATE_CODES[c.buyerState] || '') : '';
    const contacts  = (c.contacts || []).map(ct => [ct.salutation||'', ct.name, ct.designation, ct.phone, ct.email].filter(Boolean).join(' | ')).join('; ');
    clientRows.push([c.id, c.name, c.gstin, c.buyerState||'', stateName, c.address||'', contacts]);
  });

  // ── Sheet 2: Ship-to Addresses ──
  const addrRows = [['Client ID','Client Name','GSTIN','Address Label','Ship-to Address','Ship-to State Code','Ship-to State Name']];
  db.forEach(c => {
    (c.shipAddresses || []).forEach(a => {
      const sName = (GST_STATE_CODES && a.state) ? (GST_STATE_CODES[a.state] || '') : '';
      addrRows.push([c.id, c.name, c.gstin, a.label||'', a.address||'', a.state||'', sName]);
    });
  });

  const wb  = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(clientRows);
  const ws2 = XLSX.utils.aoa_to_sheet(addrRows);

  // Column widths
  ws1['!cols'] = [{wch:14},{wch:30},{wch:18},{wch:12},{wch:20},{wch:40},{wch:60}];
  ws2['!cols'] = [{wch:14},{wch:30},{wch:18},{wch:24},{wch:40},{wch:14},{wch:20}];

  XLSX.utils.book_append_sheet(wb, ws1, 'Clients');
  XLSX.utils.book_append_sheet(wb, ws2, 'Ship-to Addresses');

  const date = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, 'client_database_' + date + '.xlsx');
  showNotification('Client DB exported (' + db.length + ' clients) ✓');
}

function importClientDbExcel(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb       = XLSX.read(e.target.result, { type: 'array' });
      const ws       = wb.Sheets[wb.SheetNames[0]]; // Clients sheet
      const rows     = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });

      if (rows.length < 2) { showNotification('No data found in file', 'error'); return; }

      // Detect header row (skip it)
      const dataRows = rows.slice(1).filter(r => r[2] && String(r[2]).trim()); // GSTIN required

      // Load ship-to sheet if present
      const addrSheet = wb.Sheets['Ship-to Addresses'];
      const addrMap   = {};  // clientId → []
      if (addrSheet) {
        const addrRows = XLSX.utils.sheet_to_json(addrSheet, { header:1, defval:'' }).slice(1);
        addrRows.forEach(r => {
          const cid = String(r[0]).trim();
          if (!cid) return;
          if (!addrMap[cid]) addrMap[cid] = [];
          if (r[4]) addrMap[cid].push({ id: Date.now() + Math.random(), label: String(r[3]||'').trim() || String(r[4]).split('\n')[0].substring(0,30), address: String(r[4]).trim(), state: String(r[5]||'').trim() });
        });
      }

      const existing = getClientDb();
      const existingGstins = new Set(existing.map(c => c.gstin.trim().toLowerCase()));

      let added = 0, skipped = 0;
      dataRows.forEach(r => {
        const gstin = String(r[2]||'').trim();
        if (!gstin) { skipped++; return; }
        if (existingGstins.has(gstin.toLowerCase())) { skipped++; return; } // skip duplicates

        const id  = String(r[0]||'').trim() || String(Date.now() + Math.random());
        const client = {
          id:           Number(id) || Date.now() + Math.random(),
          name:         String(r[1]||'').trim(),
          gstin,
          buyerState:   String(r[3]||'').trim(),
          address:      String(r[5]||'').trim(),
          contacts:     [],
          shipAddresses: addrMap[id] || [],
        };

        // Parse inline contacts string if present
        const contactsStr = String(r[6]||'').trim();
        if (contactsStr) {
          contactsStr.split(';').forEach(cs => {
            const parts = cs.split('|').map(s => s.trim());
            if (parts.length >= 2) {
              // Check if first part is a salutation
              const salutations = ['Mr.','Mrs.','Miss','Ms.','Dr.','Prof.','Eng.'];
              let salutation = 'Mr.', name = '', designation = '', phone = '', email = '';
              let offset = 0;
              if (salutations.includes(parts[0])) { salutation = parts[0]; offset = 1; }
              name        = parts[offset]   || '';
              designation = parts[offset+1] || '';
              phone       = parts[offset+2] || '';
              email       = parts[offset+3] || '';
              client.contacts.push({ id: Date.now() + Math.random(), salutation, name, designation, phone, email });
            }
          });
        }

        existing.unshift(client);
        existingGstins.add(gstin.toLowerCase());
        added++;
      });

      saveClientDb(existing);
      renderClientDb();
      showNotification('Imported: ' + added + ' clients' + (skipped ? ' (' + skipped + ' skipped — duplicate GSTIN or no GSTIN)' : '') + ' ✓');
    } catch(err) {
      showNotification('Import failed: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function toggleShipSameAsBilling() {
  const checked = document.getElementById('shipSameAsBilling').checked;
  const fields  = document.getElementById('shipToFields');
  if (fields) fields.style.display = checked ? 'none' : 'block';
  if (checked) {
    const set = (id) => { const el = document.getElementById(id); if (el) el.value = ''; };
    set('shipToAddress');
    set('shipToState');
    const saveBtn = document.getElementById('shipToSaveBtn');
    if (saveBtn) saveBtn.style.display = 'none';
  }
  autoDetectGstType();
  syncDoc();
}

// ===== EDIT CLIENT =====
let _editClientId  = null;
let _editShipAddrs = [];  // working copy while modal open
let _editContacts  = [];  // working copy of contacts while modal open

function openEditClient(id, e) {
  e.stopPropagation();
  const db     = getClientDb();
  const client = db.find(c => c.id === id);
  if (!client) return;

  _editClientId  = id;
  _editShipAddrs = JSON.parse(JSON.stringify(client.shipAddresses || []));
  _editContacts  = JSON.parse(JSON.stringify(client.contacts      || []));

  const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
  set('editClientName',    client.name);
  set('editClientAddress', client.address);
  set('editClientGstin',   client.gstin);
  set('editBuyerState',    client.buyerState);
  set('editNewShipAddr',   '');
  set('editNewShipState',  '');

  renderEditShipList();
  renderEditContacts();
  document.getElementById('clientEditOverlay').style.display = 'flex';
}

function closeEditClient() {
  document.getElementById('clientEditOverlay').style.display = 'none';
  _editClientId  = null;
  _editShipAddrs = [];
  _editContacts  = [];
}

function renderEditContacts() {
  const list = document.getElementById('editContactsList');
  if (!list) return;
  list.innerHTML = '';
  _editContacts.forEach((c, idx) => {
    const div = document.createElement('div');
    div.className = 'contact-card';
    div.innerHTML = `
      <div class="contact-card-header">
        <span class="contact-card-label">Contact ${idx + 1}</span>
        <button class="del-row-btn" onclick="_removeEditContact(${c.id})" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style="display:grid;grid-template-columns:72px 1fr 1fr;gap:6px;margin-bottom:6px">
        <select style="font-size:12px;padding:6px 4px" onchange="_updateEditContact(${c.id},'salutation',this.value)">
          ${['Mr.','Mrs.','Miss','Ms.','Dr.','Prof.','Eng.'].map(s => `<option value="${s}" ${c.salutation===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <input type="text" value="${escHtml(c.name)}" placeholder="Full Name" oninput="_updateEditContact(${c.id},'name',this.value)" style="font-size:12px">
        <input type="text" value="${escHtml(c.designation)}" placeholder="Designation" oninput="_updateEditContact(${c.id},'designation',this.value)" style="font-size:12px">
      </div>
      <div class="form-row">
        <div><input type="tel" value="${escHtml(c.phone)}" placeholder="Phone" oninput="_updateEditContact(${c.id},'phone',this.value)" style="font-size:12px"></div>
        <div><input type="email" value="${escHtml(c.email)}" placeholder="Email" oninput="_updateEditContact(${c.id},'email',this.value)" style="font-size:12px"></div>
      </div>
    `;
    list.appendChild(div);
  });
}

function _addEditContact() {
  _editContacts.push({ id: Date.now() + Math.random(), salutation: 'Mr.', name: '', designation: '', phone: '', email: '' });
  renderEditContacts();
}

function _removeEditContact(id) {
  _editContacts = _editContacts.filter(c => c.id !== id);
  renderEditContacts();
}

function _updateEditContact(id, field, value) {
  const c = _editContacts.find(c => c.id === id);
  if (c) c[field] = value;
}

function renderEditShipList() {
  const container = document.getElementById('editShipAddrList');
  if (!container) return;
  if (_editShipAddrs.length === 0) {
    container.innerHTML = '<div style="font-size:11px;color:var(--text-muted)">No saved addresses</div>';
    return;
  }
  container.innerHTML = _editShipAddrs.map((a, i) => `
    <div style="display:flex;gap:8px;align-items:flex-start;padding:7px 10px;background:var(--panel-mid);border:1px solid var(--panel-border);border-radius:5px">
      <div style="flex:1;min-width:0">
        <div style="font-size:11.5px;font-weight:600;color:var(--text-primary)">${escHtml(a.label)}</div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-top:1px">${escHtml((GST_STATE_CODES && a.state ? GST_STATE_CODES[a.state] + ' · ' : '') + a.address.split('\n')[0])}</div>
      </div>
      <button onclick="removeEditShipAddr(${i})" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;padding:2px;border-radius:3px;flex-shrink:0" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>`).join('');
}

function addEditShipAddr() {
  const address = (document.getElementById('editNewShipAddr').value || '').trim();
  if (!address) { showNotification('Enter an address first', 'error'); return; }
  const state   = document.getElementById('editNewShipState').value || '';
  const label   = address.split('\n')[0].substring(0, 30);
  if (_editShipAddrs.find(a => a.address.trim().toLowerCase() === address.toLowerCase())) {
    showNotification('Address already exists', 'error'); return;
  }
  _editShipAddrs.push({ id: Date.now(), label, address, state });
  document.getElementById('editNewShipAddr').value  = '';
  document.getElementById('editNewShipState').value = '';
  renderEditShipList();
}

function removeEditShipAddr(idx) {
  _editShipAddrs.splice(idx, 1);
  renderEditShipList();
}

async function saveEditClient() {
  const name  = (document.getElementById('editClientName').value || '').trim();
  if (!name) { showNotification('Client name is required', 'error'); return; }

  const gstin     = (document.getElementById('editClientGstin').value || '').trim().toUpperCase();
  const gstNA     = document.getElementById('editClientGstinNA')?.checked || false;
  const gstStatus = validateGstin(gstin);

  // Block invalid format
  if (gstin && gstStatus === 'invalid') {
    showNotification('Invalid GSTIN format. Must be 15 chars like 22AAAAA0000A1Z5', 'error');
    return;
  }

  // Require explicit checkbox if no GSTIN
  if (!gstin && !gstNA) {
    showNotification('Enter a GSTIN or check "GST No. Not Available" before saving', 'error');
    const chkEl = document.getElementById('editClientGstinNA');
    if (chkEl) {
      chkEl.parentElement.style.color = 'var(--accent)';
      setTimeout(() => { chkEl.parentElement.style.color = ''; }, 2500);
    }
    return;
  }

  const db = DM.getClients();

  // GSTIN duplicate check — exclude current client
  if (gstin) {
    const gstDup = db.find(c => c.id !== _editClientId && (c.gstin || '').trim().toUpperCase() === gstin);
    if (gstDup) { showNotification('GSTIN already used by: ' + gstDup.name, 'error'); return; }
  }

  // Name duplicate warning if no GSTIN
  if (!gstin) {
    const nameDup = db.find(c => c.id !== _editClientId && c.name.trim().toLowerCase() === name.toLowerCase());
    if (nameDup) {
      if (!confirm('Another client named "' + name + '" exists without a GSTIN — sure this is different?')) return;
    }
  }

  const idx = db.findIndex(c => c.id === _editClientId);
  if (idx < 0) { showNotification('Client not found', 'error'); return; }

  db[idx] = {
    ...db[idx],
    name,
    address:         document.getElementById('editClientAddress').value || '',
    gstin,
    gstNotAvailable: gstNA,
    buyerState:      document.getElementById('editBuyerState').value || '',
    contacts:        JSON.parse(JSON.stringify(_editContacts)),
    shipAddresses:   _editShipAddrs,
  };

  console.log('[CLIENT EDIT] updating id:', _editClientId);
  const ok = await DM.updateClientRecord(_editClientId, db[idx]);
  if (ok) {
    renderClientDb();
    renderShipToAddresses(state.activeClientId);
    showNotification('Client updated ✓');
    closeEditClient();
  } else {
    showNotification('Update failed — open console for details', 'error');
  }
}
