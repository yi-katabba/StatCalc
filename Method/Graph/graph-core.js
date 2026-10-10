/* =========================================================================
   GRAPH CORE - modul bersama untuk semua halaman Graph
   -------------------------------------------------------------------------
   Muat file ini SEBELUM file graph lain (scatter.js, histogram.js, dst) dan
   SETELAH Method/Shared/impor-data.js.

   Tiap file graph cukup memanggil:
     GraphCore.add({ id, title, types, lede, format, columns, minRows,
                     sample, axes, options, draw(data, opts) -> {svg, summary} })
   dan GraphCore membuatkan halaman (#view-{id}), tabel input, impor data
   (Tempel dari Excel / unggah file), panel pengaturan, hasil, serta tombol
   unduh PNG/SVG. Grafik digambar sebagai SVG (tajam di semua ukuran layar).
   ========================================================================= */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const PAL = ['#22384A', '#BD7E1F', '#2F7F79', '#7A4A7F', '#B5532F', '#4E7F3A', '#5B7DB1', '#A38B2B', '#8C5A3C', '#3F6E8C', '#9A3F5A', '#6B7F2A'];
  const INK = '#1C1E24', SOFT = '#52565F', GRID = '#E6E0CC', AXIS = '#948C77';
  /* Gaya yang berlaku SAAT sebuah halaman Graph menggambar (diatur dari pita). Di luar itu (mis. grafik
     pendukung metode Stat) nilainya kembali ke bawaan, jadi tampilan grafik lain tidak berubah. */
  const PALETTES = {
    bawaan: PAL,
    cerah: ['#E6194B', '#3CB44B', '#4363D8', '#F58231', '#911EB4', '#42D4F4', '#F032E6', '#BFEF45', '#FFD400', '#469990', '#9A6324', '#800000'],
    pastel: ['#8FB8DE', '#F4B183', '#A9D18E', '#FFD966', '#C9A6E4', '#9DC3C1', '#F4A6B8', '#C5C9A0', '#B4C7E7', '#E2B49A', '#B7DEE8', '#D9D2A5'],
    laut: ['#0B3C5D', '#1D70A2', '#328CC1', '#4FA3D1', '#79BEDB', '#A6D4E8', '#2F7F79', '#5AA9A2', '#8CC7C1', '#1F4E5F', '#6C8EAD', '#B2CCE0'],
    hangat: ['#7F1D1D', '#B5532F', '#D97706', '#E9A23B', '#F2C879', '#9A3F5A', '#C75D6B', '#8C5A3C', '#BD7E1F', '#A38B2B', '#D9B08C', '#6B3E26'],
    mono: ['#1C1E24', '#3A3F4A', '#575D6B', '#747B8B', '#9199A8', '#AEB5C2', '#CBD0DA', '#2B3038', '#484E5B', '#656C7B', '#828A9B', '#9FA6B5'],
  };
  const PALETTE_LABEL = { bawaan: 'Bawaan', cerah: 'Cerah', pastel: 'Pastel', laut: 'Laut (biru-hijau)', hangat: 'Hangat', mono: 'Monokrom' };
  /* ST.v === null = kisi vertikal "otomatis" (ikut bawaan tiap grafik; dipakai pita grafik pendukung Stat). */
  const ST0 = { on: false, h: true, v: false, gc: GRID, c1: PAL[0], c2: '#BD7E1F', pal: PAL, bg: '#ffffff' };
  const ST = Object.assign({}, ST0);
  const resetST = () => Object.assign(ST, ST0);
  /* Pengaturan pita per grafik: grid = garis kisi bawaan (null = tanpa kisi); c1/c2 = label pemilih warna; pal = pakai palet */
  const GRAPH_STYLE = {
    scatter: { grid: { h: 1, v: 1 }, c1: 'Warna titik', c2: 'Warna garis regresi' },
    histogram: { grid: { h: 1, v: 0 }, c1: 'Warna batang' },
    probplot: { grid: { h: 1, v: 1 }, c1: 'Warna titik', c2: 'Warna garis acuan' },
    boxplot: { grid: { h: 1, v: 0 }, pal: true },
    barchart: { grid: { h: 1, v: 0 }, c1: 'Warna batang', pal: true },
    piechart: { grid: null, pal: true },
    timeseries: { grid: { h: 1, v: 0 }, c1: 'Warna garis data', c2: 'Warna garis tren' },
  };
  const TYPE_LABEL = {
    numerik1: 'Numerik 1 variabel', numerik2: 'Dua variabel numerik',
    kelompok: 'Numerik per kelompok', kategorik: 'Kategorik', waktu: 'Deret waktu',
  };

  /* ----------------------------- Utilitas umum ----------------------------- */
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmt(v) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '-';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e9 || a < 1e-4) return v.toExponential(2);
    return String(+v.toPrecision(6));
  }
  function parseNum(s) {
    s = String(s).trim();
    if (!s) return NaN;
    if (window.StatCalcImport && window.StatCalcImport.normNum) {
      const n = window.StatCalcImport.normNum(s);
      return n === null ? NaN : Number(n);
    }
    s = s.replace(/\s/g, '').replace(',', '.');
    return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) ? Number(s) : NaN;
  }

  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const mean = (a) => sum(a) / a.length;
  const min = (a) => a.reduce((m, v) => (v < m ? v : m), Infinity);
  const max = (a) => a.reduce((m, v) => (v > m ? v : m), -Infinity);
  const sd = (a) => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(sum(a.map((v) => (v - m) * (v - m))) / (a.length - 1)); };
  const sortedAsc = (a) => a.slice().sort((x, y) => x - y);
  /* Kuantil metode linear (sama dengan QUARTILE.INC di Excel). s harus terurut naik. */
  function quantile(s, p) {
    const h = (s.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
    return s[lo] + (h - lo) * (s[hi] - s[lo]);
  }
  function linreg(x, y) {
    const n = x.length, mx = mean(x), my = mean(y);
    let sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    const b = sxy / sxx, a = my - b * mx, r = sxy / Math.sqrt(sxx * syy);
    return { a, b, r, r2: r * r, sxx, syy, n };
  }
  /* Invers fungsi sebaran normal baku (aproksimasi Acklam, galat relatif < 1,2e-9) */
  function invNorm(p) {
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425, ph = 1 - pl;
    let q, r;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p <= ph) {
      q = p - 0.5; r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  /* ----------------------------- Skala & sumbu SVG ----------------------------- */
  /* Tick "cantik". int=true memaksa langkah bilangan bulat (untuk frekuensi). */
  function niceTicks(lo, hi, n, int) {
    n = n || 6;
    if (!(hi > lo)) { const d = Math.abs(lo) || 1; lo -= d * 0.5; hi += d * 0.5; if (int) { lo = Math.floor(lo); hi = Math.ceil(hi); } }
    const raw = (hi - lo) / (n - 1);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const nr = raw / mag;
    let step = (nr < 1.5 ? 1 : nr < 3 ? 2 : nr < 7 ? 5 : 10) * mag;
    if (int && step < 1) step = 1;
    const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step;
    const t = [];
    for (let v = a; v <= b + step * 0.5; v += step) t.push(+v.toPrecision(12));
    return { lo: t[0], hi: t[t.length - 1], ticks: t, step };
  }
  function mlFor(ticks, hasLabel) {
    const len = ticks.reduce((m, t) => Math.max(m, fmt(t).length), 1);
    return Math.max(46, Math.round(len * 6.6 + 16 + (hasLabel ? 18 : 0)));
  }
  function layout(o) {
    const W = 640, H = o.H || 400;
    const m = { l: o.ml || 56, r: o.mr || 22, t: o.title ? 46 : 22, b: o.mb || (o.xl ? 58 : 36) };
    return { W, H, m, pw: W - m.l - m.r, ph: H - m.t - m.b };
  }
  const sx = (L, sc) => (v) => L.m.l + (v - sc.lo) / (sc.hi - sc.lo) * L.pw;
  const sy = (L, sc) => (v) => L.m.t + L.ph - (v - sc.lo) / (sc.hi - sc.lo) * L.ph;

  function head(L, title) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W} ${L.H}" font-family="Inter, Arial, Helvetica, sans-serif"><rect width="${L.W}" height="${L.H}" fill="${ST.bg}"/>` +
      (title ? `<text x="${L.W / 2}" y="27" text-anchor="middle" font-size="16" font-weight="700" fill="${INK}">${esc(title)}</text>` : '');
  }
  function gridY(L, sc, label) {
    const py = sy(L, sc);
    let s = '';
    sc.ticks.forEach((t) => {
      const y = py(t);
      if (!ST.on || ST.h) s += `<line x1="${L.m.l}" x2="${L.W - L.m.r}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${ST.gc}"/>`;
      s += `<text x="${L.m.l - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="${SOFT}">${esc(fmt(t))}</text>`;
    });
    s += `<line x1="${L.m.l}" y1="${L.m.t}" x2="${L.m.l}" y2="${L.m.t + L.ph}" stroke="${AXIS}"/>`;
    if (label) s += `<text transform="translate(15 ${(L.m.t + L.ph / 2).toFixed(1)}) rotate(-90)" text-anchor="middle" font-size="12" fill="${INK}">${esc(label)}</text>`;
    return s;
  }
  function axisX(L, sc, label, vgrid, ticks) {
    const px = sx(L, sc), yb = L.m.t + L.ph;
    let s = '';
    (ticks || sc.ticks).forEach((t) => {
      const x = px(t);
      if (ST.on && ST.v !== null ? ST.v : vgrid) s += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${L.m.t}" y2="${yb}" stroke="${ST.gc}"/>`;
      s += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${yb}" y2="${yb + 4}" stroke="${AXIS}"/>` +
        `<text x="${x.toFixed(1)}" y="${yb + 17}" text-anchor="middle" font-size="11" fill="${SOFT}">${esc(fmt(t))}</text>`;
    });
    s += `<line x1="${L.m.l}" y1="${yb}" x2="${L.W - L.m.r}" y2="${yb}" stroke="${AXIS}"/>`;
    if (label) s += `<text x="${(L.m.l + L.pw / 2).toFixed(1)}" y="${L.H - 12}" text-anchor="middle" font-size="12" fill="${INK}">${esc(label)}</text>`;
    return s;
  }
  /* Apakah label kategori perlu diputar (terlalu rapat)? */
  function needRot(labels) {
    const ml = labels.reduce((m, l) => Math.max(m, String(l).length), 1);
    return labels.length > 1 && ml * 6.2 > 540 / labels.length;
  }
  function catBottom(labels, hasLabel) {
    if (!needRot(labels)) return hasLabel ? 58 : 36;
    const ml = Math.min(16, labels.reduce((m, l) => Math.max(m, String(l).length), 1));
    return Math.min(104, Math.round(30 + ml * 4.3 + (hasLabel ? 22 : 0)));
  }
  /* Sumbu kategori (pita) di bawah. Mengembalikan {svg, cx(i), bw}. */
  function axisCat(L, labels, label) {
    const n = labels.length, bw = L.pw / n, yb = L.m.t + L.ph, rot = needRot(labels);
    const maxc = rot ? 16 : Math.max(3, Math.floor(bw / 6.2));
    let s = `<line x1="${L.m.l}" y1="${yb}" x2="${L.W - L.m.r}" y2="${yb}" stroke="${AXIS}"/>`;
    if (ST.on && ST.v) for (let i = 0; i <= n; i++) { const gx = (L.m.l + bw * i).toFixed(1); s += `<line x1="${gx}" x2="${gx}" y1="${L.m.t}" y2="${yb}" stroke="${ST.gc}"/>`; }
    labels.forEach((lb, i) => {
      const cx = L.m.l + bw * (i + 0.5);
      const t = String(lb).length > maxc ? String(lb).slice(0, maxc - 1) + '\u2026' : String(lb);
      if (rot) s += `<text transform="translate(${cx.toFixed(1)} ${yb + 14}) rotate(-40)" text-anchor="end" font-size="11" fill="${SOFT}">${esc(t)}</text>`;
      else s += `<text x="${cx.toFixed(1)}" y="${yb + 17}" text-anchor="middle" font-size="11" fill="${SOFT}">${esc(t)}</text>`;
    });
    if (label) s += `<text x="${(L.m.l + L.pw / 2).toFixed(1)}" y="${L.H - 10}" text-anchor="middle" font-size="12" fill="${INK}">${esc(label)}</text>`;
    return { svg: s, bw, cx: (i) => L.m.l + bw * (i + 0.5) };
  }

  /* ----------------------------- Tabel ringkasan ----------------------------- */
  function kv(rows, caption) {
    return `<div class="table-scroll"><table class="result-table gr-kv">${caption ? `<caption>${caption}</caption>` : ''}<tbody>${rows.map((r) => `<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function grid(headCells, rows, caption) {
    return `<div class="table-scroll"><table class="result-table">${caption ? `<caption>${caption}</caption>` : ''}<thead><tr>${headCells.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  const note = (html) => `<p class="hint gr-note">${html}</p>`;

  /* ----------------------------- Gaya halaman Graph ----------------------------- */
  const style = document.createElement('style');
  style.textContent = `
    .gr-format{ background:var(--accent-soft); border-left:3px solid var(--accent-2); padding:10px 14px; border-radius:var(--radius); font-size:13.5px; color:var(--ink); margin:0 0 14px; }
    .gr-opts{ display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:12px 16px; align-items:end; margin-bottom:16px; }
    .gr-opt{ display:flex; flex-direction:column; gap:5px; }
    .gr-opts .plain-input, .gr-opts .select-input{ width:100%; min-width:0; text-align:left; font-family:var(--font-body); font-size:14.5px; padding:0 12px; }
    .gr-check{ display:flex; align-items:center; gap:9px; font-size:14px; font-weight:600; min-height:var(--tap); cursor:pointer; }
    .gr-check input{ width:18px; height:18px; accent-color:var(--accent); }
    .gr-chart{ border:1px solid var(--rule); border-radius:var(--radius); background:#fff; overflow:hidden; }
    .gr-chart svg{ display:block; width:100%; height:auto; }
    .gr-actions{ margin:12px 0 18px; }
    .gr-note{ margin:12px 0 0; font-size:13.5px; }
    .gr-kv th{ text-align:left !important; }
    .gr-sum{ display:flex; flex-direction:column; gap:14px; }
    .gr-vname{ width:100%; min-width:104px; font:600 13px var(--font-body); text-align:center; color:var(--ink); background:#fff; border:1px solid var(--rule-strong); border-radius:6px; padding:7px 8px; }
    .gr-vname:focus{ outline:2px solid var(--accent-2); outline-offset:1px; }
    .gr-modebar{ display:flex; flex-direction:column; gap:6px; max-width:520px; }
    .gr-modebar .select-input{ width:100%; }
  `;
  document.head.appendChild(style);

  /* ----------------------------- Unduh ----------------------------- */
  function exportSvg(svg) {
    const m = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    const w = m ? +m[1] : 640, h = m ? +m[2] : 400;
    return { w, h, str: svg.replace('<svg ', `<svg width="${w}" height="${h}" `) };
  }
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function downloadSVG(svg, name) {
    saveBlob(new Blob([exportSvg(svg).str], { type: 'image/svg+xml;charset=utf-8' }), name + '.svg');
  }
  function downloadPNG(svg, name, onFail) {
    const e = exportSvg(svg), img = new Image();
    const url = URL.createObjectURL(new Blob([e.str], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = e.w * 2; c.height = e.h * 2;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => { if (b) saveBlob(b, name + '.png'); else if (onFail) onFail(); }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); if (onFail) onFail(); };
    img.src = url;
  }

  /* ----------------------------- Pembuat halaman graph ----------------------------- */
  let clipCounter = 0;
  function add(cfg) {
    const id = cfg.id, P = 'gr-' + id + '-';
    const minRows = cfg.minRows || 2;
    const typeText = (cfg.types || []).map((t) => TYPE_LABEL[t] || t).join(' / ');

    const opts = [{ key: 'title', type: 'text', label: 'Judul grafik', placeholder: cfg.title }];
    if (cfg.axes) {
      opts.push({ key: 'xLabel', type: 'text', label: 'Label sumbu X', placeholder: cfg.axes[0] });
      opts.push({ key: 'yLabel', type: 'text', label: 'Label sumbu Y', placeholder: cfg.axes[1] });
    }
    (cfg.options || []).forEach((o) => opts.push(o));

    const useRibbon = !!window.StatRibbon;
    function optHTML(o) {
      const oid = P + 'o-' + o.key;
      if (o.type === 'checkbox') return `<label class="gr-check" for="${oid}"><input type="checkbox" id="${oid}" ${o.def ? 'checked' : ''}> ${esc(o.label)}</label>`;
      if (o.type === 'select') return `<div class="gr-opt"><label for="${oid}">${esc(o.label)}</label><select class="select-input" id="${oid}">${o.choices.map((c) => `<option value="${esc(c[0])}" ${c[0] === o.def ? 'selected' : ''}>${esc(c[1])}</option>`).join('')}</select></div>`;
      return `<div class="gr-opt"><label for="${oid}">${esc(o.label)}</label><input type="text" class="plain-input" id="${oid}" ${o.type === 'number' ? 'inputmode="decimal"' : ''} placeholder="${esc(o.placeholder || '')}" value="${o.def !== undefined ? esc(o.def) : ''}" autocomplete="off"></div>`;
    }

    const W_ = cfg.wide || null, S = W_ ? 1 : 0;
    const wideModeCard = W_ ? `
        <section class="card step-card">
          <div class="step-tag">Langkah 1</div>
          <h2>Pilih format data</h2>
          <div class="gr-modebar">
            <label for="${P}mode">Bagaimana data Anda tersusun?</label>
            <select class="select-input" id="${P}mode">
              <option value="wide" selected>Per variabel - satu kolom = satu variabel (seperti di Excel)</option>
              <option value="long">Per kelompok - kolom Kelompok + kolom Nilai</option>
            </select>
          </div>
          <p class="hint gr-note">Pilih <strong>Per variabel</strong> bila tiap variabel/kelompok sudah berada di kolomnya sendiri (boleh hanya 1 variabel). Pilih <strong>Per kelompok</strong> bila semua nilai ada di satu kolom dan kelompoknya ditulis di kolom lain.</p>
        </section>` : '';
    const wideDataCard = W_ ? `
        <section class="card step-card" id="${P}wdata-card">
          <div class="step-tag">Langkah 2</div>
          <h2>Masukkan data (per variabel)</h2>
          <div class="gr-format"><strong>Jenis data:</strong> ${esc(typeText)}. ${W_.format || ''}</div>
          <p class="hint">Setiap kolom adalah satu variabel; ubah nama variabel pada judul kolom. Panjang tiap kolom boleh berbeda (sel kosong diabaikan). Minimal <strong><span id="${P}wmin">2</span> baris</strong>; maksimal ${W_.maxCols || 12} variabel.</p>
          <div class="table-scroll">
            <table class="data-table">
              <thead id="${P}whead"></thead>
              <tbody id="${P}wbody"></tbody>
            </table>
          </div>
          <div class="btn-grid btn-grid-3">
            <button type="button" class="btn-ghost" id="${P}wadd">+ Tambah baris</button>
            <button type="button" class="btn-ghost" id="${P}wremove">&minus; Hapus baris terakhir</button>
            <button type="button" class="btn-ghost" id="${P}wclear">Kosongkan</button>
          </div>
          <div class="btn-grid btn-grid-2">
            <button type="button" class="btn-ghost" id="${P}waddcol">+ Tambah variabel</button>
            <button type="button" class="btn-ghost" id="${P}wremcol">&minus; Hapus variabel terakhir</button>
          </div>
          <div class="btn-grid btn-grid-1">
            <button type="button" class="btn-ghost" id="${P}wsample">Isi contoh data</button>
          </div>
        </section>` : '';

    const section = document.createElement('section');
    section.className = 'view';
    section.id = 'view-' + id;
    section.innerHTML = `
      <div class="chapter-inner">
        <div class="chapter-head ch-wide">
          <span class="eyebrow">Graph &rsaquo; ${esc(typeText)}</span>
          <h1>${esc(cfg.title)}</h1>
          <p class="lede">${cfg.lede || ''}</p>
        </div>

        ${wideModeCard}
        ${wideDataCard}
        <section class="card step-card" id="${P}data-card" ${W_ ? 'hidden' : ''}>
          <div class="step-tag">Langkah ${S + 1}</div>
          <h2>Masukkan data${W_ ? ' (per kelompok)' : ''}</h2>
          <div class="gr-format"><strong>Jenis data:</strong> ${esc(typeText)}. ${cfg.format || ''}</div>
          <p class="hint">Minimal <strong><span id="${P}min">${minRows}</span> baris</strong> data. Anda dapat mengetik langsung, menempel dari Excel, atau mengunggah file.</p>
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>#</th>${cfg.columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
              <tbody id="${P}body"></tbody>
            </table>
          </div>
          <div class="btn-grid btn-grid-3">
            <button type="button" class="btn-ghost" id="${P}add">+ Tambah baris</button>
            <button type="button" class="btn-ghost" id="${P}remove">&minus; Hapus baris terakhir</button>
            <button type="button" class="btn-ghost" id="${P}clear">Kosongkan</button>
          </div>
          <div class="btn-grid btn-grid-1">
            <button type="button" class="btn-ghost" id="${P}sample">Isi contoh data</button>
          </div>
        </section>

        <section class="card step-card">
          <div class="step-tag">Langkah ${S + 2}</div>
          <h2>${useRibbon ? 'Gambar grafik' : 'Pengaturan grafik'}</h2>
          ${useRibbon
    ? '<p class="hint">Judul, label, opsi grafik, <strong>warna</strong>, dan <strong>garis kisi</strong> diatur lewat pita di bagian atas halaman ini. Setelah grafik muncul, setiap perubahan pada pita langsung diterapkan.</p>'
    : `<p class="hint">Semua pengaturan bersifat opsional. Kosongkan untuk memakai pengaturan bawaan.</p><div class="gr-opts">${opts.map(optHTML).join('')}</div>`}
          <div class="control-row">
            <button type="button" class="btn-primary" id="${P}draw">Gambar Grafik &rarr;</button>
          </div>
          <p class="error-msg" id="${P}err" role="alert" hidden></p>
        </section>

        <section class="card step-card" id="${P}out" hidden>
          <div class="step-tag">Langkah ${S + 3}</div>
          <h2>Hasil</h2>
          <div class="gr-chart" id="${P}chart"></div>
          <div class="control-row gr-actions">
            <button type="button" class="btn-ghost" id="${P}png">Unduh PNG</button>
            <button type="button" class="btn-ghost" id="${P}svg">Unduh SVG</button>
          </div>
          <div class="gr-sum" id="${P}sum"></div>
        </section>
      </div>`;
    document.body.insertBefore(section, $('#profileOverlay'));

    const q = (s) => $('#' + P + s, section);
    const body = q('body'), errEl = q('err'), outCard = q('out');
    let lastSvg = '';

    /* ---- tabel ---- */
    function addRow() {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="rownum">${body.rows.length + 1}</td>` + cfg.columns.map((c, j) =>
        `<td><input type="text" inputmode="${c.text ? 'text' : 'decimal'}" autocomplete="off" data-col="${j}" placeholder="${esc(c.placeholder || c.label)}"></td>`).join('');
      body.appendChild(tr);
    }
    function removeRow() { if (body.rows.length > 1) body.deleteRow(-1); }
    function setRows(n) { while (body.rows.length < n) addRow(); while (body.rows.length > n && body.rows.length > 1) body.deleteRow(-1); }
    for (let i = 0; i < (cfg.defaultRows || Math.max(minRows, 5)); i++) addRow();
    q('add').addEventListener('click', addRow);
    q('remove').addEventListener('click', removeRow);
    q('clear').addEventListener('click', () => { $$('input', body).forEach((x) => { x.value = ''; x.classList.remove('invalid'); }); hideErr(); });
    q('sample').addEventListener('click', () => {
      const s = cfg.sample || [];
      setRows(s.length);
      s.forEach((r, i) => $$('input', body.rows[i]).forEach((inp, j) => { inp.value = r[j] === undefined ? '' : String(r[j]); inp.classList.remove('invalid'); }));
      hideErr();
    });

    function showErr(m) { errEl.textContent = m; errEl.hidden = false; }
    function hideErr() { errEl.hidden = true; }

    /* ---- baca data ---- */
    function readData() {
      const cols = cfg.columns.map(() => []);
      let n = 0;
      for (let i = 0; i < body.rows.length; i++) {
        const ins = $$('input', body.rows[i]);
        const vals = ins.map((x) => x.value.trim());
        ins.forEach((x) => x.classList.remove('invalid'));
        if (vals.every((v) => v === '')) continue;
        for (let j = 0; j < vals.length; j++) {
          const c = cfg.columns[j];
          if (vals[j] === '') {
            if (c.optional) { cols[j].push(c.fallback || ''); continue; }
            ins[j].classList.add('invalid');
            throw new Error(`Baris ${i + 1}: kolom \u201C${c.label}\u201D belum diisi.`);
          }
          if (c.text) cols[j].push(vals[j]);
          else {
            const v = parseNum(vals[j]);
            if (!Number.isFinite(v)) { ins[j].classList.add('invalid'); throw new Error(`Baris ${i + 1}: \u201C${vals[j]}\u201D bukan angka pada kolom \u201C${c.label}\u201D.`); }
            cols[j].push(v);
          }
        }
        n++;
      }
      if (n < minRows) throw new Error(`Data baru ${n} baris; grafik ini membutuhkan minimal ${minRows} baris.`);
      return { cols, n };
    }

    /* ---- baca pengaturan ---- */
    function readOpts() {
      const o = {};
      opts.forEach((d) => {
        const el = $('#' + P + 'o-' + d.key, section);
        if (!el) return;
        if (d.type === 'checkbox') o[d.key] = el.checked;
        else if (d.type === 'select') o[d.key] = el.value;
        else if (d.type === 'number') { const v = parseNum(el.value); o[d.key] = Number.isFinite(v) ? v : null; }
        else o[d.key] = el.value.trim();
      });
      return o;
    }

    /* ---- tabel per variabel (kolom = variabel) ---- */
    let wNames = [], wRows = 0, wb = null;
    const wMax = W_ ? (W_.maxCols || 12) : 0;
    const wMinPer = W_ ? (W_.minPerSeries || 2) : 0;
    const modeEl = W_ ? q('mode') : null;
    const isWide = () => !!W_ && modeEl.value === 'wide';
    if (W_) {
      wb = q('wbody');
      const wh = q('whead');
      const defName = (j) => (W_.namePrefix || 'Variabel') + ' ' + (j + 1);
      const renderHead = () => {
        wh.innerHTML = '<tr><th>#</th>' + wNames.map((nm, j) => `<th><input type="text" class="gr-vname" data-j="${j}" value="${esc(nm)}" aria-label="Nama variabel ${j + 1}" autocomplete="off"></th>`).join('') + '</tr>';
      };
      wh.addEventListener('input', (e) => { const t = e.target; if (t && t.matches && t.matches('.gr-vname')) wNames[+t.dataset.j] = t.value; });
      const cellHTML = (j) => `<td><input type="text" inputmode="decimal" autocomplete="off" data-col="${j}" placeholder="${esc(wNames[j] || defName(j))}"></td>`;
      const wAddRow = () => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="rownum">${wb.rows.length + 1}</td>` + wNames.map((_, j) => cellHTML(j)).join('');
        wb.appendChild(tr);
      };
      const wSetRows = (n) => { while (wb.rows.length < n) wAddRow(); while (wb.rows.length > n && wb.rows.length > 1) wb.deleteRow(-1); };
      const wSetCols = (n) => {
        n = Math.max(1, Math.min(wMax, Math.round(n) || 1));
        if (n === wNames.length) return;
        while (wNames.length < n) wNames.push(defName(wNames.length));
        wNames.length = n;
        renderHead();
        Array.prototype.forEach.call(wb.rows, (tr) => {
          const have = tr.querySelectorAll('input').length;
          if (have > n) { for (let k = have; k > n; k--) tr.deleteCell(-1); }
          else for (let j = have; j < n; j++) tr.insertAdjacentHTML('beforeend', cellHTML(j));
        });
      };
      wNames = Array.from({ length: W_.defCols || 3 }, (_, j) => defName(j));
      renderHead();
      for (let i = 0; i < (W_.defaultRows || 8); i++) wAddRow();
      q('wadd').addEventListener('click', wAddRow);
      q('wremove').addEventListener('click', () => { if (wb.rows.length > 1) wb.deleteRow(-1); });
      q('waddcol').addEventListener('click', () => wSetCols(wNames.length + 1));
      q('wremcol').addEventListener('click', () => wSetCols(wNames.length - 1));
      q('wclear').addEventListener('click', () => { $$('input', wb).forEach((x) => { x.value = ''; x.classList.remove('invalid'); }); hideErr(); });
      q('wsample').addEventListener('click', () => {
        const sm = W_.sample || { names: [defName(0)], rows: [[1], [2]] };
        wNames = sm.names.slice(0, wMax);
        wb.innerHTML = '';
        renderHead();
        wSetRows(sm.rows.length);
        sm.rows.forEach((r, i) => $$('input', wb.rows[i]).forEach((inp, j) => { inp.value = r[j] === undefined || r[j] === null ? '' : String(r[j]); inp.classList.remove('invalid'); }));
        hideErr();
      });
      const syncMode = () => {
        const w = modeEl.value === 'wide';
        q('wdata-card').hidden = !w;
        q('data-card').hidden = w;
        hideErr(); outCard.hidden = true;
      };
      modeEl.addEventListener('change', syncMode);
      syncMode();
      q('wsample').click();
    }
    function readWide() {
      const used = [];
      const series = wNames.map(() => []);
      for (let i = 0; i < wb.rows.length; i++) {
        $$('input', wb.rows[i]).forEach((x, j) => {
          x.classList.remove('invalid');
          const v = x.value.trim();
          if (v === '') return;
          const num = parseNum(v);
          if (!Number.isFinite(num)) { x.classList.add('invalid'); throw new Error(`Baris ${i + 1}, kolom \u201C${wNames[j] || j + 1}\u201D: \u201C${v}\u201D bukan angka.`); }
          series[j].push(num);
        });
      }
      const names = [], vals = [], seen = {};
      series.forEach((arr, j) => {
        if (!arr.length) return;
        let nm = (wNames[j] || '').trim() || ((W_.namePrefix || 'Variabel') + ' ' + (j + 1));
        if (seen[nm]) { seen[nm]++; nm += ' (' + seen[nm] + ')'; } else seen[nm] = 1;
        names.push(nm); vals.push(arr);
      });
      if (!names.length) throw new Error('Belum ada data. Isi minimal satu kolom variabel.');
      const short = vals.findIndex((a) => a.length < wMinPer);
      if (short !== -1) throw new Error(`Variabel \u201C${names[short]}\u201D baru berisi ${vals[short].length} data; minimal ${wMinPer} data per variabel.`);
      return { names, series: vals, n: vals.reduce((s, a) => s + a.length, 0) };
    }

    /* ---- pita (ribbon): teks, opsi, warna, garis kisi ---- */
    const GS = Object.assign({ grid: { h: 1, v: 0 }, c1: 'Warna utama', pal: true }, GRAPH_STYLE[id] || {}, cfg.style || {});
    const sid = (k) => P + 's-' + k;
    const gel = (k) => $('#' + sid(k), section);
    function buildRibbon() {
      const item = (o) => {
        const oid = P + 'o-' + o.key;
        if (o.type === 'checkbox') return { type: 'check', id: oid, label: o.label, def: !!o.def };
        if (o.type === 'select') return { type: 'select', id: oid, label: o.label, options: o.choices, selected: o.def };
        return { type: o.type === 'number' ? 'number' : 'text', id: oid, label: o.label, placeholder: o.placeholder || '', def: o.def };
      };
      const texts = opts.filter((o) => o.type === 'text'), others = opts.filter((o) => o.type !== 'text');
      const tabs = [{ id: 'grafik', label: 'Grafik', groups: [{ label: 'Teks', cols: texts.length, items: texts.map(item) }].concat(others.length ? [{ label: 'Opsi grafik', cols: Math.min(2, others.length), items: others.map(item) }] : []) }];
      const cItems = [];
      if (GS.c1) cItems.push({ type: 'color', id: sid('c1'), label: GS.c1, def: PAL[0] });
      if (GS.c2) cItems.push({ type: 'color', id: sid('c2'), label: GS.c2, def: ST0.c2 });
      const cg = [];
      if (cItems.length) cg.push({ label: 'Warna data', cols: 1, items: cItems });
      if (GS.pal) cg.push({ label: 'Palet warna', cols: 1, items: [{ type: 'select', id: sid('pal'), label: 'Palet (grafik banyak warna)', options: Object.keys(PALETTES).map((k) => [k, PALETTE_LABEL[k]]), selected: 'bawaan' }] });
      cg.push({ label: 'Latar', cols: 1, items: [{ type: 'color', id: sid('bg'), label: 'Warna latar grafik', def: ST0.bg }] });
      tabs.push({ id: 'warna', label: 'Warna', groups: cg, tip: GS.pal ? 'Palet dipakai untuk grafik berwarna-warni (tiap boxplot, irisan pie, atau batang bila &ldquo;Warna berbeda tiap batang&rdquo; aktif).' : '' });
      if (GS.grid) tabs.push({ id: 'kisi', label: 'Garis kisi', groups: [
        { label: 'Tampilkan', cols: 1, items: [{ type: 'check', id: sid('gh'), label: 'Garis horizontal', def: !!GS.grid.h }, { type: 'check', id: sid('gv'), label: 'Garis vertikal', def: !!GS.grid.v }] },
        { label: 'Gaya', cols: 1, items: [{ type: 'color', id: sid('gc'), label: 'Warna garis kisi', def: GRID }] },
      ] });
      window.StatRibbon.mount({ view: '#view-' + id, key: 'gr-' + id, tabs, onChange: schedule });
    }
    /* pilihan (mis. arah batang) boleh mengatur ulang bawaan garis kisi: o.gridDef = { nilai: {h, v} } */
    function bindGridDefaults() {
      opts.forEach((o) => {
        if (o.type !== 'select' || !o.gridDef) return;
        const el = $('#' + P + 'o-' + o.key, section);
        if (el) el.addEventListener('change', () => {
          const d = o.gridDef[el.value], h = gel('gh'), v = gel('gv');
          if (!d) return;
          if (h) h.checked = !!d.h;
          if (v) v.checked = !!d.v;
        });
      });
    }
    function applyStyle() {
      ST.on = true;
      if (gel('c1')) ST.c1 = gel('c1').value;
      if (gel('c2')) ST.c2 = gel('c2').value;
      if (gel('pal')) ST.pal = PALETTES[gel('pal').value] || PAL;
      if (gel('bg')) ST.bg = gel('bg').value;
      ST.h = gel('gh') ? gel('gh').checked : false;
      ST.v = gel('gv') ? gel('gv').checked : false;
      if (gel('gc')) ST.gc = gel('gc').value;
    }

    let lastData = null, redrawTimer = null;
    function paint(scroll) {
      const o = readOpts();
      let res;
      applyStyle();
      try { res = lastData.wide ? W_.draw(lastData.d, o) : cfg.draw(lastData.d, o); } finally { resetST(); }
      lastSvg = res.svg;
      q('chart').innerHTML = res.svg;
      q('sum').innerHTML = res.summary || '';
      outCard.hidden = false;
      if (scroll) {
        if (window.StatCalc && window.StatCalc.trackCalc) window.StatCalc.trackCalc();
        if (outCard.scrollIntoView) outCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    function schedule() {
      if (!lastData || outCard.hidden) return;
      clearTimeout(redrawTimer);
      redrawTimer = setTimeout(() => {
        try { hideErr(); paint(false); } catch (err) { showErr(err && err.message ? err.message : 'Terjadi kesalahan saat menggambar grafik.'); }
      }, 40);
    }
    if (useRibbon) { buildRibbon(); bindGridDefaults(); }

    q('draw').addEventListener('click', () => {
      hideErr();
      try {
        lastData = isWide() ? { wide: true, d: readWide() } : { wide: false, d: readData() };
        paint(true);
      } catch (err) {
        lastData = null;
        outCard.hidden = true;
        showErr(err && err.message ? err.message : 'Terjadi kesalahan saat menggambar grafik.');
      }
    });
    q('png').addEventListener('click', () => {
      if (lastSvg) downloadPNG(lastSvg, id, () => showErr('Peramban ini tidak dapat membuat PNG. Gunakan Unduh SVG.'));
    });
    q('svg').addEventListener('click', () => { if (lastSvg) downloadSVG(lastSvg, id); });

    /* ---- impor data (Tempel dari Excel / unggah file) ---- */
    if (window.StatCalcImport && window.StatCalcImport.register) {
      window.StatCalcImport.register({
        card: '#' + P + 'data-card', body: '#' + P + 'body',
        add: '#' + P + 'add', remove: '#' + P + 'remove', minHint: '#' + P + 'min',
        text: cfg.columns.map((c, j) => (c.text ? j : -1)).filter((j) => j >= 0),
      });
      if (W_) {
        window.StatCalcImport.register({
          card: '#' + P + 'wdata-card', body: '#' + P + 'wbody',
          add: '#' + P + 'wadd', remove: '#' + P + 'wremove', minHint: '#' + P + 'wmin',
          text: [],
          fitCols: (n) => { const h = q('waddcol'); let g = 0; while (wNames.length < Math.min(n, wMax) && g++ < 30) h.click(); g = 0; const r = q('wremcol'); while (wNames.length > Math.max(1, Math.min(n, wMax)) && g++ < 30) r.click(); },
          onApply: (info) => {
            const nm = info.names || [], off = info.offset || 0;
            nm.forEach((t, k) => { const j = off + k; const v = String(t || '').trim(); const inp = $$('.gr-vname', section)[j]; if (inp && v) { inp.value = v; wNames[j] = v; } });
          },
        });
      }
    }
  }

  window.GraphCore = {
    add,
    u: {
      esc, fmt, parseNum, PAL, INK, SOFT, GRID, AXIS, ST, ST0, PALETTES, PALETTE_LABEL, resetST,
      sum, mean, min, max, sd, sortedAsc, quantile, linreg, invNorm,
      niceTicks, mlFor, layout, sx, sy, head, gridY, axisX, axisCat, needRot, catBottom,
      kv, grid, note,
      nextClipId: () => 'gclip' + (++clipCounter),
    },
  };
})();
