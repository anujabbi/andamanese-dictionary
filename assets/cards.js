/* assets/cards.js — transform <p class="lpLexEntryPara"> paragraphs into
   structured card DOM. Single IIFE; no modules. Runs on DOMContentLoaded.
   Coexists with javascript/hi.js (fragment highlight on window.onload). */
(function () {
  'use strict';

  // ---------- Audio helpers ----------

  function isAudioAnchor(node) {
    if (!node || node.nodeType !== 1 || node.tagName !== 'A') return false;
    const href = node.getAttribute('href') || '';
    return /\/audio\//.test(href) || /^audio\//.test(href);
  }

  function findAudioBefore(paragraph, anchorEl) {
    // Walk paragraph children up to anchorEl; return the last audio href found.
    let audio = null;
    for (const node of paragraph.childNodes) {
      if (node === anchorEl) break;
      if (isAudioAnchor(node)) audio = node.getAttribute('href');
    }
    return audio;
  }

  // ---------- Text cleanup ----------

  function cleanText(s) {
    if (!s) return null;
    const t = s.replace(/[\s;.,]+$/, '').trim();
    return t.length ? t : null;
  }

  // ---------- Entry parsing ----------

  function parseEntry(p) {
    const headSpan = p.querySelector('span.lpLexEntryName');
    if (!headSpan) return null;

    const entry = {
      id: headSpan.id || null,
      ipa: headSpan.textContent.trim(),
      hom: null,
      deva: null,
      morph: null,
      varText: null,
      etym: null,
      pos: null,
      glossEn: null,
      glossHi: null,
      audioMain: findAudioBefore(p, headSpan),
      examples: [],
      categories: [],
      note: null,
      refs: [],
    };

    // Homonym subscript appears as <sub> after the headword span.
    const subAfter = headSpan.nextElementSibling;
    if (subAfter && subAfter.tagName === 'SUB') {
      entry.hom = subAfter.textContent.trim();
    }

    const devaSpan = p.querySelector('span.lpLexEntryNameGA_in_Sript');
    if (devaSpan) entry.deva = devaSpan.textContent.trim();

    const morphSpan = p.querySelector('span.lpMorph');
    if (morphSpan) entry.morph = morphSpan.textContent.trim();

    const etymSpan = p.querySelector('span.lpEtymology');
    if (etymSpan) entry.etym = etymSpan.textContent.trim();

    const varSpan = p.querySelector('span.lpMainCrossRef');
    if (varSpan) entry.varText = varSpan.textContent.trim();

    const posSpan = p.querySelector('span.lpPartOfSpeech');
    if (posSpan) entry.pos = posSpan.textContent.trim().replace(/[.\s]+$/, '');

    // Linear walk over element children to capture main glosses, examples,
    // categories, refs, and notes. State machine driven by mini-heading text.
    const kids = Array.from(p.children);
    let mode = 'main';
    let currentExample = null;

    for (const node of kids) {
      const cls = node.classList;
      const text = node.textContent || '';

      // Mini-heading triggers section transitions
      if (cls && cls.contains('lpMiniHeading')) {
        const lbl = text.trim().replace(/[:.\s]+$/, '');
        if (lbl === 'SD') { mode = 'categories'; continue; }
        if (lbl === 'SEE') { mode = 'refs'; continue; }
        if (lbl === 'NT') { mode = 'notes'; continue; }
        continue; // MORPH/VAR/Etym already captured via querySelector
      }

      if (cls && cls.contains('lpExample')) {
        currentExample = {
          ipa: text.trim(),
          deva: null,
          glossEn: null,
          glossHi: null,
          audio: findAudioBefore(p, node),
        };
        entry.examples.push(currentExample);
        mode = 'inExample';
        continue;
      }

      if (mode === 'main') {
        if (cls && cls.contains('lpGlossEnglish') && !entry.glossEn) {
          entry.glossEn = cleanText(text);
        } else if (cls && cls.contains('lpGlossHindi') && !entry.glossHi) {
          entry.glossHi = cleanText(text);
        }
      } else if (mode === 'inExample' && currentExample) {
        if (cls && cls.contains('lpGlossGA_in_Sript') && !currentExample.deva) {
          currentExample.deva = text.trim();
        } else if (cls && cls.contains('lpGlossEnglish') && !currentExample.glossEn) {
          currentExample.glossEn = cleanText(text);
        } else if (cls && cls.contains('lpGlossHindi') && !currentExample.glossHi) {
          currentExample.glossHi = cleanText(text);
        }
      } else if (mode === 'categories') {
        if (cls && cls.contains('lpCategory')) {
          entry.categories.push(text.trim());
        }
      } else if (mode === 'refs') {
        if (node.tagName === 'A') {
          const refSpan = node.querySelector('span.lpCrossRef');
          if (refSpan) {
            const title = node.getAttribute('title') || '';
            entry.refs.push({
              href: node.getAttribute('href'),
              ipa: refSpan.textContent.trim(),
              gloss: cleanText(title.split(';')[0]) || null,
            });
          }
        }
      } else if (mode === 'notes') {
        if (cls && cls.contains('lpEncycInfoEnglish') && !entry.note) {
          entry.note = cleanText(text.replace(/^NT:\s*/, ''));
        }
      }
    }

    return entry;
  }

  // ---------- Rendering ----------

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderCard(entry, pictureSrc) {
    const card = el('article', 'entry');
    if (entry.id) card.id = entry.id;

    const body = el('div', 'body');

    // Head
    const head = el('div', 'head');
    head.appendChild(el('span', 'ipa', entry.ipa));
    if (entry.hom) head.appendChild(el('span', 'hom', entry.hom));
    if (entry.deva) head.appendChild(el('span', 'deva', entry.deva));
    if (entry.pos) head.appendChild(el('span', 'pos', entry.pos));
    if (entry.audioMain) {
      const btn = el('button', 'audio-btn', '▶');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Play pronunciation');
      btn.dataset.audio = entry.audioMain;
      head.appendChild(btn);
    }
    body.appendChild(head);

    if (entry.glossEn) body.appendChild(el('div', 'gloss', entry.glossEn));
    if (entry.glossHi) body.appendChild(el('div', 'gloss-hi', entry.glossHi));

    // Meta line
    const metaItems = [];
    if (entry.morph)   metaItems.push(['Morph',   entry.morph,   'morph']);
    if (entry.varText) metaItems.push(['Variant', entry.varText, 'var']);
    if (entry.etym)    metaItems.push(['Etym',    entry.etym,    'etym']);
    if (metaItems.length) {
      const meta = el('div', 'meta-line');
      for (const [lbl, val, cls] of metaItems) {
        meta.appendChild(el('span', 'lbl', lbl));
        meta.appendChild(el('span', cls, val));
      }
      body.appendChild(meta);
    }

    // Examples
    for (const ex of entry.examples) {
      const exDiv = el('div', 'example');
      exDiv.appendChild(el('div', 'lbl', 'Example'));
      const line1 = document.createElement('div');
      line1.appendChild(el('span', 'ex-ipa', ex.ipa));
      if (ex.deva) line1.appendChild(el('span', 'ex-deva', ex.deva));
      if (ex.audio) {
        const exBtn = el('button', 'ex-audio', '▶');
        exBtn.type = 'button';
        exBtn.setAttribute('aria-label', 'Play example audio');
        exBtn.dataset.audio = ex.audio;
        line1.appendChild(exBtn);
      }
      exDiv.appendChild(line1);
      const parts = [];
      if (ex.glossEn) parts.push(ex.glossEn);
      if (ex.glossHi) parts.push(ex.glossHi);
      if (parts.length) exDiv.appendChild(el('div', 'ex-gloss', parts.join(' · ')));
      body.appendChild(exDiv);
    }

    // Note
    if (entry.note) body.appendChild(el('div', 'note', entry.note));

    // Refs
    if (entry.refs.length) {
      const refs = el('div', 'refs');
      refs.appendChild(el('span', 'lbl', 'See also'));
      for (const r of entry.refs) {
        const a = document.createElement('a');
        a.className = 'ref';
        a.href = r.href;
        a.textContent = r.ipa;
        if (r.gloss) a.appendChild(el('span', 'ref-gloss', ' · ' + r.gloss));
        refs.appendChild(a);
        refs.appendChild(document.createTextNode(' '));
      }
      body.appendChild(refs);
    }

    // Categories
    if (entry.categories.length) {
      const cats = el('div', 'cats');
      for (const c of entry.categories) cats.appendChild(el('span', 'cat', c));
      body.appendChild(cats);
    }

    card.appendChild(body);

    // Picture
    if (pictureSrc) {
      card.classList.add('has-picture');
      const pic = document.createElement('div');
      pic.className = 'pic';
      pic.dataset.lightboxSrc = pictureSrc;
      pic.title = 'Click to enlarge';
      pic.setAttribute('role', 'button');
      pic.setAttribute('tabindex', '0');
      const img = document.createElement('img');
      img.src = pictureSrc;
      img.alt = entry.glossEn || entry.ipa || '';
      img.loading = 'lazy';
      pic.appendChild(img);
      card.appendChild(pic);
    }

    return card;
  }

  // ---------- Audio click delegation ----------

  function installAudioHandler(root) {
    root.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-audio]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        new Audio(btn.dataset.audio).play().catch(err => console.warn('Audio playback failed:', err));
      } catch (err) {
        console.warn('Audio constructor failed:', err);
      }
    });
  }

  // ---------- Lightbox ----------

  let currentLightbox = null;

  function openLightbox(src) {
    closeLightbox();
    const overlay = document.createElement('div');
    overlay.className = 'lightbox';
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    overlay.appendChild(img);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    overlay.appendChild(closeBtn);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target === closeBtn) closeLightbox();
    });
    document.body.appendChild(overlay);
    currentLightbox = overlay;
    closeBtn.focus();
  }

  function closeLightbox() {
    if (currentLightbox) {
      currentLightbox.remove();
      currentLightbox = null;
    }
  }

  function installLightbox() {
    document.addEventListener('click', function (e) {
      const trigger = e.target.closest('[data-lightbox-src]');
      if (trigger) {
        e.preventDefault();
        openLightbox(trigger.dataset.lightboxSrc);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && currentLightbox) closeLightbox();
    });
  }

  // ---------- Standalone "← Home" header ----------

  function maybeRenderHeader(container) {
    if (window.top !== window.self) return; // suppress inside frameset
    const bar = el('div', 'cards-topbar');
    const home = document.createElement('a');
    home.href = '../index.htm';
    home.textContent = '← Home';
    bar.appendChild(home);
    bar.appendChild(document.createElement('span'));
    container.insertBefore(bar, container.firstChild);
  }

  // ---------- Page transformation ----------

  function transformPage() {
    const paras = Array.from(document.querySelectorAll('p.lpLexEntryPara, p.lpPicturePara'));
    if (!paras.length) return;

    const container = el('div', 'cards-page');
    let pendingPicture = null;
    const orphansToRemove = [];

    for (const p of paras) {
      if (p.classList.contains('lpPicturePara')) {
        // <p> cannot contain <table>; HTML parsers auto-close the <p> before
        // the <table>, leaving an empty <p class="lpPicturePara"> followed by
        // the actual table at sibling level. Look at the next sibling table.
        let img = p.querySelector('img');
        if (!img) {
          const sib = p.nextElementSibling;
          if (sib && sib.tagName === 'TABLE') {
            img = sib.querySelector('img');
            if (img) orphansToRemove.push(sib);
          }
        }
        pendingPicture = img ? img.getAttribute('src') : null;
        continue;
      }
      const entry = parseEntry(p);
      if (!entry) continue;
      const card = renderCard(entry, pendingPicture);
      pendingPicture = null;
      container.appendChild(card);
    }

    if (!container.firstChild) return;

    paras[0].parentNode.insertBefore(container, paras[0]);
    for (const p of paras) p.remove();
    for (const o of orphansToRemove) o.remove();

    maybeRenderHeader(container);
    installAudioHandler(container);
  }

  // ---------- Bootstrap ----------

  function init() {
    transformPage();
    installLightbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
