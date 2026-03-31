## End-to-end test checklist (staging OU → domain roll-out)

### 1) Backend (Cloud Run)
- [ ] Deploy `gmail-integration/backend` to HTTPS
- [ ] Confirm `GET /healthz` returns `ok`
- [ ] Confirm `POST /api/gmail/reply-draft` works with a real OAuth access token (`gmail.modify`)
- [ ] Confirm draft appears in Gmail in correct thread and has the PDF attached
- [ ] Confirm attachment filename and size are correct

### 2) Web app
- [ ] Host `gmail-integration/webapp/index.html` on HTTPS
- [ ] Set `BACKEND_URL` in `webapp/index.html`
- [ ] Set `GENERATOR_URL` in `webapp/index.html` (your hosted generator)
- [ ] Open web app with query params (`threadId`, `messageId`, `to`, `subject`) and confirm fields prefill

### 3) Gmail Add-on
- [ ] Set `WEBAPP_BASE_URL` in `gmail-integration/gmail-addon/Code.gs`
- [ ] Deploy add-on to staging OU
- [ ] Open an email → add-on appears → click **Open generator** → web app opens with params

### 4) Roll-out
- [ ] Expand from staging OU to full domain
- [ ] Monitor errors (Cloud Run logs + Apps Script executions)

