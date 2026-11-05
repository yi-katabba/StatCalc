"""Acuan independen untuk quality-core.js (konstanta, bagan kendali, uji kondisi, kapabilitas, faktorial) -> tests/ref_quality.json
Jalankan:  python3 tests/make_ref7.py && node tests/quality-core.test.js     (butuh numpy, scipy, statsmodels)"""
import json, itertools, numpy as np, statsmodels.api as sm
from scipy import stats, integrate
rng = np.random.default_rng(101); CASES = []
nrm = stats.norm
def consts(n):
    W = lambda w: n * integrate.quad(lambda z: nrm.pdf(z) * (nrm.cdf(z + w) - nrm.cdf(z)) ** (n - 1), -12, 12, epsabs=1e-13, epsrel=1e-13)[0]
    e1 = integrate.quad(lambda w: 1 - W(w), 0, 16, epsabs=1e-12, epsrel=1e-12)[0]; e2 = integrate.quad(lambda w: 2 * w * (1 - W(w)), 0, 16, epsabs=1e-12, epsrel=1e-12)[0]
    d2 = e1; d3 = np.sqrt(e2 - e1 ** 2); from scipy.special import gammaln
    c4 = np.sqrt(2 / (n - 1)) * np.exp(gammaln(n / 2) - gammaln((n - 1) / 2)); c5 = np.sqrt(1 - c4 ** 2)
    return dict(n=n, d2=d2, d3=d3, c4=c4, A2=3 / (d2 * np.sqrt(n)), A3=3 / (c4 * np.sqrt(n)), D3=max(0, 1 - 3 * d3 / d2), D4=1 + 3 * d3 / d2, B3=max(0, 1 - 3 * c5 / c4), B4=1 + 3 * c5 / c4)
CASES.append({'k': 'consts', 'tab': [{k: float(v) for k, v in consts(n).items()} for n in [2, 3, 4, 5, 6, 8, 10, 15, 25]]})
def rule_flags(z, tests):
    n = len(z); fl = [[] for _ in range(n)]
    for i in range(n):
        if 1 in tests and abs(z[i]) > 3: fl[i].append(1)
        if 2 in tests and i >= 8:
            w = z[i - 8:i + 1]
            if all(v > 0 for v in w) or all(v < 0 for v in w): fl[i].append(2)
        if 3 in tests and i >= 5:
            w = z[i - 5:i + 1]; d = np.diff(w)
            if all(d > 0) or all(d < 0): fl[i].append(3)
        if 4 in tests and i >= 13:
            d = np.diff(z[i - 13:i + 1])
            if all(d[k] * d[k - 1] < 0 for k in range(1, len(d))): fl[i].append(4)
        if 5 in tests and i >= 2:
            w = z[i - 2:i + 1]
            if (z[i] > 2 and sum(v > 2 for v in w) >= 2) or (z[i] < -2 and sum(v < -2 for v in w) >= 2): fl[i].append(5)
        if 6 in tests and i >= 4:
            w = z[i - 4:i + 1]
            if (z[i] > 1 and sum(v > 1 for v in w) >= 4) or (z[i] < -1 and sum(v < -1 for v in w) >= 4): fl[i].append(6)
    return fl
for m, n in [(25, 5), (30, 4), (20, 3)]:
    mu = rng.normal(0, 1, m).cumsum() * 0.15 + 50; rows = np.round(mu[:, None] + rng.normal(0, 2, (m, n)), 2); rows[7] += 6
    c = consts(n); xb = rows.mean(1); R = np.ptp(rows, 1); S = rows.std(1, ddof=1)
    CASES.append({'k': 'xbarR', 'rows': rows.tolist(), 'xb': xb.tolist(), 'Rbar': float(R.mean()), 'X2': float(xb.mean()), 'uclx': float(xb.mean() + c['A2'] * R.mean()), 'lclx': float(xb.mean() - c['A2'] * R.mean()), 'uclr': float(c['D4'] * R.mean()), 'lclr': float(c['D3'] * R.mean()),
                  'Sbar': float(S.mean()), 'uclxs': float(xb.mean() + c['A3'] * S.mean()), 'ucls': float(c['B4'] * S.mean()), 'lcls': float(c['B3'] * S.mean())})
for n in [30, 40]:
    x = np.round(np.cumsum(rng.normal(0, 0.4, n)) * 0.3 + rng.normal(10, 1, n), 2); x[11] += 5; mr = np.abs(np.diff(x)); mrbar = mr.mean(); s = mrbar / consts(2)['d2']
    xbar = x.mean(); z = (x - xbar) / s
    CASES.append({'k': 'imr', 'x': x.tolist(), 'xbar': float(xbar), 'mrbar': float(mrbar), 'ucl': float(xbar + 3 * s), 'lcl': float(xbar - 3 * s), 'uclmr': float(consts(2)['D4'] * mrbar), 'rules': {str(t): rule_flags(list(z), [t]) for t in range(1, 7)}})
for t_ in range(3):
    n = 25; z = list(np.round(rng.normal(0, 1.1, n), 2))
    z[5:14] = [0.4, 0.8, 0.3, 1.1, 0.2, 0.7, 0.9, 0.5, 0.6]; z[17:23] = [-2.3, -2.5, 0.2, -2.2, -1.5, -1.2]; z[15] = -3.4
    CASES.append({'k': 'rules', 'z': z, 'flags': rule_flags(z, [1, 2, 3, 4, 5, 6])})
for kind in ['p', 'np', 'c', 'u']:
    m = 24; nn = rng.integers(80, 120, m) if kind in ('p', 'u') else np.full(m, 100)
    x = rng.binomial(nn, 0.08) if kind in ('p', 'np') else rng.poisson(6 * (nn / 100) if kind == 'u' else 6, m)
    x = x.astype(float).copy(); x[9] += 12
    row = {'k': kind, 'x': x.tolist(), 'n': nn.tolist()}
    if kind == 'p': pb = x.sum() / nn.sum(); s = np.sqrt(pb * (1 - pb) / nn); row.update(cl=float(pb), ucl=np.minimum(1, pb + 3 * s).tolist(), lcl=np.maximum(0, pb - 3 * s).tolist())
    if kind == 'np': pb = x.sum() / nn.sum(); s = np.sqrt(100 * pb * (1 - pb)); row.update(cl=float(100 * pb), ucl=float(100 * pb + 3 * s), lcl=float(max(0, 100 * pb - 3 * s)))
    if kind == 'c': cb = x.mean(); row.update(cl=float(cb), ucl=float(cb + 3 * np.sqrt(cb)), lcl=float(max(0, cb - 3 * np.sqrt(cb))))
    if kind == 'u': ub = x.sum() / nn.sum(); s = np.sqrt(ub / nn); row.update(cl=float(ub), ucl=(ub + 3 * s).tolist(), lcl=np.maximum(0, ub - 3 * s).tolist())
    CASES.append(row)
for sub, n in [(1, 40), (5, 50), (4, 48)]:
    x = np.round(rng.normal(100, 2.2, n), 3); lsl, usl, tg = 93.0, 107.0, 100.5
    mu = x.mean(); so = x.std(ddof=1)
    if sub == 1: sw = np.abs(np.diff(x)).mean() / consts(2)['d2']
    else:
        g = n // sub; xs = x[:g * sub].reshape(g, sub); sp = np.sqrt(((sub - 1) * xs.var(1, ddof=1)).sum() / (g * (sub - 1))); df = g * (sub - 1); sw = sp / consts(df + 1)['c4']
    cp = (usl - lsl) / (6 * sw); cpk = min((usl - mu) / (3 * sw), (mu - lsl) / (3 * sw)); pp = (usl - lsl) / (6 * so); ppk = min((usl - mu) / (3 * so), (mu - lsl) / (3 * so))
    cpm = (usl - lsl) / (6 * np.sqrt(so ** 2 + (mu - tg) ** 2)); ppmw = (nrm.cdf((lsl - mu) / sw) + nrm.sf((usl - mu) / sw)) * 1e6; ppmo = (nrm.cdf((lsl - mu) / so) + nrm.sf((usl - mu) / so)) * 1e6
    df_ = n - 1; ci = [float(pp * np.sqrt(stats.chi2.ppf(0.025, df_) / df_)), float(pp * np.sqrt(stats.chi2.ppf(0.975, df_) / df_))]
    CASES.append({'k': 'cap', 'x': x.tolist(), 'sub': sub, 'lsl': lsl, 'usl': usl, 'target': tg, 'sw': float(sw), 'so': float(so), 'cp': float(cp), 'cpk': float(cpk), 'pp': float(pp), 'ppk': float(ppk), 'cpm': float(cpm), 'ppmw': float(ppmw), 'ppmo': float(ppmo), 'ciPp': ci})
def lenth(eff, alpha=0.05):
    ab = np.abs(eff); s0 = 1.5 * np.median(ab); pse = 1.5 * np.median(ab[ab < 2.5 * s0]); d = len(ab) / 3; me = pse * stats.t.ppf(1 - alpha / 2, d); g = (1 + (1 - alpha) ** (1 / len(ab))) / 2
    return pse, me, pse * stats.t.ppf(g, d)
for k, reps, mo in [(3, 2, 3), (3, 1, 3), (4, 1, 4), (4, 2, 2), (2, 3, 2)]:
    runs = list(itertools.product([0, 1], repeat=k)) * reps; X = np.array(runs)[:, ::-1] * 2 - 1
    F = np.where(X > 0, 20 + 5 * np.arange(k), 10 + 5 * np.arange(k)).astype(float); b = rng.uniform(-3, 3, k)
    y = 50 + X @ b + (X[:, 0] * X[:, 1] * 2.5 if k >= 2 else 0) + rng.normal(0, 0.6 if reps > 1 else 0.3, len(X))
    terms = [t for o in range(1, mo + 1) for t in itertools.combinations(range(k), o)]
    cols = [np.prod(X[:, list(t)], axis=1) for t in terms]; M = np.column_stack([np.ones(len(y))] + cols); f = sm.OLS(y, M).fit()
    row = {'k': 'fact', 'F': F.tolist(), 'y': y.tolist(), 'order': mo, 'terms': [''.join(chr(65 + j) for j in t) for t in terms], 'eff': (2 * f.params[1:]).tolist(), 'se': (2 * f.bse[1:]).tolist() if f.df_resid > 0 else None, 'p': f.pvalues[1:].tolist() if f.df_resid > 0 else None, 'r2': float(f.rsquared), 'dfe': int(f.df_resid)}
    if len(y) > 2 ** k: grp = {}; [grp.setdefault(tuple(r), []).append(v) for r, v in zip(X.tolist(), y)]; row['sspe'] = float(sum(((np.array(g) - np.mean(g)) ** 2).sum() for g in grp.values())); row['dfpe'] = int(sum(len(g) - 1 for g in grp.values()))
    row['lenth'] = [float(v) for v in lenth(2 * f.params[1:])]; CASES.append(row)
open('tests/ref_quality.json', 'w').write(json.dumps(CASES)); print(len(CASES), 'kasus -> tests/ref_quality.json')
