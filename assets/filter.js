/* assets/filter.js — hide reverse-index rows that lack the active tag
   (etym / morph), read from sessionStorage["ga.filter"]. Loaded only by
   the reverse-index panes (index-english, index-hindi, index-ga_in_sript).
   Vanilla IIFE; no modules. */
(function () {
  'use strict';

  function readFilter() {
    try {
      var v = sessionStorage.getItem('ga.filter');
      return (v === 'etym' || v === 'morph') ? v : '';
    } catch (e) { return ''; }
  }

  function goId(href) {
    // "javascript:go('28', '3525')" -> "e3525"
    var m = /go\(\s*'[^']*'\s*,\s*'(\d+)'\s*\)/.exec(href || '');
    return m ? 'e' + m[1] : null;
  }

  function qualifyingIds(index, filter) {
    var set = new Set();
    for (var i = 0; i < index.length; i++) {
      var e = index[i];
      if (filter === 'etym' ? e.etym : e.morph) set.add(e.id);
    }
    return set;
  }

  function apply(index, filter) {
    var ids = qualifyingIds(index, filter);
    var rows = document.querySelectorAll('tr');
    var considered = 0, visible = 0;
    rows.forEach(function (tr) {
      var a = tr.querySelector('a[href^="javascript:go("]');
      if (!a) return;
      considered++;
      var id = goId(a.getAttribute('href'));
      var keep = !!(id && ids.has(id));
      tr.classList.toggle('ga-filtered-out', !keep);
      if (keep) visible++;
    });
    var prev = document.querySelector('.ga-empty');
    if (prev) prev.remove();
    if (considered > 0 && visible === 0) {
      var note = document.createElement('p');
      note.className = 'ga-empty';
      note.textContent = filter === 'etym'
        ? 'No entries with an etymology note on this page.'
        : 'No entries with a morphology note on this page.';
      document.body.appendChild(note);
    }
  }

  function init() {
    var filter = readFilter();
    if (!filter) return;
    fetch('../assets/search-index.json')
      .then(function (r) { return r.json(); })
      .then(function (index) { apply(index, filter); })
      .catch(function (err) { console.warn('filter.js: index load failed', err); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
