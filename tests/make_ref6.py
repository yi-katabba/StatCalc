"""Acuan numpy/scipy/sklearn/factor_analyzer/pingouin/statsmodels untuk multi-core.js -> tests/ref_multi.json
Jalankan:  python3 tests/make_ref6.py && node tests/multi-core.test.js
(butuh numpy, scipy, scikit-learn, factor_analyzer, pingouin, statsmodels)"""
import json, warnings, numpy as np, pandas as pd
warnings.filterwarnings('ignore')
from scipy.cluster.hierarchy import linkage, fcluster
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from factor_analyzer import FactorAnalyzer
from factor_analyzer.factor_analyzer import calculate_kmo, calculate_bartlett_sphericity
import pingouin as pg
# factor_analyzer belum mengikuti scikit-learn >= 1.6 (force_all_finite -> ensure_all_finite): tambalan kompatibilitas
import factor_analyzer.factor_analyzer as _fam
_orig = _fam.check_array
def _patched(*a, force_all_finite=None, **k):
    if force_all_finite is not None: k['ensure_all_finite'] = force_all_finite
    return _orig(*a, **k)
_fam.check_array = _patched
from statsmodels.tsa.seasonal import seasonal_decompose
rng = np.random.default_rng(77); CASES = []
def nz(a): return [None if np.isnan(v) else float(v) for v in np.asarray(a, dtype=float)]
# PCA / KMO / Bartlett / faktor
for n, p, nf in [(60, 5, 2), (100, 6, 2), (80, 8, 3), (50, 4, 1)]:
    F = rng.normal(0, 1, (n, 2)); X = F @ rng.uniform(-1, 1, (2, p)) + rng.normal(0, 0.7, (n, p)) + rng.uniform(0, 5, p)
    R = np.corrcoef(X.T); w, V = np.linalg.eigh(R); o = np.argsort(w)[::-1]; w = w[o]
    row = {'k': 'pca', 'X': X.tolist(), 'ev': w.tolist(), 'absV': np.abs(V[:, o].T).tolist(), 'cov_ev': np.sort(np.linalg.eigvalsh(np.cov(X.T)))[::-1].tolist()}
    Z = (X - X.mean(0)) / X.std(0, ddof=1); row['absScores'] = np.abs(Z @ V[:, o]).tolist()
    kmo_v, kmo = calculate_kmo(X); chi, pv = calculate_bartlett_sphericity(X); row.update(kmo=float(kmo), msa=kmo_v.tolist(), bchi=float(chi), bp=float(pv))
    fa0 = FactorAnalyzer(n_factors=nf, method='principal', rotation=None); fa0.fit(X)
    from factor_analyzer.rotator import Rotator
    L = Rotator(method='varimax', normalize=True, max_iter=100000, tol=1e-14).fit_transform(fa0.loadings_) if nf > 1 else fa0.loadings_   # referensi dijalankan sampai konvergen penuh
    row.update(nf=nf, fa_comm=(L ** 2).sum(1).tolist(), fa_var=(L ** 2).sum(0).tolist(), fa_abs=np.abs(L).tolist())
    CASES.append(row)
# klaster hierarki
for n, p in [(25, 2), (40, 3), (30, 4)]:
    X = np.vstack([rng.normal(c, 0.8, (n // 3 + 1, p)) for c in (0, 4, 9)])[:n]
    row = {'k': 'hc', 'X': X.tolist()}
    for m in ['single', 'complete', 'average', 'ward']:
        Z = linkage(X, method=m, metric='euclidean'); row[m] = Z[:, 2].tolist(); row[m + '_lab3'] = fcluster(Z, 3, 'maxclust').tolist()
    CASES.append(row)
# k-means & silhouette
for n, p, k in [(60, 2, 3), (90, 3, 4), (45, 2, 2)]:
    X = np.vstack([rng.normal(c * 3.5, 0.9, (n // k + 1, p)) for c in range(k)])[:n]
    km = KMeans(n_clusters=k, n_init=30, random_state=0).fit(X); CASES.append({'k': 'km', 'X': X.tolist(), 'kc': k, 'inertia': float(km.inertia_), 'labels': km.labels_.tolist(), 'sil': float(silhouette_score(X, km.labels_))})
# analisis butir
for n, k in [(30, 5), (60, 8), (45, 4)]:
    t = rng.normal(0, 1, (n, 1)); M = np.round(3 + t + rng.normal(0, 0.9, (n, k)), 0).clip(1, 5)
    a = pg.cronbach_alpha(pd.DataFrame(M), ci=0.95); alpha = float(a[0]); ci = [float(a[1][0]), float(a[1][1])]
    tot = M.sum(1); ric = [float(np.corrcoef(M[:, j], tot - M[:, j])[0, 1]) for j in range(k)]
    ad = []
    for j in range(k):
        Mr = np.delete(M, j, 1); ad.append(float(pg.cronbach_alpha(pd.DataFrame(Mr))[0]) if k > 2 else None)
    CASES.append({'k': 'item', 'M': M.tolist(), 'alpha': alpha, 'ci': ci, 'ric': ric, 'ad': ad})
# dekomposisi
for n, m, model in [(48, 12, 'additive'), (36, 12, 'multiplicative'), (40, 4, 'additive'), (35, 7, 'multiplicative'), (30, 5, 'additive')]:
    t = np.arange(n); s = np.tile(rng.uniform(-3, 3, m), n // m + 1)[:n]
    y = (20 + 0.5 * t + (s if model == 'additive' else 1) ) * (1 if model == 'additive' else (1 + 0.1 * s)) + rng.normal(0, 0.5, n) if model == 'multiplicative' else 20 + 0.5 * t + s + rng.normal(0, 0.5, n)
    y = np.round(np.abs(y) + 5, 3); d = seasonal_decompose(y, period=m, model=model, two_sided=True)
    seas = np.asarray(d.seasonal); des = y / seas if model == 'multiplicative' else y - seas; b, a = np.polyfit(np.arange(1, n + 1), des, 1)
    h = 6; fc = [(a + b * (n + i + 1)) * (seas[(n + i) % m] if model == 'multiplicative' else 1) + (0 if model == 'multiplicative' else seas[(n + i) % m]) for i in range(h)]
    CASES.append({'k': 'dec', 'y': y.tolist(), 'm': m, 'model': model, 'trend': nz(np.asarray(d.trend)), 'seasonal': seas.tolist(), 'resid': nz(np.asarray(d.resid)), 'a': float(a), 'b': float(b), 'fc': fc})
open('tests/ref_multi.json', 'w').write(json.dumps(CASES)); print(len(CASES), 'kasus -> tests/ref_multi.json')
