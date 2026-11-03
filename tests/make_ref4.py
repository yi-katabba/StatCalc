"""Acuan SciPy/pingouin untuk anova-core.js (Tukey, Bonferroni, Dunnett, RAK, ANOVA berulang) -> tests/ref_anova.json
Jalankan:  python3 tests/make_ref4.py && node tests/anova-core.test.js     (butuh numpy, scipy, pandas, pingouin)"""
import json, warnings, numpy as np, pandas as pd
from scipy import stats
warnings.filterwarnings('ignore')
rng = np.random.default_rng(21); CASES = []
for k, base in [(3, 10), (4, 12), (5, 9), (3, 11), (6, 10)]:
    ns = [int(rng.integers(4, 12)) for _ in range(k)]
    gs = [np.round(rng.normal(base + 1.2 * i, 2.5, n), 2) for i, n in enumerate(ns)]
    th = stats.tukey_hsd(*gs); ci = th.confidence_interval(0.95)
    pairs = [(i, j) for i in range(k) for j in range(i + 1, k)]
    row = {'k': 'post', 'groups': [g.tolist() for g in gs],
           'tukey': [[i, j, float(th.pvalue[i, j]), float(ci.low[i, j]), float(ci.high[i, j])] for i, j in pairs]}
    dn = stats.dunnett(*gs[1:], control=gs[0]); dci = dn.confidence_interval(0.95)
    row['dunnett'] = [[i + 1, 0, float(dn.pvalue[i]), float(dci.low[i]), float(dci.high[i])] for i in range(k - 1)]
    CASES.append(row)
for b, t in [(4, 3), (6, 4), (5, 5), (8, 3)]:
    M = np.round(rng.normal(20, 3, (b, t)) + np.arange(t) * 1.5 + rng.normal(0, 2, (b, 1)), 2)
    df = pd.DataFrame([{'blk': i, 'trt': j, 'y': M[i, j]} for i in range(b) for j in range(t)])
    import statsmodels.formula.api as smf, statsmodels.api as sm
    a = sm.stats.anova_lm(smf.ols('y ~ C(trt) + C(blk)', df).fit(), typ=2)
    CASES.append({'k': 'rcbd', 'M': M.tolist(), 'F': [float(a.loc['C(trt)', 'F']), float(a.loc['C(blk)', 'F'])], 'p': [float(a.loc['C(trt)', 'PR(>F)']), float(a.loc['C(blk)', 'PR(>F)'])], 'sse': float(a.loc['Residual', 'sum_sq'])})
import pingouin as pg
for n, k in [(8, 3), (12, 4), (10, 5), (15, 3), (9, 2)]:
    M = np.round(rng.normal(10, 2, (n, k)) + np.arange(k) * 0.8 + rng.normal(0, 3, (n, 1)), 2)
    df = pd.DataFrame([{'s': i, 'c': j, 'y': M[i, j]} for i in range(n) for j in range(k)])
    r = pg.rm_anova(data=df, dv='y', within='c', subject='s', correction=True, detailed=True).iloc[0]
    sph = pg.sphericity(df, dv='y', within='c', subject='s', method='mauchly') if k > 2 else None
    row = {'k': 'rm', 'M': M.tolist(), 'F': float(r['F']), 'p': float(r['p_unc']), 'ssc': float(r['SS']), 'eps': float(r['eps']) if k > 2 else 1.0, 'pgg': float(r['p_GG_corr']) if k > 2 else float(r['p_unc']), 'np2': float(r['ng2'])}
    if sph is not None: row['W'] = float(sph.W); row['pW'] = float(sph.pval)
    CASES.append(row)
open('tests/ref_anova.json', 'w').write(json.dumps(CASES).replace('NaN', 'null')); print(len(CASES), 'kasus -> tests/ref_anova.json')
