"""Acuan independen untuk MLR dan uji Mardia di sem-core.js.
Jalankan: python3 tests/make_ref10.py   (butuh numpy, scipy)

Sengaja memakai formulasi BERBEDA dari sem-core.js agar aljabarnya teruji silang:
  - optimasi ML dengan scipy (BFGS) + polesan Fisher scoring, bukan Levenberg-Marquardt dengan turunan analitik;
  - Delta = turunan numerik vech(Sigma) terhadap theta (selisih pusat), bukan turunan analitik;
  - V = 1/2 D'(Sigma^-1 (x) Sigma^-1) D dengan matriks duplikasi D eksplisit, Gamma = kovarians sampel vech(zz') eksplisit;
    sem-core.js memakai bentuk kasus-per-kasus tanpa matriks duplikasi.
  - Mardia: matriks jarak Mahalanobis n x n lewat numpy.
Keluaran: ref_mlr.json (SE ML, SE robust, c, chi2 terskala, baseline c, Mardia)."""
import json, os, numpy as np
from scipy.optimize import minimize
here = os.path.dirname(os.path.abspath(__file__))

def vech_idx(p): return [(i, j) for i in range(p) for j in range(i + 1)]
def dup(p):
    idx = vech_idx(p); D = np.zeros((p * p, len(idx)))
    for k, (i, j) in enumerate(idx): D[i * p + j, k] = 1; D[j * p + i, k] = 1
    return D
def vech(M): return np.array([M[i, j] for i, j in vech_idx(M.shape[0])])

def build(names_obs, lat, loadings, regs, covs):
    """loadings: {lat: [obs...]} (indikator pertama dikunci 1); regs: [(to, from)]; covs: [(a, b)] kovarians galat/laten bebas."""
    names = names_obs + lat; p = len(names_obs); v = len(names); ix = {n: i for i, n in enumerate(names)}
    P = []   # (mat, i, j, free, val, kind, lhs, rhs)
    hasin = set()
    for L, inds in loadings.items():
        for k, o in enumerate(inds):
            hasin.add(ix[o]); P.append(('A', ix[o], ix[L], k > 0, 1.0 if k == 0 else 0.6, 'loading', L, o))
    for to, fr in regs: hasin.add(ix[to]); P.append(('A', ix[to], ix[fr], True, 0.0, 'reg', to, fr))
    for n in names_obs: P.append(('S', ix[n], ix[n], True, 1.0, 'var', n, n))
    for L in lat: P.append(('S', ix[L], ix[L], True, 1.0, 'var', L, L))
    for a, b in covs: P.append(('S', ix[a], ix[b], True, 0.0, 'cov', a, b))
    return dict(names=names, p=p, v=v, P=P)

def sigma(spec, th):
    v, p = spec['v'], spec['p']; A = np.zeros((v, v)); S = np.zeros((v, v)); t = 0
    for (m, i, j, free, val, *_r) in spec['P']:
        x = th[t] if free else val; t += 1 if free else 0
        if m == 'A': A[i, j] = x
        else: S[i, j] = x; S[j, i] = x
    M = np.linalg.inv(np.eye(v) - A); C = M @ S @ M.T
    return C[:p, :p]

def fit_ml(spec, Sm, th0):
    p = spec['p']; ld = np.linalg.slogdet(Sm)[1]
    def F(th):
        Sg = sigma(spec, th); sg, l = np.linalg.slogdet(Sg)
        if sg <= 0: return 1e10
        return l + np.trace(Sm @ np.linalg.inv(Sg)) - ld - p
    r = minimize(F, th0, method='BFGS', options={'gtol': 1e-10, 'maxiter': 5000})
    th = r.x
    for _ in range(30):   # Fisher scoring
        Sg = sigma(spec, th); Si = np.linalg.inv(Sg); D = dup(p); V = 0.5 * D.T @ np.kron(Si, Si) @ D
        De = jac(spec, th); step = np.linalg.solve(De.T @ V @ De, De.T @ V @ (vech(Sm) - vech(Sg)))
        th = th + step
        if np.max(np.abs(step)) < 1e-13: break
    return th, F(th)

def jac(spec, th, h=1e-6):
    cols = []
    for k in range(len(th)):
        a = th.copy(); b = th.copy(); a[k] += h; b[k] -= h
        cols.append((vech(sigma(spec, a)) - vech(sigma(spec, b))) / (2 * h))
    return np.array(cols).T

def mlr(spec, X):
    n, p = X.shape; Z = X - X.mean(0); Sm = Z.T @ Z / n
    free = [q for q in spec['P'] if q[3]]; th0 = np.array([0.6 if q[5] == 'loading' else (0.0 if q[5] in ('reg', 'cov') else 0.5 * Sm[0, 0]) for q in free])
    # nilai awal varians = separuh varians sampel variabelnya
    th0 = th0.copy(); nm = spec['names']
    for k, q in enumerate(free):
        if q[5] == 'var': th0[k] = 0.5 * Sm[q[1], q[1]] if q[1] < p else 0.5
    th, F = fit_ml(spec, Sm, th0)
    Sg = sigma(spec, th); Si = np.linalg.inv(Sg); D = dup(p); V = 0.5 * D.T @ np.kron(Si, Si) @ D
    De = jac(spec, th); A = De.T @ V @ De; Ai = np.linalg.inv(A)
    d = np.array([vech(np.outer(z, z)) for z in Z]); Gam = np.cov(d.T, ddof=0)
    covML = Ai / n; covR = Ai @ De.T @ V @ Gam @ V @ De @ Ai / n
    pst = p * (p + 1) // 2; df = pst - len(th); U = V - V @ De @ Ai @ De.T @ V; c = np.trace(U @ Gam) / df
    chi2 = n * F
    # baseline
    Sb = np.diag(np.diag(Sm)); Sbi = np.linalg.inv(Sb); Vb = 0.5 * D.T @ np.kron(Sbi, Sbi) @ D
    Db = np.array([vech(np.diag(np.eye(p)[k])) for k in range(p)]).T; Ab = Db.T @ Vb @ Db
    Ub = Vb - Vb @ Db @ np.linalg.inv(Ab) @ Db.T @ Vb; dB = p * (p - 1) // 2; cB = np.trace(Ub @ Gam) / dB
    chiB = n * (np.log(np.diag(Sm)).sum() - np.linalg.slogdet(Sm)[1])
    return dict(N=n, df=df, chi2=chi2, c=c, cBase=cB, chi2Base=chiB, trVG=float(np.trace(V @ Gam)),
                params=[dict(kind=q[5], lhs=q[6], rhs=q[7], est=float(th[k]), seML=float(np.sqrt(covML[k, k])), seR=float(np.sqrt(covR[k, k]))) for k, q in enumerate(free)])

def mardia(X):
    n, p = X.shape; Z = X - X.mean(0); Sm = Z.T @ Z / n; M = Z @ np.linalg.inv(Sm) @ Z.T
    b1 = (M ** 3).mean(); b2 = (np.diag(M) ** 2).mean()
    return dict(b1p=float(b1), b2p=float(b2), zK=float((b2 - p * (p + 2)) / np.sqrt(8 * p * (p + 2) / n)), statSkew=float(n * b1 / 6), dfSkew=p * (p + 1) * (p + 2) / 6,
                k=float((p + 1) * (n + 1) * (n + 3) / (n * ((n + 1) * (p + 1) - 6))), maxD=float(np.diag(M).max()),
                uniSkew=[float(((z) ** 3).mean() / (z ** 2).mean() ** 1.5) for z in Z.T], uniKurt=[float((z ** 4).mean() / (z ** 2).mean() ** 2 - 3) for z in Z.T])

out = {}
pd_ = json.load(open(os.path.join(here, 'data_polidem.json'))); sim = json.load(open(os.path.join(here, 'data_sem_sim.json')))
def cols(d, names): return np.array(d['X'], float)[:, [d['names'].index(c) for c in names]]
# --- Political Democracy ---
obs = [n for n in pd_['names'] if n in 'x1 x2 x3 y1 y2 y3 y4 y5 y6 y7 y8'.split()]
spec = build(obs, ['ind60', 'dem60', 'dem65'], {'ind60': ['x1', 'x2', 'x3'], 'dem60': ['y1', 'y2', 'y3', 'y4'], 'dem65': ['y5', 'y6', 'y7', 'y8']},
             [('dem60', 'ind60'), ('dem65', 'ind60'), ('dem65', 'dem60')], [('y1', 'y5'), ('y2', 'y4'), ('y2', 'y6'), ('y3', 'y7'), ('y4', 'y8'), ('y6', 'y8')])
Xp = cols(pd_, obs); out['pd'] = dict(obs=obs, **mlr(spec, Xp), mardia=mardia(Xp))
# --- simulasi: CFA 3 faktor + jalur ---
obs2 = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3', 'c4']
spec2 = build(obs2, ['A', 'B', 'C'], {'A': ['a1', 'a2', 'a3'], 'B': ['b1', 'b2', 'b3'], 'C': ['c1', 'c2', 'c3', 'c4']}, [('B', 'A'), ('C', 'B'), ('C', 'A')], [])
Xs = cols(sim, obs2); out['sim'] = dict(obs=obs2, **mlr(spec2, Xs), mardia=mardia(Xs))
json.dump(out, open(os.path.join(here, 'ref_mlr.json'), 'w'), indent=1)
for k in out: print(k, 'chi2=%.4f df=%d c=%.6f cBase=%.6f' % (out[k]['chi2'], out[k]['df'], out[k]['c'], out[k]['cBase']))
