"""Acuan SciPy untuk nonpar-core.js (Chi-Square, Fisher, Mann-Whitney, Wilcoxon, Kruskal-Wallis, Friedman) -> tests/ref_nonpar.json
Jalankan:  python3 tests/make_ref3.py && node tests/nonpar-core.test.js     (butuh numpy, scipy)"""
import json, warnings, numpy as np
from scipy import stats
warnings.filterwarnings('ignore')
rng = np.random.default_rng(5); C = []
for r, c in [(2, 2), (2, 3), (3, 3), (3, 4), (2, 5), (4, 2)]:
    O = rng.integers(2, 40, size=(r, c))
    row = {'k': 'chi', 'O': O.tolist()}
    a = stats.chi2_contingency(O, correction=False); g = stats.chi2_contingency(O, correction=False, lambda_='log-likelihood')
    row.update(chi=[float(a.statistic), float(a.pvalue), int(a.dof)], G=[float(g.statistic), float(g.pvalue)])
    if (r, c) == (2, 2):
        y = stats.chi2_contingency(O, correction=True); row['yates'] = [float(y.statistic), float(y.pvalue)]
    row['V'] = float(stats.contingency.association(O, method='cramer', correction=False)); C.append(row)
for k in [2, 3, 4, 6]:
    O = rng.integers(5, 60, size=k); eq = stats.chisquare(O)
    pr = rng.uniform(1, 3, size=k); pr = pr / pr.sum(); ex = pr * O.sum(); cs = stats.chisquare(O, ex)
    C.append({'k': 'gof', 'O': O.tolist(), 'eq': [float(eq.statistic), float(eq.pvalue)], 'props': pr.tolist(), 'ex': [float(cs.statistic), float(cs.pvalue)]})
for tab in [(8, 2, 1, 5), (3, 7, 9, 2), (0, 6, 5, 4), (12, 18, 20, 9), (30, 10, 15, 25), (5, 0, 0, 5)]:
    t = np.array(tab).reshape(2, 2); row = {'k': 'fisher', 'tab': list(tab)}
    for alt in ['two-sided', 'greater', 'less']:
        r = stats.fisher_exact(t, alternative=alt); row[alt] = [float(r.statistic) if np.isfinite(r.statistic) else 1e999, float(r.pvalue)]
    C.append(row)
for trial in range(10):
    n1, n2 = int(rng.integers(3, 30)), int(rng.integers(3, 30))
    ties = trial % 2 == 1
    x = np.round(rng.normal(10, 3, n1), 0 if ties else 3); y = np.round(rng.normal(11.5, 3, n2), 0 if ties else 3)
    exact_ok = (not ties) and n1 + n2 <= 40
    row = {'k': 'mw', 'x': x.tolist(), 'y': y.tolist(), 'exact': exact_ok}
    for alt in ['two-sided', 'greater', 'less']:
        r = stats.mannwhitneyu(x, y, alternative=alt, method='exact' if exact_ok else 'asymptotic', use_continuity=True); row[alt] = float(r.pvalue)
    row['U1'] = float(stats.mannwhitneyu(x, y, alternative='greater', method='asymptotic').statistic); C.append(row)
for trial in range(10):
    n = int(rng.integers(5, 45)); ties = trial % 2 == 1
    d = rng.normal(0.6, 1.5, n); d = np.round(d, 0) if ties else np.round(d, 4)
    d = d + (d == 0) * 0.0 if ties else d
    nz = d[d != 0]; exact_ok = len(nz) == len(d) and len(set(np.abs(nz).tolist())) == len(nz) and len(d) <= 50   # eksak hanya bila tanpa nol & tanpa nilai kembar
    row = {'k': 'wil', 'd': d.tolist(), 'exact': exact_ok}
    for alt in ['two-sided', 'greater', 'less']:
        r = stats.wilcoxon(d, alternative=alt, method='exact' if exact_ok else 'approx', correction=True, zero_method='wilcox'); row[alt] = float(r.pvalue)
    C.append(row)
for trial in range(8):
    k = int(rng.integers(2, 6)); gs = [np.round(rng.normal(10 + i, 3, int(rng.integers(5, 20))), 0 if trial % 2 else 3) for i in range(k)]
    r = stats.kruskal(*gs); C.append({'k': 'kw', 'groups': [g.tolist() for g in gs], 'H': float(r.statistic), 'p': float(r.pvalue)})
for trial in range(8):
    n, k = int(rng.integers(5, 25)), int(rng.integers(3, 6)); M = rng.normal(0, 1, (n, k)) + np.arange(k) * 0.4; M = np.round(M, 0 if trial % 2 else 3)
    r = stats.friedmanchisquare(*[M[:, j] for j in range(k)]); C.append({'k': 'fr', 'M': M.tolist(), 'chi': float(r.statistic), 'p': float(r.pvalue)})
open('tests/ref_nonpar.json', 'w').write(json.dumps(C).replace('Infinity', '1e999')); print(len(C), 'kasus -> tests/ref_nonpar.json')
