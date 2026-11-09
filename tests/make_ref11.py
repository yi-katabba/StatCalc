"""Acuan independen untuk Q2 (blindfolding) dan PLSpredict di sem-core.js.
Jalankan: python3 tests/make_ref11.py   (butuh numpy)

Sengaja BUKAN salinan kode JS:
  - PLS (skema path/centroid, mode A) ditulis ulang dengan numpy dari nol (bobot awal = 1, toleransi 1e-13);
    JS memulai dari bobot data penuh dan toleransi 1e-8/1e-9;
  - benchmark LM memakai numpy.linalg.lstsq pada data MENTAH dengan intersep (JS: persamaan normal pada data baku);
  - pembagian lipatan memakai port PRNG mulberry32 + Fisher-Yates yang sama (agar lipatan identik), sisanya independen.
Keluaran: ref_pls_pred.json
"""
import json, os, numpy as np
here = os.path.dirname(os.path.abspath(__file__)); M32 = 0xFFFFFFFF
d = json.load(open(os.path.join(here, 'data_sem_sim.json'))); names = d['names']; X = np.array(d['X'], float)
col_order = ['a1','a2','a3','b1','b2','b3','c1','c2','c3','c4','z','w']      # urutan kolom unik seperti di plsData (menentukan pola omisi)
raw = np.column_stack([X[:, names.index(c)] for c in col_order]); n, K = raw.shape
cons = {'A': [0,1,2], 'B': [3,4,5], 'C': [6,7,8,9], 'z': [10], 'w': [11]}
cn = list(cons); mode_single = {'z': True, 'w': True}
edges = [('A','B'), ('A','C'), ('B','C'), ('C','z'), ('w','z')]           # (dari, ke)
pred = {c: [a for (a, b) in edges if b == c] for c in cn}; succ = {c: [b for (a, b) in edges if a == c] for c in cn}

def mulberry(seed):
    a = [seed & M32]
    def imul(x, y): return (x * y) & M32
    def f():
        a[0] = (a[0] + 0x6D2B79F5) & M32; t = a[0]
        t = imul(t ^ (t >> 15), t | 1); t = t ^ ((t + imul(t ^ (t >> 7), t | 61)) & M32)
        return ((t ^ (t >> 14)) & M32) / 4294967296.0
    return f

def std(v, ddof=1): return v.std(ddof=ddof)
def cov(a, b): return float(a @ b) / (len(a) - 1)

def pls(Z, scheme):
    nn = Z.shape[0]; W = {c: np.ones(len(ix)) for c, ix in cons.items()}; Y = {}
    def score(c):
        y = Z[:, cons[c]] @ W[c]; s = np.sqrt((y @ y) / (nn - 1)); W[c] = W[c] / s; Y[c] = y / s
    for c in cn: score(c)
    for it in range(2000):
        R = {(a, b): cov(Y[a], Y[b]) for a in cn for b in cn}; inner = {}
        for j in cn:
            z = np.zeros(nn)
            if scheme == 'path' and pred[j]:
                Rpp = np.array([[R[(a, b)] for b in pred[j]] for a in pred[j]]); rp = np.array([R[(a, j)] for a in pred[j]]); beta = np.linalg.solve(Rpp, rp)
            for k in pred[j] + succ[j]:
                if scheme == 'centroid': e = np.sign(R[(j, k)])
                elif scheme == 'path' and k in pred[j]: e = beta[pred[j].index(k)]
                else: e = R[(j, k)]
                z += e * Y[k]
            inner[j] = z / np.sqrt((z @ z) / (nn - 1))
        delta = 0.0
        for j in cn:
            if len(cons[j]) == 1: continue
            old = W[j].copy(); W[j] = np.array([cov(Z[:, k], inner[j]) for k in cons[j]]); score(j); delta = max(delta, np.abs(W[j] - old).max())
        if delta < 1e-13: break
    R = {(a, b): cov(Y[a], Y[b]) for a in cn for b in cn}; B = {}
    for j in cn:
        if pred[j]:
            Rpp = np.array([[R[(a, b)] for b in pred[j]] for a in pred[j]]); rp = np.array([R[(a, j)] for a in pred[j]]); B[j] = dict(zip(pred[j], np.linalg.solve(Rpp, rp)))
    return W, Y, B

def blind(scheme, D):
    acc = {c: [dict(ssoC=0, sseC=0, ssoR=0, sseR=0) for _ in cons[c]] for c in cn}
    for g in range(D):
        om = np.array([[(i + k) % D == g for k in range(K)] for i in range(n)]); Z = np.zeros((n, K)); mu = np.zeros(K); sd = np.zeros(K)
        for k in range(K):
            keep = ~om[:, k]; mu[k] = raw[keep, k].mean(); sd[k] = raw[keep, k].std(ddof=1); Z[keep, k] = (raw[keep, k] - mu[k]) / sd[k]
        W, Y, B = pls(Z, scheme)
        for c in cn:
            comm = len(cons[c]) > 1; red = len(pred[c]) > 0
            yh = sum(B[c][p] * Y[p] for p in pred[c]) if red else None
            for h, k in enumerate(cons[c]):
                lam = cov(Z[:, k], Y[c]); idx = np.where(om[:, k])[0]; x = raw[idx, k]
                if comm: a = acc[c][h]; a['sseC'] += ((x - (mu[k] + sd[k] * lam * Y[c][idx])) ** 2).sum(); a['ssoC'] += ((x - mu[k]) ** 2).sum()
                if red: a = acc[c][h]; a['sseR'] += ((x - (mu[k] + sd[k] * lam * yh[idx])) ** 2).sum(); a['ssoR'] += ((x - mu[k]) ** 2).sum()
    out = {}
    for c in cn:
        a = acc[c]; o = {}
        if len(cons[c]) > 1: o['comm'] = 1 - sum(x['sseC'] for x in a) / sum(x['ssoC'] for x in a); o['commInd'] = [1 - x['sseC'] / x['ssoC'] for x in a]
        if pred[c]: o['red'] = 1 - sum(x['sseR'] for x in a) / sum(x['ssoR'] for x in a); o['redInd'] = [1 - x['sseR'] / x['ssoR'] for x in a]
        out[c] = o
    return out

def predict(scheme, tech, F, R, seed):
    rnd = mulberry(seed); targets = [(c, h, k) for c in cn if pred[c] for h, k in enumerate(cons[c])]
    anc = {}
    def ancestors(c):
        if c not in anc: s = set()
        else: return anc[c]
        for p in pred[c]: s.add(p); s |= ancestors(p)
        anc[c] = s; return s
    topo = ['A', 'w', 'B', 'C', 'z']
    acc = {t: dict(rmse=0, mae=0, q2=0, lrmse=0, lmae=0) for t in targets}
    for r in range(R):
        perm = list(range(n))
        for i in range(n - 1, 0, -1):
            q = int(np.floor(rnd() * (i + 1))); perm[i], perm[q] = perm[q], perm[i]
        fold = np.zeros(n, int)
        for pos, idx in enumerate(perm): fold[idx] = pos % F
        P = {t: np.zeros(n) for t in targets}; PL = {t: np.zeros(n) for t in targets}; NV = {t: np.zeros(n) for t in targets}
        for f in range(F):
            tr = np.where(fold != f)[0]; te = np.where(fold == f)[0]
            mu = raw[tr].mean(0); sd = raw[tr].std(0, ddof=1); Ztr = (raw[tr] - mu) / sd; Zte = (raw[te] - mu) / sd
            W, Y, B = pls(Ztr, scheme); Yte = {c: Zte[:, cons[c]] @ W[c] for c in cn}
            Yh = dict(Yte)
            if tech == 'earliest':
                for c in topo:
                    if pred[c]: Yh[c] = sum(B[c][p] * Yh[p] for p in pred[c])
            for (c, h, k) in targets:
                lam = cov(Ztr[:, k], Y[c])
                yh = Yh[c] if tech == 'earliest' else sum(B[c][p] * Yte[p] for p in pred[c])
                P[(c, h, k)][te] = mu[k] + sd[k] * lam * yh; NV[(c, h, k)][te] = mu[k]
                ids = pred[c] if tech == 'direct' else sorted(a for a in ancestors(c) if not pred[a])
                cols = [kk for a in ids for kk in cons[a]]
                A = np.column_stack([np.ones(len(tr))] + [raw[tr, kk] for kk in cols]); coef = np.linalg.lstsq(A, raw[tr, k], rcond=None)[0]
                PL[(c, h, k)][te] = np.column_stack([np.ones(len(te))] + [raw[te, kk] for kk in cols]) @ coef
        for t in targets:
            y = raw[:, t[2]]; e = y - P[t]; el = y - PL[t]; en = y - NV[t]; a = acc[t]
            a['rmse'] += np.sqrt((e ** 2).mean()); a['mae'] += np.abs(e).mean(); a['q2'] += 1 - (e ** 2).sum() / (en ** 2).sum()
            a['lrmse'] += np.sqrt((el ** 2).mean()); a['lmae'] += np.abs(el).mean()
    return [dict(con=t[0], h=t[1], **{k: v / R for k, v in acc[t].items()}) for t in targets]

out = {'blind': {s: blind(s, 7) for s in ['path', 'centroid']}, 'blindD5': blind('path', 5),
       'predict': {f'{s}_{t}': predict(s, t, 5, 3, 42) for s in ['path'] for t in ['direct', 'earliest']}}
out['predict']['centroid_direct'] = predict('centroid', 'direct', 5, 3, 42)
json.dump(out, open(os.path.join(here, 'ref_pls_pred.json'), 'w'), indent=1); print('ok', list(out['predict']))
