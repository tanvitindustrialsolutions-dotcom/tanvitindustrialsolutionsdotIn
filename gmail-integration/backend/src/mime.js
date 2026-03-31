export function buildReplyDraftMime({
  to,
  subject,
  bodyText,
  attachmentFilename,
  attachmentContentType,
  attachmentBase64,
  inReplyTo,
  references,
}) {
  const boundary = 'qg_boundary_' + Math.random().toString(16).slice(2);

  // Minimal, robust MIME. Gmail will thread using threadId in API call; headers help clients too.
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references ? `References: ${references}` : null,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean);

  const parts = [];

  parts.push(
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    bodyText || ``,
    ``
  );

  if (attachmentBase64) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${attachmentContentType || 'application/pdf'}; name="${attachmentFilename || 'document.pdf'}"`,
      `Content-Disposition: attachment; filename="${attachmentFilename || 'document.pdf'}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      attachmentBase64.replace(/\r?\n/g, ''),
      ``
    );
  }

  parts.push(`--${boundary}--`, ``);

  return headers.join('\r\n') + '\r\n\r\n' + parts.join('\r\n');
}

export function toBase64Url(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

