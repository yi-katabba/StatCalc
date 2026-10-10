/* =========================================================================
   EXPORT HASIL — unduh hasil metode Stat sebagai .docx + grafik pendukung
   -------------------------------------------------------------------------
   Muat SETELAH graph-core.js dan stat-charts.js. Tanpa pustaka luar:
   berkas .docx (OOXML) dan .zip dibuat langsung di peramban.

   Dipanggil dari tiap modul Stat setelah perhitungan selesai:

     StatExport.publish({
       id: 'anova',                         // unik per metode
       title: 'ANOVA Satu Arah',            // judul dokumen
       anchor: '#an-conclusion-card',       // panel ekspor disisipkan SETELAH elemen ini
       resultsCard: '#an-results-card',     // (opsional) tombol ringkas ditambahkan di sini
       meta: [['Jenis analisis', '...'], ...],        // tabel "Pengaturan analisis"
       sections: [{ heading: 'Statistik Kelompok', sel: '#anDescWrap' }, ...],  // hasil di halaman
       charts: [{ title, caption, svg | build: () => svg }, ...],
       data: { head: [...], rows: [[...]], caption: '...' },                    // lampiran data input
     });

   Panel grafik punya pita (Warna, Garis kisi) lewat StatRibbon.mount(host); gaya disimpan per metode
   (STYLE) dan dipakai saat grafik dibangun ulang, juga untuk .docx. Pemilih "Terapkan ke" memilih Semua grafik atau satu grafik. Tombol Setel ulang (ikon panah putar) ada di tiap tab pita.

   Isi sections diambil dari DOM halaman (tabel, rumus, hipotesis, kesimpulan),
   sehingga dokumen selalu sama dengan yang tampil di layar.
   ========================================================================= */
(function () {
  'use strict';
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const enc = new TextEncoder();

  /* ----------------------------- ZIP (tanpa kompresi) ----------------------------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    const d = new Date();
    const dosT = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosD = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const parts = [], central = [];
    let off = 0;
    files.forEach((f) => {
      const name = enc.encode(f.name), data = f.data, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosT, true); lh.setUint16(12, dosD, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dosT, true); ch.setUint16(14, dosD, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + data.length;
    });
    const csize = central.reduce((s, a) => s + a.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, off, true);
    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0));
    let p = 0; all.forEach((a) => { out.set(a, p); p += a.length; });
    return out;
  }

  /* ----------------------------- SVG -> PNG ----------------------------- */
  function svgSize(svg) { const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); return { w: m ? +m[1] : 640, h: m ? +m[2] : 400 }; }
  function svgSized(svg) { const z = svgSize(svg); return svg.replace('<svg ', `<svg width="${z.w}" height="${z.h}" `); }
  function svgToPng(svg, scale) {
    scale = scale || 2;
    const z = svgSize(svg);
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svgSized(svg)], { type: 'image/svg+xml;charset=utf-8' }));
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = Math.round(z.w * scale); c.height = Math.round(z.h * scale);
        const g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => {
          if (!b) { reject(new Error('png')); return; }
          b.arrayBuffer().then((buf) => resolve({ bytes: new Uint8Array(buf), w: c.width, h: c.height, blob: b }), reject);
        }, 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('png')); };
      img.src = url;
    });
  }
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  /* ----------------------------- OOXML helpers ----------------------------- */
  const X = (s) => String(s === null || s === undefined ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const FONT = 'Calibri', MONO = 'Consolas';

  function run(text, st) {
    st = st || {};
    let pr = '';
    if (st.mono) pr += `<w:rFonts w:ascii="${MONO}" w:hAnsi="${MONO}" w:cs="${MONO}"/>`;
    if (st.b) pr += '<w:b/>';
    if (st.i) pr += '<w:i/>';
    if (st.color) pr += `<w:color w:val="${st.color}"/>`;
    if (st.size) pr += `<w:sz w:val="${st.size}"/><w:szCs w:val="${st.size}"/>`;
    if (st.sup) pr += '<w:vertAlign w:val="superscript"/>';
    if (st.sub) pr += '<w:vertAlign w:val="subscript"/>';
    const rpr = pr ? `<w:rPr>${pr}</w:rPr>` : '';
    return String(text).split('\n').map((ln, i) => (i ? `<w:r>${rpr}<w:br/></w:r>` : '') + (ln === '' ? '' : `<w:r>${rpr}<w:t xml:space="preserve">${X(ln)}</w:t></w:r>`)).join('');
  }
  function para(runs, o) {
    o = o || {};
    let pp = '';
    if (o.style) pp += `<w:pStyle w:val="${o.style}"/>`;
    if (o.keepNext) pp += '<w:keepNext/>';
    if (o.shade) pp += `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>`;
    if (o.after !== undefined || o.before !== undefined) pp += `<w:spacing${o.before !== undefined ? ` w:before="${o.before}"` : ''}${o.after !== undefined ? ` w:after="${o.after}"` : ''}/>`;
    if (o.ind) pp += `<w:ind w:left="${o.ind}"${o.hang ? ` w:hanging="${o.hang}"` : ''}/>`;
    if (o.align) pp += `<w:jc w:val="${o.align}"/>`;
    return `<w:p>${pp ? `<w:pPr>${pp}</w:pPr>` : ''}${runs}</w:p>`;
  }

  /* --- inline DOM -> runs --- */
  const SKIP = { SVG: 1, CANVAS: 1, SCRIPT: 1, STYLE: 1, BUTTON: 1, INPUT: 1, SELECT: 1, TEXTAREA: 1, NAV: 1 };
  function inline(node, st) {
    let out = '';
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) { const t = c.nodeValue.replace(/[ \t\r\n]+/g, ' '); if (t) out += run(t, st); return; }
      if (c.nodeType !== 1 || SKIP[c.tagName.toUpperCase()] || c.hidden) return;
      const tag = c.tagName.toLowerCase();
      if (tag === 'br') { out += `<w:r><w:br/></w:r>`; return; }
      const ns = Object.assign({}, st);
      if (tag === 'strong' || tag === 'b' || tag === 'th') ns.b = true;
      if (tag === 'em' || tag === 'i') ns.i = true;
      if (tag === 'sub') ns.sub = true;
      if (tag === 'sup') ns.sup = true;
      if (tag === 'code' || c.classList.contains('formula')) ns.mono = true;
      out += inline(c, ns);
    });
    return out;
  }
  const BLOCK = /^(p|div|table|h[1-6]|ul|ol|li|pre|section|figure|blockquote|details|main|article)$/i;
  const hasBlock = (el) => Array.from(el.children).some((c) => BLOCK.test(c.tagName) || hasBlock(c));
  const plain = (el) => el.textContent.replace(/\s+/g, ' ').trim();
  const NOTE = ['test-note', 'test-sub', 'hint', 'chart-note', 'gr-note', 'field-note'];

  /* --- tabel --- */
  const PAGE_W = 9026;
  function tableXml(rows, o) {
    /* rows: [{cells:[{xml, span, vspan, head, align, fill}], head:boolean}] ; o:{fontSize,firstColLeft} */
    o = o || {};
    let cols = 0;
    rows.forEach((r) => { cols = Math.max(cols, r.cells.reduce((s, c) => s + (c.span || 1), 0)); });
    if (!cols) return '';
    const sz = o.size || (cols > 9 ? 14 : cols > 6 ? 16 : cols > 4 ? 18 : 20);
    const gw = Math.floor(PAGE_W / cols);
    let carry = new Array(cols).fill(0), x = '';
    rows.forEach((r) => {
      let col = 0, cells = '';
      const place = (c) => {
        while (col < cols && carry[col] > 0) { cells += `<w:tc><w:tcPr><w:tcW w:w="${gw}" w:type="dxa"/><w:vMerge/></w:tcPr><w:p/></w:tc>`; carry[col]--; col++; }
        if (!c) return;
        const span = Math.min(c.span || 1, cols - col) || 1;
        let pr = `<w:tcW w:w="${gw * span}" w:type="dxa"/>`;
        if (span > 1) pr += `<w:gridSpan w:val="${span}"/>`;
        if ((c.vspan || 1) > 1) { pr += '<w:vMerge w:val="restart"/>'; for (let k = 0; k < span; k++) carry[col + k] = c.vspan - 1; }
        const fill = c.fill || (c.head ? 'E4EAF0' : null);
        if (fill) pr += `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`;
        pr += '<w:vAlign w:val="center"/>';
        const al = c.align || (c.head ? 'center' : 'left');
        cells += `<w:tc><w:tcPr>${pr}</w:tcPr><w:p><w:pPr><w:spacing w:before="30" w:after="30"/><w:jc w:val="${al}"/></w:pPr>${c.xml || ''}</w:p></w:tc>`;
        col += span;
      };
      r.cells.forEach((c) => place(c));
      place(null);
      x += `<w:tr>${r.head ? '<w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'}${cells}</w:tr>`;
      carry = carry.map((v, i) => (i < col ? v : v)); // sisa rowSpan terbawa ke baris berikut
    });
    const bd = (n) => `<w:${n} w:val="single" w:sz="4" w:space="0" w:color="B8B29C"/>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="${PAGE_W}" w:type="dxa"/><w:tblBorders>${bd('top')}${bd('left')}${bd('bottom')}${bd('right')}${bd('insideH')}${bd('insideV')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${gw}"/>`).join('')}</w:tblGrid>${x}</w:tbl>` + para('', { after: 80 });
  }
  const NUMRE = /^[\s+\-\u2212\u2013]?[\d.,]+(e[+-]?\d+)?\s*%?$/i;
  function domTable(t) {
    const cap = t.querySelector('caption');
    const rows = [];
    const trs = [];
    ['thead', 'tbody', 'tfoot'].forEach((sec) => { $$(':scope > ' + sec + ' > tr', t).forEach((tr) => trs.push({ tr, sec })); });
    $$(':scope > tr', t).forEach((tr) => trs.push({ tr, sec: 'tbody' }));
    let nCols = 0;
    trs.forEach(({ tr, sec }) => {
      const cells = [];
      Array.from(tr.children).forEach((c) => {
        if (!/^(td|th)$/i.test(c.tagName)) return;
        const isTh = c.tagName.toLowerCase() === 'th', head = sec === 'thead';
        const txt = plain(c);
        cells.push({
          xml: inline(c, { b: isTh || sec === 'tfoot' || undefined }), span: parseInt(c.getAttribute('colspan') || '1', 10) || 1,
          vspan: parseInt(c.getAttribute('rowspan') || '1', 10) || 1, head,
          fill: !head && isTh ? 'F1EFE4' : sec === 'tfoot' ? 'F6F3E8' : null,
          align: head ? 'center' : (!isTh && NUMRE.test(txt) ? 'right' : 'left'),
        });
      });
      if (cells.length) rows.push({ cells, head: sec === 'thead' });
      nCols = Math.max(nCols, cells.reduce((s, c) => s + c.span, 0));
    });
    let out = '';
    if (cap) out += para(run(plain(cap), { b: true, size: 20 }), { keepNext: true, before: 120, after: 60 });
    return out + tableXml(rows);
  }
  function kvTable(pairs, head) {
    const rows = [];
    if (head) rows.push({ head: true, cells: head.map((h) => ({ xml: run(h, { b: true }), head: true })) });
    pairs.forEach((p) => rows.push({ cells: [{ xml: run(p[0], { b: true }), fill: 'F1EFE4' }, { xml: run(String(p[1])) }] }));
    return tableXml(rows, { size: 20 });
  }
  function statCardsTable(cards) {
    let out = '';
    for (let i = 0; i < cards.length; i += 4) {
      const ch = cards.slice(i, i + 4);
      out += tableXml([
        { head: true, cells: ch.map((c) => ({ xml: run(plain($('.k', c) || c), { b: true, size: 18 }), head: true })) },
        { cells: ch.map((c) => ({ xml: run(plain($('.v', c) || c), { b: true, size: 22 }), align: 'center' })) },
      ], { size: 20 });
    }
    return out;
  }

  /* --- walker blok --- */
  function blocks(root) {
    let out = '', buf = '';
    const flush = () => { if (buf.replace(/<[^>]+>/g, '').trim()) out += para(buf); buf = ''; };
    root.childNodes.forEach((c) => {
      if (c.nodeType === 3) { const t = c.nodeValue.replace(/[ \t\r\n]+/g, ' '); if (t.trim() || buf) buf += run(t); return; }
      if (c.nodeType !== 1) return;
      const tag = c.tagName.toLowerCase();
      if (SKIP[tag.toUpperCase()] || c.hidden) return;
      if (!BLOCK.test(tag)) { buf += inline({ childNodes: [c] }, {}); return; }
      flush();
      const cl = c.classList;
      if (/^h[1-6]$/.test(tag)) {
        const lv = +tag[1];
        out += para(inline(c, {}), { style: lv <= 2 ? 'Heading1' : lv === 3 ? 'Heading2' : 'Heading3', keepNext: true });
      } else if (tag === 'table') out += domTable(c);
      else if (tag === 'ul' || tag === 'ol') {
        $$(':scope > li', c).forEach((li, i) => { out += para(run(tag === 'ul' ? '\u2022\t' : (i + 1) + '.\t') + inline(li, {}), { ind: 360, hang: 360, after: 40 }); });
      } else if (cl.contains('stat-grid') || cl.contains('test-stat-row')) {
        const cards = $$('.stat-card', c); if (cards.length) out += statCardsTable(cards);
      } else if (cl.contains('stat-card')) out += statCardsTable([c]);
      else if (cl.contains('hyp-box')) {
        $$('.hyp-row', c).forEach((r) => { const tg = $('.hyp-tag', r), tx = $('.hyp-text', r); out += para(run((tg ? plain(tg) : '') + ' ', { b: true }) + (tx ? inline(tx, {}) : ''), { ind: 360, hang: 360, after: 40, shade: 'F6F3E8' }); });
      } else if (cl.contains('test-verdict')) {
        out += para(run(plain(c), { b: true, color: cl.contains('ok') ? '1F6B3A' : cl.contains('bad') ? '9A2F1B' : '1C1E24' }), { shade: cl.contains('ok') ? 'DFEEE3' : cl.contains('bad') ? 'F6E0DA' : 'EFEAD9', before: 60, after: 100 });
      } else if (tag === 'pre' || cl.contains('formula') || cl.contains('matrix')) {
        out += para(run(c.textContent.replace(/\s+$/g, ''), { mono: true, size: 19 }), { style: 'Formula' });
      } else if (tag === 'p' || (tag === 'div' && !hasBlock(c))) {
        const x = inline(c, NOTE.some((n) => cl.contains(n)) ? { i: true, color: '52565F' } : {});
        if (x.replace(/<[^>]+>/g, '').trim()) out += para(x, { after: 100 });
      } else if (tag === 'li') out += para(run('\u2022\t') + inline(c, {}), { ind: 360, hang: 360, after: 40 });
      else out += blocks(c);
    });
    flush();
    return out;
  }

  /* ----------------------------- Susun dokumen ----------------------------- */
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:eastAsia="${FONT}" w:cs="${FONT}"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr><w:rPr><w:b/><w:color w:val="22384A"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="6" w:color="BD7E1F"/></w:pBdr><w:spacing w:after="240"/></w:pPr><w:rPr><w:color w:val="52565F"/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="100"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="22384A"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="22384A"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="2F7F79"/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="40" w:after="200"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:color w:val="52565F"/><w:sz w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Formula"><w:name w:val="Formula"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F6F3E8"/><w:spacing w:before="40" w:after="120" w:line="240" w:lineRule="auto"/><w:ind w:left="200"/></w:pPr><w:rPr><w:rFonts w:ascii="${MONO}" w:hAnsi="${MONO}" w:cs="${MONO}"/><w:sz w:val="19"/></w:rPr></w:style>
</w:styles>`;
  const CT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const FOOTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:color w:val="948C77"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">StatCalc \u2014 halaman </w:t></w:r><w:r><w:rPr><w:color w:val="948C77"/><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:color w:val="948C77"/><w:sz w:val="18"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:color w:val="948C77"/><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:color w:val="948C77"/><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:color w:val="948C77"/><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;

  const TGL = () => new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); };

  function imageXml(n, rid, wEmu, hEmu, descr) {
    return `<w:p><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="40"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${wEmu}" cy="${hEmu}"/><wp:docPr id="${n}" name="Grafik ${n}" descr="${X(descr)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="grafik${n}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${wEmu}" cy="${hEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }

  async function buildDocx(spec) {
    const charts = resolveCharts(spec.charts, spec.id);
    let body = para(run(spec.title), { style: 'Title' }) +
      para(run('Dibuat dengan StatCalc \u2022 ' + TGL()), { style: 'Subtitle' });
    if (spec.meta && spec.meta.length) body += para(run('Pengaturan analisis'), { style: 'Heading1' }) + kvTable(spec.meta);
    (spec.sections || []).forEach((sec) => {
      const el = typeof sec.sel === 'string' ? $(sec.sel) : sec.el;
      if (!el) return;
      const xml = blocks(el);
      if (!xml.trim()) return;
      body += para(run(sec.heading), { style: 'Heading1' }) + xml;
    });
    const media = [], rels = [];
    if (charts.length) {
      body += para(run('Grafik Pendukung'), { style: 'Heading1' });
      let n = 0;
      for (const ch of charts) {
        n++;
        try {
          const png = await svgToPng(ch.svg, 2);
          const wEmu = 5760000, hEmu = Math.round(wEmu * png.h / png.w);
          const rid = 'rId' + (10 + n);
          media.push({ name: 'word/media/grafik' + n + '.png', data: png.bytes });
          rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/grafik${n}.png"/>`);
          body += imageXml(n, rid, wEmu, hEmu, ch.title) +
            para(run('Gambar ' + n + '. ' + ch.title + '.', { b: true }) + (ch.caption ? run(' ' + ch.caption) : ''), { style: 'Caption' });
        } catch (e) {
          body += para(run('[Grafik \u201C' + ch.title + '\u201D tidak dapat dibuat di peramban ini.]', { i: true }));
        }
      }
    }
    if (spec.data && spec.data.rows && spec.data.rows.length) {
      const MAXR = 400, rows = spec.data.rows.slice(0, MAXR);
      body += para(run('Lampiran: Data Input'), { style: 'Heading1' });
      if (spec.data.caption) body += para(run(spec.data.caption, { i: true, color: '52565F' }));
      const trs = [{ head: true, cells: spec.data.head.map((h) => ({ xml: run(String(h), { b: true }), head: true })) }]
        .concat(rows.map((r) => ({ cells: r.map((v) => ({ xml: run(v === null || v === undefined ? '' : String(v)), align: 'right' })) })));
      body += tableXml(trs);
      if (spec.data.rows.length > MAXR) body += para(run('Hanya ' + MAXR + ' baris pertama dari ' + spec.data.rows.length + ' baris yang ditampilkan.', { i: true }));
    }
    const sect = `<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1304" w:right="1440" w:bottom="1304" w:left="1440" w:header="708" w:footer="567" w:gutter="0"/></w:sectPr>`;
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}${sect}</w:body></w:document>`;
    const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${rels.join('')}</Relationships>`;
    const iso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(spec.title)}</dc:title><dc:creator>StatCalc</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created></cp:coreProperties>`;
    const files = [
      { name: '[Content_Types].xml', data: enc.encode(CT) },
      { name: '_rels/.rels', data: enc.encode(RELS) },
      { name: 'docProps/core.xml', data: enc.encode(core) },
      { name: 'word/document.xml', data: enc.encode(doc) },
      { name: 'word/styles.xml', data: enc.encode(STYLES) },
      { name: 'word/footer1.xml', data: enc.encode(FOOTER) },
      { name: 'word/_rels/document.xml.rels', data: enc.encode(docRels) },
    ].concat(media);
    return new Blob([zip(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  /* Gaya grafik (pita Warna / Garis kisi) disimpan per metode. Selama belum diubah (dirty=false) grafik
     digambar dengan tampilan bawaan. Gaya diterapkan ke GraphCore.u.ST hanya selama grafik dibangun,
     lalu dikembalikan, sehingga halaman Graph tidak terpengaruh. Berlaku juga untuk grafik di .docx. */
  /* STYLE[id] = { target: 'all' | indeks grafik, all: gaya untuk semua grafik, per: { indeks: gaya khusus satu grafik } } */
  const STYLE = {};
  const DEF_STYLE = () => ({ dirty: false, c1: '#22384A', c2: '#BD7E1F', pal: 'bawaan', bg: '#ffffff', h: true, v: 'auto', gc: '#E6E0CC' });
  const newState = () => ({ target: 'all', all: DEF_STYLE(), per: {} });
  const styleFor = (id, i) => { const S = STYLE[id]; return (S && (S.per[i] || S.all)) || null; };
  function withStyle(id, i, fn) {
    const gu = window.GraphCore && window.GraphCore.u, st = styleFor(id, i);
    if (!gu || !st || !st.dirty) return fn();
    Object.assign(gu.ST, {
      on: true, h: st.h, v: st.v === 'auto' ? null : st.v === 'on',
      gc: st.gc, c1: st.c1, c2: st.c2, bg: st.bg, pal: gu.PALETTES[st.pal] || gu.PAL,
    });
    try { return fn(); } finally { gu.resetST(); }
  }
  function resolveCharts(list, id) {
    const out = [];
    (list || []).forEach((c, i) => {
      try {
        const svg = c.svg || (c.build ? withStyle(id, i, c.build) : null);
        if (svg) out.push({ title: c.title, caption: c.caption || '', svg });
      } catch (e) { console.warn('Grafik dilewati:', c.title, e); }
    });
    return out;
  }

  /* ----------------------------- Panel di halaman ----------------------------- */
  const style = document.createElement('style');
  style.textContent = `
    .ex-bar{ display:flex; flex-wrap:wrap; align-items:center; gap:10px 16px; margin:4px 0 14px; padding:10px 14px; border:1px solid var(--rule); border-radius:var(--radius); background:var(--accent-soft); }
    .ex-bar a{ font-size:13.5px; font-weight:600; color:var(--accent); }
    .ex-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr)); gap:18px; margin-top:16px; }
    .ex-fig{ margin:0; border:1px solid var(--rule); border-radius:var(--radius); background:#fff; overflow:hidden; display:flex; flex-direction:column; }
    .ex-fig .ex-chart svg{ display:block; width:100%; height:auto; }
    .ex-fig figcaption{ padding:10px 14px 4px; font-size:13px; color:var(--ink-soft); }
    .ex-fig figcaption strong{ display:block; color:var(--ink); font-size:14px; margin-bottom:2px; }
    .ex-fig .control-row{ padding:6px 14px 14px; margin:0; }
    .ex-status{ margin:10px 0 0; font-size:13.5px; }
    .ex-rib{ margin:14px 0 0; }
    .ex-rib .rb-main{ box-shadow:none; margin:0; }
  `;
  document.head.appendChild(style);

  const STORE = {};
  function status(panel, msg, bad) {
    const p = $('.ex-status', panel);
    p.textContent = msg; p.hidden = !msg;
    p.className = 'ex-status ' + (bad ? 'error-msg' : 'imp-ok');
  }
  async function doDocx(id, trigger) {
    const spec = STORE[id];
    if (!spec) return;
    const panel = $('#ex-panel-' + id);
    const btns = $$('[data-ex="docx"]', document).filter((b) => b.dataset.exId === id);
    btns.forEach((b) => { b.disabled = true; });
    status(panel, 'Menyusun dokumen Word\u2026');
    try {
      const blob = await buildDocx(spec);
      saveBlob(blob, 'StatCalc-' + id + '-' + stamp() + '.docx');
      status(panel, 'Dokumen .docx berhasil dibuat dan diunduh.');
    } catch (e) {
      console.error(e);
      status(panel, 'Dokumen tidak dapat dibuat: ' + (e && e.message ? e.message : 'kesalahan tak dikenal') + '.', true);
    } finally { btns.forEach((b) => { b.disabled = false; }); }
  }
  async function doZip(id) {
    const spec = STORE[id], panel = $('#ex-panel-' + id);
    status(panel, 'Menyiapkan arsip grafik\u2026');
    try {
      const files = [];
      let n = 0;
      for (const ch of spec.resolved) {
        n++;
        const png = await svgToPng(ch.svg, 2);
        const nm = String(n).padStart(2, '0') + '-' + ch.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
        files.push({ name: nm + '.png', data: png.bytes });
        files.push({ name: nm + '.svg', data: enc.encode(svgSized(ch.svg)) });
      }
      saveBlob(new Blob([zip(files)], { type: 'application/zip' }), 'StatCalc-' + id + '-grafik-' + stamp() + '.zip');
      status(panel, 'Arsip grafik (PNG + SVG) berhasil diunduh.');
    } catch (e) { status(panel, 'Arsip grafik tidak dapat dibuat di peramban ini. Unduh grafik satu per satu sebagai SVG.', true); }
  }
  async function doFig(id, i, kind) {
    const spec = STORE[id], ch = spec.resolved[i], panel = $('#ex-panel-' + id);
    const nm = 'StatCalc-' + id + '-' + String(i + 1).padStart(2, '0');
    if (kind === 'svg') { saveBlob(new Blob([svgSized(ch.svg)], { type: 'image/svg+xml;charset=utf-8' }), nm + '.svg'); return; }
    try { const png = await svgToPng(ch.svg, 2); saveBlob(png.blob, nm + '.png'); }
    catch (e) { status(panel, 'Peramban ini tidak dapat membuat PNG. Gunakan Unduh SVG.', true); }
  }

  /* ---- pita Warna / Garis kisi untuk grafik pendukung ---- */
  const sid = (id, k) => 'exs-' + id + '-' + k;
  function curStyle(id) { const S = STYLE[id]; return S.target === 'all' ? S.all : (S.per[S.target] || S.all); }
  function mountRibbon(id, panel) {
    const slot = $('[data-rib-slot]', panel);
    if (!slot || !window.StatRibbon || !window.GraphCore) return;
    const gu = window.GraphCore.u, S = STYLE[id], spec = STORE[id];
    if (S.target !== 'all' && !spec.resolved[S.target]) S.target = 'all';
    const st = curStyle(id);
    const opts = [['all', 'Semua grafik']].concat(spec.charts.map((c, i) => [String(i), (i + 1) + '. ' + c.title]));
    const tgt = (k) => ({ label: 'Terapkan ke', cols: 1, items: [{ type: 'select', id: sid(id, k), label: 'Grafik yang diubah', options: opts, selected: String(S.target) }] });
    const tabs = [
      { id: 'warna', label: 'Warna', groups: [
        tgt('tw'),
        { label: 'Warna data', cols: 1, items: [
          { type: 'color', id: sid(id, 'c1'), label: 'Warna utama (titik, batang, histogram)', def: st.c1 },
          { type: 'color', id: sid(id, 'c2'), label: 'Warna garis sorotan (regresi, kurva, rata-rata)', def: st.c2 },
        ] },
        { label: 'Palet warna', cols: 1, items: [{ type: 'select', id: sid(id, 'pal'), label: 'Palet (grafik banyak warna)', options: Object.keys(gu.PALETTES).map((k) => [k, gu.PALETTE_LABEL[k]]), selected: st.pal }] },
        { label: 'Latar', cols: 1, items: [{ type: 'color', id: sid(id, 'bg'), label: 'Warna latar grafik', def: st.bg }] },
        { label: 'Setel ulang', cols: 1, items: [{ type: 'button', act: 'warna', icon: 'reset', label: 'Setel ulang warna' }] },
      ], tip: 'Pilih &ldquo;Semua grafik&rdquo; untuk mengubah semuanya sekaligus (pengaturan khusus per grafik ikut ditimpa), atau satu grafik saja. Perubahan ikut ke PNG/SVG/ZIP dan berkas .docx.' },
      { id: 'kisi', label: 'Garis kisi', groups: [
        tgt('tk'),
        { label: 'Tampilkan', cols: 1, items: [
          { type: 'select', id: sid(id, 'gh'), label: 'Garis horizontal', options: [['on', 'Tampil'], ['off', 'Sembunyi']], selected: st.h ? 'on' : 'off' },
          { type: 'select', id: sid(id, 'gv'), label: 'Garis vertikal', options: [['auto', 'Otomatis (sesuai jenis grafik)'], ['on', 'Tampil'], ['off', 'Sembunyi']], selected: st.v },
        ] },
        { label: 'Gaya', cols: 1, items: [{ type: 'color', id: sid(id, 'gc'), label: 'Warna garis kisi', def: st.gc }] },
        { label: 'Setel ulang', cols: 1, items: [{ type: 'button', act: 'kisi', icon: 'reset', label: 'Setel ulang kisi' }] },
      ], tip: 'Garis vertikal &ldquo;Otomatis&rdquo; mengikuti bawaan tiap jenis grafik (scatter &amp; Q-Q berkisi vertikal; histogram dan batang tidak).' },
    ];
    window.StatRibbon.mount({ view: '#ex-panel-' + id, key: 'ex-' + id, host: slot, tabs, onChange: (e) => onRibbon(id, e), onAction: (act) => resetPart(id, act) });
  }
  const rTimers = {};
  const gEl = (id, k) => document.getElementById(sid(id, k));
  function loadInputs(id) {
    const st = curStyle(id), set = (k, v) => { const el = gEl(id, k); if (el) el.value = v; };
    set('c1', st.c1); set('c2', st.c2); set('pal', st.pal); set('bg', st.bg); set('gh', st.h ? 'on' : 'off'); set('gv', st.v); set('gc', st.gc);
  }
  function onRibbon(id, e) {
    const S = STYLE[id], tid = e && e.target && e.target.id;
    if (tid === sid(id, 'tw') || tid === sid(id, 'tk')) {            /* ganti grafik yang diubah: muat nilainya, tanpa menggambar ulang */
      S.target = e.target.value;
      ['tw', 'tk'].forEach((k) => { const el = gEl(id, k); if (el) el.value = S.target; });
      loadInputs(id);
      return;
    }
    clearTimeout(rTimers[id]);
    rTimers[id] = setTimeout(() => {
      if (!gEl(id, 'c1')) return;
      const v = { dirty: true, c1: gEl(id, 'c1').value, c2: gEl(id, 'c2').value, pal: gEl(id, 'pal').value, bg: gEl(id, 'bg').value, h: gEl(id, 'gh').value === 'on', v: gEl(id, 'gv').value, gc: gEl(id, 'gc').value };
      if (S.target === 'all') { S.all = v; S.per = {}; } else S.per[S.target] = v;
      redraw(id);
    }, 40);
  }
  function redraw(id) {
    const spec = STORE[id], panel = $('#ex-panel-' + id);
    if (!spec || !panel) return;
    spec.resolved = resolveCharts(spec.charts, id);
    const holders = $$('.ex-fig .ex-chart', panel);
    if (holders.length !== spec.resolved.length) { publish(spec); return; }
    holders.forEach((h, i) => { h.innerHTML = spec.resolved[i].svg; });
  }
  /* Setel ulang satu bagian (warna atau kisi) pada grafik yang sedang dipilih di pemilih "Terapkan ke" */
  const PART = { warna: ['c1', 'c2', 'pal', 'bg'], kisi: ['h', 'v', 'gc'] };
  function resetPart(id, part) {
    const S = STYLE[id], d = DEF_STYLE(), keys = PART[part];
    if (!keys) return;
    const apply = (st) => { keys.forEach((k) => { st[k] = d[k]; }); return st; };
    if (S.target === 'all') { apply(S.all); Object.keys(S.per).forEach((i) => apply(S.per[i])); }
    else S.per[S.target] = apply(Object.assign({}, S.per[S.target] || S.all, { dirty: true }));
    loadInputs(id);
    redraw(id);
  }

  function publish(spec) {
    const id = spec.id;
    if (!STYLE[id]) STYLE[id] = newState();
    spec.resolved = resolveCharts(spec.charts, id);
    STORE[id] = spec;
    const anchor = $(spec.anchor);
    if (!anchor) { console.warn('StatExport: anchor tidak ditemukan', spec.anchor); return; }
    let panel = $('#ex-panel-' + id);
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'card step-card ex-panel';
      panel.id = 'ex-panel-' + id;
      panel.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ex]');
        if (!b) return;
        const k = b.dataset.ex;
        if (k === 'docx') doDocx(id);
        else if (k === 'zip') doZip(id);
        else if (k === 'png' || k === 'svg') doFig(id, +b.dataset.i, k);
      });
      panel.innerHTML = '<div class="ex-dyn"></div>';
      anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    }
    const dyn = $('.ex-dyn', panel);
    const figs = spec.resolved.map((c, i) => `
      <figure class="ex-fig">
        <div class="ex-chart">${c.svg}</div>
        <figcaption><strong>${X(c.title)}</strong>${c.caption ? X(c.caption) : ''}</figcaption>
        <div class="control-row">
          <button type="button" class="btn-ghost" data-ex="png" data-i="${i}">Unduh PNG</button>
          <button type="button" class="btn-ghost" data-ex="svg" data-i="${i}">Unduh SVG</button>
        </div>
      </figure>`).join('');
    panel.hidden = false;
    dyn.innerHTML = `
      <div class="step-tag">Ekspor</div>
      <h2>Grafik Pendukung &amp; Unduh Hasil</h2>
      <p class="hint">Grafik dibuat dari data yang baru dihitung. Unduh tiap grafik sebagai PNG/SVG, atau unduh <strong>seluruh hasil</strong> (pengaturan, tabel, uji, kesimpulan, grafik, dan data input) dalam satu dokumen Word.</p>
      <div class="control-row">
        <button type="button" class="btn-primary" data-ex="docx" data-ex-id="${id}">Unduh Hasil (.docx)</button>
        ${spec.resolved.length ? '<button type="button" class="btn-ghost" data-ex="zip">Unduh semua grafik (.zip)</button>' : ''}
      </div>
      <p class="ex-status" hidden></p>
      ${spec.resolved.length ? '<div class="ex-rib" data-rib-slot></div>' : ''}
      ${spec.resolved.length ? `<div class="ex-grid">${figs}</div>` : ''}`;
    mountRibbon(id, panel);

    /* tombol ringkas di kartu hasil */
    const rc = spec.resultsCard ? $(spec.resultsCard) : null;
    if (rc && !rc.querySelector('.ex-bar')) {
      const bar = document.createElement('div');
      bar.className = 'ex-bar';
      bar.innerHTML = `<button type="button" class="btn-ghost" data-ex-bar="docx">Unduh hasil (.docx)</button><a href="#ex-panel-${id}" data-ex-go="1">Lihat grafik pendukung &darr;</a>`;
      const h2 = rc.querySelector('h2');
      (h2 && h2.nextSibling ? h2.parentNode : rc).insertBefore(bar, h2 ? h2.nextSibling : rc.firstChild);
      bar.addEventListener('click', (e) => {
        if (e.target.closest('[data-ex-bar="docx"]')) doDocx(id);
        const g = e.target.closest('[data-ex-go]');
        if (g) { e.preventDefault(); const p = $('#ex-panel-' + id); if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
    }
  }

  /* Bantu modul: bangun daftar grafik dengan penanganan galat per grafik */
  const fmtN = (v, d) => (v === null || v === undefined || !Number.isFinite(v) ? '\u2013' : String(+Number(v).toPrecision(d || 5)));

  window.StatExport = { publish, buildDocx, zip, svgToPng, fmtN, _blocks: blocks };
})();
