/**
 * Gmail Add-on: shows a card in Gmail reading view and opens the external webapp
 * with thread/message context.
 *
 * Deploy domain-wide via Workspace Marketplace SDK or Apps Script deployment flow
 * (admin approved). This project is a starter.
 */

// TODO: set to your deployed webapp URL
var WEBAPP_BASE_URL = 'https://example.com/qg';

function buildContextualCard(e) {
  var access = e && e.gmail && e.gmail.accessToken;
  var msgId = e && e.gmail && e.gmail.messageId;
  var threadId = e && e.gmail && e.gmail.threadId;

  // Best effort: read subject/from/snippet
  var subject = '';
  var from = '';
  var to = '';
  var snippet = '';

  try {
    if (access && msgId) {
      var resp = UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + msgId + '?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To', {
        method: 'get',
        headers: { Authorization: 'Bearer ' + access },
        muteHttpExceptions: true
      });
      var data = JSON.parse(resp.getContentText() || '{}');
      snippet = data.snippet || '';
      var headers = (data.payload && data.payload.headers) || [];
      headers.forEach(function(h) {
        if (h.name === 'Subject') subject = h.value;
        if (h.name === 'From') from = h.value;
        if (h.name === 'To') to = h.value;
      });
    }
  } catch (err) {}

  var url = WEBAPP_BASE_URL +
    '?gmail=1' +
    '&threadId=' + encodeURIComponent(threadId || '') +
    '&messageId=' + encodeURIComponent(msgId || '') +
    '&subject=' + encodeURIComponent(subject || '') +
    '&from=' + encodeURIComponent(from || '') +
    '&to=' + encodeURIComponent(to || '') +
    '&snippet=' + encodeURIComponent(snippet || '');

  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader()
    .setTitle('Quotation Generator')
    .setSubtitle(subject ? ('Thread: ' + subject) : 'Open generator for this thread'));

  var section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph()
    .setText('Open the generator in a new tab, generate PDF, then create a Reply draft with attachment.'));

  section.addWidget(
    CardService.newTextButton()
      .setText('Open generator')
      .setOpenLink(CardService.newOpenLink().setUrl(url))
  );

  card.addSection(section);
  return card.build();
}

