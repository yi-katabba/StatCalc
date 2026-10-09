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
  const sel = { r: 0, c: 0 };
  let undoStack = [];

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
  function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > UNDO_MAX) undoStack.shift(); updateUndoBtn(); }
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
  `;
  document.head.appendChild(style);

  /* --------------------------- Markup halaman ---------------------------- */
  const section = document.createElement('section');
  section.className = 'view';
  section.id = 'view-metode-calc';
  section.innerHTML = `
    <div class="chapter-inner">
      <div class="chapter-head">
        <span class="eyebrow">Metode &rsaquo; Calc</span>
        <h1>Lembar Kerja Calc</h1>
        <p class="lede">Impor data dari Excel, ubah dan hitung seperti di Excel (ketik rumus atau pakai Rumus Kolom, misalnya mengubah satu kolom menjadi log dan menyimpannya di kolom lain), lalu ekspor kembali ke Excel.</p>
      </div>

      <section class="card step-card">
        <div class="step-tag">Langkah 1</div>
        <h2>Impor data</h2>
        <p class="hint">Blok sel di Excel lalu tempel, atau unggah file <strong>.xlsx</strong> / <strong>.csv</strong>. Anda juga boleh langsung mengetik di lembar kerja pada Langkah 2.</p>
        <div class="sc-bar c2">
          <button type="button" class="btn-ghost" id="scPasteBtn">Tempel dari Excel</button>
          <button type="button" class="btn-ghost" id="scFileBtn">Unggah file (.xlsx, .csv)</button>
        </div>
        <input type="file" id="scFile" hidden accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,text/csv,text/plain">
        <div class="sc-panel" id="scPastePanel" hidden>
          <h4 class="sc-h4" style="margin-top:0">Tempel data dari Excel</h4>
          <textarea id="scPasteArea" spellcheck="false" placeholder="Tempel data di sini (Ctrl+V)&hellip;" aria-label="Data tempelan"></textarea>
          <div class="sc-bar c2">
            <button type="button" class="btn-primary" id="scPasteRead">Baca Data</button>
            <button type="button" class="btn-ghost" id="scPasteCancel">Batal</button>
          </div>
        </div>
        <h3 class="sc-h4">Atau buat data baru</h3>
        <p class="hint" style="margin-top:0">Tentukan ukuran tabel, lalu isi sendiri di Langkah 2. Judul kolom ada di baris 1 dan bisa diganti. Kolom dan baris bisa ditambah kapan saja.</p>
        <div class="sc-sel">
          <div class="sc-field"><label for="scNewC">Jumlah kolom</label><input id="scNewC" class="plain-input" type="number" min="1" max="52" value="3" inputmode="numeric"></div>
          <div class="sc-field"><label for="scNewR">Jumlah baris data</label><input id="scNewR" class="plain-input" type="number" min="1" max="5000" value="10" inputmode="numeric"></div>
        </div>
        <div class="sc-bar c2">
          <button type="button" class="btn-primary" id="scNewBtn">Buat tabel baru</button>
          <button type="button" class="btn-ghost" id="scSampleBtn">Isi contoh data</button>
        </div>
        <p class="sc-msg err" id="scErr" role="alert" hidden></p>
        <p class="sc-msg ok" id="scOk" role="status" hidden></p>
      </section>

      <section class="card step-card">
        <div class="step-tag">Langkah 2</div>
        <h2>Lembar kerja</h2>
        <p class="hint">Ketuk sel untuk mengedit. Awali dengan <code>=</code> untuk rumus, misalnya <code>=LOG10(A2)</code>, <code>=B2*2+C2</code>, atau <code>=SUM(A2:A20)</code>. Tekan Enter untuk turun, Tab untuk ke kanan. Anda juga bisa menempel (Ctrl+V) blok dari Excel langsung ke sel.</p>
        <label class="sc-check"><input type="checkbox" id="scHeader" checked> Baris 1 adalah judul kolom</label>
        <div class="sc-bar c4">
          <button type="button" class="btn-ghost" id="scAddRow">+ Tambah baris</button>
          <button type="button" class="btn-ghost" id="scDelRow">&minus; Hapus baris terakhir</button>
          <button type="button" class="btn-ghost" id="scAddCol">+ Tambah kolom</button>
          <button type="button" class="btn-ghost" id="scDelCol">&minus; Hapus kolom terakhir</button>
        </div>
        <div class="sc-bar c2">
          <button type="button" class="btn-ghost" id="scUndo" disabled>&#8630; Urungkan</button>
          <button type="button" class="btn-ghost" id="scClear">Kosongkan</button>
        </div>
        <div class="sc-fxrow">
          <span class="sc-name" id="scName">A1</span>
          <input type="text" class="sc-fx" id="scFx" spellcheck="false" autocomplete="off" aria-label="Isi sel / rumus" placeholder="Isi sel atau rumus">
        </div>
        <div class="sc-scroll" id="scScroll">
          <div class="sc-head" id="scHead"></div>
          <div class="sc-inner" id="scInner"><div class="sc-rows" id="scRows"></div></div>
        </div>
        <p class="sc-note" id="scInfo"></p>
      </section>

      <section class="card step-card">
        <div class="step-tag">Langkah 3</div>
        <h2>Rumus kolom &mdash; hitung &amp; simpan di kolom lain</h2>
        <p class="hint">Pilih kolom sumber dan operasi, lalu tentukan kolom tujuan. Hasilnya berupa rumus Excel yang diisikan ke bawah (seperti fill down), sehingga ikut berubah bila data sumber diedit.</p>
        <div class="sc-sel">
          <div class="sc-field"><label for="scSrc">Kolom sumber</label><select id="scSrc" class="select-input"></select></div>
          <div class="sc-field"><label for="scOp">Operasi</label><select id="scOp" class="select-input"></select></div>
          <div class="sc-field" id="scParWrap"><label for="scPar" id="scParLbl">Parameter</label><input id="scPar" class="plain-input" type="text" inputmode="decimal" value="2"></div>
        </div>
        <div class="sc-sel" style="margin-top:12px">
          <div class="sc-field"><label for="scDst">Simpan hasil di</label><select id="scDst" class="select-input"></select></div>
          <div class="sc-field"><label for="scTitle">Judul kolom hasil</label><input id="scTitle" class="plain-input" type="text" placeholder="mis. log_Y"></div>
        </div>
        <div class="sc-bar c2">
          <button type="button" class="btn-primary" id="scApply">Terapkan</button>
          <button type="button" class="btn-ghost" id="scToVal">Ubah semua rumus jadi nilai</button>
        </div>

        <h3 class="sc-h4">Rumus bebas</h3>
        <p class="hint" style="margin-top:0">Tulis rumus memakai huruf kolom saja; huruf kolom otomatis dipasangkan dengan nomor baris. Contoh: <code>LOG10(A)</code>, <code>(A-B)^2</code>, <code>IF(A&gt;100,A,0)</code>, <code>B/SUM(B$2:B$100)</code>.</p>
        <div class="sc-sel">
          <div class="sc-field" style="flex:2 1 220px"><label for="scExpr">Rumus per baris</label><input id="scExpr" class="plain-input" type="text" spellcheck="false" autocomplete="off" placeholder="mis. LN(A)*2+B"></div>
          <div class="sc-field"><label for="scDst2">Simpan hasil di</label><select id="scDst2" class="select-input"></select></div>
        </div>
        <div class="sc-bar c2"><button type="button" class="btn-primary" id="scApply2">Terapkan rumus bebas</button><span></span></div>
        <p class="sc-msg err" id="scErr2" role="alert" hidden></p>
        <p class="sc-msg ok" id="scOk2" role="status" hidden></p>
      </section>

      <section class="card step-card">
        <div class="step-tag">Langkah 4</div>
        <h2>Ekspor ke Excel</h2>
        <p class="hint">File <strong>.xlsx</strong> menyimpan rumus sekaligus nilainya sehingga tetap bisa dihitung ulang di Excel. File <strong>.csv</strong> menyimpan nilai hasil hitung saja.</p>
        <div class="sc-sel"><div class="sc-field"><label for="scFname">Nama file</label><input id="scFname" class="plain-input" type="text" value="data-calc"></div></div>
        <div class="sc-bar c2">
          <button type="button" class="btn-primary" id="scXlsx">Unduh .xlsx</button>
          <button type="button" class="btn-ghost" id="scCsv">Unduh .csv</button>
        </div>
        <p class="sc-msg err" id="scErr3" role="alert" hidden></p>
      </section>
    </div>`;
  document.body.insertBefore(section, $('#profileOverlay'));

  const q = (id) => $('#' + id, section);
  const elScroll = q('scScroll'), elHead = q('scHead'), elInner = q('scInner'), elRows = q('scRows');
  const elName = q('scName'), elFx = q('scFx'), elInfo = q('scInfo');

  function flash(id, msg, ms) { const e = q(id); e.textContent = msg; e.hidden = false; clearTimeout(e._t); if (ms) e._t = setTimeout(() => { e.hidden = true; }, ms); }
  function hide(id) { q(id).hidden = true; }

  /* ----------------------------- Render grid ------------------------------ */
  let rStart = -1, rEnd = -1, rafId = 0;
  function totalW() { return GUT + S.C * CW; }

  function buildHead() {
    let h = `<div class="sc-corner"></div>`;
    for (let c = 0; c < S.C; c++) h += `<div class="sc-ch${c === sel.c ? ' on' : ''}" data-c="${c}">${colName(c)}</div>`;
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
    return k;
  }
  function rowHTML(r) {
    let h = `<div class="sc-row" data-r="${r}"><div class="sc-gut${r === sel.r ? ' on' : ''}">${r + 1}</div>`;
    for (let c = 0; c < S.C; c++) {
      const t = raw(r, c), v = cellVal(r, c);
      h += `<input class="${cellClass(r, c, v, t)}" data-r="${r}" data-c="${c}" value="${esc(display(v))}" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="text" aria-label="${colName(c)}${r + 1}">`;
    }
    return h + '</div>';
  }
  function layout() {
    elInner.style.height = (S.R * RH) + 'px';
    elInner.style.width = totalW() + 'px';
    elScroll.dataset.rows = S.R;
  }
  function renderRows(force) {
    const top = Math.max(0, elScroll.scrollTop - 32);
    const vis = Math.ceil(elScroll.clientHeight / RH) + 1;
    const a = Math.max(0, Math.floor(top / RH) - OVERSCAN), b = Math.min(S.R - 1, a + vis + OVERSCAN * 2);
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
    updateInfo(); updateSelects(); updateSelUI();
  }
  elScroll.addEventListener('scroll', () => { if (rafId) return; rafId = requestAnimationFrame(() => { rafId = 0; renderRows(false); }); });

  function updateInfo() {
    const last = lastDataRow();
    elInfo.textContent = `${S.R} baris × ${S.C} kolom · data terisi sampai baris ${last + 1 > 0 ? last + 1 : 0}. Batas lembar: ${MAX_R} baris × ${MAX_C} kolom.`;
  }
  function updateUndoBtn() { q('scUndo').disabled = undoStack.length === 0; }

  /* ----------------------------- Seleksi sel ------------------------------ */
  function updateSelUI() {
    elName.textContent = colName(sel.c) + (sel.r + 1);
    const active = document.activeElement;
    if (active !== elFx) elFx.value = raw(sel.r, sel.c);
    $$('.sc-ch', elHead).forEach((e) => e.classList.toggle('on', +e.dataset.c === sel.c));
    $$('.sc-gut', elRows).forEach((e) => e.classList.toggle('on', +e.parentNode.dataset.r === sel.r));
  }
  function select(r, c) { sel.r = r; sel.c = c; updateSelUI(); }

  function goTo(r, c, opts) {
    r = Math.max(0, Math.min(S.R - 1, r)); c = Math.max(0, Math.min(S.C - 1, c));
    const y = r * RH, h = elScroll.clientHeight;
    if (y < elScroll.scrollTop) elScroll.scrollTop = y;
    else if (y + RH + 32 > elScroll.scrollTop + h) elScroll.scrollTop = y + RH + 32 - h;
    const x = c * CW, w = elScroll.clientWidth - GUT;
    if (x < elScroll.scrollLeft) elScroll.scrollLeft = x;
    else if (x + CW > elScroll.scrollLeft + w) elScroll.scrollLeft = x + CW - w;
    renderRows(false);
    let inp = cellInput(r, c);
    if (!inp) { renderRows(true); inp = cellInput(r, c); }
    if (inp) { inp.focus({ preventScroll: true }); if (!(opts && opts.noSelect)) { try { inp.select(); } catch (e) { /* abaikan */ } } }
    select(r, c);
  }

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
    select(r, c);
  });
  elRows.addEventListener('input', (e) => { if (e.target.classList.contains('sc-cell')) elFx.value = e.target.value; });
  elRows.addEventListener('focusout', (e) => {
    const inp = e.target;
    if (!inp.classList || !inp.classList.contains('sc-cell')) return;
    const r = +inp.dataset.r, c = +inp.dataset.c;
    const changed = inp.value !== (inp._orig === undefined ? raw(r, c) : inp._orig) ? commit(r, c, inp.value) : false;
    inp._orig = undefined;
    if (changed) { updateInfo(); }
    const v = cellVal(r, c), t = raw(r, c);
    inp.value = display(v); inp.className = cellClass(r, c, v, t);
    if (changed) refreshVisible();
  });
  elRows.addEventListener('keydown', (e) => {
    const inp = e.target;
    if (!inp.classList || !inp.classList.contains('sc-cell')) return;
    const r = +inp.dataset.r, c = +inp.dataset.c;
    const k = e.key;
    if (k === 'Enter') { e.preventDefault(); if (r + 1 >= S.R && S.R < MAX_R && !e.shiftKey) { inp.blur(); addRows(1); } goTo(e.shiftKey ? r - 1 : r + 1, c); }
    else if (k === 'Tab') { e.preventDefault(); goTo(r, e.shiftKey ? c - 1 : c + 1); }
    else if (k === 'ArrowDown') { e.preventDefault(); goTo(r + 1, c); }
    else if (k === 'ArrowUp') { e.preventDefault(); goTo(r - 1, c); }
    else if (k === 'ArrowRight' && inp.selectionStart === inp.value.length && inp.selectionEnd === inp.value.length) { e.preventDefault(); goTo(r, c + 1); }
    else if (k === 'ArrowLeft' && inp.selectionStart === 0 && inp.selectionEnd === 0) { e.preventDefault(); goTo(r, c - 1); }
    else if (k === 'Escape') { inp.value = raw(r, c); inp._orig = inp.value; inp.blur(); }
  });
  elRows.addEventListener('paste', (e) => {
    const inp = e.target;
    if (!inp.classList || !inp.classList.contains('sc-cell')) return;
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text || !/[\t\n\r]/.test(text.replace(/[\r\n]+$/, ''))) return;   // paste satu nilai: biarkan bawaan
    e.preventDefault();
    const grid = parseDelimited(text);
    pasteBlock(grid, +inp.dataset.r, +inp.dataset.c);
  });
  elScroll.addEventListener('click', (e) => {
    const ch = e.target.closest('.sc-ch');
    if (ch) goTo(sel.r, +ch.dataset.c, { noSelect: true });
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

  function pasteBlock(grid, r0, c0) {
    if (!grid.length) return;
    const nR = r0 + grid.length, nC = c0 + Math.max.apply(null, grid.map((x) => x.length));
    if (nR > MAX_R || nC > MAX_C) flash('scErr', `Data tempelan dipotong sesuai batas lembar (${MAX_R} baris × ${MAX_C} kolom).`, 6000);
    pushUndo();
    ensure(nR, nC);
    grid.forEach((row, i) => row.forEach((v, j) => { const r = r0 + i, c = c0 + j; if (r < MAX_R && c < MAX_C) S.cells[r][c] = normalizeInput(String(v)); }));
    invalidate(); fullRender(true);
  }

  /* ------------------------ Baris / kolom / undo -------------------------- */
  function addRows(n) {
    if (S.R >= MAX_R) { flash('scErr', `Batas ${MAX_R} baris tercapai.`, 4000); return; }
    pushUndo(); ensure(S.R + n, S.C); invalidate(); fullRender(true);
  }
  q('scAddRow').addEventListener('click', () => { addRows(1); });
  q('scDelRow').addEventListener('click', () => {
    if (S.R <= 1) return;
    pushUndo(); S.cells.pop(); S.R -= 1; sel.r = Math.min(sel.r, S.R - 1); invalidate(); fullRender(true);
  });
  q('scAddCol').addEventListener('click', () => {
    if (S.C >= MAX_C) { flash('scErr', `Batas ${MAX_C} kolom tercapai.`, 4000); return; }
    pushUndo(); ensure(S.R, S.C + 1); invalidate(); fullRender(true);
  });
  q('scDelCol').addEventListener('click', () => {
    if (S.C <= 1) return;
    pushUndo(); S.cells.forEach((row) => row.pop()); S.C -= 1; sel.c = Math.min(sel.c, S.C - 1); invalidate(); fullRender(true);
  });
  q('scUndo').addEventListener('click', () => {
    if (!undoStack.length) return;
    restore(undoStack.pop()); invalidate(); q('scHeader').checked = S.header; sel.r = Math.min(sel.r, S.R - 1); sel.c = Math.min(sel.c, S.C - 1);
    updateUndoBtn(); fullRender(true);
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
    sel.r = 1; sel.c = 0; invalidate(); fullRender(false); elScroll.scrollTop = 0; elScroll.scrollLeft = 0;
    q('scFname').value = 'data-baru';
    flash('scOk', `Tabel baru ${R} baris \u00D7 ${C} kolom dibuat. Ganti judul kolom di baris 1, lalu isi datanya di Langkah 2.`, 9000);
    section.scrollIntoView && q('scScroll').scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => goTo(0, 0), 400);
  });
  q('scSampleBtn').addEventListener('click', () => {
    const Y = [120, 132, 125, 140, 138, 150, 145, 160, 158, 170, 165, 180];
    const X = [10, 12, 11, 15, 14, 18, 17, 21, 20, 24, 23, 27];
    const rows = [['Periode', 'Y', 'X']];
    Y.forEach((y, i) => rows.push([String(i + 1), String(y), String(X[i])]));
    loadGrid(rows, true);
    flash('scOk', 'Contoh data dimuat. Coba Langkah 3: pilih kolom B, operasi Log10, simpan di kolom D.', 7000);
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
    sel.r = 0; sel.c = 0; invalidate(); fullRender(false); elScroll.scrollTop = 0; elScroll.scrollLeft = 0;
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

  /* --------------------------- Rumus kolom (Langkah 3) -------------------- */
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
    q('scParWrap').hidden = !o.par;
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
  window.addEventListener('resize', () => { if (section.classList.contains('active')) renderRows(true); });
  layout(); buildHead(); updateSelects(); updateInfo(); updateSelUI();
  window.StatCalcSheet = { state: S, cellVal, display, loadGrid };
})();
