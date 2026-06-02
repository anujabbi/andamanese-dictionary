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

  // ---- helpers ----
  function readLS(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function etymSource(v) { return v ? String(v).split(/[;,]/)[0].trim() : ''; }

  function parseLetterLinks(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    return Array.prototype.slice.call(doc.querySelectorAll('a[href]'))
      .filter(function (a) { return /^\d{2}\.htm$/.test(a.getAttribute('href')); })
      .map(function (a) { return { label: a.textContent.trim(), file: a.getAttribute('href') }; });
  }

  function parseRows(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var rows = [], prev = '';
    Array.prototype.forEach.call(doc.querySelectorAll('tr'), function (tr) {
      var a = tr.querySelector('a[href^="javascript:go("]');
      if (!a) return;
      var m = /go\(\s*'(\d+)'\s*,\s*'(\d+)'\s*\)/.exec(a.getAttribute('href'));
      if (!m) return;
      var ipaSpan = a.querySelector('span.lpLexEntryName');
      var termSpan = tr.querySelector('td span[class^="lpIndex"]');
      var term = termSpan ? termSpan.textContent.trim() : '';
      if (!term || term === '·') term = prev; else prev = term;
      rows.push({ term: term, ipa: ipaSpan ? ipaSpan.textContent.trim() : '',
                  file: m[1] + '.htm', id: 'e' + m[2] });
    });
    return rows;
  }

  // Two-pane reverse-index page controller.
  // cfg = { base } ; the page provides #ilist and #pane, and same-dir alphalinks.htm + NN.htm.
  function initIndexPage(cfg) {
    var base = cfg.base || '';
    var ilist = document.getElementById('ilist');
    var pane = document.getElementById('pane');
    var index = null; // search-index.json, for filtering + hash lookup

    function qualifies(e, f, val) {
      if (f === 'morph') return !!e.morph;
      if (f === 'etym') return !!e.etym && (!val || etymSource(e.etym) === val);
      if (f === 'env') return !!e.env;
      return true;
    }
    function applyListFilter() {
      var f = readLS('ga.filter'), val = readLS('ga.filter.value');
      var ok = null;
      if (f && index) { ok = new Set(); index.forEach(function (e) { if (qualifies(e, f, val)) ok.add(e.id); }); }
      Array.prototype.forEach.call(ilist.querySelectorAll('a'), function (a) {
        var keep = !f || (ok && ok.has(a.dataset.id));
        a.classList.toggle('ga-filtered-out', !keep);
      });
    }

    function showEntry(file, id) {
      Array.prototype.forEach.call(ilist.querySelectorAll('a'), function (a) {
        a.classList.toggle('active', a.dataset.id === id && a.dataset.file === file);
      });
      pane.innerHTML = '<div class="cards"></div>';
      var holder = pane.firstChild;
      loadEntry(base, file, id).then(function (card) {
        if (card) holder.appendChild(card); else holder.innerHTML = '<p class="hint">Entry not found.</p>';
      });
      try { history.replaceState(null, '', '#' + id); } catch (e) { location.hash = id; }
    }

    function renderList(rows) {
      ilist.innerHTML = '';
      rows.forEach(function (r) {
        var a = document.createElement('a');
        a.dataset.file = r.file; a.dataset.id = r.id;
        var t = document.createElement('span'); t.textContent = r.term;
        var ip = document.createElement('span'); ip.className = 'ipa'; ip.textContent = r.ipa;
        a.appendChild(t); a.appendChild(ip);
        a.addEventListener('click', function (e) { e.preventDefault(); showEntry(r.file, r.id); });
        ilist.appendChild(a);
      });
      applyListFilter();
    }

    function loadLetter(file) {
      return fetch(file).then(function (r) { return r.text(); }).then(function (h) { renderList(parseRows(h)); });
    }

    // Build letter row from this section's alphalinks.htm.
    fetch('alphalinks.htm').then(function (r) { return r.text(); }).then(function (html) {
      var letters = parseLetterLinks(html);
      window.GAChrome.renderLetterRow({
        letters: letters.map(function (L, i) { return { label: L.label, key: L.file, active: i === 0 }; }),
      });
      var bar = document.querySelector('nav.letterbar');
      bar.addEventListener('click', function (e) {
        var a = e.target.closest('a[data-key]'); if (!a) return; e.preventDefault();
        Array.prototype.forEach.call(bar.querySelectorAll('a'), function (x) { x.classList.remove('active'); });
        a.classList.add('active');
        loadLetter(a.dataset.key);
      });
      if (letters.length) loadLetter(letters[0].file);
    });

    // Load index for filtering; if the URL has #eNNN, pre-select that entry.
    fetch(base + 'assets/search-index.json').then(function (r) { return r.json(); }).then(function (idx) {
      index = idx;
      applyListFilter();
      var hash = (location.hash || '').replace('#', '');
      if (/^e\d+$/.test(hash)) {
        var hit = idx.filter(function (e) { return e.id === hash; })[0];
        if (hit) showEntry(hit.file, hit.id);
      }
    }).catch(function (e) { console.warn('browse.js: index load failed', e); });

    document.addEventListener('ga:filterchange', applyListFilter);
  }

  window.GABrowse = { loadEntry: loadEntry, initIndexPage: initIndexPage };
})();
