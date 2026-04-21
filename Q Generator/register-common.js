/**
 * Shared register helpers: auth/session, theme, ui shell.
 */
(function () {
  const SUPABASE_URL = 'https://ncswfxrbhyjhjvzeepwf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_lIOdxplC0bGpLKewX5XfwA_tsqNwMqF';
  const THEME_KEY = 'qg-theme-preset';
  const THEMES = ['dark', 'light', 'corporate', 'soft'];
  /** Same key as app.js — session hint for “back to register” after opening a doc from Accounts Register. */
  const QG_APP_RETURN_KEY = 'qg-app-return';

  function registerPageBasename() {
    try {
      return (new URL(window.location.href).pathname.split('/').pop() || '').toLowerCase();
    } catch (_) {
      return '';
    }
  }

  /** Called before navigating to index.html with a saved doc from Accounts Register. */
  function setAppReturnFromAccounts(docId, resume) {
    try {
      const href = registerPageBasename() || 'register-accounts.html';
      const id = String(docId || '').trim();
      if (!id) return;
      sessionStorage.setItem(QG_APP_RETURN_KEY, JSON.stringify({
        v: 1,
        href,
        label: 'Back to Accounts Register',
        fromDocId: id,
        resume: {
          scope: 'accounts',
          companyId: String(resume && resume.companyId != null ? resume.companyId : ''),
          docTypeKey: resume && resume.docTypeKey != null && String(resume.docTypeKey).trim() !== ''
            ? String(resume.docTypeKey)
            : null,
        },
      }));
    } catch (_) {}
  }

  function clearAppReturnNav() {
    try { sessionStorage.removeItem(QG_APP_RETURN_KEY); } catch (_) {}
  }

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

  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  function companyLabel(row) {
    const p = row.profile || {};
    return (p.companyName || row.name || '—').trim() || '—';
  }

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

  function applyTheme(theme) {
    const t = THEMES.includes(theme) ? theme : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (_) {}
    const sel = $('regThemeSelect');
    if (sel && sel.value !== t) sel.value = t;
  }

  function bootTheme() {
    let t = 'dark';
    try { t = localStorage.getItem(THEME_KEY) || 'dark'; } catch (_) {}
    applyTheme(t);
    const sel = $('regThemeSelect');
    if (sel) sel.addEventListener('change', () => applyTheme(sel.value || 'dark'));
  }

  function showAuth() {
    if ($('regAuthCard')) $('regAuthCard').style.display = '';
    if ($('regMainCard')) $('regMainCard').style.display = 'none';
    const so = $('regSignOut');
    if (so) so.style.display = 'none';
  }

  function showMain() {
    if ($('regAuthCard')) $('regAuthCard').style.display = 'none';
    if ($('regMainCard')) $('regMainCard').style.display = '';
    const so = $('regSignOut');
    if (so) so.style.display = '';
  }

  async function ensureUser() {
    const { data: ures, error: uerr } = await sb().auth.getUser();
    if (uerr || !ures?.user) return null;
    return ures.user;
  }

  async function initAuthFlow(loadMain) {
    const { data: { session } } = await sb().auth.getSession();
    if (session?.user) {
      showMain();
      await loadMain();
    } else {
      showAuth();
    }

    $('regSignIn')?.addEventListener('click', async () => {
      const email = (($('regEmail') || {}).value || '').trim();
      const password = (($('regPass') || {}).value || '');
      if (!email) return showErr('Enter your email.');
      if (!password) return showErr('Enter your password.');
      showErr('');
      const btn = $('regSignIn');
      if (btn) { btn.disabled = true; btn.textContent = 'Signing in...'; }
      try {
        const { error } = await sb().auth.signInWithPassword({ email, password });
        if (error) throw error;
        if ($('regPass')) $('regPass').value = '';
        showMain();
        await loadMain();
      } catch (e) {
        showErr(e.message || 'Sign in failed.');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Sign in'; }
      }
    });

    $('regSignOut')?.addEventListener('click', async () => {
      await sb().auth.signOut();
      showAuth();
    });

    $('regRefresh')?.addEventListener('click', () => { loadMain(); });

    sb().auth.onAuthStateChange((event, currentSession) => {
      if (event === 'SIGNED_OUT') showAuth();
      else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && currentSession?.user) {
        showMain();
        loadMain();
      }
    });
  }

  function markActiveNav(pageKey) {
    document.querySelectorAll('.reg-shell-tab').forEach((el) => {
      el.classList.toggle('is-active', el.getAttribute('data-page') === pageKey);
    });
  }

  window.QGRegisterCommon = {
    sb,
    $,
    escapeHtml,
    formatDate,
    companyLabel,
    showErr,
    showAuth,
    showMain,
    ensureUser,
    initAuthFlow,
    bootTheme,
    applyTheme,
    markActiveNav,
    QG_APP_RETURN_KEY,
    registerPageBasename,
    setAppReturnFromAccounts,
    clearAppReturnNav,
  };
})();
