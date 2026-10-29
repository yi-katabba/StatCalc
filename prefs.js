/* Pengaturan global: taraf signifikansi (alpha). Dimuat sebelum file metode. */
(function () {
  'use strict';
  var KEY = 'statcalc.alpha', ALLOWED = [0.1, 0.05, 0.01], alpha = 0.05, subs = [];
  try { var v = parseFloat(localStorage.getItem(KEY)); if (ALLOWED.indexOf(v) !== -1) alpha = v; } catch (e) { /* penyimpanan tidak tersedia */ }
  window.statAlpha = function () { return alpha; };
  window.StatCalcPrefs = {
    allowed: ALLOWED.slice(),
    get alpha() { return alpha; },
    setAlpha: function (a) {
      a = +a; if (ALLOWED.indexOf(a) === -1 || a === alpha) return;
      alpha = a; try { localStorage.setItem(KEY, String(a)); } catch (e) { /* abaikan */ }
      subs.forEach(function (f) { try { f(a); } catch (e) { /* abaikan */ } });
      rewrite();
    },
    onAlpha: function (f) { subs.push(f); },
    refresh: function () { rewrite(); },
  };
  /* Teks kesimpulan di hasil masih menyebut 0.05 / 5%: sesuaikan dengan alpha aktif */
  var CMP = /([<>\u2264\u2265]=?\s*|\u03B1\s*=\s*)0[.,]05\b/g;
  var PCT = /(taraf signifikansi\s*)5%/gi;
  var orig = new WeakMap();
  function fmt(comma, a) { var s = String(a); return comma ? s.replace('.', ',') : s; }
  function rewrite(root) {
    var a = alpha, pct = Math.round(a * 100) + '%';
    var w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode && n.parentNode.nodeName;
        if (p === 'SCRIPT' || p === 'STYLE' || p === 'TEXTAREA' || p === 'OPTION') return NodeFilter.FILTER_REJECT;
        return (orig.has(n) || /0[.,]05\b|5%/.test(n.nodeValue)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    var nodes = [], n; while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function (t) {
      if (t.parentNode && t.parentNode.closest && t.parentNode.closest('.calc-card,.sc-main,.calc-hist-card,.chapter-head,.sc-quick')) return;
      var o = orig.has(t) ? orig.get(t) : t.nodeValue;
      var r = o.replace(CMP, function (m, pre) { return pre + fmt(/,/.test(m), a); }).replace(PCT, function (m, pre) { return pre + pct; });
      if (r !== o) orig.set(t, o);
      if (r !== t.nodeValue) t.nodeValue = r;
    });
  }
  /* hasil baru dirender oleh tiap metode: terapkan alpha ke teks yang baru muncul */
  var timer = null;
  new MutationObserver(function () { if (alpha === 0.05 || timer) return; timer = setTimeout(function () { timer = null; rewrite(); }, 250); })
    .observe(document.documentElement, { childList: true, subtree: true });
  var sel = document.getElementById('profileAlpha');
  if (sel) {
    sel.value = String(alpha);
    sel.addEventListener('change', function () {
      window.StatCalcPrefs.setAlpha(sel.value);
      if (window.StatCalc && window.StatCalc.showToast) window.StatCalc.showToast('Taraf signifikansi \u03B1 = ' + String(alpha).replace('.', ',') + '. Hitung ulang untuk memperbarui hasil.');
    });
  }
})();
