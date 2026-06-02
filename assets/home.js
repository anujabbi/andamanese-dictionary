/* Great Andamanese homepage — vanilla JS, no modules. */
(function () {
  'use strict';

  // ---------- Constants ----------
  const INDEX_URL = 'assets/search-index.json';
  const MAX_RESULTS = 6;
  const DEBOUNCE_MS = 80;
  const RECENT_KEY = 'ga.recent';
  const MAX_RECENTS = 5;

  // Hard-coded suggestions for the empty state. Picked from the real index:
  // biriu "dirty water", coboŋ "forest", ɖiu "hot; sunny" — all have audio.
  const SUGGESTED_IDS = ['e418', 'e711', 'e886'];

  // Speaker-with-soundwaves icon (monochrome, inherits the button's color).
  const AUDIO_SVG =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<path d="M3.2 6.2h2L8 4v8L5.2 9.8h-2z" fill="currentColor"/>' +
      '<path d="M10.4 6.1a2.6 2.6 0 0 1 0 3.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
      '<path d="M12.1 4.6a5 5 0 0 1 0 6.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '</svg>';

  // ---------- State ----------
  let INDEX = null;            // resolved array once loaded
  let pending = null;          // most recent query while index was loading
  let activeIndex = -1;        // highlighted dropdown row (-1 = none)
  let currentResults = [];     // results currently rendered

  // ---------- Pure helpers ----------

  function debounce(fn, ms) {
    let t = null;
    return function () {
      const args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function highlight(text, query) {
    if (!query) return escapeHtml(text);
    const lower = text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx < 0) return escapeHtml(text);
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + query.length);
    const after = text.slice(idx + query.length);
    return escapeHtml(before) + '<mark>' + escapeHtml(match) + '</mark>' + escapeHtml(after);
  }

  function searchIndex(query, index) {
    const q = query.trim().toLowerCase();
    if (!q || !index) return [];
    const scored = [];
    for (const e of index) {
      let score = 0;
      let field = null;
      if (e.ipa && e.ipa.toLowerCase().startsWith(q))      { score = 100; field = 'ipa'; }
      else if (e.en && e.en.toLowerCase().split(/\s+/).some(w => w.startsWith(q)))
                                                           { score = 80;  field = 'en'; }
      else if (e.ipa && e.ipa.toLowerCase().includes(q))   { score = 50;  field = 'ipa'; }
      else if (e.en && e.en.toLowerCase().includes(q))     { score = 40;  field = 'en'; }
      if (score > 0) scored.push({ entry: e, score, field });
    }
    scored.sort((a, b) => (b.score - a.score) || a.entry.ipa.localeCompare(b.entry.ipa));
    return scored.slice(0, MAX_RESULTS);
  }

  // ---------- Recents ----------

  function recentEntries() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function recordRecent(entry) {
    if (!entry) return;
    const slim = { id: entry.id, file: entry.file, ipa: entry.ipa, en: entry.en, deva: entry.deva };
    const list = recentEntries().filter(e => e.id !== slim.id);
    list.unshift(slim);
    while (list.length > MAX_RECENTS) list.pop();
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (e) { /* ignore quota */ }
  }

  // ---------- Rendering ----------

  function entryUrl(entry) {
    return 'lexicon/' + entry.file + '#' + entry.id;
  }

  function audioUrl(entry) {
    // Encode spaces in filenames the way Lexique Pro does.
    return entry.audio ? entry.audio.replace(/ /g, '%20') : null;
  }

  function rowHtml(entry, query, matchField, isActive) {
    const ipaHtml  = matchField === 'ipa' ? highlight(entry.ipa, query) : escapeHtml(entry.ipa);
    const enHtml   = entry.en
      ? (matchField === 'en' ? highlight(entry.en, query) : escapeHtml(entry.en))
      : '';
    const devaHtml = entry.deva ? escapeHtml(entry.deva) : '';
    const hiHtml   = entry.hi   ? escapeHtml(entry.hi)   : '';
    const catHtml  = entry.cat  ? '<span class="cat">' + escapeHtml(entry.cat) + '</span>' : '';
    const gloss = [enHtml, hiHtml].filter(Boolean).join(' · ');
    const audioBtn = entry.audio
      ? '<button class="audio-btn" type="button" data-audio="' + escapeHtml(audioUrl(entry)) + '" aria-label="Play audio">' + AUDIO_SVG + '</button>'
      : '';
    return (
      '<div class="row' + (isActive ? ' active' : '') + '" role="option" data-href="' + escapeHtml(entryUrl(entry)) + '" data-id="' + escapeHtml(entry.id) + '">' +
        '<div class="body">' +
          '<div class="line1"><span class="ipa">' + ipaHtml + '</span>' +
            (devaHtml ? '<span class="deva">' + devaHtml + '</span>' : '') +
          '</div>' +
          '<div class="line2">' + catHtml + gloss + '</div>' +
        '</div>' +
        audioBtn +
      '</div>'
    );
  }

  function footerHtml(totalShown) {
    return (
      '<div class="footer">' +
        '<span><span class="kbd">↑↓</span> navigate &nbsp; <span class="kbd">↵</span> open</span>' +
        '<span class="seeall" data-seeall="1">See all ' + totalShown + ' results →</span>' +
      '</div>'
    );
  }

  function noResultsHtml(query) {
    return (
      '<div class="empty">' +
        '<div class="title">No matches for "' + escapeHtml(query) + '"</div>' +
        '<div class="sub">Try a shorter prefix, or check spelling.</div>' +
        '<div class="nudge"><a href="lexicon/index.htm">Browse by letter →</a></div>' +
      '</div>'
    );
  }

  function renderDropdown(results, query) {
    const dd = document.getElementById('dropdown');
    if (!results.length) {
      activeIndex = -1;
      currentResults = [];
      dd.innerHTML = noResultsHtml(query);
      dd.hidden = false;
      return;
    }
    activeIndex = 0;
    currentResults = results;
    const rows = results
      .map((r, i) => rowHtml(r.entry, query, r.field, i === activeIndex))
      .join('');
    dd.innerHTML = rows + footerHtml(results.length);
    dd.hidden = false;
  }

  function hideDropdown() {
    const dd = document.getElementById('dropdown');
    dd.hidden = true;
    dd.innerHTML = '';
    activeIndex = -1;
    currentResults = [];
  }

  function setActive(newIndex) {
    activeIndex = newIndex;
    const dd = document.getElementById('dropdown');
    const rows = dd.querySelectorAll('.row');
    rows.forEach((row, i) => {
      row.classList.toggle('active', i === activeIndex);
    });
  }

  // ---------- Loading ----------

  function loadIndex() {
    return fetch(INDEX_URL)
      .then(r => r.json())
      .then(json => { INDEX = json; })
      .catch(err => { console.error('Failed to load search index:', err); INDEX = []; });
  }

  // ---------- Wiring ----------

  function onInput() {
    const q = document.getElementById('q').value;
    if (!q.trim()) { renderEmptyState(); return; }
    if (!INDEX) { pending = q; return; }
    const results = searchIndex(q, INDEX);
    renderDropdown(results, q);
  }

  function openActive() {
    if (!currentResults.length) return;
    const idx = activeIndex >= 0 && activeIndex < currentResults.length ? activeIndex : 0;
    const entry = currentResults[idx].entry;
    recordRecent(entry);
    window.location.href = entryUrl(entry);
  }

  function onKeyDown(e) {
    if (document.getElementById('dropdown').hidden) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentResults.length === 0) return;
      setActive((activeIndex + 1) % currentResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentResults.length === 0) return;
      setActive((activeIndex - 1 + currentResults.length) % currentResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openActive();
    } else if (e.key === 'Escape') {
      if (activeIndex >= 0) { setActive(-1); }
      else { document.getElementById('q').blur(); hideDropdown(); }
    }
  }

  function onDropdownClick(e) {
    const audioBtn = e.target.closest('.audio-btn');
    if (audioBtn) {
      e.preventDefault();
      e.stopPropagation();
      playAudio(audioBtn.getAttribute('data-audio'));
      return;
    }
    const seeAll = e.target.closest('[data-seeall]');
    if (seeAll) {
      e.preventDefault();
      if (currentResults.length) {
        const entry = currentResults[0].entry;
        recordRecent(entry);
        window.location.href = entryUrl(entry);
      }
      return;
    }
    const row = e.target.closest('.row');
    if (row) {
      const href = row.getAttribute('data-href');
      const id = row.getAttribute('data-id');
      const entry = (currentResults.find(r => r.entry.id === id) || {}).entry;
      if (entry) recordRecent(entry);
      window.location.href = href;
    }
  }

  function onDocumentClick(e) {
    if (e.target.closest('.search-wrap')) return;
    hideDropdown();
  }

  function playAudio(url) {
    if (!url) return;
    try {
      const a = new Audio(url);
      a.play().catch(err => console.warn('Audio playback failed:', err));
    } catch (err) {
      console.warn('Audio constructor failed:', err);
    }
  }

  // ---------- Empty state ----------

  function suggestionEntries() {
    if (!INDEX) return [];
    return SUGGESTED_IDS
      .map(id => INDEX.find(e => e.id === id))
      .filter(Boolean);
  }

  function emptyStateHtml() {
    const recents = recentEntries();
    const suggestions = suggestionEntries();
    if (!recents.length && !suggestions.length) return '';
    let html = '';
    if (recents.length) {
      html += '<div class="section-label">Recent</div>';
      for (const e of recents) {
        currentResults.push({ entry: e, field: null });
        html += rowHtml(e, '', null, false);
      }
    }
    if (suggestions.length) {
      html += '<div class="section-label">Try</div>';
      for (const e of suggestions) {
        currentResults.push({ entry: e, field: null });
        html += rowHtml(e, '', null, false);
      }
    }
    return html;
  }

  function renderEmptyState() {
    const dd = document.getElementById('dropdown');
    currentResults = [];
    activeIndex = -1;
    const html = emptyStateHtml();
    if (!html) { hideDropdown(); return; }
    dd.innerHTML = html;
    dd.hidden = false;
  }

  // ---------- Word of the Day ----------

  function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  function isoDateToday() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function wordOfTheDay(index, dateStr) {
    if (!index || !index.length) return null;
    let pool = index.filter(e => e.en && e.audio);
    if (!pool.length) pool = index.filter(e => e.en);
    if (!pool.length) return null;
    const h = fnv1a32(dateStr);
    return pool[h % pool.length];
  }

  function renderWordOfTheDay() {
    const entry = wordOfTheDay(INDEX, isoDateToday());
    if (!entry) return;
    const el = document.getElementById('wotd');
    const gloss = [entry.en, entry.hi].filter(Boolean).join(' · ');
    const audio = entry.audio
      ? '<button class="audio-btn" type="button" data-audio="' + escapeHtml(audioUrl(entry)) + '" aria-label="Play audio">' + AUDIO_SVG + '</button>'
      : '';
    el.innerHTML =
      '<div class="body">' +
        '<div class="label">Word of the day</div>' +
        '<div class="word">' + escapeHtml(entry.ipa) + '</div>' +
        '<div class="gloss">' + escapeHtml(gloss) + '</div>' +
      '</div>' +
      audio;
    el.setAttribute('data-href', entryUrl(entry));
    el.setAttribute('data-id', entry.id);
    el.hidden = false;
  }

  function onWotdClick(e) {
    const audioBtn = e.target.closest('.audio-btn');
    if (audioBtn) {
      e.preventDefault();
      e.stopPropagation();
      playAudio(audioBtn.getAttribute('data-audio'));
      return;
    }
    const el = document.getElementById('wotd');
    const href = el.getAttribute('data-href');
    const id = el.getAttribute('data-id');
    if (!href) return;
    const entry = (INDEX || []).find(x => x.id === id);
    if (entry) recordRecent(entry);
    window.location.href = href;
  }

  // ---------- Bootstrap ----------

  function bindSearchBox() {
    const input = document.getElementById('q');
    const debounced = debounce(onInput, DEBOUNCE_MS);
    input.addEventListener('input', debounced);
    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('focus', function () {
      if (!input.value.trim()) renderEmptyState();
    });
    document.getElementById('dropdown').addEventListener('click', onDropdownClick);
    document.addEventListener('click', onDocumentClick);
  }

  function init() {
    bindSearchBox();
    document.getElementById('wotd').addEventListener('click', onWotdClick);
    loadIndex().then(() => {
      if (pending && pending === document.getElementById('q').value) {
        onInput();
      }
      pending = null;
      renderWordOfTheDay();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
