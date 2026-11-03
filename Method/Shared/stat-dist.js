/* =========================================================================
   STAT-DIST - fungsi distribusi bersama (t, normal, chi-square, F)
   -------------------------------------------------------------------------
   Dipakai metode Stat yang baru (Uji t, Korelasi, ...). Tanpa pustaka luar.
   Semua p-value dua sisi dihitung langsung dari beta/gamma tak lengkap, jadi
   tetap akurat untuk p yang sangat kecil (tidak lewat 1 - cdf).
   API (window.StatDist):
     normCdf(z), normQuant(p), normTwoP(z)
     tCdf(t, df), tTwoP(t, df), tCrit(df, conf)      // tCrit: nilai kritis dua sisi
     chi2Cdf(x, k), chi2Sf(x, k)
     fCdf(x, d1, d2), fSf(x, d1, d2), fQuant(p, d1, d2)
   ========================================================================= */
(function () {
  'use strict';
  const C = [57.1562356658629235, -59.5979603554754912, 14.1360979747417471, -0.491913816097620199, 0.339946499848118887e-4,
    0.465236289270485756e-4, -0.983744753048795646e-4, 0.158088703224912494e-3, -0.210264441724104883e-3,
    0.217439618115212643e-3, -0.164318106536763890e-3, 0.844182239838527433e-4, -0.261908384015814087e-4, 0.368991826595316234e-5];
  function lgamma(x) {   // Lanczos (Numerical Recipes 3e), akurasi ~1e-15
    let y = x, tmp = x + 5.24218750000000000;
    tmp = (x + 0.5) * Math.log(tmp) - tmp;
    let ser = 0.999999999999997092;
    for (let j = 0; j < 14; j++) ser += C[j] / ++y;
    return tmp + Math.log(2.5066282746310005 * ser / x);
  }
  function betacf(a, b, x) {
    const MAXIT = 500, EPS = 1e-15, FPMIN = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
      const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function ibeta(a, b, x) {   // I_x(a, b) teregularisasi
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function gser(a, x) { let ap = a, sum = 1 / a, del = sum; for (let n = 0; n < 1000; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break; } return sum * Math.exp(-x + a * Math.log(x) - lgamma(a)); }
  function gcf(a, x) {
    const FPMIN = 1e-300; let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
    for (let i = 1; i < 1000; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN; c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-16) break; }
    return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }
  function gammp(a, x) { if (x <= 0) return 0; return x < a + 1 ? gser(a, x) : 1 - gcf(a, x); }   // P(a,x)
  function gammq(a, x) { if (x <= 0) return 1; return x < a + 1 ? 1 - gser(a, x) : gcf(a, x); }   // Q(a,x)

  /* ---- normal ---- */
  function erfc(x) { return x >= 0 ? gammq(0.5, x * x) : 1 + gammp(0.5, x * x); }
  function normCdf(z) { return 0.5 * erfc(-z / Math.SQRT2); }
  function normTwoP(z) { return erfc(Math.abs(z) / Math.SQRT2); }
  function normQuant(p) {   // Acklam + satu langkah Halley
    if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    let x;
    if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else { const q = p - 0.5, r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
    const e = normCdf(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
    return x - u / (1 + x * u / 2);
  }

  /* ---- t ---- */
  function tTwoP(t, df) { return ibeta(df / 2, 0.5, df / (df + t * t)); }        // P(|T| > |t|)
  function tCdf(t, df) { const p = 0.5 * tTwoP(t, df); return t > 0 ? 1 - p : p; }
  function tCrit(df, conf) {   // nilai kritis dua sisi: P(|T| > c) = 1 - conf
    const alpha = 1 - conf; let lo = 0, hi = 1e4;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (tTwoP(mid, df) > alpha) lo = mid; else hi = mid; if (hi - lo < 1e-13 * Math.max(1, hi)) break; }
    return (lo + hi) / 2;
  }

  /* ---- chi-square & F ---- */
  function chi2Cdf(x, k) { return gammp(k / 2, x / 2); }
  function chi2Sf(x, k) { return gammq(k / 2, x / 2); }
  function fCdf(x, d1, d2) { return x <= 0 ? 0 : ibeta(d1 / 2, d2 / 2, d1 * x / (d1 * x + d2)); }
  function fSf(x, d1, d2) { return x <= 0 ? 1 : ibeta(d2 / 2, d1 / 2, d2 / (d1 * x + d2)); }

  function fQuant(p, d1, d2) {   // kuantil F (invers fCdf) lewat bisection
    let lo = 0, hi = 1;
    while (fCdf(hi, d1, d2) < p && hi < 1e12) hi *= 2;
    for (let i = 0; i < 300; i++) { const mid = (lo + hi) / 2; if (fCdf(mid, d1, d2) < p) lo = mid; else hi = mid; if (hi - lo < 1e-14 * Math.max(1, hi)) break; }
    return (lo + hi) / 2;
  }

  window.StatDist = { lgamma, ibeta, normCdf, normQuant, normTwoP, tCdf, tTwoP, tCrit, chi2Cdf, chi2Sf, fCdf, fSf, fQuant };
})();
