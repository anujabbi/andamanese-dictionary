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

  // Public hook surface used by page-specific bootstraps and browse.js.
  window.GAChrome = {
    config: CFG,
    base: B,
    headerEl: function () { return document.querySelector('header.ga-chrome'); },
    mainSelect: function () { return mainSel; },
    sourceSelect: function () { return srcSel; },
    onReady: function (fn) { document.addEventListener('ga:chromeready', fn); },
  };

  function start() { init(); document.dispatchEvent(new CustomEvent('ga:chromeready')); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
