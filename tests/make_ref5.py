"""Acuan statsmodels/SciPy untuk reg-core.js (OLS, polinomial, stepwise, best subsets, logistik) -> tests/ref_reg.json
Jalankan:  python3 tests/make_ref5.py && node tests/reg-core.test.js     (butuh numpy, scipy, statsmodels)"""
import json, itertools, warnings, numpy as np, statsmodels.api as sm
from scipy import stats
warnings.filterwarnings('ignore')
rng = np.random.default_rng(33); CASES = []
def ols_fit(X, y): return sm.OLS(y, sm.add_constant(X, has_constant='add')).fit()
# OLS umum
for n, p in [(20, 2), (35, 4), (60, 5)]:
    X = rng.normal(0, 1, (n, p)); y = 2 + X @ rng.uniform(-1, 1, p) + rng.normal(0, 1, n); f = ols_fit(X, y); h = f.get_influence().hat_matrix_diag
    CASES.append({'k': 'ols', 'X': X.tolist(), 'y': y.tolist(), 'beta': f.params.tolist(), 'se': f.bse.tolist(), 'p': f.pvalues.tolist(), 'r2': float(f.rsquared), 'adj': float(f.rsquared_adj), 'F': float(f.fvalue), 'pF': float(f.f_pvalue), 'aic': float(f.aic), 'bic': float(f.bic), 'h': h.tolist()})
# polinomial
for n, deg in [(25, 2), (40, 3), (30, 4)]:
    x = np.sort(rng.uniform(0, 10, n)); y = 1 + 0.5 * x - 0.08 * x ** 2 + 0.004 * x ** 3 + rng.normal(0, 0.4, n)
    row = {'k': 'poly', 'x': x.tolist(), 'y': y.tolist(), 'deg': deg, 'orig': np.polyfit(x, y, deg)[::-1].tolist()}
    xc = x - x.mean(); f = ols_fit(np.column_stack([xc ** d for d in range(1, deg + 1)]), y)
    row.update(beta=f.params.tolist(), se=f.bse.tolist(), p=f.pvalues.tolist(), r2=float(f.rsquared), aic=float(f.aic), bic=float(f.bic))
    x0 = float(np.mean(x) + 1.3); pr = f.get_prediction(np.concatenate([[1], [(x0 - x.mean()) ** d for d in range(1, deg + 1)]]).reshape(1, -1)).summary_frame(alpha=0.05).iloc[0]
    row['pred'] = [x0, float(pr['mean']), float(pr['mean_ci_lower']), float(pr['mean_ci_upper']), float(pr['obs_ci_lower']), float(pr['obs_ci_upper'])]
    cmp = []
    for d in range(1, 6):
        fd = ols_fit(np.column_stack([xc ** k for k in range(1, d + 1)]), y); cmp.append([d, float(fd.rsquared), float(fd.rsquared_adj), float(fd.aic), float(fd.bic)])
    row['cmp'] = cmp; CASES.append(row)
# stepwise (port algoritma yang sama dengan statsmodels sebagai pembanding numerik)
def pvals(X, y, idx): f = ols_fit(X[:, idx], y); return f.pvalues[1:]
def step_ref(X, y, method, ain, aout):
    p = X.shape[1]; cur = list(range(p)) if method == 'backward' else []; hist = []
    guard = 0; seen = set()
    while guard < 4 * p + 10:
        guard += 1; key = ','.join(map(str, sorted(cur)))
        if key in seen and method == 'stepwise' and len(hist) > 1 - 0: break
        seen.add(key); changed = False
        if method != 'backward':
            best = None
            for j in range(p):
                if j not in cur:
                    pv = ols_fit(X[:, cur + [j]], y).pvalues[-1]
                    if best is None or pv < best[1]: best = (j, pv)
            if best and best[1] < ain: cur = cur + [best[0]]; hist.append(('in', best[0])); changed = True
        if method != 'forward' and cur:
            pv = pvals(X, y, cur); i = int(np.argmax(pv))
            if pv[i] > aout and not (changed and cur[i] == cur[-1]): hist.append(('out', cur[i])); cur = [c for c in cur if c != cur[i]]; changed = True
        if not changed: break
    return cur, hist
for n, p, method in [(40, 6, 'stepwise'), (50, 8, 'forward'), (45, 7, 'backward'), (60, 5, 'stepwise'), (35, 6, 'backward')]:
    X = rng.normal(0, 1, (n, p)); X[:, 1] = X[:, 0] * 0.6 + rng.normal(0, 0.8, n); y = 1 + 1.5 * X[:, 0] - 1.0 * X[:, 2] + 0.5 * X[:, 3] + rng.normal(0, 1, n)
    fin, hist = step_ref(X, y, method, 0.15, 0.15); CASES.append({'k': 'step', 'X': X.tolist(), 'y': y.tolist(), 'method': method, 'final': fin, 'hist': hist})
# best subsets
for n, p in [(30, 4), (40, 6)]:
    X = rng.normal(0, 1, (n, p)); y = 3 + X[:, 0] - 2 * X[:, 2] + rng.normal(0, 1, n); full = ols_fit(X, y); mf = full.mse_resid; rows = []
    for m in range(1, p + 1):
        for idx in itertools.combinations(range(p), m):
            f = ols_fit(X[:, list(idx)], y); rows.append([list(idx), float(f.rsquared), float(f.rsquared_adj), float(f.ssr / mf - (n - 2 * (m + 1))), float(f.aic), float(f.bic)])
    CASES.append({'k': 'best', 'X': X.tolist(), 'y': y.tolist(), 'rows': rows})
# logistik
for n, p in [(60, 1), (120, 2), (200, 3), (80, 2)]:
    X = rng.normal(0, 1, (n, p)); eta = -0.3 + X @ rng.uniform(-1.5, 1.5, p); y = (rng.uniform(size=n) < 1 / (1 + np.exp(-eta))).astype(int)
    m = sm.Logit(y, sm.add_constant(X)).fit(disp=0, tol=1e-12); pr = m.predict(); pred = (pr >= 0.5).astype(int)
    CASES.append({'k': 'logit', 'X': X.tolist(), 'y': y.tolist(), 'beta': m.params.tolist(), 'se': m.bse.tolist(), 'p': m.pvalues.tolist(), 'll': float(m.llf), 'll0': float(m.llnull), 'LR': float(m.llr), 'pLR': float(m.llr_pvalue), 'mcf': float(m.prsquared), 'aic': float(m.aic), 'bic': float(m.bic),
                  'tp': int(((pred == 1) & (y == 1)).sum()), 'tn': int(((pred == 0) & (y == 0)).sum()), 'auc': float(stats.mannwhitneyu(pr[y == 1], pr[y == 0], alternative='greater').statistic / ((y == 1).sum() * (y == 0).sum()))})
open('tests/ref_reg.json', 'w').write(json.dumps(CASES)); print(len(CASES), 'kasus -> tests/ref_reg.json')
