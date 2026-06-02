/* assets/chrome.js — injects the shared level-2 header + scope filter.
   Pages set window.GA_PAGE = { section, base } before this loads. No modules. */
(function () {
  'use strict';
  var CFG = window.GA_PAGE || { section: '', base: '' };
  var B = CFG.base || '';

  var NAV = [
    ['lexicon',    'Lexicon',    B + 'lexicon/index.htm'],
    ['devanagari', 'Devanagari', B + 'index-ga_in_sript/index.htm'],
    ['english',    'English',    B + 'index-english/index.htm'],
    ['hindi',      'Hindi',      B + 'index-hindi/index.htm'],
    ['categories', 'Categories', B + 'categories/index.htm'],
  ];

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function buildHeader() {
    var hdr = el('header', 'hdr ga-chrome');
    var brand = el('a', 'brand');
    brand.href = B + 'index.htm';
    brand.innerHTML = 'Great <b>Andamanese</b>';
    hdr.appendChild(brand);
    var nav = el('nav');
    NAV.forEach(function (n) {
      var a = el('a', n[0] === CFG.section ? 'active' : '', n[1]);
      a.href = n[2];
      nav.appendChild(a);
    });
    hdr.appendChild(nav);
    hdr.appendChild(el('span', 'spacer'));
    hdr.appendChild(buildScope());
    return hdr;
  }

  function opt(value, label, sel) {
    var o = document.createElement('option');
    o.value = value; o.textContent = label; if (sel) o.selected = true;
    return o;
  }

  var mainSel, srcSel;
  function buildScope() {
    var wrap = el('span', 'scope');
    wrap.appendChild(el('label', null, 'Show'));
    mainSel = el('select', 'scope-main');
    [['', 'All entries'], ['etym', 'ETYM'], ['morph', 'MORPH'], ['env', 'ENV']]
      .forEach(function (p) { mainSel.appendChild(opt(p[0], p[1])); });
    srcSel = el('select', 'scope-src');
    wrap.appendChild(mainSel); wrap.appendChild(srcSel);
    return wrap;
  }

  function readLS(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function writeLS(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

  function syncSrcVisibility() { srcSel.hidden = mainSel.value !== 'etym'; }

  function restore() {
    var f = readLS('ga.filter');
    if (f === 'etym' || f === 'morph' || f === 'env') mainSel.value = f;
    if (!srcSel.options.length) srcSel.appendChild(opt('', 'All sources'));
    syncSrcVisibility();
    srcSel.value = readLS('ga.filter.value');
  }

  function onChange() {
    writeLS('ga.filter', mainSel.value);
    if (mainSel.value !== 'etym') { writeLS('ga.filter.value', ''); srcSel.value = ''; }
    else writeLS('ga.filter.value', srcSel.value || '');
    syncSrcVisibility();
    document.dispatchEvent(new CustomEvent('ga:filterchange'));
  }

  function init() {
    document.body.insertBefore(buildHeader(), document.body.firstChild);
    restore();
    mainSel.addEventListener('change', onChange);
    srcSel.addEventListener('change', onChange);
  }

  // Build/replace the top letter row under the header.
  // opts = { letters: [{label, href?, key?, active?}], toggle?: HTMLElement }
  function renderLetterRow(opts) {
    var hdr = document.querySelector('header.ga-chrome');
    var existing = hdr.nextElementSibling;
    if (existing && existing.classList.contains('letterbar')) existing.remove();
    var bar = document.createElement('nav');
    bar.className = 'letterbar' + (opts.toggle ? ' labeled' : '');
    if (opts.toggle) bar.appendChild(opts.toggle);
    (opts.letters || []).forEach(function (L) {
      var a = document.createElement('a');
      a.textContent = L.label;
      if (L.href) a.href = L.href;
      if (L.key != null) a.dataset.key = L.key;
      if (L.active) a.className = 'active';
      bar.appendChild(a);
    });
    hdr.parentNode.insertBefore(bar, hdr.nextSibling);
    return bar;
  }

  // Build a script-toggle control (.scriptseg). options = [{key,label}]; calls
  // onPick(key) when a button is chosen. Returns the element (first option active).
  function buildScriptToggle(options, onPick) {
    var seg = document.createElement('span');
    seg.className = 'scriptseg';
    options.forEach(function (o, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = o.label;
      b.dataset.key = o.key;
      if (i === 0) b.className = 'active';
      b.addEventListener('click', function () {
        if (b.classList.contains('active')) return;
        Array.prototype.forEach.call(seg.querySelectorAll('button'), function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        onPick(o.key);
      });
      seg.appendChild(b);
    });
    return seg;
  }

  // Public hook surface used by page-specific bootstraps and browse.js.
  window.GAChrome = {
    buildScriptToggle: buildScriptToggle,
    config: CFG,
    base: B,
    headerEl: function () { return document.querySelector('header.ga-chrome'); },
    mainSelect: function () { return mainSel; },
    sourceSelect: function () { return srcSel; },
    renderLetterRow: renderLetterRow,
    onReady: function (fn) { document.addEventListener('ga:chromeready', fn); },
  };

  function firstLetterIn(text, set) {
    var s = String(text || '');
    for (var i = 0; i < s.length; i++) { if (set.has(s[i])) return s[i]; }
    return '';
  }

  // Lexicon pages: IPA letter row (navigates per-letter pages) with an
  // [a–z | देव] toggle. देव mode is data-driven from search-index.json: it hides
  // the static cards and renders a Devanagari-grouped card list in their place.
  function initLexicon() {
    var cur = (location.pathname.match(/(\d{2})\.htm$/) || [])[1];
    var lexMap = null, index = null, collation = null, devBox = null;
    function cardsPage() { return document.querySelector('.cards-page'); }

    function entryFromIndex(e) {
      return { id: e.id, ipa: e.ipa, hom: null, deva: e.deva || null, morph: e.morph || null,
               varText: null, etym: e.etym || null, pos: null, glossEn: e.en || null,
               glossHi: e.hi || null, audioMain: e.audio || null, examples: [],
               categories: e.cat ? [e.cat] : [], note: null, refs: [], env: !!e.env };
    }
    function toggleEl() {
      return buildScriptToggle([{ key: 'ipa', label: 'a–z' }, { key: 'dev', label: 'देव' }], setMode);
    }
    function setToggleActive(m) {
      var seg = document.querySelector('.scriptseg'); if (!seg) return;
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
        b.classList.toggle('active', b.dataset.key === m);
      });
    }
    function setMode(m) {
      try { sessionStorage.setItem('ga.script.lexicon', m); } catch (e) {}
      if (m === 'dev') showDev(); else showIpa();
    }
    function showIpa() {
      if (devBox) { devBox.remove(); devBox = null; }
      var cp = cardsPage(); if (cp) cp.style.display = '';
      renderLetterRow({
        toggle: toggleEl(),
        letters: lexMap.map(function (m) {
          return { label: m.label, href: B + 'lexicon/' + m.file, active: cur != null && m.file === cur + '.htm' };
        }),
      });
      setToggleActive('ipa');
    }
    function showDev() {
      var cp = cardsPage(); if (cp) cp.style.display = 'none';
      var set = new Set(collation.devGa);
      var present = {};
      index.forEach(function (e) { if (e.deva) { var g = firstLetterIn(e.deva, set); if (g) present[g] = 1; } });
      var letters = collation.devGa.filter(function (l) { return present[l]; });
      renderLetterRow({
        toggle: toggleEl(),
        letters: letters.map(function (l, i) { return { label: l, key: 'dev:' + l, active: i === 0 }; }),
      });
      setToggleActive('dev');
      var bar = document.querySelector('nav.letterbar');
      bar.addEventListener('click', function (e) {
        var a = e.target.closest('a[data-key]'); if (!a) return; e.preventDefault();
        Array.prototype.forEach.call(bar.querySelectorAll('a'), function (x) { x.classList.remove('active'); });
        a.classList.add('active');
        showGroup(a.dataset.key.slice(4));
      });
      if (!devBox) {
        devBox = document.createElement('div'); devBox.className = 'cards';
        bar.parentNode.insertBefore(devBox, bar.nextSibling);
      }
      if (letters.length) showGroup(letters[0]);
    }
    function showGroup(letter) {
      var set = new Set(collation.devGa);
      var rows = index.filter(function (e) { return e.deva && firstLetterIn(e.deva, set) === letter; });
      rows.sort(function (a, b) { return String(a.deva).localeCompare(String(b.deva)); });
      devBox.innerHTML = '';
      var head = document.createElement('p'); head.className = 'lpTitlePara'; head.textContent = letter;
      devBox.appendChild(head);
      rows.forEach(function (e) { devBox.appendChild(window.GACards.renderCard(entryFromIndex(e))); });
    }

    Promise.all([
      fetch(B + 'assets/lexicon-letters.json').then(function (r) { return r.json(); }),
      fetch(B + 'assets/search-index.json').then(function (r) { return r.json(); }),
      fetch(B + 'assets/collation-data.json').then(function (r) { return r.json(); }),
    ]).then(function (res) {
      lexMap = res[0]; index = res[1]; collation = res[2];
      var saved = ''; try { saved = sessionStorage.getItem('ga.script.lexicon') || ''; } catch (e) {}
      if (saved === 'dev') showDev(); else showIpa();
    }).catch(function (e) { console.warn('chrome.js: lexicon init failed', e); });
  }

  function start() {
    init();
    document.dispatchEvent(new CustomEvent('ga:chromeready'));
    if (CFG.section === 'lexicon') initLexicon();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
