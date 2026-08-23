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
        var entry = window.GACards.parseEntry(p);
        if (!entry) return null;
        // Attach any following lpLexEntryPara2 continuation senses of this headword.
        var sib = p.nextElementSibling;
        while (sib && sib.classList && sib.classList.contains('lpLexEntryPara2')) {
          var s = window.GACards.parseSense(sib);
          if (s) entry.senses.push(s);
          sib = sib.nextElementSibling;
        }
        // Audio/picture paths in the fetched file are relative to lexicon/; re-root
        // them onto this page's base and carry the entry's illustration across.
        window.GACards.rebaseEntryMedia(entry, base);
        var pic = window.GACards.mediaPath(window.GACards.pictureBefore(p), base);
        return window.GACards.renderCard(entry, pic);
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

  // --- collation (browser copy; orders come from assets/collation-data.json) ---
  function firstLetterIn(text, orderSet) {
    var s = String(text || '');
    for (var i = 0; i < s.length; i++) { if (orderSet.has(s[i])) return s[i]; }
    return '';
  }

  // Two-pane reverse-index page controller.
  // cfg = { base, scripts:[{key,label,mode:'native'|'alt', requires?, termField?, groupBy?, order?, sortKey?}] }
  // The page provides #ilist and #pane, and same-dir alphalinks.htm + NN.htm.
  function initIndexPage(cfg) {
    var base = cfg.base || '';
    var ilist = document.getElementById('ilist');
    var pane = document.getElementById('pane');
    var scripts = cfg.scripts && cfg.scripts.length ? cfg.scripts : [{ key: 'native', label: 'A–Z', mode: 'native' }];
    var mode = scripts[0];
    var index = null;            // search-index.json
    var collation = null;        // { devGa:[], hindi:[] }
    var lexLetters = null;       // [{file,label}] for IPA grouping
    var alpha = [];              // native letters [{label,file}] from alphalinks.htm

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

    function renderRows(rows) {
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

    // ----- native mode (existing per-letter tables) -----
    function loadNativeLetter(file) {
      return fetch(file).then(function (r) { return r.text(); }).then(function (h) { renderRows(parseRows(h)); });
    }

    // ----- alt mode (search-index driven) -----
    function altOrder() { return mode.order === 'ipa' ? lexLetters.map(function (l) { return l.label; }) : collation[mode.order]; }
    function letterForFile(file) {
      for (var i = 0; i < lexLetters.length; i++) if (lexLetters[i].file === file) return lexLetters[i].label;
      return '';
    }
    function altGroupOf(e) {
      if (mode.groupBy === 'file') return letterForFile(e.file);
      return firstLetterIn(e[mode.groupBy], new Set(altOrder()));
    }
    function altEntries() { return index.filter(function (e) { return e[mode.requires]; }); }
    function showAltGroup(label) {
      var order = altOrder();
      var rows = altEntries().filter(function (e) { return altGroupOf(e) === label; });
      rows.sort(function (a, b) { return String(a[mode.sortKey] || '').localeCompare(String(b[mode.sortKey] || '')); });
      renderRows(rows.map(function (e) {
        return { term: e[mode.termField] || e.ipa, ipa: e.ipa, file: e.file, id: e.id };
      }));
    }

    function buildToggle() {
      if (scripts.length < 2) return null;
      var seg = window.GAChrome.buildScriptToggle(
        scripts.map(function (s) { return { key: s.key, label: s.label }; }),
        function (key) { setMode(key); }
      );
      // reflect current mode as active
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
        b.classList.toggle('active', b.dataset.key === mode.key);
      });
      return seg;
    }

    function renderForMode() {
      var letters;
      if (mode.mode === 'native') {
        letters = alpha.map(function (L, i) { return { label: L.label, key: 'native:' + L.file, active: i === 0 }; });
      } else {
        var order = altOrder();
        var present = {};
        altEntries().forEach(function (e) { var g = altGroupOf(e); if (g) present[g] = 1; });
        letters = order.filter(function (l) { return present[l]; })
          .map(function (l, i) { return { label: l, key: 'alt:' + l, active: i === 0 }; });
      }
      window.GAChrome.renderLetterRow({ letters: letters, toggle: buildToggle() });
      var bar = document.querySelector('nav.letterbar');
      bar.addEventListener('click', function (e) {
        var a = e.target.closest('a[data-key]'); if (!a) return; e.preventDefault();
        Array.prototype.forEach.call(bar.querySelectorAll('a'), function (x) { x.classList.remove('active'); });
        a.classList.add('active');
        var k = a.dataset.key;
        if (k.indexOf('native:') === 0) loadNativeLetter(k.slice(7));
        else showAltGroup(k.slice(4));
      });
      // load first group/letter
      if (letters.length) {
        if (mode.mode === 'native') loadNativeLetter(letters[0].key.slice(7));
        else showAltGroup(letters[0].key.slice(4));
      }
    }

    function setMode(key) {
      mode = scripts.filter(function (s) { return s.key === key; })[0] || scripts[0];
      try { sessionStorage.setItem('ga.script.' + cfg.section, key); } catch (e) {}
      renderForMode();
    }

    // Load everything we need, then render.
    Promise.all([
      fetch('alphalinks.htm').then(function (r) { return r.text(); }).then(parseLetterLinks),
      fetch(base + 'assets/search-index.json').then(function (r) { return r.json(); }),
      fetch(base + 'assets/collation-data.json').then(function (r) { return r.json(); }),
      fetch(base + 'assets/lexicon-letters.json').then(function (r) { return r.json(); }),
    ]).then(function (res) {
      alpha = res[0]; index = res[1]; collation = res[2]; lexLetters = res[3];
      // restore saved script mode
      var saved = readLS('ga.script.' + cfg.section);
      var savedMode = scripts.filter(function (s) { return s.key === saved; })[0];
      if (savedMode) mode = savedMode;
      renderForMode();
      // deep-link
      var hash = (location.hash || '').replace('#', '');
      if (/^e\d+$/.test(hash)) {
        var hit = index.filter(function (e) { return e.id === hash; })[0];
        if (hit) showEntry(hit.file, hit.id);
      }
    }).catch(function (e) { console.warn('browse.js: initIndexPage load failed', e); });

    document.addEventListener('ga:filterchange', applyListFilter);
  }

  // Two-pane categories page controller. Page provides #catlist and #pane.
  function initCategoryPage(cfg) {
    var base = cfg.base || '';
    var catlist = document.getElementById('catlist');
    var pane = document.getElementById('pane');
    var curCards = null;

    function showCategory(file, name) {
      Array.prototype.forEach.call(catlist.querySelectorAll('a'), function (a) {
        a.classList.toggle('active', a.dataset.file === file);
      });
      pane.innerHTML = '';
      var wrap = document.createElement('div'); wrap.className = 'cards';
      var head = document.createElement('p'); head.className = 'lpTitlePara'; head.textContent = name;
      wrap.appendChild(head);
      pane.appendChild(wrap);
      curCards = wrap;
      fetch(base + 'categories/' + file).then(function (r) { return r.text(); }).then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var built = [], lastEntry = null;
        Array.prototype.forEach.call(doc.querySelectorAll('p.lpLexEntryPara, p.lpLexEntryPara2'), function (p) {
          if (p.classList.contains('lpLexEntryPara2')) {
            var s = window.GACards.parseSense(p);
            if (s && lastEntry) lastEntry.senses.push(s);
            return;
          }
          var entry = window.GACards.parseEntry(p);
          if (!entry) return;
          // Category files carry the same media markup as lexicon files, relative
          // to categories/ — re-root it and pick up the entry's illustration.
          window.GACards.rebaseEntryMedia(entry, base);
          built.push({ entry: entry, pic: window.GACards.mediaPath(window.GACards.pictureBefore(p), base) });
          lastEntry = entry;
        });
        built.forEach(function (b) { wrap.appendChild(window.GACards.renderCard(b.entry, b.pic)); });
        window.GACards.applyFilter(wrap);
      });
      try { history.replaceState(null, '', '#' + file); } catch (e) { location.hash = file; }
    }

    fetch(base + 'assets/category-list.json').then(function (r) { return r.json(); }).then(function (list) {
      list.forEach(function (c) {
        var a = document.createElement('a');
        a.dataset.file = c.file; a.textContent = c.name;
        a.addEventListener('click', function (e) { e.preventDefault(); showCategory(c.file, c.name); });
        catlist.appendChild(a);
      });
      var hash = (location.hash || '').replace('#', '');
      var initial = list.filter(function (c) { return c.file === hash; })[0] || list[0];
      if (initial) showCategory(initial.file, initial.name);
    }).catch(function (e) { console.warn('browse.js: category list failed', e); });

    document.addEventListener('ga:filterchange', function () { if (curCards) window.GACards.applyFilter(curCards); });
  }

  window.GABrowse = { loadEntry: loadEntry, initIndexPage: initIndexPage, initCategoryPage: initCategoryPage };
})();
