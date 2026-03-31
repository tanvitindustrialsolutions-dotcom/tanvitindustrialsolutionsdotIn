## Gmail integration (Workspace domain-wide)

This folder contains a working starting point to integrate the Quotation Generator with Gmail as:

- **Gmail entry point**: Google Workspace Gmail Add-on (domain deploy)
- **UI**: external web app (opens in a new tab)
- **Action**: backend creates a **Reply draft** in Gmail with the generated PDF attached

### Components

- `backend/`: HTTP API that creates Gmail drafts with attachments
- `gmail-addon/`: Apps Script Workspace Add-on that appears in Gmail and opens the web app with thread context
- `webapp/`: thin web app that launches your generator and calls the backend

### Deployment overview

1. Deploy `backend/` to Cloud Run (or any HTTPS host).
2. Deploy `webapp/` (static hosting or Cloud Run).
3. Configure OAuth consent + scopes (Workspace admin).
4. Deploy the add-on domain-wide and point it at the `webapp/` URL.

