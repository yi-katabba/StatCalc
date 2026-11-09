"""Acuan untuk tar-core.js: TAR konvensional, SETAR (2 dan 3 rezim), STAR (LSTAR/ESTAR).
Jalankan: python3 tests/make_ref12.py   (butuh numpy, scipy)
Menulis tests/data_tar_sim.json (data simulasi, seed tetap) dan tests/ref_tar.json.
Implementasi acuan sengaja berbeda dari JS: pencarian ambang brute force dengan np.linalg.lstsq pada SEMUA nilai
ambang, uji Tsay dengan refit eksplisit (bukan Sherman-Morrison), STAR dengan scipy least_squares multi-start
berbatas + Jacobian numerik (bukan turunan analitik)."""
import json, os, numpy as np
from scipy import stats
from scipy.optimize import least_squares

here = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(20261109)

# ----------------------------- data simulasi -----------------------------
def sim_setar(n, burn=50):
    y = np.zeros(n + burn); e = rng.normal(0, 0.8, n + burn)
    for t in range(2, n + burn):
        y[t] = (0.8 + 0.5 * y[t-1] - 0.25 * y[t-2] + e[t]) if y[t-2] <= 0.3 else (-1.0 - 0.6 * y[t-1] + e[t])
    return y[burn:]
def sim_tar(n, burn=50):
    z = np.zeros(n + burn); ez = rng.normal(0, 1, n + burn)
    for t in range(1, n + burn): z[t] = 0.7 * z[t-1] + ez[t]
    y = np.zeros(n + burn); e = rng.normal(0, 0.7, n + burn)
    for t in range(2, n + burn):
        y[t] = (1.0 + 0.7 * y[t-1] + e[t]) if z[t-1] <= -0.2 else (-0.5 + 0.2 * y[t-1] + 0.3 * y[t-2] + e[t])
    return y[burn:], z[burn:]
def sim_lstar(n, burn=50):
    y = np.zeros(n + burn); e = rng.normal(0, 0.5, n + burn)
    for t in range(1, n + burn):
        G = 1 / (1 + np.exp(-4.0 * (y[t-1] - 0.3)))
        y[t] = (0.5 + 0.6 * y[t-1]) * (1 - G) + (-0.7 - 0.7 * y[t-1]) * G + e[t]
    return y[burn:]
def sim_estar(n, burn=100):
    y = np.zeros(n + burn); e = rng.normal(0, 1.2, n + burn)
    for t in range(2, n + burn):
        G = 1 - np.exp(-0.35 * y[t-1] ** 2)
        y[t] = 1.0 * y[t-1] - 0.9 * y[t-1] * G + e[t]
    return y[burn:]
def sim_ar1(n, burn=50):
    y = np.zeros(n + burn); e = rng.normal(0, 1, n + burn)
    for t in range(1, n + burn): y[t] = 0.5 + 0.6 * y[t-1] + e[t]
    return y[burn:]
y_setar = sim_setar(300); y_tar, z_tar = sim_tar(300); y_lstar = sim_lstar(400); y_estar = sim_estar(400); y_lin = sim_ar1(300)
data = {k: np.round(v, 5).tolist() for k, v in dict(setar=y_setar, tar_y=y_tar, tar_z=z_tar, lstar=y_lstar, estar=y_estar, linear=y_lin).items()}
json.dump(data, open(os.path.join(here, 'data_tar_sim.json'), 'w'))
Y = {k: np.array(v) for k, v in data.items()}   # pakai data yang sudah dibulatkan, sama seperti yang dibaca JS

# ----------------------------- pembantu umum -----------------------------
def lsq(X, y):
    b = np.linalg.lstsq(X, y, rcond=None)[0]; r = y - X @ b; return b, float(r @ r)
def rows(y, pmax, m):
    T = len(y) - m
    X = np.column_stack([np.ones(T)] + [y[m - j: len(y) - j] for j in range(1, pmax + 1)]); return X, y[m:]
def thr_var(series, m, d, T): return series[m - d: m - d + T]
def aic(sse, T, k): return float(T * np.log(sse / T) + 2 * k)

def setar_ref(y, z, orders, dlist, trim, nreg):
    self_ = z is None; series = y if self_ else z
    pmax = max(orders); ks = [p + 1 for p in orders]; m = max(pmax, max(dlist)); X, yy = rows(y, pmax, m); T = len(yy)
    minN = [max(int(np.ceil(trim * T)), k + 2) for k in ks]; best = None; dtab = []
    for d in dlist:
        s = thr_var(series, m, d, T); vals = np.unique(s); bd = None; prof = []
        if nreg == 2:
            for r in vals:
                lo = s <= r; n1 = int(lo.sum())
                if n1 < minN[0] or T - n1 < minN[1]: continue
                tot = lsq(X[lo][:, :ks[0]], yy[lo])[1] + lsq(X[~lo][:, :ks[1]], yy[~lo])[1]; prof.append((float(r), tot))
                if bd is None or tot < bd[0]: bd = (tot, [float(r)])
        else:
            for i1, r1 in enumerate(vals):
                for r2 in vals[i1 + 1:]:
                    a = s <= r1; b = (s > r1) & (s <= r2); c = s > r2
                    if a.sum() < minN[0] or b.sum() < minN[1] or c.sum() < minN[2]: continue
                    tot = lsq(X[a][:, :ks[0]], yy[a])[1] + lsq(X[b][:, :ks[1]], yy[b])[1] + lsq(X[c][:, :ks[2]], yy[c])[1]
                    if bd is None or tot < bd[0]: bd = (tot, [float(r1), float(r2)])
        npar = sum(ks) + nreg - 1; dtab.append({'d': d, 'sse': bd[0], 'thr': bd[1], 'aic': aic(bd[0], T, npar)})
        if best is None or bd[0] < best['sse']: best = {'d': d, 'sse': bd[0], 'thr': bd[1], 'prof': prof, 's': s}
    s = best['s']; thr = best['thr']; reg = np.zeros(T, int)
    for r in thr: reg += (s > r).astype(int)
    regs = []; resid = np.zeros(T)
    for j in range(nreg):
        idx = reg == j; Xj = X[idx][:, :ks[j]]; b, sse = lsq(Xj, yy[idx]); s2 = sse / (idx.sum() - ks[j])
        se = np.sqrt(np.diag(s2 * np.linalg.inv(Xj.T @ Xj))); regs.append({'n': int(idx.sum()), 'coef': b.tolist(), 'se': se.tolist(), 'sse': sse})
        resid[idx] = yy[idx] - Xj @ b
    out = {'d': best['d'], 'thr': thr, 'sse': best['sse'], 'dtab': dtab, 'regimes': regs, 'T': T, 'aic': aic(best['sse'], T, sum(ks) + nreg - 1),
           'bic': float(T * np.log(best['sse'] / T) + np.log(T) * (sum(ks) + nreg - 1))}
    if nreg == 2:
        S = best['sse']; inci = [r for r, v in best['prof'] if T * (v - S) / S <= 7.352]; out['ci'] = [min(inci), max(inci)]
    # diagnostik
    mlb = max(pmax + 1, min(10, T // 4)); e = resid - resid.mean(); c0 = e @ e
    r = [float(e[k:] @ e[:-k] / c0) for k in range(1, mlb + 1)]; Q = T * (T + 2) * sum(v * v / (T - i - 1) for i, v in enumerate(r))
    out['lb'] = {'Q': Q, 'm': mlb, 'df': mlb - pmax, 'p': float(stats.chi2.sf(Q, mlb - pmax))}
    m2 = (e ** 2).mean(); sk = (e ** 3).mean() / m2 ** 1.5; ku = (e ** 4).mean() / m2 ** 2; JB = T / 6 * (sk ** 2 + (ku - 3) ** 2 / 4); out['jb'] = {'JB': float(JB), 'skew': float(sk), 'kurt': float(ku)}
    # benchmark linier & uji Tsay (refit eksplisit)
    b0, S0 = lsq(X, yy); out['lin'] = {'sse': S0, 'aic': aic(S0, T, pmax + 1)}
    order = np.argsort(s, kind='stable'); Xs = X[order]; ys = yy[order]; k = X.shape[1]; m0 = max(k + 5, T // 10 + k); eh = []
    for i in range(m0, T):
        Xi = Xs[:i]; bi = np.linalg.lstsq(Xi, ys[:i], rcond=None)[0]; xi = Xs[i]; den = 1 + xi @ np.linalg.inv(Xi.T @ Xi) @ xi; eh.append((ys[i] - xi @ bi) / np.sqrt(den))
    eh = np.array(eh); N = len(eh); bt, sse1 = lsq(Xs[m0:], eh); F = ((eh @ eh - sse1) / k) / (sse1 / (N - k)); out['tsay'] = {'F': float(F), 'p': float(stats.f.sf(F, k, N - k)), 'df2': N - k}
    # sup-F (orde sama pmax di dua rezim, sup atas semua d)
    mS = max(pmax, max(dlist)); Xp, yp = rows(y, pmax, mS); Tp = len(yp); kp = pmax + 1; mn = max(int(np.ceil(trim * Tp)), kp + 2); S0p = lsq(Xp, yp)[1]; bestS = np.inf
    for d in dlist:
        sp = thr_var(series, mS, d, Tp)
        for r in np.unique(sp):
            lo = sp <= r
            if lo.sum() < mn or Tp - lo.sum() < mn: continue
            v = lsq(Xp[lo], yp[lo])[1] + lsq(Xp[~lo], yp[~lo])[1]; bestS = min(bestS, v)
    out['supF'] = float(Tp * (S0p - bestS) / bestS)
    return out

ref = {}
ref['setar2'] = {'orders': [2, 1], 'dlist': [1, 2, 3, 4], 'trim': 0.15, **setar_ref(Y['setar'], None, [2, 1], [1, 2, 3, 4], 0.15, 2)}
ref['setar2_p2'] = {'orders': [2, 2], 'dlist': [2], 'trim': 0.15, **setar_ref(Y['setar'], None, [2, 2], [2], 0.15, 2)}
y3 = Y['setar'][:150]
ref['setar3'] = {'n': 150, 'orders': [1, 1, 1], 'dlist': [2], 'trim': 0.15, **setar_ref(y3, None, [1, 1, 1], [2], 0.15, 3)}
ref['tar'] = {'orders': [1, 2], 'dlist': [1, 2, 3], 'trim': 0.15, **setar_ref(Y['tar_y'], Y['tar_z'], [1, 2], [1, 2, 3], 0.15, 2)}

# ------------------------------ Terasvirta ------------------------------
def terasvirta_ref(y, p, d, dmax=3):
    m = max(p, dmax); X, yy = rows(y, p, m); T = len(yy); k = p + 1; s = thr_var(y, m, d, T); u = (s - s.mean()) / s.std(ddof=1)
    def cols(q):
        c = [X]
        for pw in range(1, q + 1):
            for j in range(1, p + 1): c.append((X[:, j] * u ** pw)[:, None])
        return np.hstack(c)
    sse = [lsq(cols(q), yy)[1] for q in range(4)]; df = lambda e: T - k - e * p
    Fg = ((sse[0] - sse[3]) / (3 * p)) / (sse[3] / df(3)); F4 = ((sse[2] - sse[3]) / p) / (sse[3] / df(3)); F3 = ((sse[1] - sse[2]) / p) / (sse[2] / df(2)); F2 = ((sse[0] - sse[1]) / p) / (sse[1] / df(1))
    return {'general': [float(Fg), float(stats.f.sf(Fg, 3 * p, df(3)))], 'h04': [float(F4), float(stats.f.sf(F4, p, df(3)))], 'h03': [float(F3), float(stats.f.sf(F3, p, df(2)))], 'h02': [float(F2), float(stats.f.sf(F2, p, df(1)))]}

# ---------------------------------- STAR ----------------------------------
def star_ref(y, p, d, form):
    m = max(p, d); W, yy = rows(y, p, m); T = len(yy); k = p + 1; s = thr_var(y, m, d, T); sbar = s.mean(); ssd = s.std(ddof=1); u = (s - sbar) / ssd; us = np.sort(u)
    G = (lambda g, c: 1 / (1 + np.exp(-g * (u - c)))) if form == 'lstar' else (lambda g, c: 1 - np.exp(-g * (u - c) ** 2))
    def lin_fit(g, c):
        Gv = G(g, c); Z = np.hstack([W, W * Gv[:, None]]); b = np.linalg.lstsq(Z, yy, rcond=None)[0]; return Z, b, yy - Z @ b
    lo = [np.log(1e-3), np.quantile(us, 0.05)]; hi = [np.log(1e3), np.quantile(us, 0.95)]
    best = None
    for g0 in [0.1, 0.3, 1, 3, 10, 30, 100]:
        for c0 in np.quantile(us, [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9]):
            try:
                r = least_squares(lambda x: lin_fit(np.exp(x[0]), x[1])[2], [np.log(g0), c0], bounds=(lo, hi), xtol=1e-14, ftol=1e-14, gtol=1e-14)
            except Exception: continue
            v = float((r.fun ** 2).sum())
            if best is None or v < best[0] - 1e-12: best = (v, r.x)
    sse, x = best; g = float(np.exp(x[0])); c = float(x[1]); Z, b, res = lin_fit(g, c)
    phi = b[:k]; theta = b[k:]
    def resid_full(par):
        ph, th, gg, cc = par[:k], par[k:2 * k], par[2 * k], par[2 * k + 1]; Gv = G(gg, cc); return yy - (W @ ph + (W @ th) * Gv)
    par0 = np.concatenate([phi, theta, [g, c]]); npar = len(par0); J = np.zeros((T, npar))
    for i in range(npar):
        h = 1e-6 * max(1.0, abs(par0[i])); pp = par0.copy(); pm = par0.copy(); pp[i] += h; pm[i] -= h; J[:, i] = -(resid_full(pp) - resid_full(pm)) / (2 * h)
    s2 = sse / (T - npar); cov = s2 * np.linalg.inv(J.T @ J); se = np.sqrt(np.diag(cov))
    seHigh = [float(np.sqrt(cov[j, j] + cov[k + j, k + j] + 2 * cov[j, k + j])) for j in range(k)]
    return {'p': p, 'd': d, 'form': form, 'T': T, 'sse': sse, 'gamma': g, 'cStd': c, 'c': float(sbar + ssd * c), 'phi': phi.tolist(), 'theta': theta.tolist(),
            'sePhi': se[:k].tolist(), 'seTheta': se[k:2 * k].tolist(), 'seGamma': float(se[2 * k]), 'seC': float(se[2 * k + 1] * ssd), 'seHigh': seHigh,
            'aic': aic(sse, T, npar), 'lin_sse': lsq(W, yy)[1]}
ref['lstar'] = star_ref(Y['lstar'], 1, 1, 'lstar')
ref['estar'] = star_ref(Y['estar'], 2, 1, 'estar')
ref['lstar_tests'] = {str(d): terasvirta_ref(Y['lstar'], 1, d, 3) for d in (1, 2, 3)}
ref['estar_tests'] = {str(d): terasvirta_ref(Y['estar'], 2, d, 3) for d in (1, 2, 3)}
json.dump(ref, open(os.path.join(here, 'ref_tar.json'), 'w'))
print('ok', {k: (round(v['sse'], 4) if 'sse' in v else '-') for k, v in ref.items()})
