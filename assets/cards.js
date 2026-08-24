/* assets/cards.js — transform <p class="lpLexEntryPara"> paragraphs into
   structured card DOM. Single IIFE; no modules. Runs on DOMContentLoaded.
   Coexists with javascript/hi.js (fragment highlight on window.onload). */
(function () {
  'use strict';

  function readFilter() {
    try {
      var v = sessionStorage.getItem('ga.filter');
      return (v === 'etym' || v === 'morph' || v === 'env') ? v : '';
    } catch (e) { return ''; }
  }

  function readFilterValue() {
    try { return sessionStorage.getItem('ga.filter.value') || ''; } catch (e) { return ''; }
  }

  function etymSource(v) {
    return v ? String(v).split(/[;,]/)[0].trim() : '';
  }

  function applyFilter(container) {
    var f = readFilter();
    var val = f === 'etym' ? readFilterValue() : '';
    var cards = container.querySelectorAll('.entry');
    var visible = 0;
    cards.forEach(function (card) {
      var keep;
      if (!f) keep = true;
      else if (f === 'morph') keep = !!card.dataset.hasMorph;
      else if (f === 'env') keep = !!card.dataset.env;
      else keep = !!card.dataset.hasEtym && (!val || card.dataset.etymSource === val);
      card.classList.toggle('ga-filtered-out', !keep);
      if (keep) visible++;
    });
    var prev = container.querySelector('.ga-empty');
    if (prev) prev.remove();
    if (f && visible === 0) {
      var note = document.createElement('p');
      note.className = 'ga-empty';
      note.textContent = f === 'etym'
        ? 'No entries with an etymology note on this page.'
        : f === 'env'
        ? 'No environmental-lexicon entries on this page.'
        : 'No entries with a morphology note on this page.';
      container.appendChild(note);
    }
  }

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
      env: !!p.querySelector('span.lpEnvLex'),
      senses: [],
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

    collectSense(p, entry);
    return entry;
  }

  // Shared linear walk that fills a sense target (main glosses, examples,
  // categories, refs, note) from a paragraph's element children. State machine
  // driven by mini-heading text. Used for the primary entry and for each
  // lpLexEntryPara2 continuation (an additional sense of the same headword).
  function collectSense(p, t) {
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
        t.examples.push(currentExample);
        mode = 'inExample';
        continue;
      }

      if (mode === 'main') {
        if (cls && cls.contains('lpGlossEnglish') && !t.glossEn) {
          t.glossEn = cleanText(text);
        } else if (cls && cls.contains('lpGlossHindi') && !t.glossHi) {
          t.glossHi = cleanText(text);
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
          t.categories.push(text.trim());
        }
      } else if (mode === 'refs') {
        if (node.tagName === 'A') {
          const refSpan = node.querySelector('span.lpCrossRef');
          if (refSpan) {
            const title = node.getAttribute('title') || '';
            t.refs.push({
              href: node.getAttribute('href'),
              ipa: refSpan.textContent.trim(),
              gloss: cleanText(title.split(';')[0]) || null,
            });
          }
        }
      } else if (mode === 'notes') {
        if (cls && cls.contains('lpEncycInfoEnglish') && !t.note) {
          t.note = cleanText(text.replace(/^NT:\s*/, ''));
        }
      }
    }
  }

  // Parse an lpLexEntryPara2 continuation paragraph into a sense object (it
  // carries a part of speech + gloss/examples but no headword of its own).
  function parseSense(p) {
    const sense = { pos: null, glossEn: null, glossHi: null, examples: [], categories: [], refs: [], note: null };
    const posSpan = p.querySelector('span.lpPartOfSpeech');
    if (posSpan) sense.pos = posSpan.textContent.trim().replace(/[.\s]+$/, '');
    collectSense(p, sense);
    if (!sense.pos && !sense.glossEn && !sense.glossHi && !sense.examples.length) return null;
    return sense;
  }

  // ---------- Media association ----------

  // The illustration belonging to an entry paragraph, for callers that render a
  // single entry out of a fetched document (browse.js) rather than transforming
  // the whole page. Lexique Pro emits the picture BEFORE the entry it belongs
  // to, and since <p> cannot contain <table> the parser rewrites
  //   <p class="lpPicturePara"><table>…</table></p>
  // as three siblings: an empty picture <p>, the table, and an empty <p> from
  // the stray close tag. So walk back over those, stopping at the previous
  // entry so one entry's picture never leaks onto the next.
  function pictureBefore(p) {
    var n = p.previousElementSibling;
    for (var i = 0; n && i < 4; i++, n = n.previousElementSibling) {
      if (n.tagName === 'P' &&
          (n.classList.contains('lpLexEntryPara') || n.classList.contains('lpLexEntryPara2'))) {
        return null;
      }
      var img = n.querySelector('img[src*="/pictures/"]');
      if (img) return img.getAttribute('src');
    }
    return null;
  }

  // Media paths inside lexicon/ and categories/ pages are written relative to
  // those directories ("../audio/x.wav"). A page that renders entries fetched
  // from there may sit at a different depth, so re-root every path onto the
  // consumer's own base ('' at the repo root, '../' one level down).
  function mediaPath(src, base) {
    if (!src) return null;
    return (base || '') + src.replace(/^(\.\.\/)+/, '');
  }

  // Re-root an entry's audio paths (main + examples + senses) onto `base`.
  function rebaseEntryMedia(entry, base) {
    if (!entry) return entry;
    entry.audioMain = mediaPath(entry.audioMain, base);
    var lists = [entry.examples || []];
    (entry.senses || []).forEach(function (s) { lists.push(s.examples || []); });
    lists.forEach(function (exs) {
      exs.forEach(function (ex) { ex.audio = mediaPath(ex.audio, base); });
    });
    return entry;
  }

  // ---------- Rendering ----------

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  // Speaker-with-soundwaves icon (monochrome, inherits the button's color).
  const AUDIO_SVG =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<path d="M3.2 6.2h2L8 4v8L5.2 9.8h-2z" fill="currentColor"/>' +
      '<path d="M10.4 6.1a2.6 2.6 0 0 1 0 3.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
      '<path d="M12.1 4.6a5 5 0 0 1 0 6.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '</svg>';

  function renderExample(ex) {
    const exDiv = el('div', 'example');
    exDiv.appendChild(el('div', 'lbl', 'Example'));
    const line1 = document.createElement('div');
    line1.appendChild(el('span', 'ex-ipa', ex.ipa));
    if (ex.deva) line1.appendChild(el('span', 'ex-deva', ex.deva));
    if (ex.audio) {
      const exBtn = el('button', 'ex-audio');
      exBtn.type = 'button';
      exBtn.setAttribute('aria-label', 'Play example audio');
      exBtn.dataset.audio = ex.audio;
      exBtn.innerHTML = AUDIO_SVG;
      line1.appendChild(exBtn);
    }
    exDiv.appendChild(line1);
    const parts = [];
    if (ex.glossEn) parts.push(ex.glossEn);
    if (ex.glossHi) parts.push(ex.glossHi);
    if (parts.length) exDiv.appendChild(el('div', 'ex-gloss', parts.join(' · ')));
    return exDiv;
  }

  function renderRefs(refList) {
    const refs = el('div', 'refs');
    refs.appendChild(el('span', 'lbl', 'See also'));
    for (const r of refList) {
      const a = document.createElement('a');
      a.className = 'ref';
      a.href = r.href;
      a.textContent = r.ipa;
      if (r.gloss) a.appendChild(el('span', 'ref-gloss', ' · ' + r.gloss));
      refs.appendChild(a);
      refs.appendChild(document.createTextNode(' '));
    }
    return refs;
  }

  // An additional sense (from an lpLexEntryPara2 continuation): its own part of
  // speech, gloss, examples, note, refs, and categories, under the same headword.
  function renderSenseBlock(s) {
    const blk = el('div', 'sense');
    if (s.pos) blk.appendChild(el('span', 'pos', s.pos));
    if (s.glossEn) blk.appendChild(el('div', 'gloss', s.glossEn));
    if (s.glossHi) blk.appendChild(el('div', 'gloss-hi', s.glossHi));
    for (const ex of s.examples) blk.appendChild(renderExample(ex));
    if (s.note) blk.appendChild(el('div', 'note', s.note));
    if (s.refs && s.refs.length) blk.appendChild(renderRefs(s.refs));
    if (s.categories && s.categories.length) {
      const cats = el('div', 'cats');
      for (const c of s.categories) cats.appendChild(el('span', 'cat', c));
      blk.appendChild(cats);
    }
    return blk;
  }

  function renderCard(entry, pictureSrc) {
    const card = el('article', 'entry');
    if (entry.id) card.id = entry.id;
    if (entry.etym) { card.dataset.hasEtym = '1'; card.dataset.etymSource = etymSource(entry.etym); }
    if (entry.morph) card.dataset.hasMorph = '1';
    if (entry.env) card.dataset.env = '1';

    const body = el('div', 'body');

    // Head
    const head = el('div', 'head');
    head.appendChild(el('span', 'ipa', entry.ipa));
    if (entry.hom) head.appendChild(el('span', 'hom', entry.hom));
    if (entry.deva) head.appendChild(el('span', 'deva', entry.deva));
    if (entry.pos) head.appendChild(el('span', 'pos', entry.pos));
    if (entry.audioMain) {
      const btn = el('button', 'audio-btn');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Play pronunciation');
      btn.dataset.audio = entry.audioMain;
      btn.innerHTML = AUDIO_SVG;
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
    for (const ex of entry.examples) body.appendChild(renderExample(ex));

    // Note
    if (entry.note) body.appendChild(el('div', 'note', entry.note));

    // Refs
    if (entry.refs.length) body.appendChild(renderRefs(entry.refs));

    // Categories
    if (entry.categories.length || entry.env) {
      const cats = el('div', 'cats');
      if (entry.env) cats.appendChild(el('span', 'env-tag', 'Environmental'));
      for (const c of entry.categories) cats.appendChild(el('span', 'cat', c));
      body.appendChild(cats);
    }

    // Additional senses (lpLexEntryPara2 continuations of the same headword)
    for (const s of entry.senses || []) body.appendChild(renderSenseBlock(s));

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

  // Delegated on `document`, not on a card container: cards are also rendered
  // into the reverse-index panes, the categories pane and the देव-mode list
  // (via GACards.renderCard) long after this runs, and a per-container listener
  // left every one of those play buttons dead. Same pattern as installLightbox.
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
    const paras = Array.from(document.querySelectorAll('p.lpLexEntryPara, p.lpLexEntryPara2, p.lpPicturePara'));
    if (!paras.length) return;

    const container = el('div', 'cards-page');
    let pendingPicture = null;
    const orphansToRemove = [];
    const built = [];          // { entry, picture } in document order
    let lastEntry = null;      // for attaching lpLexEntryPara2 continuations

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
      if (p.classList.contains('lpLexEntryPara2')) {
        // Continuation: an extra sense of the previous headword (no headword of its own).
        const sense = parseSense(p);
        if (sense && lastEntry) lastEntry.senses.push(sense);
        continue;
      }
      const entry = parseEntry(p);
      if (!entry) continue;
      built.push({ entry: entry, picture: pendingPicture });
      pendingPicture = null;
      lastEntry = entry;
    }

    if (!built.length) return;
    for (const b of built) container.appendChild(renderCard(b.entry, b.picture));

    paras[0].parentNode.insertBefore(container, paras[0]);
    for (const p of paras) p.remove();
    for (const o of orphansToRemove) o.remove();

    // The shared chrome.js header now provides Home/nav, so the standalone
    // "← Home" bar is redundant — only render it if chrome is NOT present.
    if (!window.GA_PAGE) maybeRenderHeader(container);
    applyFilter(container);
    // Re-apply when the shared Show filter changes (chrome.js dispatches this).
    document.addEventListener('ga:filterchange', function () { applyFilter(container); });
  }

  // ---------- Bootstrap ----------

  // Expose the renderer so the two-pane index/category pages (browse.js) can
  // render an entry parsed from a fetched document, not only the current page.
  window.GACards = {
    parseEntry: parseEntry,
    parseSense: parseSense,
    renderCard: renderCard,
    applyFilter: applyFilter,
    pictureBefore: pictureBefore,
    mediaPath: mediaPath,
    rebaseEntryMedia: rebaseEntryMedia,
  };

  function init() {
    transformPage();
    installAudioHandler(document);
    installLightbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
