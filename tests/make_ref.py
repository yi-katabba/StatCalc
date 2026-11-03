"""Buat nilai acuan SciPy untuk basic-core.js (Uji t & Korelasi) -> tests/ref_basic.json
Jalankan:  python3 tests/make_ref.py && node tests/basic-core.test.js     (butuh numpy & scipy)"""
import json, numpy as np
from scipy import stats
rng = np.random.default_rng(7); cases = []
def ci(r): c = r.confidence_interval(0.95); return [float(c.low), float(c.high)]
for _ in range(6):
    n1, n2 = int(rng.integers(5, 40)), int(rng.integers(5, 40))
    x = np.round(rng.normal(50, 8, n1), 1); y = np.round(rng.normal(53, 12, n2), 1); z = np.round(x + rng.normal(1.5, 3, n1), 1)
    for alt in ['two-sided', 'greater', 'less']:
        r = stats.ttest_1samp(x, 52, alternative=alt); cases.append(dict(k='one', x=x.tolist(), mu0=52, alt=alt, t=float(r.statistic), df=float(r.df), p=float(r.pvalue), ci=ci(r)))
        for ev in [True, False]:
            r = stats.ttest_ind(x, y, equal_var=ev, alternative=alt); cases.append(dict(k='two', x=x.tolist(), y=y.tolist(), ev=ev, alt=alt, t=float(r.statistic), df=float(r.df), p=float(r.pvalue), ci=ci(r)))
        r = stats.ttest_rel(x, z, alternative=alt); cases.append(dict(k='paired', x=x.tolist(), y=z.tolist(), alt=alt, t=float(r.statistic), df=float(r.df), p=float(r.pvalue), ci=ci(r)))
for _ in range(8):
    n = int(rng.integers(6, 60)); x = np.round(rng.normal(0, 1, n), 1); y = np.round(0.5 * x + rng.normal(0, 1, n), 1)
    pr = stats.pearsonr(x, y); sp = stats.spearmanr(x, y); kd = stats.kendalltau(x, y, method='asymptotic', variant='b'); c = pr.confidence_interval(0.95)
    cases.append(dict(k='corr', x=x.tolist(), y=y.tolist(), pr=[float(pr.statistic), float(pr.pvalue), float(c.low), float(c.high)], sp=[float(sp.statistic), float(sp.pvalue)], kd=[float(kd.statistic), float(kd.pvalue)]))
json.dump(cases, open('tests/ref_basic.json', 'w')); print(len(cases), 'kasus ->tests/ref_basic.json')
