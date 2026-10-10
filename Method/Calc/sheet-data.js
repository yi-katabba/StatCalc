/* =========================================================================
   CALC - tab "Data" (Method/Calc/sheet-data.js)
   -------------------------------------------------------------------------
   Perkakas merapikan data sebelum dianalisis di menu Stat / Graph:
   - Urutkan naik / turun menurut satu kolom (seluruh baris ikut berpindah).
   - Filter: tampilkan hanya baris yang memenuhi syarat (baris lain disembunyikan,
     bisa dipulihkan dengan "Tampilkan semua"; filter bisa ditumpuk = DAN).
   - Hapus duplikat dan hapus baris kosong.
   - Nilai hilang: isi dengan rata-rata / median / modus / nilai tertentu /
     nilai di atasnya, atau hapus barisnya.
   - Teks jadi angka (format Indonesia 1.234,56 / Internasional 1,234.56, Rp, %, (negatif))
     dan Teks ke kolom (pisahkan satu kolom menjadi beberapa kolom).
   Dimuat SETELAH Method/Calc/sheet.js (memakai StatCalcSheet.api).
   Semua perubahan bisa diurungkan dengan tombol "Urungkan" di tab Edit.
   ========================================================================= */
(function () {
  'use strict';
  const SH = window.StatCalcSheet;
  if (!SH || !SH.api) return;
  const A = SH.api, S = SH.state, section = SH.els.section;
  const q = (id) => section.querySelector('#' + id);
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ok = (m, ms) => A.flash('scOk', m, ms || 12000);
  const err = (m) => A.flash('scErr', m, 9000);

  /* ------------------------------ Ikon & markup ------------------------------ */
  const ICO = {
    sortasc: '<path d="M7 4v16M3.8 7.2 7 4l3.2 3.2"/><path d="M14 6h3M14 11h5M14 16h7"/>',
    sortdesc: '<path d="M7 20V4M3.8 16.8 7 20l3.2-3.2"/><path d="M14 18h3M14 13h5M14 8h7"/>',
    filter: '<path d="M4 5h16l-6.2 7.4V19l-3.6-2v-4.6z"/>',
    unfilter: '<path d="M4 5h16l-6.2 7.4V19l-3.6-2v-4.6z"/><path d="M3.5 3.5l17 17"/>',
    dedupe: '<rect x="3.5" y="3.5" width="11" height="11" rx="2"/><path d="M9.5 20.5h8a3 3 0 0 0 3-3v-8"/><path d="M7 9l1.6 1.6L11.5 7.5"/>',
    blank: '<rect x="3.5" y="5" width="17" height="5" rx="1.6"/><rect x="3.5" y="14" width="17" height="5" rx="1.6" stroke-dasharray="2.5 2.5"/>',
    fillna: '<rect x="3.5" y="4" width="17" height="16" rx="2.2"/><path d="M3.5 9.5h17M9.2 4v16"/><path d="M12.5 15h5M15 12.5v5"/>',
    tonum: '<path d="M4 7h6M4 12h6M4 17h4"/><path d="M13 8.5h7M13 12.5h7M13 16.5h7" stroke-dasharray="0.1 3.4"/><path d="M13 7l2-2M13 7l2 2"/><path d="M20.5 15.5v3.5M17.3 15.5h3.2"/>',
    split: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M12 4.5v15"/><path d="M7 12h3M14 12h3M9 10l1.5 2L9 14M15 10l-1.5 2 1.5 2"/>'
  };
  const svgI = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg>`;
  const rb = (id, ico, label, tip, cls, dis) => `<button type="button" class="sc-rb ${cls || ''}" id="${id}" title="${tip || label}" aria-label="${tip || label}"${dis ? ' disabled' : ''}>${svgI(ico)}<span>${label}</span></button>`;

  const FOPS = [
    ['eq', 'sama dengan'], ['ne', 'tidak sama dengan'], ['gt', 'lebih besar dari'], ['ge', 'lebih besar atau sama dengan'],
    ['lt', 'lebih kecil dari'], ['le', 'lebih kecil atau sama dengan'], ['between', 'di antara (termasuk batas)'],
    ['contains', 'mengandung'], ['ncontains', 'tidak mengandung'], ['starts', 'diawali dengan'], ['ends', 'diakhiri dengan'],
    ['empty', 'kosong'], ['nonempty', 'tidak kosong'], ['isnum', 'berisi angka'], ['istext', 'berisi teks (bukan angka)']
  ];
  const NOVAL = ['empty', 'nonempty', 'isnum', 'istext'];
  const DELIMS = [['comma', ',', 'Koma ( , )'], ['semi', ';', 'Titik koma ( ; )'], ['space', ' ', 'Spasi'], ['tab', '\t', 'Tab'], ['colon', ':', 'Titik dua ( : )'], ['pipe', '|', 'Garis tegak ( | )'], ['slash', '/', 'Garis miring ( / )'], ['dash', '-', 'Tanda hubung ( - )'], ['other', null, 'Lainnya…']];

  q('sdBody').innerHTML = `
    <div class="sc-grp">
      <div class="sc-gbody">
        <div class="sc-fld"><label for="sdSortCol">Kolom</label><select id="sdSortCol" class="select-input"></select></div>
        ${rb('sdAsc', 'sortasc', 'Naik (A-Z, kecil-besar)', 'Urutkan naik menurut kolom ini; seluruh baris ikut berpindah')}
        ${rb('sdDesc', 'sortdesc', 'Turun (Z-A, besar-kecil)', 'Urutkan turun menurut kolom ini; seluruh baris ikut berpindah')}
      </div>
      <div class="sc-glabel">Urutkan</div>
    </div>
    <div class="sc-grp">
      <div class="sc-gbody">
        <div class="sc-fgrid">
          <div class="sc-fld"><label for="sdFCol">Kolom</label><select id="sdFCol" class="select-input"></select></div>
          <div class="sc-fld"><label for="sdFOp">Syarat</label><select id="sdFOp" class="select-input" style="width:212px">${FOPS.map((o) => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select></div>
          <div class="sc-fld" id="sdFV1Wrap"><label for="sdFVal" id="sdFV1Lbl">Nilai</label><input id="sdFVal" class="plain-input" type="text" autocomplete="off" spellcheck="false"></div>
          <div class="sc-fld" id="sdFV2Wrap" style="display:none"><label for="sdFVal2">Sampai</label><input id="sdFVal2" class="plain-input" type="text" autocomplete="off" spellcheck="false"></div>
        </div>
        ${rb('sdFApply', 'filter', 'Terapkan filter', 'Tampilkan hanya baris yang memenuhi syarat (baris lain disembunyikan)', 'pri')}
        ${rb('sdFClear', 'unfilter', 'Tampilkan semua', 'Pulihkan baris yang disembunyikan filter', '', true)}
      </div>
      <div class="sc-glabel">Filter</div>
    </div>
    <div class="sc-grp">
      <div class="sc-gbody">
        <div class="sc-stack">
          <div class="sc-fld"><label for="sdDupCol">Duplikat dinilai dari</label><select id="sdDupCol" class="select-input"></select></div>
          <div class="sc-fld"><label for="sdBlankCol">Baris kosong</label><select id="sdBlankCol" class="select-input"></select></div>
        </div>
        <div class="sc-stack">
          ${rb('sdDup', 'dedupe', 'Hapus duplikat', 'Hapus baris yang isinya sama; baris pertama dipertahankan', 'sm')}
          ${rb('sdBlank', 'blank', 'Hapus baris kosong', 'Hapus baris yang kosong sesuai pilihan di sebelah kiri', 'sm')}
        </div>
      </div>
      <div class="sc-glabel">Duplikat &amp; baris kosong</div>
    </div>
    <div class="sc-grp">
      <div class="sc-gbody">
        <div class="sc-fgrid">
          <div class="sc-fld"><label for="sdMCol">Kolom</label><select id="sdMCol" class="select-input"></select></div>
          <div class="sc-fld"><label for="sdMOp">Tangani dengan</label><select id="sdMOp" class="select-input" style="width:212px">
            <option value="mean">Isi dengan rata-rata</option><option value="median">Isi dengan median</option><option value="mode">Isi dengan modus</option>
            <option value="value">Isi dengan nilai tertentu</option><option value="prev">Isi dengan nilai di atasnya</option><option value="drop">Hapus barisnya</option></select></div>
          <div class="sc-fld" id="sdMValWrap" style="display:none"><label for="sdMVal">Nilai pengisi</label><input id="sdMVal" class="plain-input" type="text" value="0" autocomplete="off" spellcheck="false"></div>
        </div>
        <label class="sc-chk" title="Selain sel kosong, anggap NA, N/A, #N/A, NaN, null, - , -- , ? sebagai nilai hilang"><input type="checkbox" id="sdMTok" checked> NA, N/A, - juga hilang</label>
        ${rb('sdMApply', 'fillna', 'Terapkan', 'Tangani nilai hilang pada kolom terpilih', 'pri')}
      </div>
      <div class="sc-glabel">Nilai hilang</div>
    </div>
    <div class="sc-grp">
      <div class="sc-gbody">
        <div class="sc-fgrid c2">
          <div class="sc-fld"><label for="sdNCol">Kolom</label><select id="sdNCol" class="select-input"></select></div>
          <div class="sc-fld"><label for="sdNFmt">Format angka</label><select id="sdNFmt" class="select-input" style="width:212px">
            <option value="auto">Otomatis (utamakan Indonesia)</option><option value="id">Indonesia: 1.234,56</option><option value="en">Internasional: 1,234.56</option></select></div>
        </div>
        ${rb('sdNum', 'tonum', 'Teks jadi angka', 'Ubah sel teks (mis. "Rp 1.250.000", "45%", " 12,5 ") menjadi angka', 'pri')}
      </div>
      <div class="sc-glabel">Teks ke angka</div>
    </div>
    <div class="sc-grp">
      <div class="sc-gbody">
        <div class="sc-fgrid c2">
          <div class="sc-fld"><label for="sdSpCol">Kolom</label><select id="sdSpCol" class="select-input"></select></div>
          <div class="sc-fld"><label for="sdSpDel">Pemisah</label><select id="sdSpDel" class="select-input">${DELIMS.map((d) => `<option value="${d[0]}">${d[2]}</option>`).join('')}</select></div>
          <div class="sc-fld" id="sdSpOtherWrap" style="display:none"><label for="sdSpOther">Pemisah lain</label><input id="sdSpOther" class="plain-input" type="text" autocomplete="off" spellcheck="false" placeholder="mis. ' - '"></div>
        </div>
        <label class="sc-chk" title="Pemisah yang berurutan dihitung satu (berguna untuk spasi ganda)"><input type="checkbox" id="sdSpMerge"> Gabung pemisah berurutan</label>
        ${rb('sdSplit', 'split', 'Pisahkan', 'Pecah isi kolom menjadi beberapa kolom baru di sebelah kanannya', 'pri')}
      </div>
      <div class="sc-glabel">Teks ke kolom</div>
    </div>`;

  const tips = section.querySelector('.sc-tips');
  if (tips) {
    const p = document.createElement('p');
    p.className = 'sc-tip'; p.dataset.tip = 'data'; p.hidden = true;
    p.innerHTML = 'Semua perintah bekerja pada baris data (baris 1 dilewati bila “Baris 1 judul kolom” aktif) dan bisa diurungkan. <strong>Filter</strong> menyembunyikan baris yang tidak cocok: grafik, analisis Stat, dan ekspor hanya memakai baris yang tampil; “Tampilkan semua” memulihkannya. Duplikat dibandingkan tanpa membedakan huruf besar/kecil. Hasil isi nilai hilang berupa nilai tetap, bukan rumus.';
    tips.appendChild(p);
  }

  /* ------------------------------ Status filter ------------------------------ */
  // filt = { order: ['v' | { h: [sel...], from: nomorBarisAsal }, ...], crit: ['Kolom B > 10', ...] }
  // 'v' = tempat baris yang masih tampil (urut sesuai posisi awal); { h } = baris yang disembunyikan.
  let filt = null;
  A.registerState(() => filt, (x) => { filt = x; });
  A.onReset(() => { filt = null; });
  const hiddenCount = () => (filt ? filt.order.filter((e) => e !== 'v').length : 0);
  A.setInfoHook(() => {
    if (!filt) return '';
    const n = Math.max(0, SH.lastDataRow() - SH.firstDataRow() + 1);
    return ` Filter aktif: menampilkan ${n} dari ${n + hiddenCount()} baris data (${filt.crit.join('; ')}).`;
  });
  // kolom yang disisipkan / dihapus ikut diterapkan ke baris tersembunyi agar tidak bergeser
  SH.onStructure((axis, kind, at, n) => {
    if (!filt || axis !== 'c') return;
    filt.order.forEach((e) => {
      if (e === 'v') return;
      e.h = e.h.map((t) => (t.charAt(0) === '=' ? A.adjustFormula(t, 'c', kind, at, n) : t));
      if (kind === 'ins') e.h.splice(at, 0, ...new Array(n).fill(''));
      else e.h.splice(at, n);
    });
  });

  /* --------------------------------- Pembantu -------------------------------- */
  const colName = SH.colName;
  const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
  const fmtNum = (x) => String(+Number(x).toPrecision(12));
  const MISS_TOK = new Set(['na', 'n/a', '#n/a', 'nan', 'null', 'nil', 'none', '-', '--', '?']);
  const isMissRaw = (t, tok) => { const s = String(t).trim(); return s === '' || (tok && MISS_TOK.has(s.toLowerCase())); };
  const isBlankVal = (v) => v === '' || (typeof v === 'string' && v.trim() === '');
  const valText = (r, c) => { const v = SH.cellVal(r, c); return SH.isErr(v) ? String(v) : (typeof v === 'number' ? String(v) : SH.display(v)); };
  const plural = (n, a) => `${n} ${a}`;

  function bounds() { return { f: SH.firstDataRow(), last: SH.lastDataRow(), C: SH.usedBounds().C }; }
  function need() {
    const b = bounds();
    if (b.last < b.f || b.C < 1) { err('Belum ada baris data pada lembar kerja. Impor atau ketik data terlebih dahulu.'); return null; }
    return b;
  }
  function selCols(b) {
    const R = SH.selection().rect;
    return range(R.c1, Math.min(R.c2, b.C - 1));
  }
  function colsOf(v, b) {
    if (v === 'all' || v === 'allrow') return range(0, b.C - 1);
    if (v === 'sel') { const c = selCols(b); if (!c.length) { err('Sel terpilih berada di luar kolom yang berisi data. Pilih sel di dalam tabel dulu.'); return null; } return c; }
    return [+v];
  }
  const colLabel = (c) => { const t = S.header ? SH.raw(0, c) : ''; return 'Kolom ' + colName(c) + (t && t.charAt(0) !== '=' ? ' - ' + (t.length > 16 ? t.slice(0, 15) + '…' : t) : ''); };
  const colsTxt = (cols) => (cols.length === 1 ? 'kolom ' + colName(cols[0]) : 'kolom ' + colName(cols[0]) + '-' + colName(cols[cols.length - 1]));

  /* Salin baris data (f..last) agar bisa diurutkan / disaring lalu ditulis ulang. */
  function getRows(b) {
    const rows = [];
    for (let r = b.f; r <= b.last; r++) rows.push({ cells: (S.cells[r] || []).slice(), from: r });
    return rows;
  }
  /* Tulis ulang baris data mulai baris pertama data. Rumus ikut digeser agar acuan sebarisnya tetap sebaris. */
  function writeRows(list, oldLast) {
    const f = SH.firstDataRow();
    A.ensure(f + list.length, S.C);
    list.forEach((it, i) => {
      const r = f + i;
      const row = it.cells.map((t) => (t.charAt(0) === '=' ? A.shiftFormula(t, r - it.from, 0) : t));
      while (row.length < S.C) row.push('');
      S.cells[r] = row;
    });
    for (let r = f + list.length; r <= oldLast; r++) S.cells[r] = new Array(S.C).fill('');
  }
  const hasFormula = (rows) => rows.some((it) => it.cells.some((t) => t.charAt(0) === '='));
  const done = () => { A.invalidate(); A.fullRender(true); refreshUI(); };

  /* ----------------------------- Pilihan kolom (select) ----------------------------- */
  const SCOPE = {
    sdSortCol: [], sdFCol: [], sdSpCol: [],
    sdDupCol: [['all', 'Seluruh baris']], sdBlankCol: [['allrow', 'Seluruh baris kosong']],
    sdMCol: [['all', 'Semua kolom']], sdNCol: [['all', 'Semua kolom angka']]
  };
  const SEL_LABEL = { sdDupCol: 'Kolom di sel terpilih', sdBlankCol: 'Kosong di salah satu kolom terpilih', sdMCol: 'Kolom di sel terpilih', sdNCol: 'Kolom di sel terpilih' };
  let selSig = '';
  function refreshSelects(force, focusCol) {
    const ub = SH.usedBounds(), n = Math.max(1, Math.min(ub.C || 1, A.MAX_C));
    const sig = n + '|' + (S.header ? Array.from({ length: n }, (_, c) => SH.raw(0, c)).join('\u0001') : '-');
    if (!force && sig === selSig) return;
    selSig = sig;
    Object.keys(SCOPE).forEach((id) => {
      const el = q(id), keep = el.value;
      let h = SCOPE[id].map((o) => `<option value="${o[0]}">${o[1]}</option>`).join('');
      if (SEL_LABEL[id]) h += `<option value="sel">${SEL_LABEL[id]}</option>`;
      for (let c = 0; c < n; c++) h += `<option value="${c}">${esc(id === 'sdBlankCol' ? 'Kosong di ' + colLabel(c) : colLabel(c))}</option>`;
      el.innerHTML = h;
      if (keep && Array.from(el.options).some((o) => o.value === keep)) el.value = keep;
      else if (SCOPE[id].length) el.value = SCOPE[id][0][0];
      else el.value = '0';
    });
    if (focusCol !== undefined) focusSingle(focusCol);
  }
  function focusSingle(c) {
    ['sdSortCol', 'sdFCol', 'sdSpCol'].forEach((id) => { const el = q(id); if (Array.from(el.options).some((o) => o.value === String(c))) el.value = String(c); });
  }
  function refreshUI() {
    const hid = hiddenCount(), btn = q('sdFClear');
    btn.disabled = !filt;
    btn.querySelector('span').textContent = filt ? `Tampilkan semua (${hid} tersembunyi)` : 'Tampilkan semua';
    q('sdFApply').querySelector('span').textContent = filt ? 'Tambah filter (DAN)' : 'Terapkan filter';
  }
  let rt = 0;
  SH.onChange(() => { clearTimeout(rt); rt = setTimeout(() => { refreshSelects(false); refreshUI(); }, 90); });
  A.onTab('data', () => { refreshSelects(true, SH.selection().rect.c1); refreshUI(); });
  refreshSelects(true); refreshUI();

  /* --------------------------------- Urutkan --------------------------------- */
  function sortKey(r, c) {
    const v = SH.cellVal(r, c);
    if (SH.isErr(v)) return { k: 2 };
    if (isBlankVal(v)) return { k: 3 };
    if (typeof v === 'number') return { k: 0, v };
    return { k: 1, v: String(v) };
  }
  function doSort(dir) {
    const b = need(); if (!b) return;
    const c = +q('sdSortCol').value;
    const rows = getRows(b);
    const keyed = rows.map((it, i) => ({ it, i, k: sortKey(it.from, c) }));
    keyed.sort((x, y) => {
      const a = x.k, z = y.k;
      if (a.k === 3 || z.k === 3) return a.k === z.k ? x.i - y.i : (a.k === 3 ? 1 : -1);   // sel kosong selalu di bawah
      if (a.k !== z.k) return a.k - z.k;                                                  // angka, lalu teks, lalu galat
      let d = 0;
      if (a.k === 0) d = a.v - z.v;
      else if (a.k === 1) d = a.v.localeCompare(z.v, 'id', { numeric: true, sensitivity: 'base' });
      return d ? d * dir : x.i - y.i;
    });
    if (keyed.every((x, i) => x.i === i)) { ok(`${colLabel(c)} sudah terurut ${dir > 0 ? 'naik' : 'turun'}; tidak ada yang berubah.`); return; }
    A.pushUndo();
    writeRows(keyed.map((x) => x.it), b.last);
    done();
    ok(`${rows.length} baris diurutkan ${dir > 0 ? 'naik' : 'turun'} menurut ${colLabel(c)}. Sel kosong selalu di bawah.${hasFormula(rows) ? ' Sebagian sel berisi rumus: acuan ke sel di barisnya sendiri ikut pindah, sedangkan acuan ke baris lain (mis. selisih, kumulatif) dihitung ulang terhadap posisi barunya.' : ''}`);
  }
  q('sdAsc').addEventListener('click', () => doSort(1));
  q('sdDesc').addEventListener('click', () => doSort(-1));

  /* ---------------------------------- Filter ---------------------------------- */
  const toN = (s) => { const t = String(s).trim().replace(',', '.'); return t === '' ? NaN : SH.parseNum(t); };
  function makeTest(op, s1, s2) {
    const n1 = toN(s1), n2 = toN(s2), t1 = s1.trim().toLowerCase();
    const cmpOK = (v, shown, f) => {
      if (!Number.isNaN(n1)) return typeof v === 'number' && f(v);
      return typeof v === 'string' && !isBlankVal(v) && f(shown.localeCompare(s1.trim(), 'id', { numeric: true, sensitivity: 'base' }), true);
    };
    const eq = (v, shown) => (!Number.isNaN(n1) && typeof v === 'number' ? v === n1 : shown.trim().toLowerCase() === t1);
    return (v, shown) => {
      const blank = isBlankVal(v);
      switch (op) {
        case 'empty': return blank;
        case 'nonempty': return !blank;
        case 'isnum': return typeof v === 'number';
        case 'istext': return typeof v === 'string' && !blank;
        case 'eq': return eq(v, shown);
        case 'ne': return !eq(v, shown);
        case 'gt': return cmpOK(v, shown, (x, t) => (t ? x > 0 : x > n1));
        case 'ge': return cmpOK(v, shown, (x, t) => (t ? x >= 0 : x >= n1));
        case 'lt': return cmpOK(v, shown, (x, t) => (t ? x < 0 : x < n1));
        case 'le': return cmpOK(v, shown, (x, t) => (t ? x <= 0 : x <= n1));
        case 'between': return typeof v === 'number' && v >= Math.min(n1, n2) && v <= Math.max(n1, n2);
        case 'contains': return !blank && shown.toLowerCase().indexOf(t1) >= 0;
        case 'ncontains': return blank || shown.toLowerCase().indexOf(t1) < 0;
        case 'starts': return !blank && shown.toLowerCase().indexOf(t1) === 0;
        case 'ends': return !blank && shown.toLowerCase().slice(-t1.length) === t1 && t1 !== '';
        default: return true;
      }
    };
  }
  function syncFilterOp() {
    const op = q('sdFOp').value;
    q('sdFV1Wrap').style.display = NOVAL.indexOf(op) >= 0 ? 'none' : '';
    q('sdFV2Wrap').style.display = op === 'between' ? '' : 'none';
    q('sdFV1Lbl').textContent = op === 'between' ? 'Dari' : 'Nilai';
  }
  q('sdFOp').addEventListener('change', syncFilterOp); syncFilterOp();
  ['sdFVal', 'sdFVal2'].forEach((id) => q(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); q('sdFApply').click(); } }));

  q('sdFApply').addEventListener('click', () => {
    const b = need(); if (!b) return;
    const c = +q('sdFCol').value, op = q('sdFOp').value, s1 = q('sdFVal').value, s2 = q('sdFVal2').value;
    if (NOVAL.indexOf(op) < 0 && ['eq', 'ne'].indexOf(op) < 0 && s1.trim() === '') { err('Isi nilai pembanding dulu.'); return; }
    if (op === 'between' && (Number.isNaN(toN(s1)) || Number.isNaN(toN(s2)))) { err('Syarat “di antara” butuh dua angka: isi kolom “Dari” dan “Sampai”.'); return; }
    const test = makeTest(op, s1, s2);
    const rows = getRows(b);
    const pass = rows.map((it) => test(SH.cellVal(it.from, c), valText(it.from, c)));
    const nOk = pass.filter(Boolean).length;
    const opTxt = FOPS.find((o) => o[0] === op)[1].replace(' (termasuk batas)', '').replace(' (bukan angka)', '');
    const desc = `${colLabel(c).split(' - ')[0]} ${opTxt}${NOVAL.indexOf(op) >= 0 ? '' : ' ' + s1.trim() + (op === 'between' ? ' dan ' + s2.trim() : '')}`;
    if (nOk === 0) { err(`Tidak ada baris yang memenuhi syarat (${desc}), jadi filter tidak diterapkan. Periksa kolom, syarat, dan nilainya.`); return; }
    if (nOk === rows.length) { ok(`Semua ${rows.length} baris yang tampil sudah memenuhi syarat (${desc}); tidak ada baris yang disembunyikan.`); return; }
    A.pushUndo();
    if (!filt) {
      filt = { order: rows.map((it, i) => (pass[i] ? 'v' : { h: it.cells, from: it.from })), crit: [desc] };
    } else {
      // samakan jumlah penanda 'v' dengan jumlah baris yang tampil sekarang (bila pengguna menambah / menghapus baris)
      let nv = filt.order.filter((e) => e === 'v').length;
      while (nv < rows.length) { filt.order.push('v'); nv++; }
      while (nv > rows.length) { const k = filt.order.lastIndexOf('v'); filt.order.splice(k, 1); nv--; }
      let j = 0;
      filt.order = filt.order.map((e) => { if (e !== 'v') return e; const i = j++; return pass[i] ? 'v' : { h: rows[i].cells, from: rows[i].from }; });
      filt.crit.push(desc);
    }
    writeRows(rows.filter((_, i) => pass[i]), b.last);
    done();
    ok(`Filter diterapkan (${desc}): menampilkan ${nOk} dari ${rows.length} baris${hiddenCount() > rows.length - nOk ? ` (total ${hiddenCount()} baris tersembunyi)` : ''}. Grafik, analisis Stat, dan ekspor hanya memakai baris yang tampil. Klik “Tampilkan semua” untuk memulihkan.`);
  });
  q('sdFClear').addEventListener('click', () => {
    if (!filt) return;
    const b = bounds(), f = b.f;
    const vis = b.last >= f ? getRows(b) : [];
    const out = []; let j = 0;
    filt.order.forEach((e) => { if (e === 'v') { if (j < vis.length) out.push(vis[j++]); } else out.push({ cells: e.h, from: e.from }); });
    while (j < vis.length) out.push(vis[j++]);
    if (f + out.length > A.MAX_R) { err(`Tidak bisa memulihkan: jumlah baris melebihi batas ${A.MAX_R}.`); return; }
    const n = hiddenCount();
    A.pushUndo();
    filt = null;
    writeRows(out, b.last);
    done();
    ok(`Filter dilepas: ${n} baris tersembunyi dipulihkan ke posisi semula (total ${out.length} baris data).`);
  });

  /* --------------------------- Duplikat & baris kosong --------------------------- */
  function keyPart(r, c) {
    const v = SH.cellVal(r, c);
    if (SH.isErr(v)) return 'e' + v.code;
    if (isBlankVal(v)) return '';
    return typeof v === 'number' ? 'n' + v : 's' + String(v).trim().toLowerCase();
  }
  q('sdDup').addEventListener('click', () => {
    const b = need(); if (!b) return;
    const cols = colsOf(q('sdDupCol').value, b); if (!cols) return;
    const rows = getRows(b), seen = new Set(), keep = [];
    let dups = 0;
    rows.forEach((it) => {
      const parts = cols.map((c) => keyPart(it.from, c));
      if (parts.every((x) => x === '')) { keep.push(it); return; }   // baris kosong bukan urusan perintah ini
      const key = parts.join('\u0001');
      if (seen.has(key)) dups++; else { seen.add(key); keep.push(it); }
    });
    const basis = q('sdDupCol').value === 'all' ? 'seluruh isi baris' : colsTxt(cols);
    if (!dups) { ok(`Tidak ada duplikat berdasarkan ${basis}.`); return; }
    A.pushUndo();
    writeRows(keep, b.last);
    done();
    ok(`${plural(dups, 'baris duplikat')} dihapus berdasarkan ${basis}; kemunculan pertama dipertahankan. Tersisa ${keep.length} baris data. (Huruf besar/kecil dan spasi di tepi tidak dibedakan.)`);
  });
  q('sdBlank').addEventListener('click', () => {
    const b = need(); if (!b) return;
    const v = q('sdBlankCol').value;
    const cols = v === 'allrow' ? null : colsOf(v, b);
    if (v !== 'allrow' && !cols) return;
    const rows = getRows(b);
    const isBlank = (it) => (cols
      ? cols.some((c) => String(it.cells[c] === undefined ? '' : it.cells[c]).trim() === '')
      : it.cells.every((t) => String(t).trim() === ''));
    const keep = rows.filter((it) => !isBlank(it)), n = rows.length - keep.length;
    const basis = cols ? `kosong di ${colsTxt(cols)}` : 'seluruh barisnya kosong';
    if (!n) { ok(`Tidak ada baris yang ${basis}.`); return; }
    A.pushUndo();
    writeRows(keep, b.last);
    done();
    ok(`${plural(n, 'baris')} dihapus (${basis}). Tersisa ${keep.length} baris data; baris di bawahnya naik mengisi tempatnya.`);
  });

  /* -------------------------------- Nilai hilang -------------------------------- */
  q('sdMOp').addEventListener('change', () => { q('sdMValWrap').style.display = q('sdMOp').value === 'value' ? '' : 'none'; });
  q('sdMApply').addEventListener('click', () => {
    const b = need(); if (!b) return;
    const op = q('sdMOp').value, tok = q('sdMTok').checked;
    const cols = colsOf(q('sdMCol').value, b); if (!cols) return;
    const miss = (r, c) => { const t = SH.raw(r, c); return t.charAt(0) !== '=' && isMissRaw(t, tok); };
    const rows = getRows(b);

    if (op === 'drop') {
      const keep = rows.filter((it) => !cols.some((c) => { const t = it.cells[c] === undefined ? '' : it.cells[c]; return t.charAt(0) !== '=' && isMissRaw(t, tok); }));
      const n = rows.length - keep.length;
      if (!n) { ok(`Tidak ada nilai hilang di ${colsTxt(cols)}.`); return; }
      A.pushUndo(); writeRows(keep, b.last); done();
      ok(`${plural(n, 'baris')} yang memiliki nilai hilang di ${colsTxt(cols)} dihapus. Tersisa ${keep.length} baris data.`);
      return;
    }

    let fillTxt = '';
    if (op === 'value') {
      fillTxt = A.normalizeInput(q('sdMVal').value).trim();
      if (fillTxt === '') { err('Isi “Nilai pengisi” dulu, mis. 0.'); return; }
    }
    const blankRow = new Set();   // baris yang seluruhnya kosong tidak diisi (itu urusan “Hapus baris kosong”)
    rows.forEach((it) => { if (it.cells.every((t) => String(t).trim() === '')) blankRow.add(it.from); });
    const plan = [], notes = [], skipped = [];
    let total = 0;
    cols.forEach((c) => {
      const miss0 = [], nums = [], seenTxt = [];
      for (let r = b.f; r <= b.last; r++) {
        if (miss(r, c)) { if (!blankRow.has(r)) miss0.push(r); continue; }
        const v = SH.cellVal(r, c);
        if (typeof v === 'number') nums.push(v);
        if (!isBlankVal(v) && !SH.isErr(v)) seenTxt.push(typeof v === 'number' ? String(v) : String(v).trim());
      }
      if (!miss0.length) return;
      const textish = seenTxt.length - nums.length;
      let fill = null, label = '';
      if (op === 'mean' || op === 'median') {
        if (!nums.length || nums.length < textish) { skipped.push(colName(c)); return; }
        if (op === 'mean') fill = fmtNum(nums.reduce((s, x) => s + x, 0) / nums.length);
        else { const s = nums.slice().sort((x, y) => x - y), m = s.length; fill = fmtNum(m % 2 ? s[(m - 1) / 2] : (s[m / 2 - 1] + s[m / 2]) / 2); }
        label = fill;
      } else if (op === 'mode') {
        if (!seenTxt.length) { skipped.push(colName(c)); return; }
        const cnt = new Map(); seenTxt.forEach((t) => cnt.set(t, (cnt.get(t) || 0) + 1));
        let best = null, bc = 0; cnt.forEach((n, t) => { if (n > bc) { bc = n; best = t; } });
        fill = best; label = best;
      } else if (op === 'value') { fill = fillTxt; label = fillTxt; }
      let n = 0, last = null;
      if (op === 'prev') {
        for (let r = b.f; r <= b.last; r++) {
          if (miss(r, c)) { if (last !== null && !blankRow.has(r)) { plan.push([r, c, last]); n++; } }
          else last = valText(r, c);
        }
        if (!n) { skipped.push(colName(c)); return; }
        notes.push(`${colName(c)}: ${n} sel`);
      } else {
        miss0.forEach((r) => { plan.push([r, c, fill]); n++; });
        notes.push(`${colName(c)}: ${n} sel → ${label}`);
      }
      total += n;
    });
    const skipTxt = skipped.length ? ` Dilewati: kolom ${skipped.join(', ')} (${op === 'mean' || op === 'median' ? 'bukan kolom angka' : op === 'prev' ? 'tidak ada nilai di atas sel yang hilang' : 'tidak ada nilai untuk dijadikan acuan'}).` : '';
    if (!plan.length) { (skipped.length ? err : ok)(`${skipped.length ? 'Tidak ada sel yang bisa diisi.' : 'Tidak ada nilai hilang pada ' + colsTxt(cols) + '.'}${skipTxt}`); return; }
    A.pushUndo();
    plan.forEach((p) => { S.cells[p[0]][p[1]] = p[2]; });
    done();
    ok(`${total} nilai hilang diisi (${notes.slice(0, 5).join('; ')}${notes.length > 5 ? '; …' : ''}).${skipTxt} Hasilnya nilai tetap, bukan rumus.`);
  });

  /* --------------------------------- Teks ke angka --------------------------------- */
  const ID_RE = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/, EN_RE = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
  function looseNum(src, fmt) {
    let s = String(src).replace(/[\u00A0\u2007\u202F\u200B]/g, ' ').trim();
    if (s.charAt(0) === "'") s = s.slice(1).trim();
    if (!s) return null;
    s = s.replace(/[\u2212\u2012\u2013\u2014]/g, '-');
    let neg = false, pct = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1).trim(); }
    if (/%$/.test(s)) { pct = true; s = s.slice(0, -1).trim(); }
    s = s.replace(/(?:rp\.?|idr|usd|eur|sgd|myr|us\$|[$€£¥])/gi, '').trim();
    if (s.charAt(0) === '-') { neg = true; s = s.slice(1).trim(); } else if (s.charAt(0) === '+') s = s.slice(1).trim();
    if (/-$/.test(s)) { neg = true; s = s.slice(0, -1).trim(); }
    if (/\s/.test(s)) { if (!/^\d{1,3}(?:\s\d{3})+(?:[.,]\d+)?$/.test(s)) return null; s = s.replace(/\s/g, ''); }
    if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
    let mode = fmt, amb = false;
    if (fmt === 'auto') {
      const nD = (s.match(/\./g) || []).length, nC = (s.match(/,/g) || []).length;
      if (nD && nC) mode = s.lastIndexOf(',') > s.lastIndexOf('.') ? 'id' : 'en';
      else if (nD) { if (nD > 1) mode = 'id'; else if (/^[1-9]\d{0,2}\.\d{3}$/.test(s)) { mode = 'id'; amb = true; } else mode = 'en'; }
      else if (nC) { if (nC > 1) mode = 'en'; else { mode = 'id'; if (/^[1-9]\d{0,2},\d{3}$/.test(s)) amb = true; } }
      else mode = 'id';
    }
    if (!(mode === 'id' ? ID_RE : EN_RE).test(s)) return null;
    let v = parseFloat(mode === 'id' ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''));
    if (!Number.isFinite(v)) return null;
    if (pct) v /= 100;
    if (neg) v = -v;
    return { v: +v.toPrecision(15), amb };
  }
  q('sdNum').addEventListener('click', () => {
    const b = need(); if (!b) return;
    const scope = q('sdNCol').value, fmt = q('sdNFmt').value;
    const cols = colsOf(scope, b); if (!cols) return;
    const plan = [], skippedCols = [], fails = [];
    let already = 0, amb = 0, naCells = 0;
    const convertedCols = new Set();
    cols.forEach((c) => {
      const loc = [], bad = [];
      let cand = 0, good = 0, alr = 0, na = 0;
      for (let r = b.f; r <= b.last; r++) {
        const t = SH.raw(r, c);
        if (t.trim() === '' || t.charAt(0) === '=') continue;
        const s = t.trim();
        if (MISS_TOK.has(s.toLowerCase())) { na++; continue; }       // NA, -, ? : bukan urusan konversi
        cand++;
        if (!Number.isNaN(SH.parseNum(t))) { good++; alr++; continue; }
        const res = looseNum(t, fmt);
        if (res) { loc.push([r, c, String(res.v), res.amb]); good++; } else bad.push(colName(c) + (r + 1));
      }
      // mode "semua kolom": lewati kolom yang kebanyakan teks (nama, kategori, dsb.)
      if (scope === 'all' && cand && good / cand < 0.5) { skippedCols.push(colName(c)); return; }
      already += alr; naCells += na;
      loc.forEach((p) => { plan.push(p); if (p[3]) amb++; });
      if (loc.length) convertedCols.add(colName(c));
      bad.forEach((a) => fails.push(a));
    });
    if (!plan.length) {
      err(fails.length
        ? `Tidak ada sel yang bisa diubah. ${fails.length} sel bukan angka yang dikenali (mis. ${fails.slice(0, 3).join(', ')}). Coba ganti “Format angka”.`
        : (already ? `Semua sel di ${colsTxt(cols)} sudah berupa angka; tidak ada yang perlu diubah.` : `Tidak ada teks yang bisa diubah menjadi angka di ${colsTxt(cols)}.`) + (skippedCols.length ? ` Kolom ${skippedCols.join(', ')} dilewati karena kebanyakan bukan angka.` : ''));
      return;
    }
    A.pushUndo();
    plan.forEach((p) => { S.cells[p[0]][p[1]] = p[2]; });
    done();
    const parts = [`${plan.length} sel teks diubah menjadi angka (kolom ${Array.from(convertedCols).join(', ')})`];
    if (already) parts.push(`${already} sel sudah berupa angka`);
    if (fails.length) parts.push(`${fails.length} sel tidak dikenali dan dibiarkan (mis. ${fails.slice(0, 3).join(', ')})`);
    if (naCells) parts.push(`${naCells} sel NA / “-” dibiarkan: tangani lewat “Nilai hilang”`);
    if (skippedCols.length) parts.push(`kolom ${skippedCols.join(', ')} dilewati karena kebanyakan teks`);
    ok(parts.join('. ') + '.' + (amb ? ` Catatan: ${amb} sel seperti “Rp 1.234” / “1,234 kg” bisa bermakna ribuan atau desimal; dibaca dengan aturan Indonesia (titik = ribuan, koma = desimal). Pilih “Format angka” bila maksudnya lain.` : ''));
  });

  /* ---------------------------------- Teks ke kolom ---------------------------------- */
  q('sdSpDel').addEventListener('change', () => { q('sdSpOtherWrap').style.display = q('sdSpDel').value === 'other' ? '' : 'none'; });
  function insertColsRaw(at, n) {
    S.cells.forEach((row) => row.splice(at, 0, ...new Array(n).fill('')));
    S.C += n;
    if (S.C > A.MAX_C) { S.cells.forEach((row) => { row.length = A.MAX_C; }); S.C = A.MAX_C; }
    A.adjustAll('c', 'ins', at, n);
  }
  q('sdSplit').addEventListener('click', () => {
    const b = need(); if (!b) return;
    const c = +q('sdSpCol').value, key = q('sdSpDel').value, merge = q('sdSpMerge').checked;
    let d = DELIMS.find((x) => x[0] === key)[1];
    if (key === 'other') { d = q('sdSpOther').value; if (d === '') { err('Ketik pemisahnya dulu di kotak “Pemisah lain”.'); return; } }
    const parts = {};
    let n = 0;
    for (let r = b.f; r <= b.last; r++) {
      if (SH.raw(r, c).trim() === '') continue;
      const t = valText(r, c);
      let p = (d === ' ' && merge) ? t.trim().split(/\s+/) : t.split(d);
      if (merge && d !== ' ') p = p.filter((x) => x !== '');
      p = p.map((x) => x.trim());
      parts[r] = p; if (p.length > n) n = p.length;
    }
    const dName = key === 'other' ? `“${d}”` : DELIMS.find((x) => x[0] === key)[2].replace(/ \(.*\)/, '').toLowerCase();
    if (n < 2) { err(`Tidak ditemukan pemisah ${dName} pada ${colLabel(c).split(' - ')[0].toLowerCase()}. Pilih pemisah lain.`); return; }
    const add = n - 1;
    if (b.C + add > A.MAX_C) { err(`Butuh ${add} kolom baru, tetapi lembar hanya memuat ${A.MAX_C} kolom (terpakai ${b.C}).`); return; }
    A.pushUndo();
    insertColsRaw(c + 1, add);
    const base = S.header && SH.raw(0, c).charAt(0) !== '=' && SH.raw(0, c).trim() ? SH.raw(0, c).trim() : colName(c);
    Object.keys(parts).forEach((r) => {
      const p = parts[r];
      for (let k = 0; k < n; k++) S.cells[r][c + k] = A.normalizeInput(p[k] === undefined ? '' : p[k]);
    });
    if (S.header) for (let k = 1; k < n; k++) S.cells[0][c + k] = base + '_' + (k + 1);
    done();
    ok(`${colLabel(c).split(' - ')[0]} dipecah menjadi ${n} kolom (${colName(c)}-${colName(c + add)}) menurut pemisah ${dName}. Kolom di kanannya bergeser dan rumus ikut menyesuaikan.${S.header ? ' Judul kolom baru diberi akhiran _2, _3, dst.' : ''} Bila hasilnya angka berformat teks, lanjutkan dengan “Teks jadi angka”.`);
  });
})();
