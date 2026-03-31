import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { buildReplyDraftMime, toBase64Url } from './mime.js';

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '25mb' })); // PDF base64 can be large

// Auth model:
// - Web app obtains Google OAuth access token (user) with gmail.modify scope
// - Web app sends Bearer token here
// - Backend uses it to call Gmail API
const oauth = new OAuth2Client();

const DraftRequest = z.object({
  threadId: z.string().min(1),
  // Reply target headers are optional because threading is ensured via threadId in API call.
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
  to: z.string().min(3),
  subject: z.string().min(1),
  bodyText: z.string().optional().default(''),
  attachment: z.object({
    filename: z.string().min(1).default('quotation.pdf'),
    contentType: z.string().min(1).default('application/pdf'),
    // base64 (standard), not data URL
    base64: z.string().min(1),
  }),
});

app.get('/healthz', (_req, res) => res.status(200).send('ok'));

app.post('/api/gmail/reply-draft', async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || '');
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ error: 'missing_bearer_token' });
    const accessToken = m[1];

    const parsed = DraftRequest.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const data = parsed.data;

    // Optional: lightweight token sanity check
    await oauth.getTokenInfo(accessToken);

    const gmail = google.gmail({
      version: 'v1',
      auth: new google.auth.OAuth2(),
    });
    gmail.context._options.auth.setCredentials({ access_token: accessToken });

    const rawMime = buildReplyDraftMime({
      to: data.to,
      subject: data.subject,
      bodyText: data.bodyText,
      attachmentFilename: data.attachment.filename,
      attachmentContentType: data.attachment.contentType,
      attachmentBase64: data.attachment.base64,
      inReplyTo: data.inReplyTo,
      references: data.references,
    });

    const draft = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          threadId: data.threadId,
          raw: toBase64Url(rawMime),
        },
      },
    });

    return res.json({
      ok: true,
      draftId: draft.data.id,
      messageId: draft.data.message?.id,
      threadId: draft.data.message?.threadId || data.threadId,
    });
  } catch (err) {
    console.error('[reply-draft] failed', err);
    return res.status(500).json({ error: 'internal_error', message: err?.message || String(err) });
  }
});

const port = parseInt(process.env.PORT || '8080', 10);
app.listen(port, () => console.log(`qg-gmail-backend listening on :${port}`));

