## Backend: Gmail reply draft with PDF attachment

### What it does

Exposes an HTTPS endpoint:

- `POST /api/gmail/reply-draft`

It creates a **Gmail Reply draft** in the provided `threadId` and attaches a PDF.

### Auth

Send a **Google OAuth access token** as:

- `Authorization: Bearer <access_token>`

The token must include Gmail scope:

- `https://www.googleapis.com/auth/gmail.modify`

### Request body (JSON)

```json
{
  "threadId": "178c...thread",
  "to": "customer@example.com",
  "subject": "Quotation - QT/2026/001",
  "bodyText": "Hi,\\n\\nPlease find attached...\\n",
  "attachment": {
    "filename": "quotation.pdf",
    "contentType": "application/pdf",
    "base64": "JVBERi0xLjcKJc..." 
  }
}
```

### Run locally

```bash
npm install
npm run dev
```

### Deploy (Cloud Run suggestion)

- Build container with Node 18+
- Set `PORT=8080`
- Restrict CORS in production to your `webapp` origin

