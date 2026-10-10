/* =========================================================================
   KALKULATOR ILMIAH v2 - editor ekspresi berkursor + tampilan LaTeX (KaTeX)
   - Ketuk di mana saja pada ekspresi untuk memindahkan kursor, lalu sisipkan /
     hapus di posisi itu (tidak harus dari kanan).
   - Pecahan, akar, dan pangkat tampil sebagai LaTeX sungguhan.
   - Riwayat perhitungan, salin LaTeX, dan dukungan keyboard fisik.
   ========================================================================= */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const grid = $('calcGrid'), mathEl = $('calcMath'), innerEl = $('calcInner'), caretEl = $('calcCaret'),
        editorEl = $('calcEditor'), prevEl = $('calcPrev'), liveEl = $('calcLive'), histEl = $('calcHist'),
        degBtn = $('calcDegBtn'), radBtn = $('calcRadBtn'), invBtn = $('calcInvBtn'),
        copyBtn = $('calcCopyBtn'), clrHistBtn = $('calcHistClear'), viewEl = $('view-kalkulator');
  if (!grid || !mathEl) return;

  let angleMode = 'deg', invMode = false;
  const hist = [];
  let st = { tok: [], c: 0, done: false, last: '0', prevTok: null, prevRes: '' };
  let meta = { mark: [] };

  /* ---------------------------- EVALUATOR ---------------------------- */
  const CONSTANTS = { pi: Math.PI, e: Math.E };
  const toRad = (x) => (angleMode === 'deg' ? (x * Math.PI) / 180 : x);
  const fromRad = (x) => (angleMode === 'deg' ? (x * 180) / Math.PI : x);
  const FUNCS = {
    sin: (x) => Math.sin(toRad(x)), cos: (x) => Math.cos(toRad(x)), tan: (x) => Math.tan(toRad(x)),
    asin: (x) => fromRad(Math.asin(x)), acos: (x) => fromRad(Math.acos(x)), atan: (x) => fromRad(Math.atan(x)),
    log: Math.log10, ln: Math.log, sqrt: Math.sqrt, exp: Math.exp, abs: Math.abs,
  };
  function factorial(n) {
    if (n < 0 || Math.abs(n - Math.round(n)) > 1e-9) return NaN;
    n = Math.round(n); if (n > 170) return Infinity;
    let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
  }
  function tokenize(str) {
    const out = []; let i = 0;
    while (i < str.length) {
      const c = str[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        let j = i; while (j < str.length && /[0-9.]/.test(str[j])) j++;
        const v = parseFloat(str.slice(i, j)); if (isNaN(v)) throw new Error('Angka tidak valid');
        out.push({ type: 'num', value: v }); i = j; continue;
      }
      if (c === '\u03C0') { out.push({ type: 'ident', value: 'pi' }); i++; continue; }
      if (c === '\u212F') { out.push({ type: 'ident', value: 'e' }); i++; continue; }
      if (/[a-z]/i.test(c)) {
        let j = i; while (j < str.length && /[a-z]/i.test(str[j])) j++;
        out.push({ type: 'ident', value: str.slice(i, j) }); i = j; continue;
      }
      if ('+-*/^!%()'.indexOf(c) !== -1) { out.push({ type: 'op', value: c }); i++; continue; }
      throw new Error('Karakter tidak dikenali: ' + c);
    }
    const res = []; // perkalian implisit: 2π, 3(4), (1)(2), 2sin(x)
    out.forEach((t) => {
      const p = res[res.length - 1];
      const endsVal = p && (p.type === 'num' || (p.type === 'op' && ')!%'.indexOf(p.value) !== -1) ||
        (p.type === 'ident' && Object.prototype.hasOwnProperty.call(CONSTANTS, p.value)));
      const startsVal = t.type === 'num' || t.type === 'ident' || (t.type === 'op' && t.value === '(');
      if (endsVal && startsVal) res.push({ type: 'op', value: '*' });
      res.push(t);
    });
    return res;
  }
  function evalExpression(str) {
    const tokens = tokenize(str); let pos = 0;
    const peek = () => tokens[pos], next = () => tokens[pos++];
    const isOp = (v) => peek() && peek().type === 'op' && peek().value === v;
    function expr() {
      let v = term();
      while (isOp('+') || isOp('-')) { const o = next().value; const r = term(); v = o === '+' ? v + r : v - r; }
      return v;
    }
    function term() {
      let v = unary();
      while (isOp('*') || isOp('/')) { const o = next().value; const r = unary(); v = o === '*' ? v * r : v / r; }
      return v;
    }
    function unary() {
      if (isOp('-')) { next(); return -unary(); }
      if (isOp('+')) { next(); return unary(); }
      return power();
    }
    function power() {
      const b = postfix();
      if (isOp('^')) { next(); return Math.pow(b, unary()); }
      return b;
    }
    function postfix() {
      let v = primary();
      while (isOp('!') || isOp('%')) { v = next().value === '!' ? factorial(v) : v / 100; }
      return v;
    }
    function primary() {
      const t = peek();
      if (!t) throw new Error('Ekspresi belum lengkap');
      if (t.type === 'num') { next(); return t.value; }
      if (t.type === 'ident') {
        if (Object.prototype.hasOwnProperty.call(CONSTANTS, t.value)) { next(); return CONSTANTS[t.value]; }
        if (Object.prototype.hasOwnProperty.call(FUNCS, t.value)) {
          next(); if (!isOp('(')) throw new Error('Fungsi ' + t.value + ' butuh tanda kurung');
          next(); const a = expr(); if (!isOp(')')) throw new Error('Tanda kurung tidak seimbang'); next();
          return FUNCS[t.value](a);
        }
        throw new Error('Tidak dikenal: ' + t.value);
      }
      if (isOp('(')) { next(); const v = expr(); if (!isOp(')')) throw new Error('Tanda kurung tidak seimbang'); next(); return v; }
      throw new Error('Ekspresi belum lengkap');
    }
    const r = expr(); if (pos < tokens.length) throw new Error('Ekspresi tidak valid'); return r;
  }
  function formatResult(v) {
    if (!Number.isFinite(v)) return 'Error';
    if (Math.abs(v) < 1e-12) v = 0;
    if (Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-9 && v !== 0)) return v.toExponential(6);
    let s = v.toPrecision(12);
    if (s.indexOf('e') === -1 && s.indexOf('.') !== -1) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return String(parseFloat(s));
  }

  /* ----------------------- TOKEN & LATEX ----------------------- */
  // e = string untuk evaluator, l = LaTeX; g = pembuka grup (p paren, r akar, w pangkat, a pecahan)
  const N = (c) => ({ k: 'n', e: c, l: c });
  const OP = (c) => ({ k: 'o', e: c, l: { '+': '+', '-': '-', '*': '\\times', '/': '\\div' }[c] });
  const P = () => ({ k: '(', g: 'p', e: '(', l: '(' });
  const X = () => ({ k: ')', x: 1, e: ')', l: ')' });
  const POW = () => ({ k: '(', g: 'w', e: '^(', l: '^{' });
  const SQ = () => ({ k: 'f', g: 'r', e: 'sqrt(', l: '\\sqrt{' });
  const FA = () => ({ k: '(', g: 'a', e: '(', l: '' });
  const MID = () => ({ k: 'm', m: 1, e: ')/(', l: '' });
  const FL = { sin: '\\sin', cos: '\\cos', tan: '\\tan', log: '\\log', ln: '\\ln' };
  function fnTok(name) {
    if (invMode && /^(sin|cos|tan)$/.test(name)) return { k: 'f', g: 'p', e: 'a' + name + '(', l: FL[name] + '^{-1}(' };
    return { k: 'f', g: 'p', e: name + '(', l: FL[name] + '(' };
  }

  function toLatex(tok, ids, mt) {
    const stack = []; let out = '';
    const w = (i, s) => (ids ? '\\htmlData{i=' + i + '}{' + s + '}' : s);
    const mk = (i) => (ids ? '\\htmlData{i=' + i + '}{\\vphantom{0}}' : '');
    tok.forEach((t, i) => {
      const prev = tok[i - 1];
      if (t.g) {
        stack.push(t.g);
        if (t.g === 'p') out += w(i, t.l);
        else { out += (t.g === 'r' ? '\\sqrt{' : t.g === 'w' ? '^{' : '\\frac{') + mk(i); if (mt) mt.mark[i] = true; }
      } else if (t.m) {
        if (mt) mt.mark[i] = true;
        if (stack[stack.length - 1] === 'a') { stack[stack.length - 1] = 'd'; out += '}{' + mk(i); }
        else out += '\\div' + mk(i);
      } else if (t.x) {
        const g = stack.pop();
        if (g === undefined || g === 'p') out += w(i, ')');
        else { if (mt) mt.mark[i] = true; out += (g === 'a' ? '}{}}' : '}') + mk(i); }
      } else if (t.k === 'o') {
        const unary = !prev || prev.k === 'o' || prev.g || prev.m;
        out += unary ? w(i, t.l) : '\\mathbin{' + w(i, t.l) + '}';
      } else out += w(i, t.l);
    });
    while (stack.length) { const g = stack.pop(); out += g === 'p' ? '\\textcolor{#8a9bab}{)}' : g === 'a' ? '}{}}' : '}'; }
    return out;
  }
  function kx(l) {
    if (window.katex) {
      try { return window.katex.renderToString(l, { throwOnError: false, trust: true, strict: 'ignore', output: 'html' }); } catch (e) { /* jatuh ke teks */ }
    }
    return l.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  }
  function resLatex(s) {
    return s.replace(/^(-?[\d.]+)e([+-]?)(\d+)$/, (m, a, sg, d) => a + '\\times10^{' + (sg === '-' ? '-' : '') + d + '}');
  }
  function resultTokens(s) {
    const out = []; let m = String(s), ex = null; const ei = m.indexOf('e');
    if (ei > -1) { ex = m.slice(ei + 1); m = m.slice(0, ei); }
    for (const ch of m) out.push(ch === '-' ? OP('-') : N(ch));
    if (ex !== null) {
      out.push(OP('*'), N('1'), N('0'), POW());
      for (const ch of ex.replace('+', '')) out.push(ch === '-' ? OP('-') : N(ch));
      out.push(X());
    }
    return out;
  }
  const exprStr = () => st.tok.map((t) => t.e).join('');

  /* ----------------------- RENDER & KURSOR ----------------------- */
  function updateLive() {
    liveEl.classList.remove('err');
    if (st.done || !st.tok.length || st.tok.every((t) => t.k === 'n')) { liveEl.innerHTML = '&nbsp;'; return; }
    try {
      const v = evalExpression(exprStr());
      if (!Number.isFinite(v)) throw 0;
      liveEl.innerHTML = '= ' + kx(resLatex(formatResult(v)));
    } catch (e) { liveEl.innerHTML = '&nbsp;'; }
  }
  function refresh() {
    meta = { mark: [] };
    const empty = !st.tok.length;
    mathEl.classList.toggle('empty', empty);
    mathEl.innerHTML = empty ? kx('0') : kx(toLatex(st.tok, true, meta));
    prevEl.innerHTML = st.prevTok ? kx(toLatex(st.prevTok, false) + '\\;=') : '&nbsp;';
    updateLive();
    requestAnimationFrame(placeCaret);
  }
  function placeCaret() {
    const ir = innerEl.getBoundingClientRect();
    const find = (i) => mathEl.querySelector('[data-i="' + i + '"]');
    const fs = parseFloat(getComputedStyle(mathEl).fontSize) || 30;
    let x, cy;
    const ref = st.c > 0 ? find(st.c - 1) : null;
    if (ref) { const r = ref.getBoundingClientRect(); x = r.right; cy = r.top + r.height / 2; }
    else {
      const kh = mathEl.querySelector('.katex-html') || mathEl, r = kh.getBoundingClientRect();
      const f = st.tok.length ? find(0) : null, fr = f ? f.getBoundingClientRect() : r;
      x = st.tok.length ? r.left : r.right; cy = fr.top + fr.height / 2;
    }
    const H = fs * 1.05;
    caretEl.style.left = (x - ir.left - 1) + 'px';
    caretEl.style.top = (cy - H / 2 - ir.top) + 'px';
    caretEl.style.height = H + 'px';
    const vis = editorEl.getBoundingClientRect();
    if (x < vis.left + 18) editorEl.scrollLeft -= vis.left + 18 - x;
    else if (x > vis.right - 18) editorEl.scrollLeft += x - (vis.right - 18);
  }
  function setCaret(c) {
    st.done = false; st.c = Math.max(0, Math.min(st.tok.length, c)); refresh();
  }

  /* --------------------------- EDITING --------------------------- */
  function ins(list, kind, off) {
    if (st.done) {
      if (kind === 'c') st.c = st.tok.length; else { st.tok = []; st.c = 0; }
      st.done = false;
    }
    st.tok.splice(st.c, 0, ...list);
    st.c += off == null ? list.length : off;
    refresh();
  }
  function match(i) {
    let d = 0;
    for (let j = i; j < st.tok.length; j++) {
      if (st.tok[j].g) d++; else if (st.tok[j].x) { d--; if (d === 0) return j; }
    }
    return -1;
  }
  function removeAt(i) {
    const t = st.tok[i];
    if (t.g) {
      const j = match(i);
      if (j >= 0) {
        let m = -1, d = 0;
        for (let q = i; q <= j; q++) { const u = st.tok[q]; if (u.g) d++; else if (u.x) d--; else if (u.m && d === 1) m = q; }
        const empty = j === i + 1 || (m === i + 1 && j === i + 2);
        if (empty) st.tok.splice(i, j - i + 1);
        else if (t.g === 'a') { if (m >= 0) st.tok.splice(m, 1, X(), OP('/'), P()); st.tok[i] = P(); }
        else { st.tok.splice(j, 1); st.tok.splice(i, 1); }
      } else st.tok.splice(i, 1);
    } else st.tok.splice(i, 1);
    st.c = i;
  }
  function backspace() {
    st.done = false;
    if (st.c <= 0) return;
    const t = st.tok[st.c - 1];
    if (t.x || t.m) st.c--; else removeAt(st.c - 1);
    refresh();
  }
  function del() {
    st.done = false;
    const t = st.tok[st.c]; if (!t) return;
    if (t.x || t.m) st.c++; else removeAt(st.c);
    refresh();
  }
  function typeOp(ch) {
    if (st.done) { st.c = st.tok.length; st.done = false; }
    let prev = st.tok[st.c - 1];
    if (prev && prev.k === 'o') {
      if (!(ch === '-' && (prev.e === '*' || prev.e === '/'))) { st.tok.splice(st.c - 1, 1); st.c--; prev = st.tok[st.c - 1]; }
    }
    if ((!prev || prev.g || prev.m) && (ch === '*' || ch === '/')) { refresh(); return; }
    ins([OP(ch)], 'c');
  }
  function dot() {
    if (st.done) { st.tok = []; st.c = 0; st.done = false; }
    for (let j = st.c - 1; j >= 0 && st.tok[j].k === 'n'; j--) if (st.tok[j].e === '.') return;
    const zero = !(st.c > 0 && st.tok[st.c - 1].k === 'n');
    ins(zero ? [N('0'), N('.')] : [N('.')], 'c');
  }
  function negate() {
    const t = st.tok; st.done = false;
    if (!t.length) { ins([OP('-')], 'c'); return; }
    if (t.length > 2 && t[0].k === 'o' && t[0].e === '-' && t[1].k === '(' && t[1].g === 'p' && match(1) === t.length - 1) {
      st.tok = t.slice(2, -1); st.c = Math.max(0, Math.min(st.c - 2, st.tok.length));
    } else { st.tok = [OP('-'), P(), ...t, X()]; st.c += 2; }
    refresh();
  }
  function evaluate() {
    if (!st.tok.length) return;
    try {
      const v = evalExpression(exprStr()), res = formatResult(v);
      if (res === 'Error') throw new Error('Hasil tidak terdefinisi (mis. dibagi nol / akar negatif)');
      hist.push({ tok: st.tok.slice(), res }); if (hist.length > 50) hist.shift();
      st.prevTok = st.tok.slice(); st.prevRes = res; st.last = res;
      st.tok = resultTokens(res); st.c = st.tok.length; st.done = true;
      refresh(); renderHistory();
      if (window.StatCalc && window.StatCalc.trackCalc) window.StatCalc.trackCalc();
    } catch (err) {
      liveEl.classList.add('err'); liveEl.textContent = err.message || 'Ekspresi tidak valid';
    }
  }

  function press(k) {
    if (/^[0-9]$/.test(k)) return ins([N(k)], 's');
    switch (k) {
      case '.': return dot();
      case '+': case '-': case '*': case '/': return typeOp(k);
      case 'pi': return ins([{ k: 'c', e: '\u03C0', l: '\\pi' }], 's');
      case 'e': return ins([{ k: 'c', e: '\u212F', l: 'e' }], 's');
      case '(': return ins([P(), X()], 's', 1);
      case ')':
        if (st.tok[st.c] && st.tok[st.c].x) return setCaret(st.c + 1);
        return ins([X()], 'c');
      case 'sin': case 'cos': case 'tan': case 'log': case 'ln': return ins([fnTok(k), X()], 's', 1);
      case 'sqrt': return ins([SQ(), X()], 's', 1);
      case 'pow': return ins([POW(), X()], 'c', 1);
      case 'x2': return ins([POW(), N('2'), X()], 'c');
      case 'frac': return ins([FA(), MID(), X()], 's', 1);
      case 'inv':
        if (st.done) { st.tok = [FA(), N('1'), MID(), ...st.tok, X()]; st.c = st.tok.length; st.done = false; return refresh(); }
        return ins([FA(), N('1'), MID(), X()], 's', 3);
      case 'fact': return ins([{ k: 'p', e: '!', l: '!' }], 'c');
      case 'percent': return ins([{ k: 'p', e: '%', l: '\\%' }], 'c');
      case 'ans': return ins(resultTokens(st.last), 's');
      case 'negate': return negate();
      case 'left': return setCaret(st.c - 1);
      case 'right': return setCaret(st.c + 1);
      case 'home': return setCaret(0);
      case 'end': return setCaret(st.tok.length);
      case 'back': return backspace();
      case 'del': return del();
      case 'clear': st.tok = []; st.c = 0; st.done = false; return refresh();
      case 'equals': return evaluate();
    }
  }

  /* --------------------------- INPUT --------------------------- */
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.calc-btn');
    if (b && b.dataset.k) press(b.dataset.k);
  });

  // Ketuk ekspresi -> pindahkan kursor ke posisi terdekat
  editorEl.addEventListener('click', (e) => {
    const els = Array.from(mathEl.querySelectorAll('[data-i]'));
    if (!els.length) { setCaret(0); return; }
    let best = null, bd = Infinity;
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX < r.left ? r.left - e.clientX : e.clientX > r.right ? e.clientX - r.right : 0;
      const dy = e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = { el, r }; }
    });
    const i = +best.el.getAttribute('data-i');
    if (meta.mark[i]) return setCaret(i + 1);
    const center = (best.r.left + best.r.right) / 2;
    setCaret(e.clientX < center ? i : i + 1);
  });

  document.addEventListener('keydown', (e) => {
    if (!viewEl || viewEl.offsetParent === null) return;
    const tg = e.target;
    if (tg && /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key; let name = null;
    if (/^[0-9.]$/.test(k) || '+-*/()'.indexOf(k) !== -1 && k.length === 1) name = k;
    else if (k === '^') name = 'pow';
    else if (k === '!') name = 'fact';
    else if (k === '%') name = 'percent';
    else if (k === 'Enter' || k === '=') name = 'equals';
    else if (k === 'Backspace') name = 'back';
    else if (k === 'Delete') name = 'del';
    else if (k === 'Escape') name = 'clear';
    else if (k === 'ArrowLeft') name = 'left';
    else if (k === 'ArrowRight') name = 'right';
    else if (k === 'Home') name = 'home';
    else if (k === 'End') name = 'end';
    else if (k === 'p' || k === 'P') name = 'pi';
    if (!name) return;
    e.preventDefault(); press(name);
  });

  degBtn.addEventListener('click', () => { angleMode = 'deg'; degBtn.classList.add('active'); radBtn.classList.remove('active'); updateLive(); });
  radBtn.addEventListener('click', () => { angleMode = 'rad'; radBtn.classList.add('active'); degBtn.classList.remove('active'); updateLive(); });
  invBtn.addEventListener('click', () => {
    invMode = !invMode; invBtn.classList.toggle('active', invMode);
    ['sin', 'cos', 'tan'].forEach((f) => {
      const b = grid.querySelector('[data-k="' + f + '"]');
      if (b) b.textContent = invMode ? f + '\u207B\u00B9' : f;
    });
  });

  /* ------------------- RIWAYAT, SALIN, TOAST ------------------- */
  function renderHistory() {
    if (!hist.length) { histEl.innerHTML = '<div class="calc-hist-empty">Belum ada perhitungan.</div>'; return; }
    histEl.innerHTML = '';
    for (let i = hist.length - 1; i >= 0; i--) {
      const h = hist[i], d = document.createElement('div');
      d.className = 'calc-hist-item'; d.dataset.i = i;
      d.innerHTML = '<div class="hx" title="Muat ulang ekspresi">' + kx(toLatex(h.tok, false)) +
        '</div><div class="hr" title="Sisipkan hasil">= ' + kx(resLatex(h.res)) + '</div>';
      histEl.appendChild(d);
    }
  }
  histEl.addEventListener('click', (e) => {
    const it = e.target.closest('.calc-hist-item'); if (!it) return;
    const h = hist[+it.dataset.i]; if (!h) return;
    if (e.target.closest('.hr')) { st.done = false; ins(resultTokens(h.res), 's'); }
    else { st.tok = h.tok.slice(); st.c = st.tok.length; st.done = false; refresh(); }
  });
  clrHistBtn.addEventListener('click', () => { hist.length = 0; renderHistory(); });

  const toast = (m) => { if (window.StatCalc && window.StatCalc.showToast) window.StatCalc.showToast(m); };
  function fallbackCopy(s) {
    const ta = document.createElement('textarea'); ta.value = s; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('LaTeX disalin'); } catch (e) { toast('Gagal menyalin'); }
    ta.remove();
  }
  copyBtn.addEventListener('click', () => {
    if (!st.tok.length) { toast('Ekspresi masih kosong'); return; }
    const s = st.done && st.prevTok ? toLatex(st.prevTok, false) + ' = ' + resLatex(st.prevRes) : toLatex(st.tok, false);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(() => toast('LaTeX disalin'), () => fallbackCopy(s));
    else fallbackCopy(s);
  });

  function reset() {
    st = { tok: [], c: 0, done: false, last: '0', prevTok: null, prevRes: '' };
    refresh();
  }
  renderHistory();
  reset();
  window.addEventListener('resize', placeCaret);
  window.StatCalcCalc = { reset };
})();
