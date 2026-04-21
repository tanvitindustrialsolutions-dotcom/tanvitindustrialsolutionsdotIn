/**
 * HOME page: sign in → Register vs App. Same Supabase session as app (qg-auth-v2).
 * "Open app" sets qg-skip-app-launcher so index.html does not show the chooser again.
 */
(function () {
  const SUPABASE_URL = 'https://ncswfxrbhyjhjvzeepwf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_lIOdxplC0bGpLKewX5XfwA_tsqNwMqF';
  const SKIP_LAUNCHER = 'qg-skip-app-launcher';

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
    const el = $('portalErr');
    if (!el) return;
    if (!msg) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.textContent = msg;
    el.style.display = 'block';
  }

  function showAuth() {
    $('portalAuth').style.display = '';
    $('portalChooser').style.display = 'none';
  }

  function showChooser() {
    $('portalAuth').style.display = 'none';
    $('portalChooser').style.display = '';
  }

  function goApp() {
    try {
      sessionStorage.setItem(SKIP_LAUNCHER, '1');
    } catch (_) {}
    window.location.href = 'index.html';
  }

  function goRegister() {
    window.location.href = 'register-accounts.html';
  }

  async function init() {
    const { data: { session } } = await sb().auth.getSession();
    if (session?.user) showChooser();
    else showAuth();

    $('portalSignIn')?.addEventListener('click', async () => {
      const email = ($('portalEmail').value || '').trim();
      const password = $('portalPass').value || '';
      if (!email) {
        showErr('Enter your email.');
        return;
      }
      if (!password) {
        showErr('Enter your password.');
        return;
      }
      showErr('');
      const btn = $('portalSignIn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Signing in…';
      }
      try {
        const { error } = await sb().auth.signInWithPassword({ email, password });
        if (error) throw error;
        $('portalPass').value = '';
        showChooser();
      } catch (e) {
        showErr(e.message || 'Sign in failed.');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Sign in';
        }
      }
    });

    $('portalGoApp')?.addEventListener('click', goApp);
    $('portalGoRegister')?.addEventListener('click', goRegister);

    $('portalSignOut')?.addEventListener('click', async () => {
      try {
        sessionStorage.removeItem(SKIP_LAUNCHER);
      } catch (_) {}
      await sb().auth.signOut();
      showAuth();
    });

    sb().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        try {
          sessionStorage.removeItem(SKIP_LAUNCHER);
        } catch (_) {}
        showAuth();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
