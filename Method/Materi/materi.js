/* =========================================================================
   MATERI STATISTIK - menu utama untuk belajar konsep & rumus tiap metode
   -------------------------------------------------------------------------
   Fitur:
   - Daftar topik (kartu) + pencarian ke seluruh isi materi.
   - Halaman baca per topik: daftar isi, bagian bernomor, rumus LaTeX (KaTeX).
   - Tautan "Lihat materi untuk pemahaman" otomatis ditambahkan ke halaman
     metode Stat (banner di atas + judul hasil uji yang dikenali).
   - Ketuk rumus untuk menyalin kode LaTeX-nya.

   Cara menambah / mengubah materi: lihat Method/Materi/README.md.
   Urutan muat (di index.html):
     katex.min.js -> auto-render.min.js -> materi.js -> data/*.js
   Halaman #view-materi & #view-materi-detail dibuat otomatis oleh file ini.
   ========================================================================= */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const TOPICS = [];
  const app = () => window.StatCalc || {};

  /* ------------------------------ Gaya ------------------------------ */
  const style = document.createElement('style');
  style.textContent = `
    #view-materi .mt-search{ position:relative; max-width:760px; margin:6px auto 4px; padding:0 14px; }
    #view-materi .mt-search input{ width:100%; height:48px; border:1px solid var(--rule-strong); border-radius:12px; background:#fff; padding:0 44px 0 42px; font-size:15px; font-family:var(--font-body); color:var(--ink); }
    #view-materi .mt-search input:focus{ outline:2px solid var(--accent-2); outline-offset:1px; }
    #view-materi .mt-search svg{ position:absolute; left:28px; top:14px; width:20px; height:20px; stroke:var(--ink-faint); fill:none; stroke-width:1.8; stroke-linecap:round; pointer-events:none; }
    #view-materi .mt-clear{ position:absolute; right:22px; top:8px; width:32px; height:32px; border:none; background:none; font-size:22px; color:var(--ink-faint); cursor:pointer; display:none; }
    #view-materi .mt-search.has-q .mt-clear{ display:block; }
    #view-materi .mt-results{ max-width:760px; margin:6px auto 0; padding:0 14px; display:flex; flex-direction:column; gap:8px; }
    #view-materi .mt-hit{ text-align:left; background:#fff; border:1px solid var(--rule); border-radius:12px; padding:12px 14px; cursor:pointer; box-shadow:var(--shadow); font-family:var(--font-body); }
    #view-materi .mt-hit:active{ background:var(--paper-2); }
    #view-materi .mt-hit .h-top{ font-size:11.5px; font-weight:700; color:var(--accent-2); letter-spacing:.03em; text-transform:uppercase; }
    #view-materi .mt-hit .h-title{ font-size:15px; font-weight:700; color:var(--ink); margin:2px 0; }
    #view-materi .mt-hit .h-snip{ font-size:12.5px; color:var(--ink-soft); line-height:1.45; }
    #view-materi .mt-hit mark{ background:#F6E4B8; color:inherit; border-radius:3px; padding:0 1px; }
    #view-materi .mt-empty{ text-align:center; color:var(--ink-faint); font-size:13.5px; padding:22px 0; }
    #view-materi .mt-count{ font-size:12.5px; color:var(--ink-faint); font-weight:600; }
    #view-materi .mc-meta{ font-family:var(--font-mono); font-size:10.5px; font-weight:600; color:var(--ink-faint); }

    /* ---- halaman baca ---- */
    #view-materi-detail .mt-wrap{ max-width:880px; margin:0 auto; padding:14px 14px calc(40px + var(--navh) + var(--safe-b)); }
    #view-materi-detail .mt-head h1{ font-family:var(--font-body); font-weight:800; letter-spacing:-.02em; font-size:clamp(25px,7.5vw,34px); line-height:1.15; margin:12px 0 8px; color:var(--ink); }
    #view-materi-detail .mt-head .lede{ font-size:14.5px; color:var(--ink-soft); margin:0; text-align:left; }
    #view-materi-detail .mt-actions{ display:flex; flex-wrap:wrap; gap:8px; margin:14px 0 4px; }
    #view-materi-detail .mt-actions button{ border:1px solid var(--rule-strong); background:#fff; color:var(--accent); border-radius:999px; padding:9px 16px; min-height:40px; font-weight:700; font-size:13.5px; cursor:pointer; font-family:var(--font-body); }
    #view-materi-detail .mt-actions button.primary{ background:var(--accent); border-color:var(--accent); color:#fff; }
    #view-materi-detail .mt-toc{ background:#fff; border:1px solid var(--rule); border-radius:14px; padding:14px 16px 12px; margin:16px 0 8px; box-shadow:var(--shadow); }
    #view-materi-detail .mt-toc h2{ font-family:var(--font-body); font-size:13px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-faint); margin:0 0 8px; }
    #view-materi-detail .mt-toc ol{ list-style:none; margin:0; padding:0; counter-reset:toc; }
    #view-materi-detail .mt-toc li{ counter-increment:toc; }
    #view-materi-detail .mt-toc a{ display:flex; gap:10px; align-items:baseline; padding:7px 2px; font-size:14px; font-weight:600; color:var(--ink); text-decoration:none; border-bottom:1px dashed var(--rule); cursor:pointer; }
    #view-materi-detail .mt-toc li:last-child a{ border-bottom:none; }
    #view-materi-detail .mt-toc a::before{ content:counter(toc); font-family:var(--font-mono); font-size:12px; color:var(--accent-2); font-weight:700; min-width:18px; }
    #view-materi-detail .mt-toc a:active, #view-materi-detail .mt-toc a.on{ color:var(--accent); background:var(--accent-soft); }

    #view-materi-detail .mt-sec{ scroll-margin-top:72px; margin-top:26px; }
    #view-materi-detail .mt-sec > h2{ font-family:var(--font-body); font-size:20px; font-weight:800; letter-spacing:-.01em; color:var(--ink); margin:0 0 10px; padding-bottom:8px; border-bottom:2px solid var(--accent-soft); display:flex; gap:10px; align-items:baseline; }
    #view-materi-detail .mt-sec > h2 .n{ font-family:var(--font-mono); font-size:14px; color:var(--accent-2); }

    .mt-body{ user-select:text; -webkit-user-select:text; -webkit-touch-callout:default; font-size:15px; line-height:1.7; color:var(--ink); }
    .mt-body p{ margin:0 0 12px; text-align:left; hyphens:manual; }
    .mt-body h3{ font-family:var(--font-body); font-size:16px; font-weight:800; margin:20px 0 8px; color:var(--accent); }
    .mt-body ul, .mt-body ol{ margin:0 0 12px; padding-left:22px; }
    .mt-body li{ margin:0 0 5px; }
    .mt-body strong{ color:var(--ink); }
    .mt-body code{ font-family:var(--font-mono); font-size:.9em; background:var(--paper-2); padding:1px 5px; border-radius:4px; }
    .mt-body .katex{ font-size:1.06em; }
    .mt-body .katex-display{ margin:12px 0; padding:10px 6px; overflow-x:auto; overflow-y:hidden; background:var(--paper-2); border-radius:10px; cursor:copy; -webkit-overflow-scrolling:touch; }
    .mt-body .katex-display > .katex{ white-space:nowrap; }
    .mt-body .katex:not(.katex-display .katex){ cursor:copy; }
    .mt-box{ position:relative; border-radius:12px; padding:30px 14px 10px; margin:14px 0; border:1px solid var(--rule); background:#fff; }
    .mt-box::before{ content:attr(data-label); position:absolute; left:14px; top:8px; font-size:11px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; }
    .mt-box > :last-child{ margin-bottom:2px; }
    .mt-box.def{ background:var(--accent-soft); border-color:#C7D9E2; } .mt-box.def::before{ color:var(--accent); }
    .mt-box.note{ background:#FBF1DC; border-color:#EBD6A6; } .mt-box.note::before{ color:#8A5A16; }
    .mt-box.warn{ background:var(--bad-bg); border-color:#EBC7BC; } .mt-box.warn::before{ color:var(--bad); }
    .mt-box.ex{ background:#fff; border-color:var(--rule-strong); border-left:4px solid var(--accent-2); } .mt-box.ex::before{ color:var(--accent-2); }
    .mt-box.key{ background:#E6F1EA; border-color:#BCD8C6; } .mt-box.key::before{ color:var(--good); }
    .mt-box .katex-display{ background:rgba(255,255,255,.65); }
    .mt-tw{ overflow-x:auto; margin:12px 0; border:1px solid var(--rule); border-radius:10px; -webkit-overflow-scrolling:touch; background:#fff; }
    .mt-body table{ border-collapse:collapse; width:100%; font-size:13.5px; }
    .mt-body th, .mt-body td{ border-bottom:1px solid var(--rule); padding:8px 10px; text-align:left; vertical-align:top; }
    .mt-body thead th{ background:var(--paper-2); font-weight:700; white-space:nowrap; }
    .mt-body tr:last-child td{ border-bottom:none; }
    .mt-body td.c, .mt-body th.c{ text-align:center; }
    .mt-steps{ counter-reset:mts; list-style:none; padding-left:0 !important; }
    .mt-steps > li{ counter-increment:mts; position:relative; padding:2px 0 2px 38px; margin-bottom:10px; }
    .mt-steps > li::before{ content:counter(mts); position:absolute; left:0; top:1px; width:26px; height:26px; border-radius:50%; background:var(--accent); color:#fff; font-weight:700; font-size:13px; display:flex; align-items:center; justify-content:center; }
    .mt-math-err{ color:var(--bad); font-family:var(--font-mono); font-size:12px; }
    .mt-hint-copy{ font-size:12px; color:var(--ink-faint); margin:-4px 0 12px; }

    #view-materi-detail .mt-foot{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:34px; }
    #view-materi-detail .mt-foot button{ text-align:left; background:#fff; border:1px solid var(--rule); border-radius:12px; padding:12px 14px; cursor:pointer; box-shadow:var(--shadow); font-family:var(--font-body); }
    #view-materi-detail .mt-foot button:active{ background:var(--paper-2); }
    #view-materi-detail .mt-foot .k{ display:block; font-size:11px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--ink-faint); }
    #view-materi-detail .mt-foot .v{ display:block; font-size:14px; font-weight:700; color:var(--accent); margin-top:2px; }
    #view-materi-detail .mt-foot button:last-child{ text-align:right; }
    #view-materi-detail .mt-foot button:only-child{ grid-column:1 / -1; }

    /* tautan "Lihat materi untuk pemahaman" di halaman metode Stat */
    .materi-link-top{ display:flex; align-items:center; gap:12px; width:100%; text-align:left; margin:2px 0 0; padding:12px 14px; border:1px solid #C7D9E2; background:var(--accent-soft); border-radius:12px; cursor:pointer; font-family:var(--font-body); color:var(--accent); }
    .materi-link-top:active{ background:#D5E4EB; }
    .materi-link-top svg{ width:24px; height:24px; flex-shrink:0; stroke:currentColor; fill:none; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
    .materi-link-top .t{ flex:1; min-width:0; }
    .materi-link-top .t strong{ display:block; font-size:14px; font-weight:800; }
    .materi-link-top .t small{ display:block; font-size:12px; color:var(--ink-soft); margin-top:1px; line-height:1.35; }
    .materi-link-top .go{ font-size:22px; line-height:1; }
    .materi-link{ display:inline-flex; align-items:center; gap:6px; margin:2px 0 10px; padding:6px 12px; min-height:32px; border:1px solid #C7D9E2; background:var(--accent-soft); color:var(--accent); border-radius:999px; font-size:12.5px; font-weight:700; cursor:pointer; font-family:var(--font-body); }
    .materi-link:active{ background:#D5E4EB; }
    .materi-link::before{ content:'\\1F4D6'; font-size:13px; }

    @media (min-width:700px){
      #view-materi .mt-search, #view-materi .mt-results{ max-width:var(--content,1040px); padding-left:28px; padding-right:28px; }
      #view-materi .mt-search svg{ left:42px; } #view-materi .mt-clear{ right:36px; }
      #view-materi-detail .mt-wrap{ padding:28px 28px 56px; }
      .mt-body{ font-size:15.5px; }
      #view-materi-detail .mt-foot button:hover{ border-color:var(--accent); background:var(--accent-soft); }
    }
    @media (min-width:1100px){
      #view-materi-detail .mt-wrap{ max-width:1120px; display:grid; grid-template-columns:240px minmax(0,1fr); column-gap:40px; align-items:start; }
      #view-materi-detail .mt-head, #view-materi-detail .mt-foot{ grid-column:1 / -1; }
      #view-materi-detail .mt-head{ max-width:860px; }
      #view-materi-detail .mt-toc{ grid-column:1; grid-row:2; position:sticky; top:76px; margin-top:8px; max-height:calc(100vh - 100px); overflow:auto; }
      #view-materi-detail .mt-content{ grid-column:2; grid-row:2; min-width:0; }
      #view-materi-detail .mt-sec:first-child{ margin-top:8px; }
    }
  `;
  document.head.appendChild(style);

  /* ------------------------------ Markup halaman ------------------------------ */
  const SVG_BOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5V6a2 2 0 0 1 2-2h13v15.5"/><path d="M6 19.5h13"/><path d="M6 19.5A1.5 1.5 0 0 1 6 16.5h13"/><path d="M9 8.5h6M9 12h4"/></svg>';

  const listView = document.createElement('main');
  listView.className = 'view';
  listView.id = 'view-materi';
  listView.innerHTML = `
    <section class="cover">
      <span class="eyebrow">Belajar</span>
      <h1>Materi Statistik</h1>
      <p class="lede">Penjelasan konsep, rumus, contoh hitung, dan cara membaca hasil dari semua metode di menu <strong>Stat</strong>. Dari halaman metode, ketuk <em>Lihat materi untuk pemahaman</em> untuk langsung dibawa ke sini.</p>
    </section>
    <div class="mt-search" id="mtSearchBox">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>
      <input type="search" id="mtSearch" placeholder="Cari materi, mis. &ldquo;akar unit&rdquo;, &ldquo;VIF&rdquo;, &ldquo;MAPE&rdquo;" autocomplete="off" spellcheck="false" aria-label="Cari materi">
      <button type="button" class="mt-clear" id="mtClear" aria-label="Hapus pencarian">&times;</button>
    </div>
    <div class="mt-results" id="mtResults" hidden></div>
    <section class="toc-section" id="mtListHead">
      <div class="toc-heading"><h2>Topik Materi</h2><span class="count mt-count" id="mtCount"></span></div>
    </section>
    <div class="menu-grid" id="mtGrid"></div>
    <p class="cover-footer">Rumus ditulis dengan LaTeX dan tampil tanpa internet. Ketuk sebuah rumus untuk menyalin kode LaTeX-nya.</p>`;

  const detailView = document.createElement('main');
  detailView.className = 'view';
  detailView.id = 'view-materi-detail';
  detailView.innerHTML = '<div class="mt-wrap" id="mtWrap"></div>';

  const anchor = $('#profileOverlay') || $('.toast');
  document.body.insertBefore(listView, anchor);
  document.body.insertBefore(detailView, anchor);

  const grid = $('#mtGrid');
  const countEl = $('#mtCount');
  const searchInput = $('#mtSearch');
  const searchBox = $('#mtSearchBox');
  const resultsEl = $('#mtResults');
  const wrap = $('#mtWrap');

  /* ------------------------------ KaTeX ------------------------------ */
  const DELIMS = [
    { left: '$$', right: '$$', display: true },
    { left: '\\[', right: '\\]', display: true },
    { left: '\\(', right: '\\)', display: false },
    { left: '$', right: '$', display: false },
  ];
  function typeset(root) {
    if (typeof window.renderMathInElement === 'function') {
      try {
        window.renderMathInElement(root, { delimiters: DELIMS, throwOnError: false, strict: 'ignore', ignoredTags: ['script', 'style', 'textarea', 'pre', 'code'], trust: false });
      } catch (e) { /* biarkan teks LaTeX apa adanya */ }
    }
  }
  // Ketuk rumus -> salin kode LaTeX (dibaca dari <annotation> milik KaTeX)
  function texOf(node) {
    const a = node.querySelector('annotation[encoding="application/x-tex"]');
    return a ? a.textContent : '';
  }
  function copyText(text) {
    const done = () => app().showToast && app().showToast('Kode LaTeX rumus disalin.');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
    function fallback() {
      try {
        const t = document.createElement('textarea');
        t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); done();
      } catch (e) { /* abaikan */ }
    }
  }
  wrap.addEventListener('click', (e) => {
    if (window.getSelection && String(window.getSelection()).length > 0) return; // sedang menyeleksi teks
    const k = e.target.closest('.katex-display, .katex');
    if (!k) return;
    const outer = k.closest('.katex-display') || k;
    const tex = texOf(outer);
    if (tex) copyText(tex);
  });

  /* ------------------------------ Registrasi topik ------------------------------ */
  function plainText(html) {
    const d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function register(topic) {
    if (!topic || !topic.id || !Array.isArray(topic.sections)) return;
    topic.sections.forEach((s) => { s._text = plainText(s.html).toLowerCase(); s._plain = plainText(s.html); });
    const i = TOPICS.findIndex((t) => t.id === topic.id);
    if (i >= 0) TOPICS[i] = topic; else TOPICS.push(topic);
    TOPICS.sort((a, b) => (a.order || 99) - (b.order || 99));
    renderList();
  }
  const topicById = (id) => TOPICS.find((t) => t.id === id);

  /* ------------------------------ Daftar topik ------------------------------ */
  function cardHTML(t) {
    return `
      <button type="button" class="menu-card" data-topic="${esc(t.id)}">
        <div class="mc-top">
          <span class="mc-icon tone-${esc(t.tone || 'navy')}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${t.icon || ''}</svg></span>
          <span class="mc-chevron" aria-hidden="true">&rsaquo;</span>
        </div>
        <div>
          <div class="mc-title">${esc(t.title)}</div>
          ${t.subtitle ? `<div class="mc-sub">${esc(t.subtitle)}</div>` : ''}
        </div>
        <p class="mc-desc">${esc(t.desc || '')}</p>
        <span class="mc-meta">${t.sections.length} bagian${t.method ? ' · terhubung ke kalkulator' : ''}</span>
      </button>`;
  }
  function renderList() {
    grid.innerHTML = TOPICS.map(cardHTML).join('');
    countEl.textContent = TOPICS.length + ' topik';
  }
  grid.addEventListener('click', (e) => {
    const c = e.target.closest('.menu-card');
    if (c) open(c.dataset.topic, null, { backTo: 'materi' });
  });

  /* ------------------------------ Pencarian ------------------------------ */
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function runSearch() {
    const raw = searchInput.value.trim();
    searchBox.classList.toggle('has-q', raw.length > 0);
    if (raw.length < 2) {
      resultsEl.hidden = true; resultsEl.innerHTML = '';
      grid.hidden = false; $('#mtListHead').hidden = false;
      return;
    }
    const terms = norm(raw).split(/\s+/).filter(Boolean);
    const hits = [];
    TOPICS.forEach((t) => {
      t.sections.forEach((s) => {
        const hay = norm(t.title + ' ' + (t.keywords || []).join(' ') + ' ' + s.title + ' ' + s._text);
        if (!terms.every((w) => hay.indexOf(w) !== -1)) return;
        const titleHit = terms.some((w) => norm(s.title).indexOf(w) !== -1) ? 2 : 0;
        const kwHit = terms.some((w) => norm((t.keywords || []).join(' ') + t.title).indexOf(w) !== -1) ? 1 : 0;
        hits.push({ t, s, score: titleHit + kwHit });
      });
    });
    hits.sort((a, b) => b.score - a.score);
    grid.hidden = true; $('#mtListHead').hidden = true; resultsEl.hidden = false;
    if (!hits.length) { resultsEl.innerHTML = '<p class="mt-empty">Tidak ada materi yang cocok. Coba kata kunci lain.</p>'; return; }
    resultsEl.innerHTML = hits.slice(0, 30).map((h) => {
      const txt = h.s._plain, nt = norm(txt);
      let idx = -1;
      for (const w of terms) { const k = nt.indexOf(w); if (k !== -1) { idx = k; break; } }
      let snip = '';
      if (idx !== -1) {
        const a = Math.max(0, idx - 50), b = Math.min(txt.length, idx + 110);
        snip = (a > 0 ? '…' : '') + txt.slice(a, b) + (b < txt.length ? '…' : '');
        snip = esc(snip);
        terms.forEach((w) => { snip = snip.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
      } else snip = esc(txt.slice(0, 120)) + '…';
      return `<button type="button" class="mt-hit" data-topic="${esc(h.t.id)}" data-sec="${esc(h.s.id)}"><div class="h-top">${esc(h.t.title)}</div><div class="h-title">${esc(h.s.title)}</div><div class="h-snip">${snip}</div></button>`;
    }).join('');
  }
  searchInput.addEventListener('input', runSearch);
  $('#mtClear').addEventListener('click', () => { searchInput.value = ''; runSearch(); searchInput.focus(); });
  resultsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.mt-hit');
    if (b) open(b.dataset.topic, b.dataset.sec, { backTo: 'materi' });
  });

  /* ------------------------------ Halaman baca ------------------------------ */
  let current = null;
  function render(t) {
    current = t;
    const i = TOPICS.indexOf(t);
    const prev = TOPICS[i - 1], next = TOPICS[i + 1];
    wrap.innerHTML = `
      <header class="mt-head">
        <span class="eyebrow">Materi Statistik</span>
        <h1>${esc(t.title)}</h1>
        <p class="lede">${esc(t.desc || '')}</p>
        <div class="mt-actions">
          ${t.method ? `<button type="button" class="primary" data-go="calc">Buka kalkulator &rsaquo;</button>` : ''}
          <button type="button" data-go="list">Semua materi</button>
        </div>
      </header>
      <nav class="mt-toc" aria-label="Daftar isi">
        <h2>Daftar isi</h2>
        <ol>${t.sections.map((s) => `<li><a data-sec="${esc(s.id)}" role="button" tabindex="0">${esc(s.title)}</a></li>`).join('')}</ol>
      </nav>
      <div class="mt-content mt-body">
        ${t.sections.map((s, k) => `<section class="mt-sec" id="mt-${esc(t.id)}-${esc(s.id)}" data-sec="${esc(s.id)}"><h2><span class="n">${k + 1}.</span><span>${esc(s.title)}</span></h2>${s.html}</section>`).join('')}
      </div>
      <div class="mt-foot">
        ${prev ? `<button type="button" data-topic="${esc(prev.id)}"><span class="k">&larr; Sebelumnya</span><span class="v">${esc(prev.title)}</span></button>` : ''}
        ${next ? `<button type="button" data-topic="${esc(next.id)}"><span class="k">Berikutnya &rarr;</span><span class="v">${esc(next.title)}</span></button>` : ''}
      </div>`;
    // bungkus tabel agar bisa digeser samping di layar sempit
    $$('.mt-body table', wrap).forEach((tb) => {
      if (tb.parentElement.classList.contains('mt-tw')) return;
      const w = document.createElement('div'); w.className = 'mt-tw';
      tb.parentNode.insertBefore(w, tb); w.appendChild(tb);
    });
    typeset($('.mt-content', wrap));
  }

  wrap.addEventListener('click', (e) => {
    const toc = e.target.closest('.mt-toc a');
    if (toc) { scrollToSection(toc.dataset.sec); return; }
    const go = e.target.closest('[data-go]');
    if (go) {
      if (go.dataset.go === 'list') app().navigate('materi', { backTo: 'home' });
      else if (go.dataset.go === 'calc' && current && current.method) app().navigate(current.method, { backTo: 'metode-stat' });
      return;
    }
    const tp = e.target.closest('.mt-foot [data-topic]');
    if (tp) open(tp.dataset.topic, null, { backTo: backToList });
  });
  wrap.addEventListener('keydown', (e) => {
    const toc = e.target.closest && e.target.closest('.mt-toc a');
    if (toc && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); scrollToSection(toc.dataset.sec); }
  });

  function scrollToSection(secId) {
    if (!current) return;
    const el = document.getElementById('mt-' + current.id + '-' + secId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ------------------------------ Buka materi ------------------------------ */
  let backToList = 'materi';
  /**
   * Buka halaman materi.
   *  open('stasioner')                    -> awal materi
   *  open('stasioner', 'adf')             -> langsung ke bagian "adf"
   *  open('stasioner', 'adf', {from:'stasioner'}) -> tombol Kembali menuju halaman metode tsb
   */
  function open(topicId, secId, opts) {
    opts = opts || {};
    const t = topicById(topicId);
    if (!t) { app().showToast && app().showToast('Materi belum tersedia.'); return; }
    let backTo = opts.backTo || 'materi';
    let backOpts = null;
    if (opts.from) {
      backTo = opts.from;
      backOpts = { scrollTo: window.scrollY || 0, backTo: opts.fromBack || 'metode-stat' };
    }
    backToList = backTo === 'materi' || opts.from ? backTo : 'materi';
    render(t);
    app().navigate('materi-detail', { title: t.title, backTo, backOpts });
    if (secId) setTimeout(() => scrollToSection(secId), 60);
  }

  /* ------------------------------ Tautan dari halaman metode Stat ------------------------------ */
  // Halaman metode -> topik materi
  const METHOD_LINKS = [
    { view: 'regresi',    topic: 'regresi',    label: 'Regresi Linear' },
    { view: 'smoothing',  topic: 'smoothing',  label: 'Metode Smoothing' },
    { view: 'anova',      topic: 'anova',      label: 'ANOVA' },
    { view: 'stasioner',  topic: 'stasioner',  label: 'Uji Stasioneritas' },
    { view: 'deskriptif', topic: 'deskriptif', label: 'Statistika Deskriptif' },
  ];
  // Judul hasil uji (<h4>) -> bagian materi
  const H4_LINKS = {
    regresi: [
      [/Tabel ANOVA Regresi|Uji F \(Simultan\)/i, 'uji-f'],
      [/Uji t \(Parsial\)/i, 'uji-t'],
      [/Normalitas Residual.*Shapiro/i, 'shapiro-wilk'],
      [/Normalitas Residual.*Kolmogorov/i, 'kolmogorov-smirnov'],
      [/Normalitas Residual/i, 'jarque-bera'],
      [/Multikolinearitas.*Korelasi/i, 'korelasi-x'],
      [/Multikolinearitas.*Condition/i, 'condition-index'],
      [/Multikolinearitas/i, 'vif'],
      [/Heteroskedastisitas.*Breusch/i, 'breusch-pagan'],
      [/Heteroskedastisitas.*White/i, 'white'],
      [/Heteroskedastisitas/i, 'glejser'],
      [/Autokorelasi.*Godfrey/i, 'breusch-godfrey'],
      [/Autokorelasi.*Runs/i, 'runs-test'],
      [/Autokorelasi/i, 'durbin-watson'],
      [/Ringkasan Kekuatan|Kesimpulan Model/i, 'determinasi'],
    ],
    anova: [
      [/Satu Arah/i, 'satu-arah'],
      [/Dua Arah|Uji F\s*(-|-)/i, 'dua-arah'],
    ],
    smoothing: [[/Ukuran Error/i, 'error']],
    stasioner: [
      [/Box-Cox/i, 'boxcox'],
      [/Phillips-Perron/i, 'pp'],
      [/KPSS/i, 'kpss'],
      [/Dickey-Fuller/i, 'adf'],
      [/Nilai Kritis/i, 'kritis'],
      [/Hasil Regresi Uji ADF/i, 'adf'],
    ],
  };

  function decorateView(link) {
    const view = document.getElementById('view-' + link.view);
    if (!view) return;
    const topic = () => topicById(link.topic);

    // 1. Banner di bawah judul halaman
    const head = $('.chapter-head', view);
    if (head && !$('.materi-link-top', view)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'materi-link-top';
      b.innerHTML = `${SVG_BOOK}<span class="t"><strong>Lihat materi untuk pemahaman</strong><small>Konsep, rumus, contoh, dan cara membaca hasil ${esc(link.label)}</small></span><span class="go" aria-hidden="true">&rsaquo;</span>`;
      b.addEventListener('click', () => open(link.topic, null, { from: link.view }));
      head.parentNode.insertBefore(b, head.nextSibling);
    }

    // 2. Tombol kecil di judul hasil uji (dipasang otomatis setiap hasil dirender)
    const rules = H4_LINKS[link.view];
    if (!rules) return;
    const scan = () => {
      $$('.test-block > h4:not([data-mt])', view).forEach((h) => {
        h.setAttribute('data-mt', '1');
        const text = h.textContent;
        const rule = rules.find((r) => r[0].test(text));
        if (!rule) return;
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'materi-link'; btn.textContent = 'Lihat materi untuk pemahaman';
        btn.addEventListener('click', () => open(link.topic, rule[1], { from: link.view }));
        h.parentNode.insertBefore(btn, h.nextSibling);
      });
    };
    let queued = false;
    new MutationObserver(() => {
      if (queued) return; queued = true;
      requestAnimationFrame(() => { queued = false; scan(); });
    }).observe(view, { childList: true, subtree: true });
    scan();
  }
  METHOD_LINKS.forEach(decorateView);

  /* ------------------------------ API publik ------------------------------ */
  window.StatCalcMateri = { register, open, topics: () => TOPICS.slice(), has: (id) => !!topicById(id) };
})();
