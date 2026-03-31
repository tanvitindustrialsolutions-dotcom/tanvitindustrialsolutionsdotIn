## OAuth + admin deployment notes (Workspace)

### Scopes (minimal for this architecture)

**Gmail Add-on (Apps Script)**
- `https://www.googleapis.com/auth/gmail.addons.execute`
- `https://www.googleapis.com/auth/gmail.readonly` (only to fetch subject/from/to for the contextual card; optional)
- `https://www.googleapis.com/auth/userinfo.email` (optional)

**Web app / user OAuth token (used by backend)**
- `https://www.googleapis.com/auth/gmail.modify` (required to create drafts with attachments)

### Consent screen / verification

- Use **Internal** (Workspace) OAuth consent screen if this is only for your domain.
- If you later need external users, expect additional verification requirements, especially with Gmail scopes.

### Admin deployment (domain-wide)

- Deploy the add-on to a **staging OU** first.
- Ensure the add-on is **trusted/whitelisted** in Admin console.
- Ensure users are allowed to grant the required OAuth scopes (or configure admin consent, depending on your setup).

### Backend hosting notes

- Host backend on HTTPS (Cloud Run recommended).
- Lock CORS to your webapp origin.
- Consider adding:
  - IAP / OAuth proxy
  - allowlist of Workspace domain users (verify `hd` claim via ID token if you move to ID tokens)

