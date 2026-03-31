## Gmail Add-on (Apps Script) starter

### What it does
- Shows a contextual card in Gmail
- Provides an **Open generator** button that opens your external web app with `threadId` + `messageId`

### Configure
- Edit `Code.gs` and set:
  - `WEBAPP_BASE_URL`

### Deploy (domain-wide)
Recommended: publish as a Workspace Add-on and deploy via Admin console for your domain.

You will still need a web app + backend to create reply drafts with attachments.

