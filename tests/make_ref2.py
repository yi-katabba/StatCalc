"""Acuan SciPy/statsmodels untuk uji z, proporsi, kesamaan ragam, normalitas -> tests/ref_basic2.json
Jalankan:  python3 tests/make_ref2.py && node tests/basic-core2.test.js     (butuh numpy, scipy, statsmodels)"""
import json, numpy as np
from scipy import stats
from statsmodels.stats.proportion import proportions_ztest, proportion_confint, confint_proportions_2indep
from statsmodels.stats.diagnostic import normal_ad
rng = np.random.default_rng(11); C = []
nrm = stats.norm
for _ in range(5):
    x = np.round(rng.normal(50, 6, int(rng.integers(6, 40))), 1); y = np.round(rng.normal(52, 9, int(rng.integers(6, 40))), 1); s1, s2 = 6.0, 9.0
    for alt in ['two-sided', 'greater', 'less']:
        se = s1 / np.sqrt(len(x)); z = (x.mean() - 51) / se
        p = {'two-sided': 2 * nrm.sf(abs(z)), 'greater': nrm.sf(z), 'less': nrm.cdf(z)}[alt]
        cz = nrm.ppf(0.975) if alt == 'two-sided' else nrm.ppf(0.95)
        ci = {'two-sided': [x.mean() - cz * se, x.mean() + cz * se], 'greater': [x.mean() - cz * se, 1e999], 'less': [-1e999, x.mean() + cz * se]}[alt]
        C.append(dict(k='z1', x=x.tolist(), mu0=51, sigma=s1, alt=alt, z=float(z), p=float(p), ci=[float(v) for v in ci]))
        se2 = np.sqrt(s1**2 / len(x) + s2**2 / len(y)); z2 = (x.mean() - y.mean() - 0.5) / se2
        p2 = {'two-sided': 2 * nrm.sf(abs(z2)), 'greater': nrm.sf(z2), 'less': nrm.cdf(z2)}[alt]
        C.append(dict(k='z2', x=x.tolist(), y=y.tolist(), s1=s1, s2=s2, d0=0.5, alt=alt, z=float(z2), p=float(p2)))
for x_, n_, p0 in [(18, 40, 0.4), (7, 25, 0.2), (55, 120, 0.5), (3, 30, 0.05), (90, 100, 0.85)]:
    for alt in ['two-sided', 'greater', 'less']:
        a = {'two-sided': 'two-sided', 'greater': 'larger', 'less': 'smaller'}[alt]
        z, p = proportions_ztest(x_, n_, value=p0, alternative=a, prop_var=p0)
        pe = stats.binomtest(x_, n_, p0, alternative=alt).pvalue
        ci = proportion_confint(x_, n_, alpha=0.05 if alt == 'two-sided' else 0.10, method='wilson')
        ci = [float(ci[0]), float(ci[1])] if alt == 'two-sided' else ([float(ci[0]), 1.0] if alt == 'greater' else [0.0, float(ci[1])])
        C.append(dict(k='p1', x=x_, n=n_, p0=p0, alt=alt, z=float(z), p=float(p), pe=float(pe), ci=ci))
for x1, n1, x2, n2 in [(30, 80, 20, 90), (12, 50, 15, 45), (60, 200, 45, 180)]:
    for alt in ['two-sided', 'greater', 'less']:
        a = {'two-sided': 'two-sided', 'greater': 'larger', 'less': 'smaller'}[alt]
        z, p = proportions_ztest([x1, x2], [n1, n2], value=0, alternative=a)
        w = confint_proportions_2indep(x1, n1, x2, n2, method='wald', compare='diff', alpha=0.05)
        C.append(dict(k='p2', x1=x1, n1=n1, x2=x2, n2=n2, alt=alt, z=float(z), p=float(p), ci=[float(w[0]), float(w[1])]))
for _ in range(6):
    k = int(rng.integers(2, 5)); gs = [np.round(rng.normal(10, rng.uniform(1, 4), int(rng.integers(5, 25))), 1) for _ in range(k)]
    lm = stats.levene(*gs, center='median'); la = stats.levene(*gs, center='mean'); bt = stats.bartlett(*gs)
    C.append(dict(k='var', groups=[g.tolist() for g in gs], lmed=[float(lm.statistic), float(lm.pvalue)], lmean=[float(la.statistic), float(la.pvalue)], bart=[float(bt.statistic), float(bt.pvalue)]))
    if k == 2:
        a_, b_ = gs; F = a_.var(ddof=1) / b_.var(ddof=1); d1, d2 = len(a_) - 1, len(b_) - 1
        p = min(1, 2 * min(stats.f.cdf(F, d1, d2), stats.f.sf(F, d1, d2)))
        C[-1]['f'] = [float(F), float(p), float(F / stats.f.ppf(0.975, d1, d2)), float(F / stats.f.ppf(0.025, d1, d2))]
for n in [3, 4, 5, 6, 8, 11, 12, 15, 20, 35, 50, 120, 400, 1500]:
    for kind in ['norm', 'skew', 'ties']:
        x = rng.normal(0, 1, n) if kind == 'norm' else (rng.exponential(1, n) if kind == 'skew' else np.round(rng.normal(5, 2, n), 0))
        if np.ptp(x) == 0: continue
        sw = stats.shapiro(x); e = {'k': 'norm', 'x': x.tolist(), 'sw': [float(sw.statistic), float(sw.pvalue)]}
        if n >= 8:
            jb = stats.jarque_bera(x); ad = normal_ad(x)
            e['jb'] = [float(jb.statistic), float(jb.pvalue)]; e['ad'] = [float(ad[0]), float(ad[1])]
        C.append(e)
open('tests/ref_basic2.json', 'w').write(json.dumps(C).replace('Infinity', '1e999')); print(len(C), 'kasus -> tests/ref_basic2.json')
