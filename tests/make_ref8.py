"""Acuan SciPy/statsmodels untuk power-core.js -> tests/ref_power.json
Jalankan:  python3 tests/make_ref8.py && node tests/power-core.test.js     (butuh numpy, scipy, statsmodels)"""
import json, math, numpy as np
from scipy import stats
from statsmodels.stats.power import TTestPower, TTestIndPower, FTestAnovaPower
rng = np.random.default_rng(3); C = []; nrm = stats.norm
for df, ncp, t in [(5, 1.2, 1.5), (14, 2.8, 2.1), (29, 3.5, 2.05), (98, 2.2, 1.98), (400, 4.0, 1.97)]:
    C.append({'k': 'nct', 'df': df, 'ncp': ncp, 't': t, 'sf': float(stats.nct.sf(t, df, ncp)), 'cdf': float(stats.nct.cdf(-t, df, ncp))})
for df1, df2, lam, f in [(2, 27, 5.0, 3.4), (3, 36, 12.5, 2.9), (4, 95, 20.0, 2.5), (5, 10, 3.0, 3.3)]:
    C.append({'k': 'ncf', 'df1': df1, 'df2': df2, 'lam': lam, 'f': f, 'cdf': float(stats.ncf.cdf(f, df1, df2, lam))})
for d, n in [(0.5, 25), (0.8, 15), (0.3, 80), (1.0, 8), (0.2, 200)]:
    for alt, sa in [('two', 'two-sided'), ('greater', 'larger')]:
        a = {'k': 'powT1', 'd': d, 'n': n, 'alt': alt, 'power': float(TTestPower().power(effect_size=d, nobs=n, alpha=0.05, alternative=sa))}; C.append(a)
        n2 = n + 5; C.append({'k': 'powT2', 'd': d, 'n1': n, 'n2': n2, 'alt': alt, 'power': float(TTestIndPower().power(effect_size=d, nobs1=n, ratio=n2 / n, alpha=0.05, alternative=sa))})
for pw, d in [(0.8, 0.5), (0.9, 0.5), (0.8, 0.3), (0.95, 0.8)]:
    C.append({'k': 'solveT1', 'd': d, 'target': pw, 'n': int(math.ceil(TTestPower().solve_power(effect_size=d, power=pw, alpha=0.05, alternative='two-sided')))})
    C.append({'k': 'solveT2', 'd': d, 'target': pw, 'n': int(math.ceil(TTestIndPower().solve_power(effect_size=d, power=pw, alpha=0.05, ratio=1.0, alternative='two-sided')))})
for k, n, delta, sigma in [(3, 10, 4.0, 3.0), (4, 15, 5.0, 4.0), (5, 8, 6.0, 3.5), (3, 25, 2.0, 3.0)]:
    f2 = (delta ** 2 / 2) / (sigma ** 2 * k); C.append({'k': 'powA', 'kk': k, 'n': n, 'delta': delta, 'sigma': sigma, 'power': float(FTestAnovaPower().power(effect_size=math.sqrt(f2), nobs=k * n, alpha=0.05, k_groups=k))})
for k, delta, sigma, pw in [(3, 4.0, 3.0, 0.8), (4, 5.0, 4.0, 0.9)]:
    f = math.sqrt((delta ** 2 / 2) / (sigma ** 2 * k)); N = FTestAnovaPower().solve_power(effect_size=f, power=pw, alpha=0.05, k_groups=k); C.append({'k': 'solveA', 'kk': k, 'delta': delta, 'sigma': sigma, 'target': pw, 'n': int(math.ceil(N / k))})
def pw1(p0, p1, n, alpha, alt):
    s0 = math.sqrt(p0 * (1 - p0) / n); s1 = math.sqrt(p1 * (1 - p1) / n); d = p1 - p0
    if alt == 'two': z = nrm.ppf(1 - alpha / 2); return nrm.cdf((d - z * s0) / s1) + nrm.cdf((-d - z * s0) / s1)
    z = nrm.ppf(1 - alpha); return nrm.cdf((d - z * s0) / s1) if alt == 'greater' else nrm.cdf((-d - z * s0) / s1)
def pw2(p1, p2, n1, n2, alpha, alt):
    pb = (n1 * p1 + n2 * p2) / (n1 + n2); s0 = math.sqrt(pb * (1 - pb) * (1 / n1 + 1 / n2)); s1 = math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2); d = p1 - p2
    if alt == 'two': z = nrm.ppf(1 - alpha / 2); return nrm.cdf((d - z * s0) / s1) + nrm.cdf((-d - z * s0) / s1)
    z = nrm.ppf(1 - alpha); return nrm.cdf((d - z * s0) / s1) if alt == 'greater' else nrm.cdf((-d - z * s0) / s1)
for p0, p1, n in [(0.5, 0.65, 60), (0.2, 0.3, 150), (0.1, 0.2, 90)]:
    for alt in ['two', 'greater']:
        C.append({'k': 'pow1', 'p0': p0, 'p1': p1, 'n': n, 'alt': alt, 'power': float(pw1(p0, p1, n, 0.05, alt))})
for p1, p2, n1, n2 in [(0.3, 0.5, 80, 80), (0.15, 0.25, 200, 150), (0.6, 0.45, 100, 100)]:
    for alt in ['two', 'greater']:
        C.append({'k': 'pow2', 'p1': p1, 'p2': p2, 'n1': n1, 'n2': n2, 'alt': alt, 'power': float(pw2(p1, p2, n1, n2, 0.05, alt))})
for p0, p1, pw in [(0.5, 0.65, 0.8), (0.2, 0.3, 0.9)]:
    n = 2
    while pw1(p0, p1, n, 0.05, 'two') < pw: n += 1
    C.append({'k': 'solve1', 'p0': p0, 'p1': p1, 'target': pw, 'n': n})
for p1, p2, pw in [(0.3, 0.5, 0.8), (0.15, 0.25, 0.9)]:
    n = 2
    while pw2(p1, p2, n, n, 0.05, 'two') < pw: n += 1
    C.append({'k': 'solve2', 'p1': p1, 'p2': p2, 'target': pw, 'n': n})
for N, conf, p, e in [(1000, 0.95, 0.5, 0.05), (5000, 0.95, 0.3, 0.03), (250, 0.99, 0.5, 0.05), (120000, 0.9, 0.5, 0.04)]:
    z = nrm.ppf(1 - (1 - conf) / 2); n0 = z * z * p * (1 - p) / e ** 2; v = z * z * p * (1 - p)
    C.append({'k': 'survey', 'N': N, 'conf': conf, 'p': p, 'e': e, 'slovin': N / (1 + N * e * e), 'cochran0': n0, 'cochran': n0 / (1 + (n0 - 1) / N), 'lemeshow': N * v / (e * e * (N - 1) + v), 'lemeshow_inf': v / (e * e)})
open('tests/ref_power.json', 'w').write(json.dumps(C)); print(len(C), 'kasus -> tests/ref_power.json')
