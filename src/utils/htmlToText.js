// src/utils/htmlToText.js
const { htmlToText } = require('html-to-text');

function toPlainText(html) {
  if (!html) return '';
  // html-to-text options: preserve line breaks, ignore images, etc.
  return htmlToText(html, {
    wordwrap: 130,
    // preserve paragraph breaks
    selectors: [
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } }
    ]
  }).trim();
}

module.exports = { toPlainText };
