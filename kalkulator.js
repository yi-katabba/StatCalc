/* =========================================================================
     KALKULATOR ILMIAH — logika menu Kalkulator
     ========================================================================= */
(function () {
  'use strict';
  const $ = (sel, ctx = document) => ctx.querySelector(sel);

  const exprEl = $('#calcExpr');
  const displayEl = $('#calcDisplay');
  const degBtn = $('#calcDegBtn');
  const radBtn = $('#calcRadBtn');
  const invBtn = $('#calcInvBtn');
  const grid = $('#calcGrid');

  if (!grid) return;

  const OPERATORS = ['+', '-', '*', '/', '^'];
  const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.'];

  const state = { expr: '', justEvaluated: false, lastResult: '0' };
  let angleMode = 'deg';
  let invMode = false;

  const CONSTANTS = { pi: Math.PI, e: Math.E };
  function toRad(x) { return angleMode === 'deg' ? (x * Math.PI) / 180 : x; }
  function fromRad(x) { return angleMode === 'deg' ? (x * 180) / Math.PI : x; }
  const FUNCS = {
    sin: (x) => Math.sin(toRad(x)),
    cos: (x) => Math.cos(toRad(x)),
    tan: (x) => Math.tan(toRad(x)),
    asin: (x) => fromRad(Math.asin(x)),
    acos: (x) => fromRad(Math.acos(x)),
    atan: (x) => fromRad(Math.atan(x)),
    log: (x) => Math.log10(x),
    ln: (x) => Math.log(x),
    sqrt: (x) => Math.sqrt(x),
    exp: (x) => Math.exp(x),
    abs: (x) => Math.abs(x),
  };

  function factorial(n) {
    if (n < 0 || Math.abs(n - Math.round(n)) > 1e-9) return NaN;
    n = Math.round(n);
    if (n > 170) return Infinity;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  function tokenize(str) {
    const tokens = [];
    let i = 0;
    while (i < str.length) {
      const c = str[i];
      if (/\s/.test(c)) { i += 1; continue; }
      if (/[0-9.]/.test(c)) {
        let j = i;
        while (j < str.length && /[0-9.]/.test(str[j])) j += 1;
        tokens.push({ type: 'num', value: parseFloat(str.slice(i, j)) });
        i = j; continue;
      }
      if (/[a-zA-Z]/.test(c)) {
        let j = i;
        while (j < str.length && /[a-zA-Z]/.test(str[j])) j += 1;
        tokens.push({ type: 'ident', value: str.slice(i, j) });
        i = j; continue;
      }
      if ('+-*/^!%()'.indexOf(c) !== -1) { tokens.push({ type: 'op', value: c }); i += 1; continue; }
      throw new Error('Karakter tidak dikenali: ' + c);
    }
    return tokens;
  }

  function evalExpression(str) {
    const tokens = tokenize(str);
    let pos = 0;
    function peek() { return tokens[pos]; }
    function nextTok() { return tokens[pos++]; }

    function parseExpression() {
      let v = parseTerm();
      while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        const op = nextTok().value;
        const rhs = parseTerm();
        v = op === '+' ? v + rhs : v - rhs;
      }
      return v;
    }
    function parseTerm() {
      let v = parseFactor();
      while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
        const op = nextTok().value;
        const rhs = parseFactor();
        v = op === '*' ? v * rhs : v / rhs;
      }
      return v;
    }
    function parseFactor() {
      const v = parseUnary();
      if (peek() && peek().type === 'op' && peek().value === '^') {
        nextTok();
        const rhs = parseFactor();
        return Math.pow(v, rhs);
      }
      return v;
    }
    function parseUnary() {
      if (peek() && peek().type === 'op' && peek().value === '-') { nextTok(); return -parseUnary(); }
      if (peek() && peek().type === 'op' && peek().value === '+') { nextTok(); return parseUnary(); }
      return parsePostfix();
    }
    function parsePostfix() {
      let v = parsePrimary();
      while (peek() && peek().type === 'op' && (peek().value === '!' || peek().value === '%')) {
        const op = nextTok().value;
        v = op === '!' ? factorial(v) : v / 100;
      }
      return v;
    }
    function parsePrimary() {
      const t = peek();
      if (!t) throw new Error('Ekspresi tidak lengkap');
      if (t.type === 'num') { nextTok(); return t.value; }
      if (t.type === 'ident') {
        const name = t.value;
        if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) { nextTok(); return CONSTANTS[name]; }
        if (Object.prototype.hasOwnProperty.call(FUNCS, name)) {
          nextTok();
          if (!peek() || peek().value !== '(') throw new Error('Fungsi ' + name + ' butuh tanda kurung');
          nextTok();
          const arg = parseExpression();
          if (!peek() || peek().value !== ')') throw new Error('Tanda kurung tidak seimbang');
          nextTok();
          return FUNCS[name](arg);
        }
        throw new Error('Fungsi/konstanta tidak dikenal: ' + name);
      }
      if (t.type === 'op' && t.value === '(') {
        nextTok();
        const v = parseExpression();
        if (!peek() || peek().value !== ')') throw new Error('Tanda kurung tidak seimbang');
        nextTok();
        return v;
      }
      throw new Error('Ekspresi tidak valid');
    }

    const result = parseExpression();
    if (pos < tokens.length) throw new Error('Ekspresi tidak valid');
    return result;
  }

  function formatResult(v) {
    if (!Number.isFinite(v)) return 'Error';
    if (Math.abs(v) < 1e-12) v = 0;
    if (Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-9 && v !== 0)) return v.toExponential(6);
    let s = v.toPrecision(12);
    if (s.indexOf('e') === -1 && s.indexOf('.') !== -1) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return String(parseFloat(s));
  }

  function prettify(s) {
    return s.replace(/\*/g, '\u00D7').replace(/\//g, '\u00F7').replace(/pi/g, '\u03C0');
  }

  function render() { displayEl.textContent = state.expr ? prettify(state.expr) : '0'; }
  function clearExprLine() { exprEl.innerHTML = '&nbsp;'; }

  function insertDigit(tok) {
    if (state.justEvaluated) { state.expr = tok === '.' ? '0.' : tok; state.justEvaluated = false; }
    else state.expr += tok;
    clearExprLine(); render();
  }
  function insertOperator(tok) {
    if (state.justEvaluated) { state.expr = state.lastResult + tok; state.justEvaluated = false; }
    else state.expr += tok;
    clearExprLine(); render();
  }
  function insertRaw(tok) {
    if (state.justEvaluated) { state.expr = tok; state.justEvaluated = false; }
    else state.expr += tok;
    clearExprLine(); render();
  }
  function currentBase() { return state.justEvaluated ? state.lastResult : (state.expr || '0'); }
  function oneOverX() { state.expr = '1/(' + currentBase() + ')'; state.justEvaluated = false; clearExprLine(); render(); }
  function square() { state.expr = '(' + currentBase() + ')^2'; state.justEvaluated = false; clearExprLine(); render(); }
  function negate() {
    const base = currentBase();
    state.expr = (base.indexOf('-(') === 0 && base.lastIndexOf(')') === base.length - 1) ? base.slice(2, -1) : '-(' + base + ')';
    state.justEvaluated = false;
    clearExprLine(); render();
  }
  function percent() {
    if (state.justEvaluated) { state.expr = state.lastResult + '%'; state.justEvaluated = false; }
    else state.expr += '%';
    clearExprLine(); render();
  }
  function clearAll() { state.expr = ''; state.justEvaluated = false; clearExprLine(); render(); }
  function backspace() {
    if (state.justEvaluated) { state.expr = ''; state.justEvaluated = false; }
    else state.expr = state.expr.slice(0, -1);
    render();
  }
  function evaluate() {
    const raw = (state.expr || '').trim();
    if (!raw) return;
    let str = raw;
    const openCount = (str.match(/\(/g) || []).length;
    const closeCount = (str.match(/\)/g) || []).length;
    if (openCount > closeCount) str += ')'.repeat(openCount - closeCount);
    try {
      const val = evalExpression(str);
      const resultStr = formatResult(val);
      if (resultStr === 'Error') throw new Error('Hasil tidak valid');
      exprEl.textContent = prettify(raw) + ' =';
      state.lastResult = resultStr;
      state.expr = resultStr;
      state.justEvaluated = true;
      render();
      if (window.StatCalc && window.StatCalc.trackCalc) window.StatCalc.trackCalc();
    } catch (err) {
      exprEl.textContent = prettify(raw) + ' =';
      displayEl.textContent = 'Error';
      state.expr = '';
      state.justEvaluated = false;
    }
  }

  function fnName(fn) {
    if (invMode && (fn === 'sin' || fn === 'cos' || fn === 'tan')) return { sin: 'asin', cos: 'acos', tan: 'atan' }[fn];
    return fn;
  }

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.calc-btn');
    if (!btn) return;
    if (btn.dataset.ins !== undefined) {
      const v = btn.dataset.ins;
      if (OPERATORS.indexOf(v) !== -1) insertOperator(v);
      else if (DIGITS.indexOf(v) !== -1) insertDigit(v);
      else insertRaw(v);
      return;
    }
    if (btn.dataset.fn) {
      const fn = btn.dataset.fn;
      if (fn === '1/x') { oneOverX(); return; }
      if (fn === 'x2') { square(); return; }
      insertRaw(fnName(fn) + '(');
      return;
    }
    if (btn.dataset.act) {
      const act = btn.dataset.act;
      if (act === 'clear') clearAll();
      else if (act === 'back') backspace();
      else if (act === 'negate') negate();
      else if (act === 'percent') percent();
      else if (act === 'equals') evaluate();
    }
  });

  degBtn.addEventListener('click', () => { angleMode = 'deg'; degBtn.classList.add('active'); radBtn.classList.remove('active'); });
  radBtn.addEventListener('click', () => { angleMode = 'rad'; radBtn.classList.add('active'); degBtn.classList.remove('active'); });
  invBtn.addEventListener('click', () => {
    invMode = !invMode;
    invBtn.classList.toggle('active', invMode);
    const sinBtn = grid.querySelector('[data-fn="sin"]');
    const cosBtn = grid.querySelector('[data-fn="cos"]');
    const tanBtn = grid.querySelector('[data-fn="tan"]');
    if (sinBtn) sinBtn.textContent = invMode ? 'sin\u207B\u00B9' : 'sin';
    if (cosBtn) cosBtn.textContent = invMode ? 'cos\u207B\u00B9' : 'cos';
    if (tanBtn) tanBtn.textContent = invMode ? 'tan\u207B\u00B9' : 'tan';
  });

  function reset() {
    state.expr = ''; state.justEvaluated = false; state.lastResult = '0';
    clearExprLine(); render();
  }
  reset();

  window.StatCalcCalc = { reset };
})();
