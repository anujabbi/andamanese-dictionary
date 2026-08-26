/* assets/browse.js — two-pane controller for the reverse-index & category pages.
   Renders entries fetched from other files into the right pane via GACards.
   Vanilla IIFE; no modules. */
(function () {
  'use strict';

  // Turn the #id entry paragraph of an already-parsed lexicon document into a card.
  // Returns HTMLElement|null.
  function cardFromDoc(doc, id, base) {
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
  }

  // Fetch lexicon/<file>, extract the #id entry paragraph, render it as a card.
  // Returns a Promise<HTMLElement|null>.
  function loadEntry(base, file, id) {
    return fetch(base + 'lexicon/' + file)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        return cardFromDoc(new DOMParser().parseFromString(html, 'text/html'), id, base);
      });
  }

  // Cards for a whole set of rows, in the order given. Rows are grouped by file
  // first so each lexicon page is fetched once: a gloss group such as
  // "a kind of tree" has 29 members spread over only 12 files, and fetching
  // per-entry would issue 29 requests for the same 12 documents.
  function loadEntries(base, rows) {
    var byFile = {};
    rows.forEach(function (r) { (byFile[r.file] = byFile[r.file] || []).push(r); });
    var docs = {};
    return Promise.all(Object.keys(byFile).map(function (f) {
      return fetch(base + 'lexicon/' + f)
        .then(function (r) { return r.text(); })
        .then(function (html) { docs[f] = new DOMParser().parseFromString(html, 'text/html'); })
        .catch(function () { docs[f] = null; });
    })).then(function () {
      return rows.map(function (r) {
        return docs[r.file] ? cardFromDoc(docs[r.file], r.id, base) : null;
      }).filter(Boolean);
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
    var groups = {};             // gloss -> member rows, for the group folders
    var openTerm = null;         // which group folder is expanded in the list
    var paneTerm = null;         // which group the entry pane currently holds
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
      // Only rows that stand for an entry are filterable; a group head has no id.
      Array.prototype.forEach.call(ilist.querySelectorAll('a[data-id]'), function (a) {
        var keep = !f || (ok && ok.has(a.dataset.id));
        a.classList.toggle('ga-filtered-out', !keep);
      });
      // A group's count badge always states how many members are actually
      // reachable, so it never promises entries the filter has taken away.
      Array.prototype.forEach.call(ilist.querySelectorAll('.group'), function (g) {
        var vis = g.querySelectorAll('a.member:not(.ga-filtered-out):not(.ga-missing)').length;
        g.classList.toggle('ga-filtered-out', vis === 0);
        var c = g.querySelector('.count');
        if (c) c.textContent = vis;
      });
    }

    function markActive(id, file) {
      Array.prototype.forEach.call(ilist.querySelectorAll('a'), function (a) {
        a.classList.toggle('active', !!id && a.dataset.id === id && (!file || a.dataset.file === file));
      });
    }

    // Expand one group folder and collapse the rest. The pane holds a single
    // group at a time, so letting two folders stand open would leave the list
    // claiming something the pane does not show.
    function setOpen(term) {
      openTerm = term;
      Array.prototype.forEach.call(ilist.querySelectorAll('.group'), function (g) {
        var on = g.dataset.term === term;
        g.classList.toggle('open', on);
        var h = g.querySelector('a.ghead');
        if (h) h.setAttribute('aria-expanded', on ? 'true' : 'false');
      });
    }

    // Scroll a card in the pane to sit under the sticky chrome, not behind it.
    function focusCard(id) {
      if (!id) return;
      var card = pane.querySelector('[id="' + id + '"]');
      if (!card) return;
      var off = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--chrome-top-lb'), 10) || 143;
      var top = card.getBoundingClientRect().top + window.pageYOffset - off - 8;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      markActive(id);
    }

    function showEntry(file, id) {
      paneTerm = null;
      markActive(id, file);
      pane.innerHTML = '<div class="cards"></div>';
      var holder = pane.firstChild;
      loadEntry(base, file, id).then(function (card) {
        if (card) { holder.appendChild(card); window.GACards.applyFilter(holder); }
        else holder.innerHTML = '<p class="hint">Entry not found.</p>';
      });
      // Show the reader where this entry sits when it lives inside a folder.
      var member = ilist.querySelector('a.member[data-id="' + id + '"]');
      if (member) { var host = member.closest('.group'); if (host) setOpen(host.dataset.term); }
      try { history.replaceState(null, '', '#' + id); } catch (e) { location.hash = id; }
    }

    // A gloss group is an ad-hoc category: every entry that shares this meaning,
    // rendered together the way categories/ renders a category.
    function showGroup(term, focusId) {
      var members = groups[term] || [];
      setOpen(term);
      if (paneTerm === term) { focusCard(focusId); return; }
      paneTerm = term;
      markActive(focusId);
      pane.innerHTML = '';
      var wrap = document.createElement('div'); wrap.className = 'cards';
      var head = document.createElement('p'); head.className = 'lpTitlePara';
      head.textContent = term + ' \u2014 ' + members.length + ' entries';
      wrap.appendChild(head);
      pane.appendChild(wrap);
      loadEntries(base, members).then(function (cards) {
        cards.forEach(function (c) { wrap.appendChild(c); });
        // Some index rows point at ids that no longer exist in lexicon/ — a
        // pre-existing defect in the generated indexes. Opening a folder is the
        // first moment we can know, so drop those rows and correct the badge
        // rather than let the folder promise entries it cannot show.
        reconcileGroup(term, cards);
        window.GACards.applyFilter(wrap);
        head.textContent = term + ' \u2014 ' + cards.length +
          (cards.length === 1 ? ' entry' : ' entries');
        focusCard(focusId);
      });
      // A group is not an entry, so it has no #eN to link to; drop a stale one.
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    }

    // Hide member rows whose entry could not be resolved and restate the count.
    function reconcileGroup(term, cards) {
      var g = ilist.querySelector('.group[data-term="' + cssq(term) + '"]');
      if (!g) return;
      var got = {};
      cards.forEach(function (c) { if (c && c.id) got[c.id] = 1; });
      var dead = [];
      Array.prototype.forEach.call(g.querySelectorAll('a.member'), function (m) {
        if (!got[m.dataset.id]) { m.classList.add('ga-missing'); dead.push(m.dataset.file + '#' + m.dataset.id); }
      });
      if (dead.length) console.warn('browse.js: index rows with no entry in lexicon/:', dead.join(', '));
      applyListFilter();
    }

    // Terms are arbitrary gloss text; escape the quote characters that would
    // otherwise break out of an attribute selector.
    function cssq(v) { return String(v).replace(/(["\\])/g, '\\$1'); }

    function makeRow(r, cls) {
      var a = document.createElement('a');
      a.dataset.file = r.file; a.dataset.id = r.id;
      if (cls) a.className = cls;
      if (cls === 'member') {
        // The gloss is already on the folder above; repeating it here would put
        // back the very repetition the folder removes. The IPA headword is what
        // tells one member from another.
        var m = document.createElement('span'); m.className = 'ipa'; m.textContent = r.ipa;
        a.appendChild(m);
      } else {
        var t = document.createElement('span'); t.textContent = r.term;
        var ip = document.createElement('span'); ip.className = 'ipa'; ip.textContent = r.ipa;
        a.appendChild(t); a.appendChild(ip);
      }
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (cls === 'member') {
          var host = a.closest('.group');
          if (host) { showGroup(host.dataset.term, r.id); return; }
        }
        showEntry(r.file, r.id);
      });
      return a;
    }

    function makeGroupHead(term, n) {
      var a = document.createElement('a');
      a.className = 'ghead';
      a.setAttribute('role', 'button');
      a.setAttribute('aria-expanded', 'false');
      var car = document.createElement('span'); car.className = 'caret'; car.setAttribute('aria-hidden', 'true');
      var t = document.createElement('span'); t.className = 'gterm'; t.textContent = term;
      var c = document.createElement('span'); c.className = 'count'; c.textContent = n;
      a.appendChild(car); a.appendChild(t); a.appendChild(c);
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (openTerm === term && paneTerm === term) { setOpen(null); return; }
        showGroup(term, null);
      });
      return a;
    }

    // grouped: fold rows sharing a term into one folder. Only ever true for a
    // list whose term is a *gloss* (English, Hindi), where repetition means
    // "many words, one meaning". A list of headword forms repeats for a
    // different reason (homographs), and folding those would hide the very
    // forms the reader is scanning.
    function renderRows(rows, grouped) {
      ilist.innerHTML = '';
      groups = {}; openTerm = null;
      if (!grouped) {
        rows.forEach(function (r) { ilist.appendChild(makeRow(r)); });
        applyListFilter();
        return;
      }
      var order = [], byTerm = {};
      rows.forEach(function (r) {
        if (!byTerm[r.term]) { byTerm[r.term] = []; order.push(r.term); }
        byTerm[r.term].push(r);
      });
      order.forEach(function (term) {
        var members = byTerm[term];
        if (members.length === 1) { ilist.appendChild(makeRow(members[0])); return; }
        groups[term] = members;
        var wrap = document.createElement('div');
        wrap.className = 'group'; wrap.dataset.term = term;
        wrap.appendChild(makeGroupHead(term, members.length));
        members.forEach(function (m) { wrap.appendChild(makeRow(m, 'member')); });
        ilist.appendChild(wrap);
      });
      applyListFilter();
    }

    // ----- native mode (existing per-letter tables) -----
    function loadNativeLetter(file) {
      return fetch(file).then(function (r) { return r.text(); })
        .then(function (h) { renderRows(parseRows(h), !!mode.group); });
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
      }), !!mode.group);
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

    // A header-search hit is shown in this page's own pane rather than sending
    // the user off to lexicon/. The left-hand list keeps whatever letter it was
    // showing — only the entry pane changes.
    window.GAChrome.registerEntryShower(function (file, id) { showEntry(file, id); return true; });

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
    var catByFile = {};          // cNNN.htm -> display name, filled once the list loads
    var curFile = null;

    function showCategory(file, name) {
      curFile = file;
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

    // The categories pane normally holds a whole category; a header-search hit
    // replaces it with that single entry's card. Picking a category again in
    // the left-hand list restores the full listing.
    function showSingleEntry(file, id) {
      curFile = null;
      Array.prototype.forEach.call(catlist.querySelectorAll('a'), function (a) { a.classList.remove('active'); });
      pane.innerHTML = '';
      var wrap = document.createElement('div'); wrap.className = 'cards';
      pane.appendChild(wrap);
      curCards = wrap;
      loadEntry(base, file, id).then(function (card) {
        if (card) { wrap.appendChild(card); window.GACards.applyFilter(wrap); }
        else wrap.innerHTML = '<p class="hint">Entry not found.</p>';
      });
      try { history.replaceState(null, '', '#' + id); } catch (e) {}
      return true;
    }
    window.GAChrome.registerEntryShower(showSingleEntry);

    fetch(base + 'assets/category-list.json').then(function (r) { return r.json(); }).then(function (list) {
      list.forEach(function (c) {
        catByFile[c.file] = c.name;
        var a = document.createElement('a');
        a.dataset.file = c.file; a.textContent = c.name;
        a.addEventListener('click', function (e) { e.preventDefault(); showCategory(c.file, c.name); });
        catlist.appendChild(a);
      });
      var hash = (location.hash || '').replace('#', '');
      // #eN — a link shared from a search hit; anything else selects a category.
      if (/^e\d+$/.test(hash)) {
        fetch(base + 'assets/search-index.json').then(function (r) { return r.json(); }).then(function (idx) {
          var hit = idx.filter(function (e) { return e.id === hash; })[0];
          if (hit) showSingleEntry(hit.file, hit.id);
          else showCategory(list[0].file, list[0].name);
        });
        return;
      }
      var initial = list.filter(function (c) { return c.file === hash; })[0] || list[0];
      if (initial) showCategory(initial.file, initial.name);
    }).catch(function (e) { console.warn('browse.js: category list failed', e); });

    // A category tag inside the pane points at categories/index.htm#cNNN.htm —
    // i.e. this very page. Following the href would only move the hash, which
    // never re-renders, so swap the pane in place instead.
    pane.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a.cat[href]');
      if (!a) return;
      var m = /#(c\d+\.htm)$/.exec(a.getAttribute('href') || '');
      if (!m) return;
      e.preventDefault();
      showCategory(m[1], catByFile[m[1]] || a.dataset.cat || m[1]);
      pane.scrollTop = 0;
    });

    // Back/forward between categories (showCategory uses replaceState, so this
    // only fires for real history navigation, never for our own updates).
    window.addEventListener('hashchange', function () {
      var h = (location.hash || '').replace('#', '');
      if (/^c\d+\.htm$/.test(h) && h !== curFile) showCategory(h, catByFile[h] || h);
    });

    document.addEventListener('ga:filterchange', function () { if (curCards) window.GACards.applyFilter(curCards); });
  }

  window.GABrowse = { loadEntry: loadEntry, initIndexPage: initIndexPage, initCategoryPage: initCategoryPage };
})();
