/* assets/browse.js — two-pane controller for the reverse-index & category pages.
   Renders entries fetched from other files into the right pane via GACards.
   Vanilla IIFE; no modules. */
(function () {
  'use strict';

  // Fetch lexicon/<file>, extract the #id entry paragraph, render it as a card.
  // Returns a Promise<HTMLElement|null>.
  function loadEntry(base, file, id) {
    return fetch(base + 'lexicon/' + file)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var span = doc.getElementById(id);
        if (!span) return null;
        var p = span.closest('p.lpLexEntryPara');
        if (!p) return null;
        return window.GACards.renderCard(window.GACards.parseEntry(p));
      });
  }

  window.GABrowse = { loadEntry: loadEntry };
})();
