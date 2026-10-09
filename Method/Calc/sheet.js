/* =========================================================================
   CALC — lembar kerja ala Excel (Method > Calc)
   -------------------------------------------------------------------------
   - Impor data: tempel dari Excel / unggah .xlsx, .csv (memakai pustaka
     SheetJS yang sama dengan Method/Shared/impor-data.js).
   - Ubah data seperti Excel: ketik nilai atau rumus (=LOG10(A2), =SUM(A2:A20)
     dst.), hasil dihitung otomatis dan tersimpan di kolom mana pun.
   - "Rumus kolom": terapkan operasi (log, akar, z-score, selisih, ...) ke satu
     kolom lalu simpan hasilnya di kolom lain, sekali klik.
   - Ekspor: .xlsx (rumus ikut tersimpan) dan .csv (nilai).
  - Seleksi rentang (seret mouse / Shift+klik / Shift+panah / klik kolom-baris / kotak nama),
    Salin-Potong-Tempel, Isi ke bawah-kanan, serta sisip & hapus baris/kolom di posisi sel
    terpilih (rumus ikut menyesuaikan). Lembar digambar memenuhi lebar & tinggi area kerja.
   Halaman dibuat otomatis (#view-metode-calc); tidak ada markup di index.html.
   ========================================================================= */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const MAX_R = 5000, MAX_C = 52, RH = 38, CW = 104, GUT = 48, OVERSCAN = 6, UNDO_MAX = 40;
  const XLSX_LOCAL = 'Method/Shared/xlsx.full.min.js';
  const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

  /* ------------------------------ Model data ------------------------------ */
  const S = { R: 20, C: 6, cells: [], header: true };   // cells[r][c] = teks mentah ('' = kosong; '=...' = rumus)
  const sel = { r: 0, c: 0 };            // sel = sel aktif (jangkar); ext = ujung seberang rentang
  const ext = { r: 0, c: 0 };
  let clip = null, keepRange = false;
  let undoStack = [], redoStack = [];

  function emptyCells(R, C) { return Array.from({ length: R }, () => new Array(C).fill('')); }
  S.cells = emptyCells(S.R, S.C);

  function colName(c) { let s = ''; c += 1; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }
  function colIndex(s) { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
  function raw(r, c) { const row = S.cells[r]; return row && row[c] !== undefined ? row[c] : ''; }
  function setRaw(r, c, v) { ensure(r + 1, c + 1); S.cells[r][c] = v; }
  function ensure(R, C) {
    R = Math.min(R, MAX_R); C = Math.min(C, MAX_C);
    while (S.cells.length < R) S.cells.push(new Array(S.C).fill(''));
    if (C > S.C) { S.cells.forEach((row) => { while (row.length < C) row.push(''); }); S.C = C; }
    S.R = Math.max(S.R, R);
  }
  function lastDataRow() { for (let r = S.R - 1; r >= 0; r--) for (let c = 0; c < S.C; c++) if (raw(r, c) !== '') return r; return -1; }
  function snapshot() { return JSON.stringify({ R: S.R, C: S.C, header: S.header, cells: S.cells }); }
  function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > UNDO_MAX) undoStack.shift(); redoStack = []; updateUndoBtn(); }
  function restore(js) { const o = JSON.parse(js); S.R = o.R; S.C = o.C; S.header = o.header; S.cells = o.cells; }

  const NUM_RE = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
  function parseNum(t) {
    if (typeof t !== 'string') return NaN;
    const s = t.trim();
    if (NUM_RE.test(s)) return parseFloat(s);
    return NaN;
  }

  /* ----------------------------- Mesin rumus ------------------------------ */
  class XErr { constructor(code) { this.code = code; } toString() { return this.code; } }
  const isErr = (v) => v instanceof XErr;
  const ERR = (c) => new XErr(c);

  const astCache = new Map();
  let valCache = new Map();
  let aggCache = new Map();
  const evaluating = new Set();
  function invalidate() { valCache = new Map(); aggCache = new Map(); }

  /* Tokenizer + parser (recursive descent) */
  function tokenize(src) {
    const t = []; let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '"') {
        let j = i + 1, out = '';
        while (j < src.length) { if (src[j] === '"') { if (src[j + 1] === '"') { out += '"'; j += 2; continue; } break; } out += src[j++]; }
        if (j >= src.length) throw new Error('str');
        t.push({ k: 'str', v: out }); i = j + 1; continue;
      }
      if (src.substr(i, 5).toUpperCase() === '#REF!') { t.push({ k: 'err', v: '#REF!' }); i += 5; continue; }
      let m;
      if ((m = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(src.slice(i)))) { t.push({ k: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if ((m = /^\$?[A-Za-z]{1,3}\$?\d+/.exec(src.slice(i))) && !/^[A-Za-z0-9_(]/.test(src.slice(i + m[0].length))) { t.push({ k: 'ref', v: m[0] }); i += m[0].length; continue; }
      if ((m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i)))) { t.push({ k: 'id', v: m[0] }); i += m[0].length; continue; }
      const two = src.slice(i, i + 2);
      if (two === '<=' || two === '>=' || two === '<>') { t.push({ k: 'op', v: two }); i += 2; continue; }
      if ('+-*/^&=<>(),;:%'.indexOf(ch) >= 0) { t.push({ k: 'op', v: ch }); i++; continue; }
      throw new Error('tok');
    }
    return t;
  }
  function parseRef(s) {
    const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(s);
    const c = colIndex(m[1]), r = parseInt(m[2], 10) - 1;
    return { r, c };
  }
  function parse(src) {
    const tk = tokenize(src); let p = 0;
    const peek = () => tk[p], next = () => tk[p++];
    const isOp = (v) => tk[p] && tk[p].k === 'op' && tk[p].v === v;
    function primary() {
      const t = next();
      if (!t) throw new Error('eof');
      if (t.k === 'num') { let n = { t: 'num', v: t.v }; while (isOp('%')) { next(); n = { t: 'bin', op: '/', a: n, b: { t: 'num', v: 100 } }; } return n; }
      if (t.k === 'str') return { t: 'str', v: t.v };
      if (t.k === 'err') return { t: 'err', v: t.v };
      if (t.k === 'ref') {
        const a = parseRef(t.v);
        if (isOp(':')) { next(); const t2 = next(); if (!t2 || t2.k !== 'ref') throw new Error('rng'); const b = parseRef(t2.v); return { t: 'rng', r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) }; }
        return { t: 'ref', r: a.r, c: a.c };
      }
      if (t.k === 'id') {
        const up = t.v.toUpperCase();
        if (isOp('(')) {
          next(); const args = [];
          if (!isOp(')')) { for (;;) { args.push(expr()); if (isOp(',') || isOp(';')) { next(); continue; } break; } }
          if (!isOp(')')) throw new Error('par'); next();
          return { t: 'call', name: up, args };
        }
        if (up === 'TRUE') return { t: 'bool', v: true };
        if (up === 'FALSE') return { t: 'bool', v: false };
        return { t: 'name', v: up };
      }
      if (t.k === 'op' && t.v === '(') { const e = expr(); if (!isOp(')')) throw new Error('par'); next(); return e; }
      throw new Error('syn');
    }
    function unary() {
      if (isOp('-')) { next(); return { t: 'un', op: '-', a: unary() }; }
      if (isOp('+')) { next(); return unary(); }
      return power();
    }
    function power() { let a = primary(); while (isOp('^')) { next(); const b = unaryNoPow(); a = { t: 'bin', op: '^', a, b }; } return a; }
    function unaryNoPow() { if (isOp('-')) { next(); return { t: 'un', op: '-', a: unaryNoPow() }; } if (isOp('+')) { next(); return unaryNoPow(); } return primary(); }
    function mul() { let a = unary(); while (isOp('*') || isOp('/')) { const op = next().v; a = { t: 'bin', op, a, b: unary() }; } return a; }
    function add() { let a = mul(); while (isOp('+') || isOp('-')) { const op = next().v; a = { t: 'bin', op, a, b: mul() }; } return a; }
    function cat() { let a = add(); while (isOp('&')) { next(); a = { t: 'bin', op: '&', a, b: add() }; } return a; }
    function cmp() { let a = cat(); while (peek() && peek().k === 'op' && ['=', '<>', '<', '>', '<=', '>='].indexOf(peek().v) >= 0) { const op = next().v; a = { t: 'bin', op, a, b: cat() }; } return a; }
    function expr() { return cmp(); }
    const ast = expr();
    if (p < tk.length) throw new Error('trail');
    return ast;
  }
  function getAst(f) {
    if (astCache.has(f)) return astCache.get(f);
    let a; try { a = parse(f); } catch (e) { a = { t: 'bad' }; }
    if (astCache.size > 5000) astCache.clear();
    astCache.set(f, a); return a;
  }

  function cellVal(r, c) {
    if (r < 0 || c < 0 || r >= MAX_R || c >= MAX_C) return ERR('#REF!');
    const t = raw(r, c);
    if (t === '') return '';
    const key = r * 100 + c;
    if (valCache.has(key)) return valCache.get(key);
    let v;
    if (t.charAt(0) === '=') {
      if (evaluating.has(key)) return ERR('#CIRC!');
      evaluating.add(key);
      try { v = ev(getAst(t.slice(1))); if (v && v.rng) v = ERR('#VALUE!'); } catch (e) { v = ERR('#VALUE!'); }
      evaluating.delete(key);
    } else {
      const n = parseNum(t);
      v = Number.isNaN(n) ? t : n;
    }
    valCache.set(key, v);
    return v;
  }
  function toNum(v) {
    if (isErr(v)) return v;
    if (v === '' || v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    const n = parseNum(String(v));
    return Number.isNaN(n) ? ERR('#VALUE!') : n;
  }
  function rangeVals(n) {
    const out = [];
    for (let r = n.r1; r <= n.r2; r++) for (let c = n.c1; c <= n.c2; c++) out.push(cellVal(r, c));
    return out;
  }
  /* Kumpulkan angka dari argumen (rentang: abaikan teks/kosong; skalar: dikonversi) */
  function collectNums(args) {
    const nums = [];
    for (const a of args) {
      if (a.t === 'rng') { for (const v of rangeVals(a)) { if (isErr(v)) return v; if (typeof v === 'number') nums.push(v); } }
      else { const v = ev(a); if (isErr(v)) return v; const n = toNum(v); if (isErr(n)) return n; nums.push(n); }
    }
    return nums;
  }
  function pairs(args) {
    if (args.length < 2 || args[0].t !== 'rng' || args[1].t !== 'rng') return ERR('#VALUE!');
    const a = rangeVals(args[0]), b = rangeVals(args[1]), x = [], y = [];
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (isErr(a[i])) return a[i]; if (isErr(b[i])) return b[i];
      if (typeof a[i] === 'number' && typeof b[i] === 'number') { x.push(a[i]); y.push(b[i]); }
    }
    return { x, y };
  }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  function variance(a, sample) { if (a.length < (sample ? 2 : 1)) return ERR('#DIV/0!'); const m = mean(a); return a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - (sample ? 1 : 0)); }
  function median(a) { if (!a.length) return ERR('#NUM!'); const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
  function chk(x) { return Number.isFinite(x) ? x : ERR('#NUM!'); }

  const AGG = {
    SUM: (a) => a.reduce((s, v) => s + v, 0),
    AVERAGE: (a) => (a.length ? mean(a) : ERR('#DIV/0!')),
    MIN: (a) => (a.length ? Math.min.apply(null, a) : 0),
    MAX: (a) => (a.length ? Math.max.apply(null, a) : 0),
    COUNT: (a) => a.length,
    MEDIAN: median,
    STDEV: (a) => { const v = variance(a, true); return isErr(v) ? v : Math.sqrt(v); },
    'STDEV.S': (a) => { const v = variance(a, true); return isErr(v) ? v : Math.sqrt(v); },
    STDEVP: (a) => { const v = variance(a, false); return isErr(v) ? v : Math.sqrt(v); },
    VAR: (a) => variance(a, true),
    'VAR.S': (a) => variance(a, true),
    VARP: (a) => variance(a, false),
    PRODUCT: (a) => a.reduce((s, v) => s * v, 1),
    SUMSQ: (a) => a.reduce((s, v) => s + v * v, 0),
  };
  const FN1 = {
    LOG10: (x) => chk(Math.log10(x)), LN: (x) => chk(Math.log(x)), EXP: (x) => chk(Math.exp(x)), SQRT: (x) => chk(Math.sqrt(x)),
    ABS: Math.abs, INT: Math.floor, SIGN: Math.sign, SIN: Math.sin, COS: Math.cos, TAN: Math.tan, ASIN: (x) => chk(Math.asin(x)), ACOS: (x) => chk(Math.acos(x)), ATAN: Math.atan,
    RADIANS: (x) => x * Math.PI / 180, DEGREES: (x) => x * 180 / Math.PI,
    FACT: (x) => { if (x < 0 || x > 170) return ERR('#NUM!'); let r = 1; for (let i = 2; i <= Math.floor(x); i++) r *= i; return r; },
  };

  function cmpVals(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    const sa = typeof a === 'string' ? a.toLowerCase() : a, sb = typeof b === 'string' ? b.toLowerCase() : b;
    if (typeof a === typeof b) return sa < sb ? -1 : sa > sb ? 1 : 0;
    const rank = (v) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2);
    return rank(a) - rank(b);
  }
  function truthy(v) { if (isErr(v)) return v; if (typeof v === 'boolean') return v; if (v === '') return false; if (typeof v === 'number') return v !== 0; return ERR('#VALUE!'); }

  function ev(n) {
    switch (n.t) {
      case 'num': case 'str': case 'bool': return n.v;
      case 'bad': return ERR('#NAME?');
      case 'err': return ERR(n.v);
      case 'name': return n.v === 'PI' ? Math.PI : ERR('#NAME?');
      case 'ref': return cellVal(n.r, n.c);
      case 'rng': return { rng: n };
      case 'un': { const v = toNum(ev(n.a)); return isErr(v) ? v : -v; }
      case 'bin': {
        let a = ev(n.a), b = ev(n.b);
        if (a && a.rng) return ERR('#VALUE!'); if (b && b.rng) return ERR('#VALUE!');
        if (isErr(a)) return a; if (isErr(b)) return b;
        if (n.op === '&') return String(a === '' ? '' : a) + String(b === '' ? '' : b);
        if (['=', '<>', '<', '>', '<=', '>='].indexOf(n.op) >= 0) {
          const d = cmpVals(a === '' ? (typeof b === 'string' ? '' : 0) : a, b === '' ? (typeof a === 'string' ? '' : 0) : b);
          return n.op === '=' ? d === 0 : n.op === '<>' ? d !== 0 : n.op === '<' ? d < 0 : n.op === '>' ? d > 0 : n.op === '<=' ? d <= 0 : d >= 0;
        }
        a = toNum(a); b = toNum(b);
        if (isErr(a)) return a; if (isErr(b)) return b;
        switch (n.op) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b;
          case '/': return b === 0 ? ERR('#DIV/0!') : a / b;
          case '^': return chk(Math.pow(a, b));
        }
        return ERR('#VALUE!');
      }
      case 'call': return callFn(n);
    }
    return ERR('#VALUE!');
  }

  function callFn(n) {
    const name = n.name, args = n.args;
    if (AGG[name]) {
      let key = null;
      if (args.length === 1 && args[0].t === 'rng') { const g = args[0]; key = name + ':' + g.r1 + ',' + g.c1 + ',' + g.r2 + ',' + g.c2; if (aggCache.has(key)) return aggCache.get(key); }
      const nums = collectNums(args);
      const res = isErr(nums) ? nums : AGG[name](nums);
      if (key) aggCache.set(key, res);
      return res;
    }
    if (name === 'COUNTA') { let k = 0; for (const a of args) { if (a.t === 'rng') rangeVals(a).forEach((v) => { if (v !== '') k++; }); else if (ev(a) !== '') k++; } return k; }
    if (name === 'CORREL' || name === 'SLOPE' || name === 'INTERCEPT' || name === 'RSQ') {
      const pr = pairs(args); if (isErr(pr)) return pr;
      const X = name === 'SLOPE' || name === 'INTERCEPT' ? pr.y : pr.x, Y = name === 'SLOPE' || name === 'INTERCEPT' ? pr.x : pr.y;
      if (X.length < 2) return ERR('#DIV/0!');
      const mx = mean(X), my = mean(Y);
      let sxy = 0, sxx = 0, syy = 0;
      for (let i = 0; i < X.length; i++) { sxy += (X[i] - mx) * (Y[i] - my); sxx += (X[i] - mx) ** 2; syy += (Y[i] - my) ** 2; }
      if (name === 'SLOPE') return sxx === 0 ? ERR('#DIV/0!') : sxy / sxx;
      if (name === 'INTERCEPT') return sxx === 0 ? ERR('#DIV/0!') : my - (sxy / sxx) * mx;
      if (sxx === 0 || syy === 0) return ERR('#DIV/0!');
      const rr = sxy / Math.sqrt(sxx * syy);
      return name === 'RSQ' ? rr * rr : rr;
    }
    if (name === 'IF') {
      if (args.length < 2) return ERR('#VALUE!');
      const c = truthy(ev(args[0])); if (isErr(c)) return c;
      const pick = c ? args[1] : args[2];
      if (!pick) return c;
      const v = ev(pick); return v && v.rng ? ERR('#VALUE!') : v;
    }
    if (name === 'IFERROR') { const v = ev(args[0]); if (isErr(v)) { return args[1] ? ev(args[1]) : ''; } return v; }
    if (name === 'AND' || name === 'OR') {
      let acc = name === 'AND';
      for (const a of args) { const vs = a.t === 'rng' ? rangeVals(a) : [ev(a)]; for (const v of vs) { if (v === '') continue; const t = truthy(v); if (isErr(t)) return t; acc = name === 'AND' ? acc && t : acc || t; } }
      return acc;
    }
    if (name === 'NOT') { const t = truthy(ev(args[0])); return isErr(t) ? t : !t; }
    if (name === 'PI') return Math.PI;
    if (name === 'ROW' || name === 'COLUMN') return ERR('#VALUE!');
    // fungsi numerik skalar
    const vals = args.map((a) => { const v = ev(a); return v && v.rng ? ERR('#VALUE!') : toNum(v); });
    for (const v of vals) if (isErr(v)) return v;
    const x = vals[0];
    if (FN1[name]) return vals.length >= 1 ? FN1[name](x) : ERR('#VALUE!');
    switch (name) {
      case 'LOG': { const b = vals.length > 1 ? vals[1] : 10; if (x <= 0 || b <= 0 || b === 1) return ERR('#NUM!'); return Math.log(x) / Math.log(b); }
      case 'ROUND': { const d = vals.length > 1 ? Math.trunc(vals[1]) : 0, f = Math.pow(10, d); return Math.sign(x) * Math.round(Math.abs(x) * f + 1e-12) / f; }
      case 'ROUNDUP': { const d = vals.length > 1 ? Math.trunc(vals[1]) : 0, f = Math.pow(10, d); return Math.sign(x) * Math.ceil(Math.abs(x) * f - 1e-12) / f; }
      case 'ROUNDDOWN': { const d = vals.length > 1 ? Math.trunc(vals[1]) : 0, f = Math.pow(10, d); return Math.sign(x) * Math.floor(Math.abs(x) * f + 1e-12) / f; }
      case 'POWER': return vals.length > 1 ? chk(Math.pow(x, vals[1])) : ERR('#VALUE!');
      case 'MOD': { if (vals.length < 2) return ERR('#VALUE!'); if (vals[1] === 0) return ERR('#DIV/0!'); const m = x - vals[1] * Math.floor(x / vals[1]); return m; }
      case 'ATAN2': return vals.length > 1 ? Math.atan2(vals[1], x) : ERR('#VALUE!');
    }
    return ERR('#NAME?');
  }

  function display(v) {
    if (isErr(v)) return v.code;
    if (v === '' || v === undefined || v === null) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return '#NUM!';
      if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
      return String(Number(v.toPrecision(10)));
    }
    return String(v);
  }

  /* -------------------------------- Gaya --------------------------------- */
  const style = document.createElement('style');
  style.textContent = `
    #view-metode-calc [hidden]{ display:none !important; }
    #view-metode-calc .sc-bar{ display:grid; gap:10px; margin-top:12px; }
    #view-metode-calc .sc-bar.c2{ grid-template-columns:repeat(2,1fr); }
    #view-metode-calc .sc-bar.c3{ grid-template-columns:repeat(3,1fr); }
    #view-metode-calc .sc-bar.c4{ grid-template-columns:repeat(4,1fr); }
    #view-metode-calc .sc-bar .btn-ghost, #view-metode-calc .sc-bar .btn-primary{ width:100%; flex:none; padding-left:6px; padding-right:6px; line-height:1.25; }
    @media (max-width:520px){ #view-metode-calc .sc-bar.c4{ grid-template-columns:repeat(2,1fr); } #view-metode-calc .sc-bar .btn-ghost{ font-size:13px; } }
    #view-metode-calc .sc-panel{ border:1px dashed var(--rule-strong); border-radius:var(--radius); padding:14px 16px; background:var(--paper-2); margin:12px 0 4px; }
    #view-metode-calc .sc-panel[hidden]{ display:none; }
    #view-metode-calc .sc-panel textarea{ width:100%; min-height:120px; resize:vertical; font-family:var(--font-mono); font-size:13px; padding:10px 12px; border:1px solid var(--rule-strong); border-radius:var(--radius); background:#fff; color:var(--ink); }
    #view-metode-calc .sc-check{ display:flex; align-items:center; gap:8px; font-size:13.5px; margin:10px 0 4px; font-weight:500; }
    #view-metode-calc .sc-msg{ margin:10px 0 0; padding:9px 12px; border-radius:var(--radius); font-size:13.5px; }
    #view-metode-calc .sc-msg.ok{ background:#DFEEE3; color:var(--good); }
    #view-metode-calc .sc-msg.err{ background:var(--bad-bg); color:var(--bad); }
    #view-metode-calc .sc-msg[hidden]{ display:none; }
    #view-metode-calc .sc-fxrow{ display:flex; align-items:center; gap:8px; margin:12px 0 8px; }
    #view-metode-calc .sc-name{ flex:0 0 auto; min-width:54px; text-align:center; font-family:var(--font-mono); font-weight:600; font-size:13px; padding:9px 8px; border:1px solid var(--rule-strong); border-radius:var(--radius); background:var(--paper-2); }
    #view-metode-calc .sc-fx{ flex:1; min-width:0; font-family:var(--font-mono); font-size:16px; padding:8px 10px; border:1px solid var(--rule-strong); border-radius:var(--radius); background:#fff; color:var(--ink); min-height:var(--tap); }
    #view-metode-calc .sc-scroll{ position:relative; overflow:auto; height:clamp(280px,56vh,540px); border:1px solid var(--rule-strong); border-radius:var(--radius); background:#fff; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; }
    #view-metode-calc .sc-head{ position:sticky; top:0; z-index:4; display:flex; height:32px; background:var(--paper-2); }
    #view-metode-calc .sc-corner, #view-metode-calc .sc-gut{ position:sticky; left:0; z-index:3; flex:0 0 ${GUT}px; width:${GUT}px; background:var(--paper-2); border-right:1px solid var(--rule-strong); border-bottom:1px solid var(--rule); box-sizing:border-box; font-family:var(--font-mono); font-size:12px; color:var(--ink-soft); display:flex; align-items:center; justify-content:center; }
    #view-metode-calc .sc-corner{ z-index:5; border-bottom:1px solid var(--rule-strong); }
    #view-metode-calc .sc-ch{ flex:0 0 ${CW}px; width:${CW}px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-size:12.5px; font-weight:600; color:var(--ink-soft); border-right:1px solid var(--rule); border-bottom:1px solid var(--rule-strong); }
    #view-metode-calc .sc-ch.on, #view-metode-calc .sc-gut.on{ background:var(--accent-soft); color:var(--accent); }
    #view-metode-calc .sc-inner{ position:relative; }
    #view-metode-calc .sc-rows{ position:absolute; left:0; top:0; }
    #view-metode-calc .sc-row{ display:flex; height:${RH}px; }
    #view-metode-calc .sc-cell{ flex:0 0 ${CW}px; width:${CW}px; height:${RH}px; box-sizing:border-box; border:none; border-right:1px solid var(--rule); border-bottom:1px solid var(--rule); padding:0 8px; font-family:var(--font-mono); font-size:16px; color:var(--ink); background:#fff; text-align:right; border-radius:0; min-height:0; }
    #view-metode-calc .sc-cell.txt{ text-align:left; }
    #view-metode-calc .sc-cell.fx{ background:#FBF6EA; }
    #view-metode-calc .sc-cell.hdr{ font-weight:700; text-align:center; background:var(--accent-soft); }
    #view-metode-calc .sc-cell.er{ color:var(--bad); }
    #view-metode-calc .sc-cell:focus{ outline:2px solid var(--accent-2); outline-offset:-2px; background:#fff; position:relative; z-index:2; }
    #view-metode-calc .sc-sel{ display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; }
    #view-metode-calc .sc-field{ display:flex; flex-direction:column; gap:4px; flex:1 1 150px; min-width:0; }
    #view-metode-calc .sc-field label{ font-size:13px; font-weight:600; color:var(--ink-soft); }
    #view-metode-calc .sc-field .select-input, #view-metode-calc .sc-field .plain-input{ width:100%; }
    #view-metode-calc .sc-note{ font-size:12.5px; color:var(--ink-soft); margin:10px 0 0; text-align:justify; text-justify:inter-word; hyphens:auto; }
    #view-metode-calc .sc-h4{ font-size:14.5px; margin:18px 0 4px; font-family:var(--font-body); }
    #view-metode-calc code{ font-family:var(--font-mono); font-size:12.5px; background:var(--paper-2); padding:1px 5px; border-radius:4px; }

    /* ---------------------- Seleksi rentang ---------------------- */
    #view-metode-calc input.sc-name{ width:104px; box-sizing:border-box; min-height:var(--tap); color:var(--ink); cursor:text; }
    #view-metode-calc input.sc-name:focus{ background:#fff; outline:2px solid var(--accent-2); outline-offset:-2px; }
    #view-metode-calc .sc-scroll:focus{ outline:none; }
    #view-metode-calc .sc-corner, #view-metode-calc .sc-ch, #view-metode-calc .sc-gut{ cursor:pointer; user-select:none; -webkit-user-select:none; }
    #view-metode-calc .sc-cell{ --sT:0 0 #0000; --sB:0 0 #0000; --sL:0 0 #0000; --sR:0 0 #0000; }
    #view-metode-calc .sc-cell.in{ background:var(--accent-soft); box-shadow:var(--sT),var(--sB),var(--sL),var(--sR); }
    #view-metode-calc .sc-cell.in.act{ background:#fff; }
    #view-metode-calc .sc-cell.sT{ --sT:inset 0 2px 0 0 var(--accent-2); }
    #view-metode-calc .sc-cell.sB{ --sB:inset 0 -2px 0 0 var(--accent-2); }
    #view-metode-calc .sc-cell.sL{ --sL:inset 2px 0 0 0 var(--accent-2); }
    #view-metode-calc .sc-cell.sR{ --sR:inset -2px 0 0 0 var(--accent-2); }
    #view-metode-calc .sc-scroll.dragging .sc-cell{ user-select:none; -webkit-user-select:none; cursor:cell; }

    /* ---------------------- Pita perintah (ribbon) ---------------------- */
    #view-metode-calc .sc-main{ padding:0; overflow:hidden; }
    #view-metode-calc .sc-tabs{ display:flex; gap:2px; padding:8px 10px 0; background:var(--paper-2); border-bottom:1px solid var(--rule-strong); overflow-x:auto; scrollbar-width:none; }
    #view-metode-calc .sc-tabs::-webkit-scrollbar{ display:none; }
    #view-metode-calc .sc-tab{ flex:1 1 0; max-width:150px; min-height:42px; padding:0 16px; border:1px solid transparent; border-bottom:none; border-radius:10px 10px 0 0; background:transparent; color:var(--ink-soft); font-family:var(--font-body); font-size:14px; font-weight:700; cursor:pointer; margin-bottom:-1px; }
    #view-metode-calc .sc-tab:hover{ color:var(--ink); background:rgba(255,255,255,.55); }
    #view-metode-calc .sc-tab[aria-selected="true"]{ background:#fff; color:var(--accent); border-color:var(--rule-strong); box-shadow:inset 0 3px 0 var(--accent-2); }
    #view-metode-calc .sc-ribbon{ display:grid; grid-template-columns:minmax(0,1fr); }
    #view-metode-calc .sc-tabs{ grid-row:1; grid-column:1; }
    #view-metode-calc .sc-rpanel{ grid-row:2; grid-column:1; min-width:0; display:flex; flex-direction:column; visibility:hidden; background:#fff; border-bottom:1px solid var(--rule); }
    #view-metode-calc .sc-rpanel.on{ visibility:visible; }
    #view-metode-calc .sc-rbody{ flex:1 1 auto; display:flex; flex-wrap:nowrap; align-items:stretch; gap:0; padding:10px 8px 4px; overflow-x:auto; scrollbar-width:thin; -webkit-overflow-scrolling:touch; overscroll-behavior-x:contain; }
    #view-metode-calc .sc-grp{ flex:0 0 auto; display:flex; flex-direction:column; padding:0 12px; border-right:1px solid var(--rule); }
    #view-metode-calc .sc-grp:last-child{ border-right:none; }
    #view-metode-calc .sc-gbody{ flex:1; display:flex; align-items:center; gap:6px; }
    #view-metode-calc .sc-glabel{ text-align:center; font-size:11px; font-weight:700; letter-spacing:.04em; color:var(--ink-faint); padding:6px 0 4px; }
    #view-metode-calc .sc-rb{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; min-width:64px; min-height:64px; padding:8px 8px 6px; border:1px solid transparent; border-radius:12px; background:transparent; color:var(--ink); cursor:pointer; font-family:var(--font-body); transition:background .12s ease, border-color .12s ease, transform .08s ease; }
    #view-metode-calc .sc-rb svg{ width:26px; height:26px; flex-shrink:0; color:var(--accent); }
    #view-metode-calc .sc-rb span{ font-size:11.5px; font-weight:600; line-height:1.15; text-align:center; max-width:84px; }
    #view-metode-calc .sc-rb:hover:not(:disabled){ background:var(--accent-soft); border-color:var(--rule-strong); }
    #view-metode-calc .sc-rb:active:not(:disabled){ transform:scale(.95); }
    #view-metode-calc .sc-rb:disabled{ opacity:.38; cursor:default; }
    #view-metode-calc .sc-rb.pri{ background:var(--accent); color:#fff; }
    #view-metode-calc .sc-rb.pri svg{ color:#fff; }
    #view-metode-calc .sc-rb.pri:hover:not(:disabled){ background:var(--accent-hi); border-color:var(--accent-hi); }
    #view-metode-calc .sc-rb.danger svg{ color:var(--bad); }
    #view-metode-calc .sc-rb.sm{ min-height:0; flex-direction:row; gap:8px; padding:8px 12px; }
    #view-metode-calc .sc-rb.sm svg{ width:20px; height:20px; }
    #view-metode-calc .sc-rb.sm span{ max-width:none; font-size:13px; }
    #view-metode-calc .sc-stack{ display:flex; flex-direction:column; gap:4px; }
    #view-metode-calc .sc-fgrid{ display:grid; grid-template-columns:repeat(3,max-content); gap:8px 10px; align-items:end; }
    #view-metode-calc .sc-fgrid.c2{ grid-template-columns:repeat(2,max-content); }
    #view-metode-calc .sc-fld{ display:flex; flex-direction:column; gap:3px; min-width:0; }
    #view-metode-calc .sc-fld > label{ font-size:11.5px; font-weight:600; color:var(--ink-soft); line-height:1.2; }
    #view-metode-calc .sc-ribbon .select-input{ width:168px; min-width:0; height:40px; border-radius:10px; font-size:14px; padding:0 8px; }
    #view-metode-calc .sc-ribbon #scOp{ width:220px; }
    #view-metode-calc .sc-ribbon .plain-input{ width:112px; height:40px; border-radius:10px; font-size:15px; text-align:left; padding:0 10px; }
    #view-metode-calc .sc-ribbon .plain-input.num{ width:78px; text-align:center; }
    #view-metode-calc .sc-ribbon .plain-input.wide{ width:100%; min-width:230px; font-family:var(--font-mono); }
    #view-metode-calc .sc-ribbon .plain-input.file{ width:150px; }
    #view-metode-calc .sc-chk{ display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; padding:8px 10px; border:1px solid var(--rule); border-radius:12px; background:var(--paper-2); cursor:pointer; max-width:150px; line-height:1.2; }
    #view-metode-calc .sc-chk input{ width:18px; height:18px; flex-shrink:0; accent-color:var(--accent); }
    #view-metode-calc .sc-tip{ margin:0; font-size:12.5px; color:var(--ink-soft); text-align:left; hyphens:manual; }
    #view-metode-calc .sc-tips{ margin-top:6px; }
    #view-metode-calc .sc-body{ padding:12px 14px 16px; }
    #view-metode-calc .sc-msgs{ padding:0 14px; }
    #view-metode-calc .sc-msgs .sc-msg{ margin:10px 0 0; }
    #view-metode-calc .sc-body .sc-fxrow{ margin-top:2px; }
    #view-metode-calc .sc-body .sc-panel{ margin-top:0; }
    #view-metode-calc .sc-body .sc-bar{ margin-top:10px; }
    @media (min-width:700px){
      #view-metode-calc .sc-rbody{ padding:12px 12px 6px; }
      #view-metode-calc .sc-tab{ flex:0 0 auto; min-width:104px; }
    }
    @media (min-width:1024px){
      #view-metode-calc .chapter-inner{ max-width:1400px; }
      body.side-off #view-metode-calc .chapter-inner{ max-width:none; }
      #view-metode-calc .sc-scroll{ height:clamp(340px,60vh,760px); }
    }
  `;
  document.head.appendChild(style);


  /* ------------------------- Ikon & tombol pita -------------------------- */
  const ICO = {
    paste: '<rect x="6" y="4.5" width="12" height="16.5" rx="2"/><path d="M9.5 4.5V3.5h5v1"/><path d="M9 11h6M9 15h4"/>',
    upload: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 18v-6M9.5 14.5 12 12l2.5 2.5"/>',
    newtable: '<rect x="3" y="4" width="14" height="14" rx="2"/><path d="M3 9.5h14M8.5 4v14"/><path d="M19 14.5v6M16 17.5h6"/>',
    sample: '<path d="M9.5 3.5h5M10.5 3.5v5.5L5.2 18.2A2 2 0 0 0 7 21h10a2 2 0 0 0 1.8-2.8L13.5 9V3.5"/><path d="M7.7 15h8.6"/>',
    xlsx: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>',
    csv: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h7"/>',
    addrow: '<rect x="3.5" y="3.5" width="17" height="9" rx="1.8"/><path d="M3.5 8h17"/><path d="M12 15.5v5M9.5 18h5"/>',
    delrow: '<rect x="3.5" y="3.5" width="17" height="9" rx="1.8"/><path d="M3.5 8h17"/><path d="M9.5 18h5"/>',
    addcol: '<rect x="3.5" y="3.5" width="9" height="17" rx="1.8"/><path d="M8 3.5v17"/><path d="M15.5 12h5M18 9.5v5"/>',
    delcol: '<rect x="3.5" y="3.5" width="9" height="17" rx="1.8"/><path d="M8 3.5v17"/><path d="M15.5 12h5"/>',
    undo: '<path d="M9 6.5 4.5 11 9 15.5"/><path d="M5 11h9a4.5 4.5 0 0 1 0 9h-3.5"/>',
    redo: '<path d="M15 6.5 19.5 11 15 15.5"/><path d="M19 11h-9a4.5 4.5 0 0 0 0 9h3.5"/>',
    clear: '<path d="M4.5 7h15M9.5 7V4.5h5V7"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5.5M14 11v5.5"/>',
    fx: '<text x="12" y="16.5" text-anchor="middle" font-size="13" font-style="italic" font-weight="700" font-family="Georgia,serif" fill="currentColor" stroke="none">fx</text><rect x="3" y="4" width="18" height="16" rx="2.5"/>',
    toval: '<path d="M4.5 8h8M4.5 12h8M4.5 16h5"/><path d="M15 12h5.5M18 9.5l2.5 2.5-2.5 2.5"/>',
    copy: '<rect x="8.5" y="8.5" width="11.5" height="12" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6.5a2 2 0 0 0-2 2v8.5a2 2 0 0 0 2 2h2"/>',
    cut: '<circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M8.2 15.7 18 4M15.8 15.7 6 4"/>',
    filldown: '<rect x="5" y="3.5" width="14" height="6" rx="1.5"/><path d="M12 9.5v8M9 14.5l3 3 3-3M5 20.5h14"/>',
    fillright: '<rect x="3.5" y="5" width="6" height="14" rx="1.5"/><path d="M9.5 12h8M14.5 9l3 3-3 3M20.5 5v14"/>',
    insrowup: '<rect x="3.5" y="12" width="17" height="8" rx="1.8"/><path d="M3.5 16h17M12 3.5v6M9 6.5h6"/>',
    inscolleft: '<rect x="12" y="3.5" width="8.5" height="17" rx="1.8"/><path d="M16.2 3.5v17M5 9v6M2 12h6"/>',
    send: '<path d="M21 3 10.5 13.5"/><path d="M21 3l-6.5 18-3.5-7.5L3.5 10z"/>'
  };
  const svgI = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg>`;
  const rb = (id, ico, label, tip, cls, dis) => `<button type="button" class="sc-rb ${cls || ''}" id="${id}" title="${tip || label}" aria-label="${tip || label}"${dis ? ' disabled' : ''}>${svgI(ico)}<span>${label}</span></button>`;

  /* --------------------------- Markup halaman ---------------------------- */
  const section = document.createElement('section');
  section.className = 'view';
  section.id = 'view-metode-calc';
  section.innerHTML = `
    <div class="chapter-inner">
      <div class="chapter-head">
        <span class="eyebrow">Metode &rsaquo; Calc</span>
        <h1>Lembar Kerja Calc</h1>
        <p class="lede">Impor, ubah, hitung, dan ekspor data seperti di Excel. Semua perintah ada di pita tab di atas lembar kerja.</p>
      </div>

      <section class="card sc-main">
        <div class="sc-ribbon">
          <div class="sc-tabs" role="tablist" aria-label="Pita perintah">
            <button type="button" class="sc-tab" role="tab" data-tab="file" aria-selected="true">File</button>
            <button type="button" class="sc-tab" role="tab" data-tab="edit" aria-selected="false">Edit</button>
            <button type="button" class="sc-tab" role="tab" data-tab="fungsi" aria-selected="false">Fungsi</button>
            <button type="button" class="sc-tab" role="tab" data-tab="kirim" aria-selected="false">Statistik</button>
          </div>

          <!-- ============ TAB FILE ============ -->
          <div class="sc-rpanel on" data-panel="file" role="tabpanel">
            <div class="sc-rbody">
              <div class="sc-grp">
                <div class="sc-gbody">
                  ${rb('scPasteBtn', 'paste', 'Tempel dari Excel', 'Tempel blok sel dari Excel')}
                  ${rb('scFileBtn', 'upload', 'Unggah file', 'Unggah file .xlsx, .csv')}
                </div>
                <div class="sc-glabel">Impor</div>
              </div>
              <div class="sc-grp">
                <div class="sc-gbody">
                  <div class="sc-stack">
                    <div class="sc-fld"><label for="scNewC">Kolom</label><input id="scNewC" class="plain-input num" type="number" min="1" max="52" value="3" inputmode="numeric"></div>
                    <div class="sc-fld"><label for="scNewR">Baris data</label><input id="scNewR" class="plain-input num" type="number" min="1" max="5000" value="10" inputmode="numeric"></div>
                  </div>
                  ${rb('scNewBtn', 'newtable', 'Buat tabel baru', 'Buat tabel kosong sesuai ukuran')}
                  ${rb('scSampleBtn', 'sample', 'Contoh data', 'Isi dengan contoh data')}
                </div>
                <div class="sc-glabel">Data baru</div>
              </div>
              <div class="sc-grp">
                <div class="sc-gbody">
                  <div class="sc-fld"><label for="scFname">Nama file</label><input id="scFname" class="plain-input file" type="text" value="data-calc"></div>
                  ${rb('scXlsx', 'xlsx', '.xlsx', 'Unduh .xlsx (rumus & nilai tersimpan)')}
                  ${rb('scCsv', 'csv', '.csv', 'Unduh .csv (nilai saja)')}
                </div>
                <div class="sc-glabel">Ekspor</div>
              </div>
            </div>
            <input type="file" id="scFile" hidden accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,text/csv,text/plain">
          </div>

          <!-- ============ TAB EDIT ============ -->
          <div class="sc-rpanel" data-panel="edit" role="tabpanel">
            <div class="sc-rbody">
              <div class="sc-grp">
                <div class="sc-gbody">
                  ${rb('scUndo', 'undo', 'Urungkan', 'Urungkan perubahan terakhir', '', true)}
                  ${rb('scRedo', 'redo', 'Ulangi', 'Ulangi perubahan yang diurungkan', '', true)}
                </div>
                <div class="sc-glabel">Riwayat</div>
              </div>
              <div class="sc-grp">
                <div class="sc-gbody">
                  ${rb('scCopy', 'copy', 'Salin', 'Salin sel terpilih (Ctrl+C)')}
                  ${rb('scCut', 'cut', 'Potong', 'Potong sel terpilih (Ctrl+X)')}
                  ${rb('scPaste', 'paste', 'Tempel', 'Tempel di sel terpilih (Ctrl+V)')}
                </div>
                <div class="sc-glabel">Papan klip</div>
              </div>
              <div class="sc-grp">
                <div class="sc-gbody">
                  ${rb('scFillDown', 'filldown', 'Isi ke bawah', 'Isi ke bawah dari baris pertama rentang (Ctrl+D)')}
                  ${rb('scFillRight', 'fillright', 'Isi ke kanan', 'Isi ke kanan dari kolom pertama rentang (Ctrl+R)')}
                </div>
                <div class="sc-glabel">Isi</div>
              </div>
              <div class="sc-grp">
                <div class="sc-gbody">
                  ${rb('scInsRowUp', 'insrowup', 'Sisip atas', 'Sisipkan baris kosong di atas sel terpilih')}
                  ${rb('scInsRowDown', 'addrow', 'Sisip bawah', 'Sisipkan baris kosong di bawah sel terpilih')}
                  ${rb('scDelRow', 'delrow', 'Hapus baris', 'Hapus baris sel terpilih', 'danger')}
                </div>
                <div class="sc-glabel">Baris</div>
              </div>
              <div class="sc-grp">
                <div class="sc-gbody">
                  ${rb('scInsColLeft', 'inscolleft', 'Sisip kiri', 'Sisipkan kolom kosong di kiri sel terpilih')}
                  ${rb('scInsColRight', 'addcol', 'Sisip kanan', 'Sisipkan kolom kosong di kanan sel terpilih')}
                  ${rb('scDelCol', 'delcol', 'Hapus kolom', 'Hapus kolom sel terpilih', 'danger')}
                </div>
                <div class="sc-glabel">Kolom</div>
              </div>
              <div class="sc-grp">
                <div class="sc-gbody">
                  ${rb('scClear', 'clear', 'Kosongkan', 'Kosongkan seluruh sel', 'danger')}
                  <label class="sc-chk"><input type="checkbox" id="scHeader" checked> Baris 1 judul kolom</label>
                </div>
                <div class="sc-glabel">Sel</div>
              </div>
            </div>
          </div>

          <!-- ============ TAB FUNGSI ============ -->
          <div class="sc-rpanel" data-panel="fungsi" role="tabpanel">
            <div class="sc-rbody">
              <div class="sc-grp">
                <div class="sc-gbody">
                  <div class="sc-fgrid">
                    <div class="sc-fld"><label for="scSrc">Kolom sumber</label><select id="scSrc" class="select-input"></select></div>
                    <div class="sc-fld"><label for="scOp">Operasi</label><select id="scOp" class="select-input"></select></div>
                    <div class="sc-fld" id="scParWrap"><label for="scPar" id="scParLbl">Parameter</label><input id="scPar" class="plain-input" type="text" inputmode="decimal" value="2"></div>
                    <div class="sc-fld"><label for="scDst">Simpan hasil di</label><select id="scDst" class="select-input"></select></div>
                    <div class="sc-fld"><label for="scTitle">Judul kolom hasil</label><input id="scTitle" class="plain-input" type="text" placeholder="mis. log_Y"></div>
                  </div>
                  ${rb('scApply', 'fx', 'Terapkan', 'Terapkan operasi ke kolom tujuan', 'pri')}
                </div>
                <div class="sc-glabel">Rumus kolom</div>
              </div>
              <div class="sc-grp">
                <div class="sc-gbody">
                  <div class="sc-stack">
                    <div class="sc-fld"><label for="scExpr">Rumus per baris</label><input id="scExpr" class="plain-input wide" type="text" spellcheck="false" autocomplete="off" placeholder="mis. LN(A)*2+B"></div>
                    <div class="sc-fld"><label for="scDst2">Simpan hasil di</label><select id="scDst2" class="select-input"></select></div>
                  </div>
                  ${rb('scApply2', 'fx', 'Terapkan', 'Terapkan rumus bebas ke kolom tujuan', 'pri')}
                </div>
                <div class="sc-glabel">Rumus bebas</div>
              </div>
              <div class="sc-grp">
                <div class="sc-gbody">
                  ${rb('scToVal', 'toval', 'Rumus jadi nilai', 'Ubah semua rumus menjadi nilai tetap')}
                </div>
                <div class="sc-glabel">Konversi</div>
              </div>
            </div>
          </div>

          <!-- ============ TAB KIRIM ============ -->
          <div class="sc-rpanel" data-panel="kirim" role="tabpanel">
            <div class="sc-rbody">
              <div class="sc-grp">
                <div class="sc-gbody">
                  <div class="sc-fld"><label for="scTarget">Analisis dengan</label>
                    <select id="scTarget" class="select-input" style="width:220px">
                      <optgroup label="Stat">
                        <option value="deskriptif">Statistika Deskriptif</option>
                        <option value="regresi">Regresi Linear</option>
                        <option value="smoothing">Metode Smoothing</option>
                        <option value="stasioner">Uji Stasioneritas (ADF)</option>
                      </optgroup>
                      <optgroup label="Graph">
                        <option value="histogram">Histogram</option>
                        <option value="boxplot">Boxplot</option>
                        <option value="scatter">Scatter Plot</option>
                        <option value="probplot">Probability Plot</option>
                        <option value="timeseries">Time Series Plot</option>
                        <option value="barchart">Bar Chart</option>
                        <option value="piechart">Pie Chart</option>
                      </optgroup>
                    </select>
                  </div>
                  ${rb('scSend', 'send', 'Buka & analisis', 'Bawa data lembar kerja ke metode terpilih', 'pri')}
                </div>
                <div class="sc-glabel">Metode Stat / Graph</div>
              </div>
            </div>
          </div>
        </div>

        <div class="sc-msgs">
          <p class="sc-msg err" id="scErr" role="alert" hidden></p>
          <p class="sc-msg ok" id="scOk" role="status" hidden></p>
          <p class="sc-msg err" id="scErr2" role="alert" hidden></p>
          <p class="sc-msg ok" id="scOk2" role="status" hidden></p>
          <p class="sc-msg err" id="scErr3" role="alert" hidden></p>
          <p class="sc-msg err" id="scErr4" role="alert" hidden></p>
        </div>

        <div class="sc-body">
          <div class="sc-panel" id="scPastePanel" hidden>
            <h4 class="sc-h4" style="margin-top:0">Tempel data dari Excel</h4>
            <textarea id="scPasteArea" spellcheck="false" placeholder="Tempel data di sini (Ctrl+V)&hellip;" aria-label="Data tempelan"></textarea>
            <div class="sc-bar c2">
              <button type="button" class="btn-primary" id="scPasteRead">Baca Data</button>
              <button type="button" class="btn-ghost" id="scPasteCancel">Batal</button>
            </div>
          </div>
          <div class="sc-fxrow">
            <input type="text" class="sc-name" id="scName" value="A1" spellcheck="false" autocomplete="off" aria-label="Kotak nama: alamat sel atau rentang, mis. A1:C10">
            <input type="text" class="sc-fx" id="scFx" spellcheck="false" autocomplete="off" aria-label="Isi sel / rumus" placeholder="Isi sel atau rumus">
          </div>
          <div class="sc-scroll" id="scScroll" tabindex="-1">
            <div class="sc-head" id="scHead"></div>
            <div class="sc-inner" id="scInner"><div class="sc-rows" id="scRows"></div></div>
          </div>
          <p class="sc-note" id="scInfo"></p>
          <div class="sc-tips">
            <p class="sc-tip" data-tip="file">Tempel blok sel dari Excel, unggah .xlsx / .csv, atau buat tabel baru lalu isi langsung di lembar kerja.</p>
            <p class="sc-tip" data-tip="edit" hidden>Pilih rentang dengan menyeret mouse, Shift+klik, Shift+panah, klik huruf kolom / nomor baris, atau ketik alamat (mis. A1:C10) di kotak nama. Delete mengosongkan rentang; Ctrl+C / X / V menyalin, memotong, menempel; Ctrl+D / R mengisi ke bawah / kanan. Awali dengan = untuk rumus.</p>
            <p class="sc-tip" data-tip="fungsi" hidden>Hasil berupa rumus yang diisi ke bawah, jadi ikut berubah bila data sumber diedit. Rumus bebas: tulis huruf kolom saja, mis. LOG10(A), (A-B)^2, IF(A&gt;100,A,0).</p>
            <p class="sc-tip" data-tip="kirim" hidden>Data (termasuk kolom hasil rumus) dibawa ke metode terpilih; tombol kembali membawa Anda ke lembar ini dengan data utuh. ANOVA belum menerima data dari Calc: salin kolom lalu tempel ke tabel ANOVA.</p>
          </div>
        </div>
      </section>
    </div>`;
  document.body.insertBefore(section, $('#profileOverlay'));

  const q = (id) => $('#' + id, section);
  const elScroll = q('scScroll'), elHead = q('scHead'), elInner = q('scInner'), elRows = q('scRows');
  const elName = q('scName'), elFx = q('scFx'), elInfo = q('scInfo');

  function flash(id, msg, ms) { const e = q(id); $$('.sc-msg', section).forEach((m) => { if (m !== e) m.hidden = true; }); e.textContent = msg; e.hidden = false; clearTimeout(e._t); if (ms) e._t = setTimeout(() => { e.hidden = true; }, ms); }
  function hide(id) { q(id).hidden = true; }

  /* ----------------------------- Render grid ------------------------------ */
  let rStart = -1, rEnd = -1, rafId = 0, prevMulti = false;
  // Baris/kolom yang digambar minimal selebar & setinggi area lembar kerja, jadi tidak ada ruang kosong di kanan/bawah.
  function vC() { return Math.min(MAX_C, Math.max(S.C, Math.ceil((elScroll.clientWidth - GUT) / CW))); }
  function vR() { return Math.min(MAX_R, Math.max(S.R, Math.ceil((elScroll.clientHeight - 32) / RH))); }
  function totalW() { return GUT + vC() * CW; }

  /* Seleksi: rentang = kotak antara sel aktif (sel) dan ujung seberang (ext) */
  const SELC = ['in', 'act', 'sT', 'sB', 'sL', 'sR'];
  function rect() { return { r1: Math.min(sel.r, ext.r), r2: Math.max(sel.r, ext.r), c1: Math.min(sel.c, ext.c), c2: Math.max(sel.c, ext.c) }; }
  function isMulti() { return sel.r !== ext.r || sel.c !== ext.c; }
  function rangeLabel() { const R = rect(); return isMulti() ? colName(R.c1) + (R.r1 + 1) + ':' + colName(R.c2) + (R.r2 + 1) : colName(sel.c) + (sel.r + 1); }
  function selClass(r, c) {
    if (!isMulti()) return '';
    const R = rect();
    if (r < R.r1 || r > R.r2 || c < R.c1 || c > R.c2) return '';
    let k = ' in';
    if (r === sel.r && c === sel.c) k += ' act';
    if (r === R.r1) k += ' sT';
    if (r === R.r2) k += ' sB';
    if (c === R.c1) k += ' sL';
    if (c === R.c2) k += ' sR';
    return k;
  }

  function buildHead() {
    const R = rect(), n = vC();
    let h = `<div class="sc-corner" title="Pilih seluruh data"></div>`;
    for (let c = 0; c < n; c++) h += `<div class="sc-ch${c >= R.c1 && c <= R.c2 ? ' on' : ''}" data-c="${c}">${colName(c)}</div>`;
    elHead.innerHTML = h;
    elHead.style.width = totalW() + 'px';
  }
  function cellClass(r, c, v, t) {
    let k = 'sc-cell';
    if (S.header && r === 0) k += ' hdr';
    else if (typeof v === 'number') k += '';
    else k += ' txt';
    if (isErr(v)) k += ' er';
    if (t.charAt(0) === '=') k += ' fx';
    return k + selClass(r, c);
  }
  function rowHTML(r) {
    const R = rect(), n = vC();
    let h = `<div class="sc-row" data-r="${r}"><div class="sc-gut${r >= R.r1 && r <= R.r2 ? ' on' : ''}">${r + 1}</div>`;
    for (let c = 0; c < n; c++) {
      const t = raw(r, c), v = cellVal(r, c);
      h += `<input class="${cellClass(r, c, v, t)}" data-r="${r}" data-c="${c}" value="${esc(display(v))}" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="text" aria-label="${colName(c)}${r + 1}">`;
    }
    return h + '</div>';
  }
  function layout() {
    elInner.style.height = (vR() * RH) + 'px';
    elInner.style.width = totalW() + 'px';
    elScroll.dataset.rows = S.R;
  }
  function renderRows(force) {
    const top = Math.max(0, elScroll.scrollTop - 32);
    const vis = Math.ceil(elScroll.clientHeight / RH) + 1;
    const total = vR();
    const a = Math.max(0, Math.floor(top / RH) - OVERSCAN), b = Math.min(total - 1, a + vis + OVERSCAN * 2);
    if (!force && a === rStart && b === rEnd) return;
    const active = document.activeElement;
    const keep = active && active.classList && active.classList.contains('sc-cell') ? { r: +active.dataset.r, c: +active.dataset.c, v: active.value, s: active.selectionStart } : null;
    rStart = a; rEnd = b;
    let h = '';
    for (let r = a; r <= b; r++) h += rowHTML(r);
    elRows.style.top = (a * RH) + 'px';
    elRows.innerHTML = h;
    if (keep && keep.r >= a && keep.r <= b) {
      const inp = cellInput(keep.r, keep.c);
      if (inp) { inp.focus({ preventScroll: true }); inp.value = keep.v; try { inp.setSelectionRange(keep.s, keep.s); } catch (e) { /* abaikan */ } }
    }
  }
  function cellInput(r, c) { return elRows.querySelector(`input[data-r="${r}"][data-c="${c}"]`); }
  function refreshVisible() {
    $$('.sc-cell', elRows).forEach((inp) => {
      if (inp === document.activeElement) return;
      const r = +inp.dataset.r, c = +inp.dataset.c, t = raw(r, c), v = cellVal(r, c);
      inp.value = display(v);
      inp.className = cellClass(r, c, v, t);
    });
  }
  function fullRender(keepScroll) {
    const st = elScroll.scrollTop, sl = elScroll.scrollLeft;
    layout(); buildHead(); rStart = rEnd = -1; renderRows(true);
    if (keepScroll) { elScroll.scrollTop = st; elScroll.scrollLeft = sl; }
    updateInfo(); updateSelects(); updateSelUI(true);
  }
  // Dipakai saat ukuran area berubah (jendela diubah / sidebar dibuka): isi ulang kolom & baris agar lembar tetap penuh.
  function refit() { layout(); buildHead(); renderRows(true); updateSelUI(true); }
  elScroll.addEventListener('scroll', () => { if (rafId) return; rafId = requestAnimationFrame(() => { rafId = 0; renderRows(false); }); });

  function updateInfo() {
    const last = lastDataRow(), ub = usedBounds();
    elInfo.textContent = last < 0 ? `Lembar masih kosong. Batas lembar: ${MAX_R} baris × ${MAX_C} kolom.` : `Data terisi: ${last + 1} baris × ${ub.C} kolom. Batas lembar: ${MAX_R} baris × ${MAX_C} kolom.`;
  }
  function updateUndoBtn() { q('scUndo').disabled = undoStack.length === 0; q('scRedo').disabled = redoStack.length === 0; }

  /* ----------------------------- Seleksi sel ------------------------------ */
  function updateSelUI(forceCells) {
    const R = rect(), multi = isMulti(), active = document.activeElement;
    if (active !== elName) elName.value = rangeLabel();
    if (active !== elFx) elFx.value = raw(sel.r, sel.c);
    $$('.sc-ch', elHead).forEach((e) => { const c = +e.dataset.c; e.classList.toggle('on', c >= R.c1 && c <= R.c2); });
    $$('.sc-gut', elRows).forEach((e) => { const r = +e.parentNode.dataset.r; e.classList.toggle('on', r >= R.r1 && r <= R.r2); });
    if (multi || prevMulti || forceCells) {
      $$('.sc-cell', elRows).forEach((inp) => {
        SELC.forEach((k) => inp.classList.remove(k));
        const k = selClass(+inp.dataset.r, +inp.dataset.c);
        if (k) k.trim().split(' ').forEach((x) => inp.classList.add(x));
      });
    }
    prevMulti = multi;
  }
  function select(r, c) { sel.r = ext.r = r; sel.c = ext.c = c; updateSelUI(); }
  function extendTo(r, c) { ext.r = r; ext.c = c; updateSelUI(); }

  function scrollToCell(r, c) {
    const y = r * RH, h = elScroll.clientHeight;
    if (y < elScroll.scrollTop) elScroll.scrollTop = y;
    else if (y + RH + 32 > elScroll.scrollTop + h) elScroll.scrollTop = y + RH + 32 - h;
    const x = c * CW, w = elScroll.clientWidth - GUT;
    if (x < elScroll.scrollLeft) elScroll.scrollLeft = x;
    else if (x + CW > elScroll.scrollLeft + w) elScroll.scrollLeft = x + CW - w;
    renderRows(false);
  }
  /* Fokus ke sel tanpa memutus rentang (dipakai setelah seret / Shift+klik / pilih kolom). */
  function focusCell(r, c, noScroll) {
    keepRange = true;
    if (!noScroll) scrollToCell(r, c);
    let inp = cellInput(r, c);
    if (!inp && !noScroll) { renderRows(true); inp = cellInput(r, c); }
    (inp || elScroll).focus({ preventScroll: true });
    keepRange = false;
  }
  function goTo(r, c, opts) {
    r = Math.max(0, Math.min(MAX_R - 1, r)); c = Math.max(0, Math.min(MAX_C - 1, c));
    if (r >= vR()) { ensure(r + 1, S.C); layout(); }
    if (c >= vC()) { ensure(S.R, c + 1); layout(); buildHead(); }
    scrollToCell(r, c);
    let inp = cellInput(r, c);
    if (!inp) { renderRows(true); inp = cellInput(r, c); }
    if (inp) { inp.focus({ preventScroll: true }); if (!(opts && opts.noSelect)) { try { inp.select(); } catch (e) { /* abaikan */ } } }
    select(r, c);
  }
  function cellAt(x, y) {
    const b = elScroll.getBoundingClientRect();
    const c = Math.floor((x - b.left - GUT + elScroll.scrollLeft) / CW), r = Math.floor((y - b.top - 32 + elScroll.scrollTop) / RH);
    return { r: Math.max(0, Math.min(vR() - 1, r)), c: Math.max(0, Math.min(vC() - 1, c)) };
  }
  function gotoRange(txt) {
    let r1, c1, r2, c2, m;
    if ((m = /^\s*([A-Za-z]{1,3})(\d+)\s*(?::\s*([A-Za-z]{1,3})(\d+))?\s*$/.exec(txt))) {
      c1 = colIndex(m[1]); r1 = +m[2] - 1; c2 = m[3] ? colIndex(m[3]) : c1; r2 = m[4] ? +m[4] - 1 : r1;
    } else if ((m = /^\s*([A-Za-z]{1,3})\s*:\s*([A-Za-z]{1,3})\s*$/.exec(txt))) {
      c1 = colIndex(m[1]); c2 = colIndex(m[2]); r1 = 0; r2 = vR() - 1;
    } else return false;
    if (![r1, c1, r2, c2].every((x) => x >= 0) || Math.max(r1, r2) >= MAX_R || Math.max(c1, c2) >= MAX_C) return false;
    const mr = Math.max(r1, r2), mc = Math.max(c1, c2);
    if (mr >= vR()) ensure(mr + 1, S.C);
    if (mc >= vC()) ensure(S.R, mc + 1);
    layout(); buildHead();
    sel.r = r1; sel.c = c1; ext.r = r2; ext.c = c2;
    updateSelUI(); focusCell(r1, c1);
    return true;
  }
  elName.addEventListener('focus', () => { try { elName.select(); } catch (e) { /* abaikan */ } });
  elName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (!gotoRange(elName.value)) flash('scErr', 'Alamat tidak dikenali. Tulis seperti B3, A1:C10, atau A:C.', 5000); else hide('scErr'); }
    else if (e.key === 'Escape') { elName.blur(); }
  });
  elName.addEventListener('blur', () => updateSelUI());

  /* Seret mouse / Shift+klik untuk memilih rentang */
  let drag = null;
  elScroll.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const inp = e.target.closest ? e.target.closest('.sc-cell') : null;
    if (!inp) return;
    const r = +inp.dataset.r, c = +inp.dataset.c;
    if (e.shiftKey) { e.preventDefault(); extendTo(r, c); focusCell(sel.r, sel.c, true); return; }
    drag = { r, c, on: false };
  });
  document.addEventListener('mousemove', (e) => {
    if (!drag) return;
    if (!(e.buttons & 1)) { drag = null; elScroll.classList.remove('dragging'); return; }
    const p = cellAt(e.clientX, e.clientY);
    if (!drag.on) {
      if (p.r === drag.r && p.c === drag.c) return;
      drag.on = true; elScroll.classList.add('dragging');
      const a = document.activeElement; if (a && a.blur) a.blur();
      const gs = window.getSelection && window.getSelection(); if (gs && gs.removeAllRanges) gs.removeAllRanges();
    }
    const b = elScroll.getBoundingClientRect();
    if (e.clientY > b.bottom - 28) elScroll.scrollTop += 28; else if (e.clientY < b.top + 60) elScroll.scrollTop -= 28;
    if (e.clientX > b.right - 28) elScroll.scrollLeft += 28; else if (e.clientX < b.left + GUT + 28) elScroll.scrollLeft -= 28;
    if (p.r !== ext.r || p.c !== ext.c) extendTo(p.r, p.c);
  });
  document.addEventListener('mouseup', () => {
    if (!drag) return;
    const was = drag.on; drag = null; elScroll.classList.remove('dragging');
    if (was) focusCell(sel.r, sel.c, true);
  });
  /* Klik huruf kolom / nomor baris / pojok kiri atas */
  function finishSel() { updateSelUI(); focusCell(sel.r, sel.c, true); }
  elScroll.addEventListener('click', (e) => {
    const ch = e.target.closest('.sc-ch'), gu = e.target.closest('.sc-gut'), co = e.target.closest('.sc-corner');
    if (ch) { const c = +ch.dataset.c; if (!e.shiftKey) sel.c = c; sel.r = 0; ext.r = vR() - 1; ext.c = c; finishSel(); }
    else if (gu) { const r = +gu.parentNode.dataset.r; if (!e.shiftKey) sel.r = r; sel.c = 0; ext.c = vC() - 1; ext.r = r; finishSel(); }
    else if (co) { const ub = usedBounds(); sel.r = 0; sel.c = 0; ext.r = Math.max(0, ub.R - 1); ext.c = Math.max(0, ub.C - 1); finishSel(); }
  });

  /* ------------------------------ Edit sel -------------------------------- */
  function normalizeInput(t) {
    t = t.replace(/ /g, ' ');
    if (t.charAt(0) === '=') return t.trim();
    const s = t.trim();
    if (/^[-+]?\d+,\d+$/.test(s)) return s.replace(',', '.');
    return t;
  }
  function commit(r, c, text) {
    text = normalizeInput(text);
    if (raw(r, c) === text) return false;
    pushUndo();
    setRaw(r, c, text);
    invalidate();
    return true;
  }
  elRows.addEventListener('focusin', (e) => {
    const inp = e.target;
    if (!inp.classList || !inp.classList.contains('sc-cell')) return;
    const r = +inp.dataset.r, c = +inp.dataset.c;
    inp.value = raw(r, c);
    inp._orig = inp.value;
    if (keepRange) updateSelUI(); else select(r, c);
  });
  elRows.addEventListener('input', (e) => { if (e.target.classList.contains('sc-cell')) elFx.value = e.target.value; });
  elRows.addEventListener('focusout', (e) => {
    const inp = e.target;
    if (!inp.classList || !inp.classList.contains('sc-cell')) return;
    const r = +inp.dataset.r, c = +inp.dataset.c;
    const changed = inp.value !== (inp._orig === undefined ? raw(r, c) : inp._orig) ? commit(r, c, inp.value) : false;
    inp._orig = undefined;
    if (changed) { updateInfo(); updateSelects(); }
    const v = cellVal(r, c), t = raw(r, c);
    inp.value = display(v); inp.className = cellClass(r, c, v, t);
    if (changed) refreshVisible();
  });
  const cellOf = (t) => (t && t.classList && t.classList.contains('sc-cell') ? t : null);
  const ARROWS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  elScroll.addEventListener('keydown', (e) => {
    const inp = cellOf(e.target), k = e.key, mod = e.ctrlKey || e.metaKey;
    const r = sel.r, c = sel.c;
    if (mod && !e.shiftKey && !e.altKey && (k === 'd' || k === 'D')) { e.preventDefault(); fillDown(); return; }
    if (mod && !e.shiftKey && !e.altKey && (k === 'r' || k === 'R')) { e.preventDefault(); fillRight(); return; }
    if (!mod && isMulti() && (k === 'Delete' || k === 'Backspace')) { e.preventDefault(); clearRange(); return; }
    if (e.shiftKey && !mod && ARROWS[k]) {
      const horiz = k === 'ArrowLeft' || k === 'ArrowRight';
      const atEdge = inp && (k === 'ArrowRight' ? (inp.selectionStart === inp.value.length && inp.selectionEnd === inp.value.length) : (inp.selectionStart === 0 && inp.selectionEnd === 0));
      if (!horiz || !inp || isMulti() || atEdge) {
        e.preventDefault();
        const d = ARROWS[k], nr = Math.max(0, Math.min(vR() - 1, ext.r + d[0])), nc = Math.max(0, Math.min(vC() - 1, ext.c + d[1]));
        extendTo(nr, nc); scrollToCell(nr, nc);
        if (!elScroll.contains(document.activeElement) || document.activeElement === document.body) focusCell(sel.r, sel.c, true);
        return;
      }
    }
    if (!inp) {
      if (ARROWS[k] && !e.shiftKey) { e.preventDefault(); goTo(r + ARROWS[k][0], c + ARROWS[k][1], { noSelect: true }); }
      return;
    }
    if (k === 'Enter') { e.preventDefault(); goTo(e.shiftKey ? r - 1 : r + 1, c); }
    else if (k === 'Tab') { e.preventDefault(); goTo(r, e.shiftKey ? c - 1 : c + 1); }
    else if (k === 'ArrowDown') { e.preventDefault(); goTo(r + 1, c); }
    else if (k === 'ArrowUp') { e.preventDefault(); goTo(r - 1, c); }
    else if (k === 'ArrowRight' && inp.selectionStart === inp.value.length && inp.selectionEnd === inp.value.length) { e.preventDefault(); goTo(r, c + 1); }
    else if (k === 'ArrowLeft' && inp.selectionStart === 0 && inp.selectionEnd === 0) { e.preventDefault(); goTo(r, c - 1); }
    else if (k === 'Escape') { inp.value = raw(r, c); inp._orig = inp.value; inp.blur(); }
  });
  elFx.addEventListener('focus', () => { elFx._orig = elFx.value; });
  elFx.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (commit(sel.r, sel.c, elFx.value)) { updateInfo(); } refreshVisible(); const inp = cellInput(sel.r, sel.c); if (inp) inp.value = display(cellVal(sel.r, sel.c)); goTo(sel.r + 1, sel.c); }
    else if (e.key === 'Escape') { elFx.value = raw(sel.r, sel.c); elFx.blur(); }
  });
  elFx.addEventListener('blur', () => {
    if (elFx.value !== raw(sel.r, sel.c) && elFx._orig !== undefined && elFx.value !== elFx._orig) { if (commit(sel.r, sel.c, elFx.value)) updateInfo(); }
    elFx.value = raw(sel.r, sel.c); refreshVisible();
  });

  /* ------------- Salin / Potong / Tempel / Isi (rentang sel) -------------- */
  /* Menulis ulang referensi sel di dalam rumus (lewati teks di antara tanda kutip). */
  const REFP = '(\\$?)([A-Za-z]{1,3})(\\$?)(\\d+)';
  function mapFormula(f, cb) {
    return f.split('"').map((seg, i) => (i % 2 ? seg : seg.replace(new RegExp('(^|[^A-Za-z0-9_$.])' + REFP + '(?::' + REFP + ')?(?![A-Za-z0-9_(])', 'g'),
      (m, pre, a1, a2, a3, a4, b1, b2, b3, b4) => {
        const a = { dc: a1, c: colIndex(a2), dr: a3, r: +a4 - 1 };
        const b = b2 ? { dc: b1, c: colIndex(b2), dr: b3, r: +b4 - 1 } : null;
        return pre + cb(a, b);
      }))).join('"');
  }
  const okRef = (x) => x.r >= 0 && x.c >= 0 && x.r < MAX_R && x.c < MAX_C;
  const fmtRef = (x) => x.dc + colName(x.c) + x.dr + (x.r + 1);
  function shiftFormula(f, dr, dc) {
    return mapFormula(f, (a, b) => {
      const mv = (x) => ({ dc: x.dc, dr: x.dr, c: x.dc ? x.c : x.c + dc, r: x.dr ? x.r : x.r + dr });
      const A = mv(a), B = b ? mv(b) : null;
      if (!okRef(A) || (B && !okRef(B))) return '#REF!';
      return fmtRef(A) + (B ? ':' + fmtRef(B) : '');
    });
  }
  /* Sesuaikan rumus saat baris/kolom disisipkan atau dihapus */
  function adjustFormula(f, axis, kind, at, n) {
    const key = axis, end = at + n - 1;
    return mapFormula(f, (a, b) => {
      if (!b) {
        let v = a[key];
        if (kind === 'ins') { if (v >= at) v += n; }
        else { if (v >= at && v <= end) return '#REF!'; if (v > end) v -= n; }
        return fmtRef(Object.assign({}, a, { [key]: v }));
      }
      const s0 = Math.min(a[key], b[key]), e0 = Math.max(a[key], b[key]);
      let ns, ne;
      if (kind === 'ins') { ns = s0 >= at ? s0 + n : s0; ne = e0 >= at ? e0 + n : e0; }
      else {
        if (s0 >= at && e0 <= end) return '#REF!';
        ns = s0 < at ? s0 : (s0 > end ? s0 - n : at);
        ne = e0 < at ? e0 : (e0 > end ? e0 - n : at - 1);
      }
      const lowFirst = a[key] <= b[key];
      return fmtRef(Object.assign({}, a, { [key]: lowFirst ? ns : ne })) + ':' + fmtRef(Object.assign({}, b, { [key]: lowFirst ? ne : ns }));
    });
  }
  function adjustAll(axis, kind, at, n) {
    S.cells.forEach((row) => { for (let i = 0; i < row.length; i++) if (row[i].charAt(0) === '=') row[i] = adjustFormula(row[i], axis, kind, at, n); });
  }

  function tsvOf(R) {
    const lines = [];
    for (let r = R.r1; r <= R.r2; r++) {
      const row = [];
      for (let c = R.c1; c <= R.c2; c++) {
        const v = cellVal(r, c);
        let t = isErr(v) ? v.code : (typeof v === 'number' ? String(v) : display(v));
        if (/[\t\n"]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
        row.push(t);
      }
      lines.push(row.join('\t'));
    }
    return lines.join('\n');
  }
  function buildClip(cut) {
    const R0 = rect(), ub = usedBounds();
    const R = { r1: R0.r1, c1: R0.c1, r2: Math.max(R0.r1, Math.min(R0.r2, ub.R - 1)), c2: Math.max(R0.c1, Math.min(R0.c2, ub.C - 1)) };
    const raws = [];
    for (let r = R.r1; r <= R.r2; r++) { const row = []; for (let c = R.c1; c <= R.c2; c++) row.push(raw(r, c)); raws.push(row); }
    clip = { R, raws, text: tsvOf(R), cut: !!cut };
    return clip.text;
  }
  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* abaikan */ }
    ta.remove();
  }
  function writeClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    legacyCopy(text); return Promise.resolve();
  }
  function copyMsg(cut) { flash('scOk', (cut ? 'Dipotong: ' : 'Disalin: ') + rangeLabel() + (cut ? '. Pilih sel tujuan lalu klik Tempel (Ctrl+V).' : '.'), 3500); }
  async function doCopy(cut) { const text = buildClip(cut); await writeClipboard(text); focusCell(sel.r, sel.c, true); copyMsg(cut); }

  /* Tulis blok teks mentah mulai (r0,c0); clearR = rentang asal bila ini pemindahan (potong) */
  function writeBlock(grid, r0, c0, clearR) {
    if (!grid.length) return;
    const w = Math.max.apply(null, grid.map((x) => x.length));
    const nR = r0 + grid.length, nC = c0 + w;
    if (nR > MAX_R || nC > MAX_C) flash('scErr', `Data tempelan dipotong sesuai batas lembar (${MAX_R} baris × ${MAX_C} kolom).`, 6000);
    pushUndo();
    if (clearR) for (let r = clearR.r1; r <= clearR.r2; r++) for (let c = clearR.c1; c <= clearR.c2; c++) if (r < S.R && c < S.C) S.cells[r][c] = '';
    ensure(nR, nC);
    grid.forEach((row, i) => row.forEach((v, j) => { const r = r0 + i, c = c0 + j; if (r < MAX_R && c < MAX_C) S.cells[r][c] = v; }));
    sel.r = r0; sel.c = c0; ext.r = Math.min(MAX_R - 1, nR - 1); ext.c = Math.min(MAX_C - 1, nC - 1);
    invalidate(); fullRender(true);
  }
  function pasteBlock(grid, r0, c0) { writeBlock(grid.map((row) => row.map((v) => normalizeInput(String(v)))), r0, c0); }
  function pasteClip(R) {
    const src = clip.R, h = clip.raws.length, w = clip.raws[0].length;
    const tile = h === 1 && w === 1 && (R.r2 > R.r1 || R.c2 > R.c1);   // 1 sel disalin -> isi seluruh rentang tujuan
    const th = tile ? R.r2 - R.r1 + 1 : h, tw = tile ? R.c2 - R.c1 + 1 : w;
    const grid = [];
    for (let i = 0; i < th; i++) {
      const row = [];
      for (let j = 0; j < tw; j++) {
        const si = tile ? 0 : i, sj = tile ? 0 : j, t = clip.raws[si][sj];
        row.push(!clip.cut && t.charAt(0) === '=' ? shiftFormula(t, (R.r1 + i) - (src.r1 + si), (R.c1 + j) - (src.c1 + sj)) : t);
      }
      grid.push(row);
    }
    const moved = clip.cut ? src : null;
    writeBlock(grid, R.r1, R.c1, moved);
    if (clip.cut) clip = null;
  }
  function fillRect(R, v) {
    pushUndo(); ensure(R.r2 + 1, R.c2 + 1);
    for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) S.cells[r][c] = v;
    invalidate(); fullRender(true);
  }
  function clearRange() {
    const R = rect();
    pushUndo();
    for (let r = R.r1; r <= Math.min(R.r2, S.R - 1); r++) for (let c = R.c1; c <= Math.min(R.c2, S.C - 1); c++) S.cells[r][c] = '';
    invalidate(); fullRender(true);
    flash('scOk', `Isi ${rangeLabel()} dikosongkan. Klik “Urungkan” bila salah.`, 3500);
  }
  const samePaste = (text) => !!clip && text.replace(/\r\n?/g, '\n').replace(/\n$/, '') === clip.text;
  const isGridText = (text) => /[\t\n\r]/.test(text.replace(/[\r\n]+$/, ''));
  function pasteText(text) {
    const R = rect();
    if (samePaste(text)) pasteClip(R);
    else if (isGridText(text)) pasteBlock(parseDelimited(text), R.r1, R.c1);
    else fillRect(R, normalizeInput(text.replace(/[\r\n]+$/, '')));
  }
  function partialSel(inp) { return inp && inp.selectionStart !== inp.selectionEnd && !(inp.selectionStart === 0 && inp.selectionEnd === inp.value.length); }
  elScroll.addEventListener('copy', (e) => {
    const inp = cellOf(e.target);
    if (!isMulti() && partialSel(inp)) return;            // sedang menyalin potongan teks di dalam sel: bawaan browser
    e.preventDefault(); e.clipboardData.setData('text/plain', buildClip(false)); copyMsg(false);
  });
  elScroll.addEventListener('cut', (e) => {
    const inp = cellOf(e.target);
    if (!isMulti() && partialSel(inp)) return;
    e.preventDefault(); e.clipboardData.setData('text/plain', buildClip(true)); copyMsg(true);
  });
  elScroll.addEventListener('paste', (e) => {
    const inp = cellOf(e.target);
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text) return;
    if (inp && !isMulti() && (partialSel(inp) || (!samePaste(text) && !isGridText(text)))) return;   // satu nilai ke satu sel: bawaan browser
    e.preventDefault(); pasteText(text);
  });
  q('scCopy').addEventListener('click', () => { doCopy(false); });
  q('scCut').addEventListener('click', () => { doCopy(true); });
  q('scPaste').addEventListener('click', async () => {
    let text = null;
    try { text = await navigator.clipboard.readText(); } catch (err) { /* diblokir browser */ }
    if (!text && clip) text = clip.text;
    if (!text) { flash('scErr', 'Papan klip kosong atau diblokir browser. Klik sel tujuan lalu tekan Ctrl+V.', 6000); return; }
    pasteText(text);
  });

  /* Isi ke bawah / ke kanan: baris (kolom) pertama rentang menjadi sumber, rumus ikut menyesuaikan */
  function fillDown() {
    const R = rect();
    let src = R.r1, from = R.r1 + 1;
    if (R.r1 === R.r2) { if (R.r1 === 0) { flash('scErr', 'Tidak ada sel di atas untuk disalin. Pilih rentang beberapa baris, lalu Isi ke bawah.', 5000); return; } src = R.r1 - 1; from = R.r1; }
    pushUndo(); ensure(R.r2 + 1, R.c2 + 1);
    for (let c = R.c1; c <= R.c2; c++) {
      const base = raw(src, c);
      for (let r = from; r <= R.r2; r++) S.cells[r][c] = base.charAt(0) === '=' ? shiftFormula(base, r - src, 0) : base;
    }
    invalidate(); fullRender(true);
    flash('scOk', `Diisi ke bawah: ${colName(R.c1)}${from + 1}\u2013${colName(R.c2)}${R.r2 + 1} dari baris ${src + 1}.`, 4000);
  }
  function fillRight() {
    const R = rect();
    let src = R.c1, from = R.c1 + 1;
    if (R.c1 === R.c2) { if (R.c1 === 0) { flash('scErr', 'Tidak ada sel di kiri untuk disalin. Pilih rentang beberapa kolom, lalu Isi ke kanan.', 5000); return; } src = R.c1 - 1; from = R.c1; }
    pushUndo(); ensure(R.r2 + 1, R.c2 + 1);
    for (let r = R.r1; r <= R.r2; r++) {
      const base = raw(r, src);
      for (let c = from; c <= R.c2; c++) S.cells[r][c] = base.charAt(0) === '=' ? shiftFormula(base, 0, c - src) : base;
    }
    invalidate(); fullRender(true);
    flash('scOk', `Diisi ke kanan: ${colName(from)}${R.r1 + 1}\u2013${colName(R.c2)}${R.r2 + 1} dari kolom ${colName(src)}.`, 4000);
  }
  q('scFillDown').addEventListener('click', fillDown);
  q('scFillRight').addEventListener('click', fillRight);


  /* ------------------------------ Tab pita -------------------------------- */
  function showTab(name) {
    $$('.sc-tab', section).forEach((b) => { const on = b.dataset.tab === name; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
    $$('.sc-rpanel', section).forEach((p) => p.classList.toggle('on', p.dataset.panel === name));
    $$('.sc-tip', section).forEach((p) => { p.hidden = p.dataset.tip !== name; });
    if (name === 'fungsi') updateSelects();
  }
  $$('.sc-tab', section).forEach((b, i, all) => {
    b.addEventListener('click', () => showTab(b.dataset.tab));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const n = all[(i + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
      n.focus(); showTab(n.dataset.tab);
    });
  });

  /* ------------------------ Sisip / hapus baris & kolom -------------------- */
  function insertLines(axis, at, n) {
    const isR = axis === 'r', used = isR ? lastDataRow() + 1 : usedBounds().C, MAX = isR ? MAX_R : MAX_C, nm = isR ? 'baris' : 'kolom';
    if (at >= used) { flash('scOk', `Tidak ada data di ${isR ? 'bawah' : 'kanan'} posisi ini, jadi tidak ada yang perlu digeser.`, 4000); return; }
    if (used + n > MAX) { flash('scErr', `Tidak bisa menyisipkan: melebihi batas ${MAX} ${nm}.`, 5000); return; }
    let note = '';
    if (isR && S.header && at === 0) { at = 1; note = ' Baris 1 adalah judul kolom, jadi sisipan ditaruh tepat di bawahnya.'; }
    pushUndo();
    if (isR) { S.cells.splice(at, 0, ...Array.from({ length: n }, () => new Array(S.C).fill(''))); S.R += n; }
    else { S.cells.forEach((row) => row.splice(at, 0, ...new Array(n).fill(''))); S.C += n; }
    if (S.R > MAX_R) { S.cells.length = MAX_R; S.R = MAX_R; }
    if (S.C > MAX_C) { S.cells.forEach((row) => { row.length = MAX_C; }); S.C = MAX_C; }
    adjustAll(axis, 'ins', at, n);
    invalidate(); fullRender(true);
    flash('scOk', `${n} ${nm} kosong disisipkan di ${isR ? 'baris ' + (at + 1) : 'kolom ' + colName(at)}; rumus ikut menyesuaikan.${note}`, 5000);
  }
  function deleteLines(axis, a, b) {
    const isR = axis === 'r', size = isR ? S.R : S.C, nm = isR ? 'baris' : 'kolom';
    if (a >= size) { flash('scOk', `Posisi ini di luar data, tidak ada ${nm} yang perlu dihapus.`, 4000); return; }
    b = Math.min(b, size - 1);
    const n = b - a + 1;
    pushUndo();
    if (isR) { S.cells.splice(a, n); S.R -= n; if (S.R < 1) { S.cells = emptyCells(1, S.C); S.R = 1; } }
    else { S.cells.forEach((row) => row.splice(a, n)); S.C -= n; if (S.C < 1) { S.cells = emptyCells(S.R, 1); S.C = 1; } }
    adjustAll(axis, 'del', a, n);
    let note = '';
    if (isR && S.header && a === 0) { S.header = false; q('scHeader').checked = false; note = ' Baris judul ikut terhapus, jadi opsi “Baris 1 judul kolom” dimatikan.'; }
    if (isR) { sel.r = ext.r = Math.min(a, vR() - 1); ext.c = sel.c; } else { sel.c = ext.c = Math.min(a, vC() - 1); ext.r = sel.r; }
    invalidate(); fullRender(true);
    flash('scOk', `${n} ${nm} dihapus (${isR ? 'baris ' + (a + 1) + (n > 1 ? '\u2013' + (b + 1) : '') : 'kolom ' + colName(a) + (n > 1 ? '\u2013' + colName(b) : '')}). Rumus ikut menyesuaikan; klik “Urungkan” bila salah.${note}`, 6000);
  }
  q('scInsRowUp').addEventListener('click', () => { const R = rect(); insertLines('r', R.r1, R.r2 - R.r1 + 1); });
  q('scInsRowDown').addEventListener('click', () => { const R = rect(); insertLines('r', R.r2 + 1, R.r2 - R.r1 + 1); });
  q('scDelRow').addEventListener('click', () => { const R = rect(); deleteLines('r', R.r1, R.r2); });
  q('scInsColLeft').addEventListener('click', () => { const R = rect(); insertLines('c', R.c1, R.c2 - R.c1 + 1); });
  q('scInsColRight').addEventListener('click', () => { const R = rect(); insertLines('c', R.c2 + 1, R.c2 - R.c1 + 1); });
  q('scDelCol').addEventListener('click', () => { const R = rect(); deleteLines('c', R.c1, R.c2); });
  function applySnapshot(js) {
    restore(js); invalidate(); q('scHeader').checked = S.header;
    sel.r = Math.min(sel.r, S.R - 1); sel.c = Math.min(sel.c, S.C - 1); ext.r = sel.r; ext.c = sel.c;
    updateUndoBtn(); fullRender(true);
  }
  q('scUndo').addEventListener('click', () => {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    applySnapshot(undoStack.pop());
  });
  q('scRedo').addEventListener('click', () => {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    applySnapshot(redoStack.pop());
  });
  q('scClear').addEventListener('click', () => {
    pushUndo(); S.cells = emptyCells(S.R, S.C); invalidate(); fullRender(true);
    flash('scOk', 'Seluruh sel dikosongkan. Klik “Urungkan” bila salah.', 4000);
  });
  q('scHeader').addEventListener('change', (e) => { pushUndo(); S.header = e.target.checked; invalidate(); fullRender(true); });
  q('scNewBtn').addEventListener('click', () => {
    const C = parseInt(q('scNewC').value, 10), R = parseInt(q('scNewR').value, 10);
    if (!(C >= 1 && C <= MAX_C) || !(R >= 1 && R < MAX_R)) { flash('scErr', `Jumlah kolom 1\u2013${MAX_C} dan jumlah baris data 1\u2013${MAX_R - 1}.`, 6000); return; }
    hide('scErr');
    pushUndo();
    S.C = C; S.R = R + 1; S.header = true; q('scHeader').checked = true;
    S.cells = emptyCells(S.R, S.C);
    for (let c = 0; c < C; c++) S.cells[0][c] = 'Variabel ' + (c + 1);
    sel.r = ext.r = 1; sel.c = ext.c = 0; invalidate(); fullRender(false); elScroll.scrollTop = 0; elScroll.scrollLeft = 0;
    q('scFname').value = 'data-baru';
    flash('scOk', `Tabel baru ${R} baris \u00D7 ${C} kolom dibuat. Ganti judul kolom di baris 1, lalu isi datanya.`, 9000);
    section.scrollIntoView && q('scScroll').scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => goTo(0, 0), 400);
  });
  q('scSampleBtn').addEventListener('click', () => {
    const Y = [120, 132, 125, 140, 138, 150, 145, 160, 158, 170, 165, 180];
    const X = [10, 12, 11, 15, 14, 18, 17, 21, 20, 24, 23, 27];
    const rows = [['Periode', 'Y', 'X']];
    Y.forEach((y, i) => rows.push([String(i + 1), String(y), String(X[i])]));
    loadGrid(rows, true);
    flash('scOk', 'Contoh data dimuat. Coba tab Fungsi: pilih kolom B, operasi Log10, simpan di kolom D.', 7000);
  });

  /* -------------------------------- Impor --------------------------------- */
  function parseDelimited(text) {
    text = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    if (!text) return [];
    const firstLine = text.split('\n')[0];
    const count = (ch) => firstLine.split(ch).length - 1;
    const delim = count('\t') > 0 ? '\t' : (count(';') >= count(',') && count(';') > 0 ? ';' : (count(',') > 0 ? ',' : '\t'));
    const out = []; let row = [], cur = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch; }
      else if (ch === '"' && cur === '') inQ = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); out.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    row.push(cur); out.push(row);
    return out;
  }
  function detectHeader(rows) {
    if (rows.length < 2) return false;
    const r0 = rows[0], r1 = rows[1];
    let textFirst = 0, numSecond = 0;
    for (let c = 0; c < r0.length; c++) {
      const a = String(r0[c] === undefined ? '' : r0[c]).trim(), b = String(r1[c] === undefined ? '' : r1[c]).trim().replace(',', '.');
      if (a !== '' && Number.isNaN(parseNum(a.replace(',', '.')))) textFirst++;
      if (b !== '' && !Number.isNaN(parseNum(b))) numSecond++;
    }
    return textFirst > 0 && numSecond > 0;
  }
  function loadGrid(rows, auto) {
    rows = rows.map((r) => r.map((v) => (v === null || v === undefined ? '' : String(v))));
    // buang baris kosong di ujung
    while (rows.length && rows[rows.length - 1].every((v) => v.trim() === '')) rows.pop();
    if (!rows.length) { flash('scErr', 'Tidak ada data yang bisa dibaca.', 6000); return; }
    const maxC = Math.min(MAX_C, Math.max.apply(null, rows.map((r) => r.length)));
    const clipped = rows.length > MAX_R || Math.max.apply(null, rows.map((r) => r.length)) > MAX_C;
    rows = rows.slice(0, MAX_R);
    pushUndo();
    S.R = Math.max(rows.length, 20); S.C = Math.max(maxC, 6);
    S.cells = emptyCells(S.R, S.C);
    rows.forEach((row, r) => row.slice(0, MAX_C).forEach((v, c) => { S.cells[r][c] = normalizeInput(v); }));
    S.header = detectHeader(rows); q('scHeader').checked = S.header;
    sel.r = ext.r = 0; sel.c = ext.c = 0; invalidate(); fullRender(false); elScroll.scrollTop = 0; elScroll.scrollLeft = 0;
    hide('scErr');
    flash('scOk', `Data dimuat: ${rows.length} baris × ${Math.min(maxC, MAX_C)} kolom.${S.header ? ' Baris 1 dikenali sebagai judul kolom.' : ''}${clipped ? ' (Sebagian data dipotong karena melebihi batas lembar.)' : ''}`, 9000);
    void auto;
  }
  q('scPasteBtn').addEventListener('click', () => { const p = q('scPastePanel'); p.hidden = !p.hidden; if (!p.hidden) q('scPasteArea').focus(); });
  q('scPasteCancel').addEventListener('click', () => { q('scPastePanel').hidden = true; q('scPasteArea').value = ''; });
  q('scPasteRead').addEventListener('click', () => {
    const t = q('scPasteArea').value;
    if (!t.trim()) { flash('scErr', 'Kotak tempel masih kosong. Salin sel dari Excel lalu tempel di sini.', 6000); return; }
    loadGrid(parseDelimited(t));
    q('scPastePanel').hidden = true; q('scPasteArea').value = '';
  });

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('lib'))); s.onerror = () => reject(new Error('lib'));
      document.head.appendChild(s);
    });
  }
  function loadXLSX() { if (window.XLSX) return Promise.resolve(window.XLSX); return loadScript(XLSX_LOCAL).catch(() => loadScript(XLSX_URL)); }
  function readBuffer(file) {
    if (file.arrayBuffer) return file.arrayBuffer();
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsArrayBuffer(file); });
  }
  q('scFileBtn').addEventListener('click', () => q('scFile').click());
  q('scFile').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    hide('scErr'); hide('scOk');
    try {
      if (/\.(csv|tsv|txt)$/i.test(file.name)) {
        loadGrid(parseDelimited(await file.text()));
      } else {
        const X = await loadXLSX();
        const wb = X.read(await readBuffer(file), { type: 'array' });
        const name = wb.SheetNames[0];
        const arr = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '', blankrows: false });
        loadGrid(arr);
        if (wb.SheetNames.length > 1) flash('scOk', `File punya ${wb.SheetNames.length} lembar; yang dimuat adalah lembar pertama (“${name}”).`, 9000);
      }
      q('scFname').value = file.name.replace(/\.[^.]+$/, '') + '-calc';
    } catch (err) {
      flash('scErr', 'File tidak dapat dibaca. ' + (err && err.message === 'lib' ? 'Pustaka pembaca Excel gagal dimuat (perlu internet saat pertama kali). Simpan sebagai CSV lalu unggah, atau pakai “Tempel dari Excel”.' : 'Pastikan formatnya .xlsx atau .csv.'), 9000);
    }
  });

  /* --------------------------- Rumus kolom (tab Fungsi) -------------------- */
  const OPS = [
    { id: 'log10', label: 'Log basis 10  —  LOG10(x)', f: (s) => `LOG10(${s})` },
    { id: 'ln', label: 'Logaritma natural  —  LN(x)', f: (s) => `LN(${s})` },
    { id: 'logb', label: 'Log basis tertentu  —  LOG(x, b)', par: 'Basis (b)', def: '2', f: (s, p) => `LOG(${s},${p})` },
    { id: 'sqrt', label: 'Akar kuadrat  —  SQRT(x)', f: (s) => `SQRT(${s})` },
    { id: 'sq', label: 'Kuadrat  —  x²', f: (s) => `${s}^2` },
    { id: 'pow', label: 'Pangkat n  —  x^n', par: 'Pangkat (n)', def: '3', f: (s, p) => `${s}^${p}` },
    { id: 'exp', label: 'Eksponen  —  EXP(x)', f: (s) => `EXP(${s})` },
    { id: 'recip', label: 'Kebalikan  —  1/x', f: (s) => `1/${s}` },
    { id: 'abs', label: 'Nilai mutlak  —  ABS(x)', f: (s) => `ABS(${s})` },
    { id: 'round', label: 'Pembulatan  —  ROUND(x, d)', par: 'Desimal (d)', def: '2', f: (s, p) => `ROUND(${s},${p})` },
    { id: 'add', label: 'Tambah konstanta  —  x + k', par: 'Konstanta (k)', def: '1', f: (s, p) => `${s}+${p}` },
    { id: 'sub', label: 'Kurang konstanta  —  x − k', par: 'Konstanta (k)', def: '1', f: (s, p) => `${s}-${p}` },
    { id: 'mul', label: 'Kali konstanta  —  x × k', par: 'Konstanta (k)', def: '2', f: (s, p) => `${s}*${p}` },
    { id: 'div', label: 'Bagi konstanta  —  x ÷ k', par: 'Konstanta (k)', def: '2', f: (s, p) => `${s}/${p}` },
    { id: 'z', label: 'Standarisasi (z-score)', rng: true, f: (s, p, R) => `(${s}-AVERAGE(${R}))/STDEV(${R})` },
    { id: 'center', label: 'Pusatkan (kurangi rata-rata)', rng: true, f: (s, p, R) => `${s}-AVERAGE(${R})` },
    { id: 'minmax', label: 'Normalisasi min–maks (0–1)', rng: true, f: (s, p, R) => `(${s}-MIN(${R}))/(MAX(${R})-MIN(${R}))` },
    { id: 'pct', label: 'Persen dari total', rng: true, f: (s, p, R) => `${s}/SUM(${R})*100` },
    { id: 'cum', label: 'Kumulatif (jumlah berjalan)', cum: true },
    { id: 'diff', label: 'Selisih dengan baris sebelumnya (diferensiasi)', prev: true, f: (s, p, R, sp) => `${s}-${sp}` },
    { id: 'lag', label: 'Lag (nilai baris sebelumnya)', prev: true, f: (s, p, R, sp) => sp },
    { id: 'pctch', label: 'Perubahan persen dari baris sebelumnya', prev: true, f: (s, p, R, sp) => `(${s}-${sp})/${sp}*100` },
    { id: 'lndiff', label: 'Selisih log (log return)', prev: true, f: (s, p, R, sp) => `LN(${s}/${sp})` },
  ];
  const opSel = q('scOp'), srcSel = q('scSrc'), dstSel = q('scDst'), dstSel2 = q('scDst2');
  opSel.innerHTML = OPS.map((o) => `<option value="${o.id}">${esc(o.label)}</option>`).join('');
  function syncOp() {
    const o = OPS.find((x) => x.id === opSel.value);
    q('scParWrap').style.visibility = o.par ? 'visible' : 'hidden';
    if (o.par) { q('scParLbl').textContent = o.par; q('scPar').value = o.def; }
  }
  opSel.addEventListener('change', syncOp); syncOp();

  function updateSelects() {
    const keepS = srcSel.value, keepD = dstSel.value, keepD2 = dstSel2.value;
    const hdr = (c) => { const t = S.header ? raw(0, c) : ''; return t && t.charAt(0) !== '=' ? ` — ${t.length > 18 ? t.slice(0, 17) + '…' : t}` : ''; };
    let cols = '';
    for (let c = 0; c < S.C; c++) cols += `<option value="${c}">Kolom ${colName(c)}${esc(hdr(c))}</option>`;
    srcSel.innerHTML = cols;
    const dst = `<option value="new">Kolom baru (${usedBounds().C < MAX_C ? colName(usedBounds().C) : 'penuh'})</option>` + cols;
    dstSel.innerHTML = dst; dstSel2.innerHTML = dst;
    if (keepS && +keepS < S.C) srcSel.value = keepS;
    dstSel.value = keepD && (keepD === 'new' || +keepD < S.C) ? keepD : 'new';
    dstSel2.value = keepD2 && (keepD2 === 'new' || +keepD2 < S.C) ? keepD2 : 'new';
  }

  function firstDataRow() { return S.header ? 1 : 0; }
  function targetCol(val) {
    if (val === 'new') { const n = usedBounds().C; return n >= MAX_C ? -1 : n; }
    return +val;
  }
  function applyFormulas(dc, titleText, makeFormula) {
    const f = firstDataRow(), last = lastDataRow();
    if (last < f) { return 'Belum ada data pada lembar kerja. Impor atau ketik data terlebih dahulu.'; }
    if (dc < 0) return `Batas ${MAX_C} kolom tercapai.`;
    const overwrite = dc < S.C && (() => { for (let r = f; r <= last; r++) if (raw(r, dc) !== '') return true; return false; })();
    pushUndo();
    ensure(S.R, dc + 1);
    for (let r = f; r <= last; r++) {
      const fx = makeFormula(r, f, last);
      S.cells[r][dc] = fx === '' ? '' : '=' + fx;
    }
    if (S.header && titleText) S.cells[0][dc] = titleText;
    invalidate(); fullRender(true);
    return { dc, f, last, overwrite };
  }
  q('scApply').addEventListener('click', () => {
    hide('scErr2'); hide('scOk2');
    const o = OPS.find((x) => x.id === opSel.value);
    const sc = +srcSel.value;
    const dc = targetCol(dstSel.value);
    const par = String(q('scPar').value).trim().replace(',', '.');
    if (o.par && (par === '' || Number.isNaN(Number(par)))) { flash('scErr2', 'Parameter harus berupa angka.', 6000); return; }
    const L = colName(sc), first = firstDataRow() + 1, lastR = lastDataRow() + 1;
    const rngTxt = `${L}$${first}:${L}$${lastR}`;
    const title = q('scTitle').value.trim() || `${S.header && raw(0, sc) ? raw(0, sc) : L}_${o.id}`;
    const res = applyFormulas(dc, title, (r, f) => {
      const s = `${L}${r + 1}`;
      if (o.cum) return `SUM(${L}$${first}:${L}${r + 1})`;
      if (o.prev) return r === f ? '' : o.f(s, par, rngTxt, `${L}${r}`);
      return o.f(s, par, rngTxt, '');
    });
    if (typeof res === 'string') { flash('scErr2', res, 7000); return; }
    flash('scOk2', `Selesai: rumus diisikan ke kolom ${colName(res.dc)} baris ${res.f + 1}–${res.last + 1}.${res.overwrite ? ' Isi lama kolom itu ditimpa (bisa diurungkan).' : ''}`, 9000);
    q('scTitle').value = '';
    goTo(res.f, res.dc, { noSelect: true }); const a = document.activeElement; if (a && a.blur) a.blur();
  });
  q('scApply2').addEventListener('click', () => {
    hide('scErr2'); hide('scOk2');
    let ex = q('scExpr').value.trim();
    if (!ex) { flash('scErr2', 'Tulis rumusnya dulu, misalnya LOG10(A).', 6000); return; }
    if (ex.charAt(0) === '=') ex = ex.slice(1);
    try { parse(ex.replace(/\b([A-Za-z]{1,2})\b(?![A-Za-z0-9_$(])/g, '$11')); } catch (e) { flash('scErr2', 'Rumus belum benar. Periksa tanda kurung dan nama fungsi.', 7000); return; }
    const dc = targetCol(dstSel2.value);
    const res = applyFormulas(dc, 'hasil', (r) => ex.replace(/(^|[^A-Za-z0-9_$.])\$?([A-Za-z]{1,2})(?![A-Za-z0-9_($])/g, (m, pre, L) => (pre + L.toUpperCase() + (r + 1))));
    if (typeof res === 'string') { flash('scErr2', res, 7000); return; }
    flash('scOk2', `Selesai: rumus diisikan ke kolom ${colName(res.dc)} baris ${res.f + 1}–${res.last + 1}.${res.overwrite ? ' Isi lama kolom itu ditimpa (bisa diurungkan).' : ''}`, 9000);
    goTo(res.f, res.dc, { noSelect: true }); const a = document.activeElement; if (a && a.blur) a.blur();
  });
  q('scToVal').addEventListener('click', () => {
    pushUndo();
    let n = 0;
    for (let r = 0; r < S.R; r++) for (let c = 0; c < S.C; c++) {
      if (raw(r, c).charAt(0) === '=') {
        const v = cellVal(r, c);
        S.cells[r][c] = isErr(v) ? '' : (typeof v === 'number' ? String(v) : display(v));
        n++;
      }
    }
    // hitung ulang cache setelah nilai berubah dibuat dari snapshot nilai lama:
    invalidate(); fullRender(true);
    flash('scOk2', n ? `${n} sel rumus diubah menjadi nilai tetap.` : 'Tidak ada sel berisi rumus.', 6000);
  });


  /* ------------------------ Kirim ke Stat / Graph ------------------------- */
  const SEND = {
    deskriptif: { title: 'Statistika Deskriptif', card: '#ds-data-card' },
    regresi: { title: 'Regresi Linear', card: '#data-card', build: '#buildTableBtn', k: true },
    smoothing: { title: 'Metode Smoothing', card: '#sm-data-card', build: '#smBuildTableBtn', onlyIfHidden: true },
    stasioner: { title: 'Uji Stasioneritas', card: '#st-data-card', build: '#stBuildTableBtn', onlyIfHidden: true },
    histogram: { title: 'Histogram', card: '#gr-histogram-data-card' },
    boxplot: { title: 'Boxplot', card: '#gr-boxplot-wdata-card' },
    scatter: { title: 'Scatter Plot', card: '#gr-scatter-data-card' },
    probplot: { title: 'Probability Plot', card: '#gr-probplot-data-card' },
    timeseries: { title: 'Time Series Plot', card: '#gr-timeseries-data-card' },
    barchart: { title: 'Bar Chart', card: '#gr-barchart-data-card' },
    piechart: { title: 'Pie Chart', card: '#gr-piechart-data-card' },
  };
  function exportRows() {
    const b = usedBounds(), rows = [];
    for (let r = 0; r < b.R; r++) {
      const row = [];
      for (let c = 0; c < b.C; c++) { const v = cellVal(r, c); row.push(isErr(v) ? '' : (typeof v === 'number' ? String(v) : display(v))); }
      rows.push(row);
    }
    return { rows, C: b.C };
  }
  q('scSend').addEventListener('click', () => {
    hide('scErr4');
    const id = q('scTarget').value, t = SEND[id];
    const { rows, C } = exportRows();
    const first = S.header ? 1 : 0;
    if (rows.length <= first) { flash('scErr4', 'Belum ada data pada lembar kerja. Isi atau impor data terlebih dahulu.', 6000); return; }
    if (!window.StatCalc || !window.StatCalcImport || !window.StatCalcImport.has(t.card) && !t.build) { flash('scErr4', 'Halaman tujuan belum siap. Muat ulang halaman lalu coba lagi.', 6000); return; }
    // jumlah kolom angka -> jumlah variabel X untuk regresi
    let numCols = 0;
    for (let c = 0; c < C; c++) { let n = 0, tot = 0; for (let r = first; r < rows.length; r++) { if (rows[r][c] !== '') { tot++; if (!Number.isNaN(parseNum(rows[r][c]))) n++; } } if (tot && n / tot >= 0.8) numCols++; }
    window.StatCalc.goToMethod(id, t.title, 'metode-calc');
    try {
      if (t.k) { const k = Math.max(1, Math.min(6, numCols - 1)); $('#varCount').value = k; $(t.build).click(); }
      else if (t.build && (!t.onlyIfHidden || $(t.card).hidden)) $(t.build).click();
    } catch (e) { /* tabel tujuan tetap bisa dibuat manual */ }
    setTimeout(() => {
      const ok = window.StatCalcImport.send(t.card, rows, 'lembar kerja Calc', { hasHeader: S.header });
      if (!ok) window.StatCalc.showToast('Tabel tujuan belum tersedia. Selesaikan Langkah 1 pada halaman ini.');
    }, 120);
  });

  /* -------------------------------- Ekspor -------------------------------- */
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function fileBase() { return (q('scFname').value.trim() || 'data-calc').replace(/[\\/:*?"<>|]+/g, '_'); }
  function usedBounds() {
    let maxR = -1, maxC = -1;
    for (let r = 0; r < S.R; r++) for (let c = 0; c < S.C; c++) if (raw(r, c) !== '') { if (r > maxR) maxR = r; if (c > maxC) maxC = c; }
    return { R: maxR + 1, C: maxC + 1 };
  }
  const XLS_ERR = { '#NULL!': 0, '#DIV/0!': 7, '#VALUE!': 15, '#REF!': 23, '#NAME?': 29, '#NUM!': 36, '#N/A': 42 };
  q('scCsv').addEventListener('click', () => {
    hide('scErr3');
    const b = usedBounds();
    if (!b.R) { flash('scErr3', 'Lembar kerja masih kosong.', 5000); return; }
    const out = [];
    for (let r = 0; r < b.R; r++) {
      const row = [];
      for (let c = 0; c < b.C; c++) {
        const v = cellVal(r, c);
        let t = typeof v === 'number' ? String(v) : display(v);
        if (/[",\n;]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
        row.push(t);
      }
      out.push(row.join(','));
    }
    download(new Blob(['﻿' + out.join('\r\n')], { type: 'text/csv;charset=utf-8' }), fileBase() + '.csv');
  });
  q('scXlsx').addEventListener('click', async () => {
    hide('scErr3');
    const b = usedBounds();
    if (!b.R) { flash('scErr3', 'Lembar kerja masih kosong.', 5000); return; }
    try {
      const X = await loadXLSX();
      const ws = {};
      for (let r = 0; r < b.R; r++) for (let c = 0; c < b.C; c++) {
        const t = raw(r, c); if (t === '') continue;
        const addr = colName(c) + (r + 1), v = cellVal(r, c);
        let cell;
        if (isErr(v)) cell = { t: 'e', v: XLS_ERR[v.code] !== undefined ? XLS_ERR[v.code] : 15 };
        else if (typeof v === 'number') cell = { t: 'n', v };
        else if (typeof v === 'boolean') cell = { t: 'b', v };
        else cell = { t: 's', v: String(v) };
        if (t.charAt(0) === '=') cell.f = t.slice(1);
        ws[addr] = cell;
      }
      ws['!ref'] = `A1:${colName(b.C - 1)}${b.R}`;
      ws['!cols'] = Array.from({ length: b.C }, () => ({ wch: 14 }));
      const wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, ws, 'Data');
      const out = X.write(wb, { bookType: 'xlsx', type: 'array' });
      download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileBase() + '.xlsx');
    } catch (err) {
      flash('scErr3', 'Pustaka Excel gagal dimuat (perlu internet saat pertama kali). Coba unduh .csv sebagai alternatif.', 8000);
    }
  });

  /* ------------------------------- Mulai ---------------------------------- */
  // Render saat halaman dibuka pertama kali (ukuran kontainer baru diketahui setelah tampil).
  const mo = new MutationObserver(() => { if (section.classList.contains('active')) { fullRender(true); } });
  mo.observe(section, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', () => { if (section.classList.contains('active')) refit(); });
  if (window.ResizeObserver) new ResizeObserver(() => { if (section.classList.contains('active')) refit(); }).observe(elScroll);
  layout(); buildHead(); updateSelects(); updateInfo(); updateSelUI();
  window.StatCalcSheet = { state: S, cellVal, display, loadGrid };
})();
