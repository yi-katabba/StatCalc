"""Acuan untuk sem-core.js: CB-SEM (semopy, lavaan) dan PLS-SEM (plspm).
Jalankan: python3 tests/make_ref9.py   (butuh numpy, pandas, semopy, plspm)"""
import json, os, numpy as np, pandas as pd, semopy
import plspm.config as c
from plspm.plspm import Plspm
from plspm.scheme import Scheme
from plspm.mode import Mode
here = os.path.dirname(os.path.abspath(__file__))
sim = json.load(open(os.path.join(here, 'data_sem_sim.json')))
df = pd.DataFrame(sim['X'], columns=sim['names'])
out = {}
# ---- CB-SEM: model simulasi dengan galat berkorelasi + prediktor teramati ----
model = """A =~ a1 + a2 + a3
B =~ b1 + b2 + b3
C =~ c1 + c2 + c3 + c4
B ~ A
C ~ B + A
z ~ C + w
b1 ~~ b2"""
m = semopy.Model(model); m.fit(df, obj='MLW')
est = m.inspect(std_est=True)
st = semopy.calc_stats(m)
N = len(df)
out['cb'] = {'model': model, 'chi2_nm1': float(st['chi2'].iloc[0]), 'N': N,
             'params': [{'lhs': r['lval'], 'op': r['op'], 'rhs': r['rval'], 'est': float(r['Estimate']), 'std': float(r['Est. Std'])} for _, r in est.iterrows()]}
# ---- PLS-SEM: tiga skema ----
def run(scheme):
    st_ = c.Structure(); st_.add_path(['A'], ['B']); st_.add_path(['A', 'B'], ['C']); st_.add_path(['C', 'Wc'], ['Z'])
    cfg = c.Config(st_.path(), scaled=False)   # scaled=True memakai penskalaan nonmetrik plspm; data dibakukan sendiri (sd sampel, n-1)
    for lv, cols in [('A', ['a1', 'a2', 'a3']), ('B', ['b1', 'b2', 'b3']), ('C', ['c1', 'c2', 'c3', 'c4']), ('Z', ['z']), ('Wc', ['w'])]:
        cfg.add_lv(lv, Mode.A, *[c.MV(k) for k in cols])
    p = Plspm((df - df.mean()) / df.std(ddof=1), cfg, scheme, 500, 1e-12)
    om = p.outer_model(); pc = p.path_coefficients(); inn = p.inner_summary()
    iss = p.inner_model()
    res = {'weights': {i: float(r['weight']) for i, r in om.iterrows()}, 'loadings': {i: float(r['loading']) for i, r in om.iterrows()},
           'communality': {i: float(r['communality']) for i, r in om.iterrows()},
           'paths': {}, 'r2': {}}
    for to in pc.index:
        for fr in pc.columns:
            if abs(pc.loc[to, fr]) > 0: res['paths'][fr + '>' + to] = float(pc.loc[to, fr])
    for i, r in inn.iterrows(): res['r2'][i] = float(r['r_squared'])
    return res
out['pls'] = {'path': run(Scheme.PATH), 'centroid': run(Scheme.CENTROID), 'factorial': run(Scheme.FACTORIAL)}
json.dump(out, open(os.path.join(here, 'ref_sem.json'), 'w'), indent=1)
print('ok')
